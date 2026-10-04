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

    resolveUrl(path) {
      return new URL(path, config.projectBaseUrl).href;
    }
  };
}
