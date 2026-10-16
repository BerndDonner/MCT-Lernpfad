// Browser host for the neutral MCT-Lernpfad viewer shell.
// A native host may define window.viewerHost before this script runs.

if (!window.viewerHost) {
  const params = new URLSearchParams(window.location.search);
  const requestedDocument = params.get("doc") || "mct-lernpfad.md";
  const documentUrl = new URL(requestedDocument, window.location.href);
  const projectBaseUrl = new URL("./", documentUrl).href;
  const documentPath = documentUrl.pathname.split("/").pop() || "mct-lernpfad.md";

  window.viewerHost = {
    kind: "browser",
    documentPath,
    projectBaseUrl,

    async loadText(path) {
      const url = new URL(path, projectBaseUrl);
      url.searchParams.set("t", Date.now().toString());

      const response = await fetch(url, { cache: "no-store" });
      if (!response.ok) {
        throw new Error(`${response.status} ${response.statusText}`);
      }
      return response.text();
    },

    async loadBinary(path) {
      const response = await fetch(new URL(path, projectBaseUrl), { cache: "no-store" });
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
      return new Uint8Array(await response.arrayBuffer());
    },

    async saveArchive(filename, bytes) {
      const url = URL.createObjectURL(new Blob([bytes], { type: "application/zip" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.append(link);
      link.click();
      link.remove();
      // Der Browser übernimmt die Daten asynchron nach dem Klick.
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    },

    resolveUrl(path) {
      return new URL(path, projectBaseUrl).href;
    }
  };
}
