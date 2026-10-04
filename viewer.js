// MCT-Lernpfad Viewer
// Markdown wird zentral mit markdown-it gerendert. Browser und Linux-Viewer
// benutzen dadurch exakt dieselbe Rendering-Logik.
// Raw HTML ist absichtlich erlaubt, damit <object> interaktive SVGs laden kann.

const content = document.querySelector("#content");
const statusEl = document.querySelector("#status");
const reloadButton = document.querySelector("#reload");

const host = window.viewerHost;
if (!host) {
  throw new Error("Kein Viewer-Host verfügbar.");
}

if (typeof window.markdownit !== "function") {
  throw new Error(
    "markdown-it fehlt. Bitte `nix run .#update-viewer-deps` ausführen."
  );
}

const markdown = window.markdownit({
  html: true,
  linkify: false,
  typographer: false,
  breaks: false,
});

const documentPath = host.documentPath || "mct-lernpfad.md";

function escapeHtml(s) {
  return s.replaceAll("&", "&amp;")
          .replaceAll("<", "&lt;")
          .replaceAll(">", "&gt;");
}

function enhanceAlerts(root) {
  const alertKinds = {
    IMPORTANT: { className: "alert-important", title: "Wichtig" },
    WARNING: { className: "alert-important", title: "Achtung" },
    MERKSATZ: { className: "alert-merksatz", title: "Merksatz" },
    NOTE: { className: "", title: "Hinweis" },
  };

  for (const quote of root.querySelectorAll("blockquote")) {
    const first = quote.firstElementChild;
    if (!first || first.tagName !== "P") continue;

    const marker = first.textContent.match(
      /^\[!(IMPORTANT|MERKSATZ|WARNING|NOTE)\](?:\s|$)/i
    );
    if (!marker) continue;

    const kind = marker[1].toUpperCase();
    const config = alertKinds[kind];

    // markdown-it lässt den Zeilenumbruch innerhalb eines Absatzes als
    // Whitespace stehen. Der Marker ist deshalb auch im innerHTML am Anfang
    // unverändert vorhanden; Inline-Markup im restlichen Absatz bleibt erhalten.
    first.innerHTML = first.innerHTML
      .replace(/^\[!(IMPORTANT|MERKSATZ|WARNING|NOTE)\](?:[ \t]*(?:\r?\n|<br\s*\/?>))?/i, "")
      .replace(/^\s+/, "");

    if (!first.textContent.trim() && !first.querySelector("*")) {
      first.remove();
    }

    quote.classList.add("alert");
    if (config.className) quote.classList.add(config.className);

    const title = document.createElement("span");
    title.className = "alert-title";
    title.textContent = config.title;
    quote.prepend(title);
  }
}

function resolveEmbeddedResources(root) {
  const attributes = [
    ["img[src]", "src"],
    ["object[data]", "data"],
    ["iframe[src]", "src"],
    ["source[src]", "src"]
  ];

  for (const [selector, attribute] of attributes) {
    for (const element of root.querySelectorAll(selector)) {
      const value = element.getAttribute(attribute);
      if (!value || value.startsWith("#") ||
          /^(?:data|blob|javascript):/i.test(value)) {
        continue;
      }
      element.setAttribute(attribute, host.resolveUrl(value));
    }
  }
}

async function loadDocument() {
  statusEl.textContent = "Lade …";
  try {
    const md = await host.loadText(documentPath);
    content.innerHTML = markdown.render(md);
    enhanceAlerts(content);
    resolveEmbeddedResources(content);
    document.title = `MCT-Lernpfad – ${documentPath}`;
    statusEl.textContent = documentPath;
  } catch (err) {
    content.innerHTML =
      `<div class="error"><strong>Dokument konnte nicht geladen werden.</strong><br>${escapeHtml(String(err))}</div>`;
    statusEl.textContent = "Fehler";
  }
}

reloadButton.addEventListener("click", loadDocument);
loadDocument();
