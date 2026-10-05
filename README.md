# MCT-Lernpfad Viewer

Der Lernpfad verwendet eine gemeinsame, neutrale Viewer-Shell aus `index.html`,
`viewer.js` und `viewer.css`. Nur der Zugriff auf die Markdown-Datei ist
plattformabhängig:

- `hosts/browser.js` lädt sie im Browser über HTTP.
- `viewer/main.c` stellt unter Linux einen nativen Host für WebKitGTK bereit.

Dadurch verwenden Browser und Linux-Viewer denselben Markdown-Renderer, dieselben
Styles und dieselben SVG-Diagramme. Das eigentliche Markdown-Parsing übernimmt
`markdown-it`; Viewer-spezifische Nachbearbeitung wie `IMPORTANT` und `MERKSATZ`
bleibt in `viewer.js`. C++-/Arduino-Fences (` ```cpp `, ` ```arduino ` usw.)
erhalten dort außerdem ein kleines lokales Syntax-Highlighting ohne zusätzliche
Browser-Abhängigkeit.

## Viewer-Abhängigkeiten aktualisieren

`markdown-it` wird nicht über npm installiert und nicht von einem CDN geladen.
Die gepinnte Browser-Datei wird reproduzierbar über Nix nach `vendor/` kopiert:

```bash
nix run .#update-viewer-deps
```

Danach die erzeugten Dateien direkt zu Git hinzufügen und mit committen:

```bash
git add vendor/markdown-it.min.js vendor/LICENSE.markdown-it
```

Das `git add` ist auch vor einem Test mit `nix build` oder `nix run` nötig, weil
Flakes ungetrackte Dateien nicht in `self` aufnehmen. So verwenden Browser,
Linux-Viewer und später weitere Hosts exakt dieselbe lokale Parser-Version.

## Linux-Viewer

Die Flake unterstützt zunächst nur `x86_64-linux`.

Entwicklungsumgebung:

```bash
nix develop
```

Bauen:

```bash
nix build
```

Den Lernpfad aus dem Repo-Root anzeigen:

```bash
nix run
```

Oder eine andere Markdown-Datei öffnen:

```bash
nix run . -- path/to/datei.md
```

Der Linux-Viewer besteht nur aus einer kleinen GTK4/WebKitGTK-Hülle. Die
Viewer-Shell wird aus dem Nix-Paket geladen; Markdown und relative Ressourcen
wie `diagrams/*.svg` werden dagegen aus dem Verzeichnis der geöffneten
Markdown-Datei gelesen.

Beim lokalen Kompilieren innerhalb von `nix develop` kann die Shell direkt aus
dem Repo-Root verwendet werden:

```bash
meson setup build
meson compile -C build
./build/mct-viewer
```

## Browser-Viewer

Python bleibt absichtlich in der Development-Shell, damit die Darstellung
jederzeit in einem normalen Browser gegengeprüft werden kann.

Im Repo-Root:

```bash
./serve.sh
```

Dann öffnen:

```text
http://127.0.0.1:8765/
```

Oder als eigenes Chromium-Fenster:

```bash
chromium --app=http://127.0.0.1:8765/
```

Standardmäßig wird `mct-lernpfad.md` geladen. Ein anderes Dokument kann über
`?doc=...` gewählt werden:

```text
http://127.0.0.1:8765/?doc=demo-interaktiv.md
```

## SVG-Diagramme einbetten

Die Diagramme werden grundsätzlich als `<object>` eingebettet:

```html
<object
  data="diagrams/setup-loop.svg"
  type="image/svg+xml"
  width="100%"
  height="390">
  Ablauf von setup() und loop()
</object>
```

Der Viewer löst relative Bild-, Object- und Iframe-URLs gegen das Verzeichnis
der geöffneten Markdown-Datei auf. Dadurch funktionieren dieselben Dokumente
im Browser und im nativen Linux-Viewer.

## Diagramm-Fonts

Einmalig aus dem Repo-Root:

```bash
./scripts/fetch-diagram-fonts.sh
```

Das Skript legt Inter 4.1 und JetBrains Mono 2.304 samt Lizenzdateien unter
`fonts/` ab. Die SVGs verwenden diese lokalen Dateien und fallen nur dann auf
Systemfonts zurück, wenn die Dateien fehlen.

## Absichtliche Einschränkung

Das Markdown wird mit dem lokal vendorten `markdown-it` gerendert. Raw HTML bleibt
absichtlich aktiviert, damit `<object>` und die interaktiven SVG-Diagramme
funktionieren. Deshalb nur vertrauenswürdige Markdown-Dateien damit öffnen.
