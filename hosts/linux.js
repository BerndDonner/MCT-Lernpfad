// Linux/WebKitGTK host adapter.
// viewer/main.c injects __MCT_LINUX_HOST and provides the viewerLoadText bridge.

if (window.__MCT_LINUX_HOST &&
    window.webkit?.messageHandlers?.viewerLoadText) {
  const config = window.__MCT_LINUX_HOST;

  window.viewerHost = {
    kind: "linux-webkitgtk",
    documentPath: config.documentPath,
    projectBaseUrl: config.projectBaseUrl,

    loadText(path) {
      return window.webkit.messageHandlers.viewerLoadText.postMessage(path);
    },

    async loadBinary(path) {
      const encoded = await window.webkit.messageHandlers.viewerLoadBinary.postMessage(path);
      const raw = atob(encoded);
      const bytes = new Uint8Array(raw.length);
      for (let i = 0; i < raw.length; ++i) bytes[i] = raw.charCodeAt(i);
      return bytes;
    },

    saveArchive(filename, bytes) {
      // WebKit-Script-Bridge transportiert Strings, keine Blob-/ArrayBuffer-Werte.
      // Batches verhindern einen Stackoverflow durch riesige apply()-Aufrufe.
      let binary = "";
      for (let i = 0; i < bytes.length; i += 8192) {
        binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
      }
      return window.webkit.messageHandlers.viewerSaveArchive.postMessage(
        `${filename}\n${btoa(binary)}`
      );
    },

    resolveUrl(path) {
      return new URL(path, config.projectBaseUrl).href;
    }
  };
}
