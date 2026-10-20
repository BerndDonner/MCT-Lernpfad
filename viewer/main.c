#include <gtk/gtk.h>
#include <gio/gio.h>
#include <jsc/jsc.h>
#include <webkit/webkit.h>

#include <stdlib.h>
#include <string.h>

typedef struct {
  gchar *project_root;
  gchar *document_name;
  gchar *shell_dir;
} ViewerState;

static gboolean
path_is_inside_root(const gchar *root, const gchar *path)
{
  if (g_strcmp0(root, path) == 0)
    return TRUE;

  g_autofree gchar *prefix = g_strconcat(root, G_DIR_SEPARATOR_S, NULL);
  return g_str_has_prefix(path, prefix);
}

static gboolean
on_load_text(WebKitUserContentManager *manager,
             JSCValue *value,
             WebKitScriptMessageReply *reply,
             gpointer user_data)
{
  (void)manager;
  ViewerState *state = user_data;

  if (!jsc_value_is_string(value)) {
    webkit_script_message_reply_return_error_message(
      reply, "viewerLoadText erwartet einen relativen Dateipfad.");
    return TRUE;
  }

  g_autofree gchar *requested = jsc_value_to_string(value);
  if (g_path_is_absolute(requested)) {
    webkit_script_message_reply_return_error_message(
      reply, "Absolute Pfade sind im Viewer-Host nicht erlaubt.");
    return TRUE;
  }

  g_autofree gchar *full_path =
    g_canonicalize_filename(requested, state->project_root);

  if (!path_is_inside_root(state->project_root, full_path)) {
    webkit_script_message_reply_return_error_message(
      reply, "Der angeforderte Pfad liegt außerhalb des Projekts.");
    return TRUE;
  }

  g_autofree gchar *contents = NULL;
  g_autoptr(GError) error = NULL;

  if (!g_file_get_contents(full_path, &contents, NULL, &error)) {
    webkit_script_message_reply_return_error_message(reply, error->message);
    return TRUE;
  }

  JSCContext *context = jsc_value_get_context(value);
  JSCValue *result = jsc_value_new_string(context, contents);
  webkit_script_message_reply_return_value(reply, result);
  g_object_unref(result);
  return TRUE;
}

// Bilddateien werden für das offline nutzbare Markdown-ZIP auch binär
// benötigt (PNG/JPEG). SVG und CSS können weiterhin loadText benutzen.
static gboolean
on_load_binary(WebKitUserContentManager *manager,
               JSCValue *value,
               WebKitScriptMessageReply *reply,
               gpointer user_data)
{
  (void)manager;
  ViewerState *state = user_data;
  if (!jsc_value_is_string(value)) {
    webkit_script_message_reply_return_error_message(reply, "Dateipfad erwartet.");
    return TRUE;
  }
  g_autofree gchar *requested = jsc_value_to_string(value);
  if (g_path_is_absolute(requested)) {
    webkit_script_message_reply_return_error_message(reply, "Absolute Pfade sind nicht erlaubt.");
    return TRUE;
  }
  g_autofree gchar *full_path = g_canonicalize_filename(requested, state->project_root);
  if (!path_is_inside_root(state->project_root, full_path)) {
    webkit_script_message_reply_return_error_message(reply, "Datei liegt außerhalb des Projekts.");
    return TRUE;
  }
  g_autofree gchar *contents = NULL;
  gsize length = 0;
  g_autoptr(GError) error = NULL;
  if (!g_file_get_contents(full_path, &contents, &length, &error)) {
    webkit_script_message_reply_return_error_message(reply, error->message);
    return TRUE;
  }
  g_autofree gchar *encoded = g_base64_encode((const guchar *)contents, length);
  JSCValue *result = jsc_value_new_string(jsc_value_get_context(value), encoded);
  webkit_script_message_reply_return_value(reply, result);
  g_object_unref(result);
  return TRUE;
}

typedef struct {
  WebKitScriptMessageReply *reply;
  JSCContext *context;
  GBytes *data;
} ArchiveSave;

static void
archive_save_free(ArchiveSave *request)
{
  g_bytes_unref(request->data);
  g_object_unref(request->context);
  webkit_script_message_reply_unref(request->reply);
  g_free(request);
}

static void
on_archive_save_response(GtkNativeDialog *dialog, gint response, gpointer user_data)
{
  ArchiveSave *request = user_data;
  if (response == GTK_RESPONSE_ACCEPT) {
    g_autoptr(GFile) file = gtk_file_chooser_get_file(GTK_FILE_CHOOSER(dialog));
    gsize length = 0;
    const gchar *data = g_bytes_get_data(request->data, &length);
    g_autoptr(GError) error = NULL;
    if (file && g_file_replace_contents(file, data, length, NULL, FALSE,
                                         G_FILE_CREATE_NONE, NULL, NULL, &error)) {
      JSCValue *result = jsc_value_new_boolean(request->context, TRUE);
      webkit_script_message_reply_return_value(request->reply, result);
      g_object_unref(result);
    } else {
      webkit_script_message_reply_return_error_message(
        request->reply, error ? error->message : "Kein Ziel ausgewählt.");
    }
  } else {
    webkit_script_message_reply_return_error_message(request->reply, "Speichern abgebrochen.");
  }
  g_object_unref(dialog);
  archive_save_free(request);
}

static gboolean
on_save_archive(WebKitUserContentManager *manager,
                JSCValue *value,
                WebKitScriptMessageReply *reply,
                gpointer user_data)
{
  (void)manager;
  GtkWindow *window = user_data;
  if (!jsc_value_is_string(value)) {
    webkit_script_message_reply_return_error_message(reply, "ZIP-Nutzdaten fehlen.");
    return TRUE;
  }
  g_autofree gchar *payload = jsc_value_to_string(value);
  gchar *separator = strchr(payload, '\n');
  if (!separator) {
    webkit_script_message_reply_return_error_message(reply, "Ungültige ZIP-Nutzdaten.");
    return TRUE;
  }
  *separator = '\0';
  if (!*payload || strchr(payload, '/') || strchr(payload, '\\') ||
      !g_str_has_suffix(payload, ".zip")) {
    webkit_script_message_reply_return_error_message(reply, "Ungültiger ZIP-Dateiname.");
    return TRUE;
  }
  gsize length = 0;
  guchar *decoded = g_base64_decode(separator + 1, &length);
  if (!decoded || length < 22) {
    g_free(decoded);
    webkit_script_message_reply_return_error_message(reply, "ZIP-Archiv ist leer oder beschädigt.");
    return TRUE;
  }
  ArchiveSave *request = g_new0(ArchiveSave, 1);
  request->reply = webkit_script_message_reply_ref(reply);
  request->context = g_object_ref(jsc_value_get_context(value));
  request->data = g_bytes_new_take(decoded, length);

  GtkFileChooserNative *dialog = gtk_file_chooser_native_new(
    "Markdown-ZIP exportieren", window, GTK_FILE_CHOOSER_ACTION_SAVE,
    "_Speichern", "_Abbrechen");
  gtk_file_chooser_set_current_name(GTK_FILE_CHOOSER(dialog), payload);
  g_signal_connect(dialog, "response", G_CALLBACK(on_archive_save_response), request);
  gtk_native_dialog_show(GTK_NATIVE_DIALOG(dialog));
  return TRUE;
}

static gchar *
project_base_uri(const gchar *project_root)
{
  g_autoptr(GError) error = NULL;
  gchar *uri = g_filename_to_uri(project_root, NULL, &error);
  if (!uri) {
    g_printerr("Projektpfad kann nicht in URI umgewandelt werden: %s\n",
               error->message);
    return NULL;
  }

  if (g_str_has_suffix(uri, "/"))
    return uri;

  gchar *with_slash = g_strconcat(uri, "/", NULL);
  g_free(uri);
  return with_slash;
}

static gchar *
build_host_bootstrap(const ViewerState *state)
{
  g_autofree gchar *base_uri = project_base_uri(state->project_root);
  if (!base_uri)
    return NULL;

  g_autofree gchar *doc_js = g_strescape(state->document_name, NULL);
  g_autofree gchar *base_js = g_strescape(base_uri, NULL);

  return g_strdup_printf(
    "window.__MCT_LINUX_HOST = Object.freeze({"
    "documentPath: \"%s\", "
    "projectBaseUrl: \"%s\""
    "});",
    doc_js, base_js);
}

static void
activate(GtkApplication *app, gpointer user_data)
{
  ViewerState *state = user_data;

  // Diagnosemodus: SVG unmittelbar in WebKitGTK laden, ohne Markdown-Viewer,
  // <object>-Einbettung, Zoom- oder Export-JavaScript.
  if (g_str_has_suffix(state->document_name, ".svg")) {
    g_autofree gchar *svg_path =
      g_build_filename(state->project_root, state->document_name, NULL);
    g_autoptr(GError) error = NULL;
    g_autofree gchar *svg_uri = g_filename_to_uri(svg_path, NULL, &error);
    if (!svg_uri) {
      g_printerr("SVG-Pfad kann nicht geöffnet werden: %s\n", error->message);
      g_application_quit(G_APPLICATION(app));
      return;
    }

    GtkWidget *window = gtk_application_window_new(app);
    gtk_window_set_title(GTK_WINDOW(window), "MCT-Lernpfad – SVG-Test");
    gtk_window_set_default_size(GTK_WINDOW(window), 1280, 900);
    GtkWidget *web_view = webkit_web_view_new();
    gtk_window_set_child(GTK_WINDOW(window), web_view);
    webkit_web_view_load_uri(WEBKIT_WEB_VIEW(web_view), svg_uri);
    gtk_window_present(GTK_WINDOW(window));
    return;
  }

  WebKitUserContentManager *manager = webkit_user_content_manager_new();
  g_signal_connect(manager,
                   "script-message-with-reply-received::viewerLoadText",
                   G_CALLBACK(on_load_text), state);
  g_signal_connect(manager,
                   "script-message-with-reply-received::viewerLoadBinary",
                   G_CALLBACK(on_load_binary), state);

  if (!webkit_user_content_manager_register_script_message_handler_with_reply(
        manager, "viewerLoadText", NULL)) {
    g_printerr("WebKit Message-Handler konnte nicht registriert werden.\n");
    g_object_unref(manager);
    g_application_quit(G_APPLICATION(app));
    return;
  }

  if (!webkit_user_content_manager_register_script_message_handler_with_reply(
        manager, "viewerLoadBinary", NULL)) {
    g_printerr("Binary-Handler konnte nicht registriert werden.\n");
    g_object_unref(manager);
    g_application_quit(G_APPLICATION(app));
    return;
  }

  g_autofree gchar *bootstrap = build_host_bootstrap(state);
  if (!bootstrap) {
    g_object_unref(manager);
    g_application_quit(G_APPLICATION(app));
    return;
  }

  WebKitUserScript *script = webkit_user_script_new(
    bootstrap,
    WEBKIT_USER_CONTENT_INJECT_TOP_FRAME,
    WEBKIT_USER_SCRIPT_INJECT_AT_DOCUMENT_START,
    NULL,
    NULL);
  webkit_user_content_manager_add_script(manager, script);
  webkit_user_script_unref(script);

  GtkWidget *web_view = g_object_new(
    WEBKIT_TYPE_WEB_VIEW,
    "user-content-manager", manager,
    NULL);
  g_object_unref(manager);

  GtkWidget *window = gtk_application_window_new(app);
  gtk_window_set_title(GTK_WINDOW(window), "MCT-Lernpfad");
  gtk_window_set_default_size(GTK_WINDOW(window), 1280, 900);
  gtk_window_set_child(GTK_WINDOW(window), web_view);
  g_signal_connect(manager,
                   "script-message-with-reply-received::viewerSaveArchive",
                   G_CALLBACK(on_save_archive), window);
  if (!webkit_user_content_manager_register_script_message_handler_with_reply(
        manager, "viewerSaveArchive", NULL)) {
    g_printerr("Save-Handler konnte nicht registriert werden.\n");
    gtk_window_destroy(GTK_WINDOW(window));
    g_application_quit(G_APPLICATION(app));
    return;
  }

  g_autofree gchar *index_path =
    g_build_filename(state->shell_dir, "index.html", NULL);
  g_autoptr(GError) error = NULL;
  g_autofree gchar *index_uri = g_filename_to_uri(index_path, NULL, &error);

  if (!index_uri) {
    g_printerr("Viewer-Shell kann nicht geladen werden: %s\n", error->message);
    gtk_window_destroy(GTK_WINDOW(window));
    g_application_quit(G_APPLICATION(app));
    return;
  }

  webkit_web_view_load_uri(WEBKIT_WEB_VIEW(web_view), index_uri);
  gtk_window_present(GTK_WINDOW(window));
}

static gchar *
find_shell_dir(void)
{
  const gchar *env = g_getenv("MCT_VIEWER_SHELL_DIR");
  if (env && *env)
    return g_canonicalize_filename(env, NULL);

  g_autofree gchar *cwd = g_get_current_dir();
  g_autofree gchar *index_path = g_build_filename(cwd, "index.html", NULL);
  if (g_file_test(index_path, G_FILE_TEST_IS_REGULAR))
    return g_strdup(cwd);

  return NULL;
}

static gboolean
init_state(ViewerState *state, int argc, char **argv)
{
  const gchar *document_arg = argc > 1 ? argv[1] : "mct-lernpfad.md";
  g_autofree gchar *document_path =
    g_canonicalize_filename(document_arg, NULL);

  if (!g_file_test(document_path, G_FILE_TEST_IS_REGULAR)) {
    g_printerr("Datei nicht gefunden: %s\n", document_path);
    return FALSE;
  }

  state->project_root = g_path_get_dirname(document_path);
  state->document_name = g_path_get_basename(document_path);

  // Für den reinen SVG-Test ist keine HTML-/Markdown-Shell erforderlich.
  if (g_str_has_suffix(state->document_name, ".svg"))
    return TRUE;

  state->shell_dir = find_shell_dir();
  if (!state->shell_dir) {
    g_printerr(
      "Viewer-Shell nicht gefunden. Starte aus dem Repo-Root oder setze "
      "MCT_VIEWER_SHELL_DIR.\n");
    return FALSE;
  }

  return TRUE;
}

static void
clear_state(ViewerState *state)
{
  g_clear_pointer(&state->project_root, g_free);
  g_clear_pointer(&state->document_name, g_free);
  g_clear_pointer(&state->shell_dir, g_free);
}

int
main(int argc, char **argv)
{
  ViewerState state = {0};
  if (!init_state(&state, argc, argv)) {
    clear_state(&state);
    return EXIT_FAILURE;
  }

  GtkApplication *app = gtk_application_new(
    "org.meisterk.mct_lernpfad",
    G_APPLICATION_NON_UNIQUE);
  g_signal_connect(app, "activate", G_CALLBACK(activate), &state);

  char *app_argv[] = { argv[0], NULL };
  int status = g_application_run(G_APPLICATION(app), 1, app_argv);
  g_object_unref(app);
  clear_state(&state);
  return status;
}
