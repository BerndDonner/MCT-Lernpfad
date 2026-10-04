# MCT-Lernpfad Viewer

Kleiner lokaler Viewer für den MCT-Lernpfad.

## Start

Im Verzeichnis:

```bash
python3 -m http.server 8765 --bind 127.0.0.1
```

Dann in Chromium:

```text
http://127.0.0.1:8765/
```

Oder als eigenes App-Fenster:

```bash
chromium --app=http://127.0.0.1:8765/
```

Standardmäßig wird `mct-lernpfad.md` geladen.

Ein anderes Markdown-Dokument:

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

Dadurch werden die SVGs als eigene Dokumente geladen. Sie können das gemeinsame
`diagrams/diagram-theme.css`, lokale Fonts und bei Bedarf JavaScript verwenden.
Die konkrete Höhe wird passend zum jeweiligen `viewBox` gesetzt.

## Diagramm-Fonts

Einmalig aus dem Repo-Root:

```bash
./scripts/fetch-diagram-fonts.sh
```

Das Skript legt Inter 4.1 und JetBrains Mono 2.304 samt Lizenzdateien unter
`fonts/` ab. Die SVGs verwenden diese lokalen Dateien und fallen nur dann auf
Systemfonts zurück, wenn die Dateien fehlen.

## Absichtliche Einschränkung

Der Viewer rendert Raw HTML absichtlich unverändert, damit `<object>` möglich ist.
Deshalb nur vertrauenswürdige Markdown-Dateien damit öffnen.

Der eingebaute Markdown-Renderer ist bewusst klein und deckt zunächst nur den
Subset ab, den der MCT-Lernpfad aktuell braucht. Er kann später ohne Änderung
am Dokumentformat durch markdown-it/marked ersetzt werden.
