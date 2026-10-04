# Vendored Viewer Dependencies

Die Dateien in diesem Verzeichnis werden reproduzierbar über Nix aktualisiert:

```bash
nix run .#update-viewer-deps
```

Aktuell wird `markdown-it` 15.0.2 verwendet. `markdown-it.min.js` und die
zugehörige Lizenzdatei werden bewusst ins Repository committed, damit Browser,
Linux-Viewer und später weitere Hosts ohne npm, CDN oder Netzwerkzugriff zur
Laufzeit exakt denselben Parser verwenden.
