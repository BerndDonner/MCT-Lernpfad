# Exporte des MCT-Lernpfads

Zwei voneinander unabhängige Workflows:

- `viewer-export.js`: Wie bisher **eine ausgewählte UE als ZIP** exportieren,
  gestartet über den Button im Viewer. Dieser Export kann bei interaktiven
  Diagrammen einen sichtbaren Snapshot erstellen.
- `export-diagrams.py`: **Alle statischen SVGs** aus `../diagrams/` ohne
  Viewer/Browser nach `diagrams/` exportieren. SVGs mit Skripten oder
  Event-Handlern werden **nicht exportiert**. Keine Snapshots.

Das Verzeichnis `export/diagrams/` ist generiert und wird von Git ignoriert.
Die Original-SVGs unter `../diagrams/` werden nie überschrieben.

## Statische SVGs exportieren

Aus dem Repository-Root in der vorhandenen Nix-Dev-Shell:

```bash
python export/export-diagrams.py
```

Der Export bettet die referenzierten lokalen CSS-Dateien ein, entfernt
`@font-face`-Deklarationen mit externen Font-Dateien und erhält die
transparenten Flächen sowie die hell/dunkel adaptiven CSS-Farbrollen für
die VS-Code-Markdown-Vorschau. SVGs mit nicht sicher
auflösbaren externen Abhängigkeiten werden als Fehler gemeldet. Scheitert die
Validierung einer statischen SVG, wird **keine** Ausgabedatei aktualisiert.

Bei jedem erfolgreichen Lauf werden alle statischen Ausgabedateien neu
überschrieben und nicht mehr exportierbare SVG-Dateien im Ausgabeordner
entfernt. Änderungen werden nicht inkrementell verglichen.

## Diagramme in die Kurs-Repositories verteilen

```bash
python export/distribute-diagrams.py
```

Das Skript verwendet `diagram-targets.json`: Pro Quelldateiname gibt es eine
Liste **vollständiger, repository-relativer Zieldateipfade**. Die
Repository-Wurzeln sind dort derzeit für `MCT_E3A` und `MCT_I3A` unter
`/home/bernd/GitHub/NixOS-Bunny/repos/` eingestellt. Bei einem Umzug müssen
nur diese beiden Einträge angepasst werden.

Es werden nur Dateien unter `donner/` geschrieben, niemals Schülerkopien.
Jede konfigurierte SVG wird ohne Inhaltsvergleich überschrieben. Fehlende
`diagrams/`-Unterordner einer bereits bestehenden UE können angelegt werden;
sonstige fehlende Zielverzeichnisse, Symlinks und ungültige Pfade führen zu
einem Abbruch **vor** dem Kopieren. Das Skript führt weder `git commit` noch
`git push` aus.

## Zielkonfiguration prüfen und interaktiv ergänzen

```bash
python export/distribute-diagrams.py --check
python export/distribute-diagrams.py --fix
```

`--check` untersucht **nur die aktuell ausgecheckten** `donner/`-Bäume in
E3A und I3A, nicht andere Branches oder Schülerverzeichnisse. Es gleicht
folgende Informationen ab:

- vorhandene `*.svg`-Dateien,
- lokale SVG-Bildreferenzen in Markdown (`![...](...)`, `<img src=...>`,
  `<object data=...>` sowie Link-Referenzdefinitionen),
- konfigurierte Zielpfade in `diagram-targets.json`.

Dadurch werden auch Referenzen auf **noch fehlende SVG-Dateien** erkannt.
`--check` meldet nicht konfigurierte SVG-Ziele, fehlende Zieldateien und
fehlende exportierte Quelldateien. Bei Abweichungen ist der Exitcode 1.
Eine fehlende Zieldatei bei bereits bestehender Zuordnung wird beim nächsten
normalen Verteilungslauf wiederhergestellt; sie wird **nicht** automatisch aus
der Konfiguration entfernt.

`--fix` zeigt dieselben Befunde an und bietet **jede ergänzbare Zuordnung**
einzeln mit `[j/N]` zur Bestätigung an. Nur bestätigte Ergänzungen werden in
`diagram-targets.json` gespeichert. `--fix` löscht keine Zuordnungen und
schreibt, löscht oder verteilt keinerlei SVG-Dateien. Für neue Einträge muss
die entsprechende statische Datei bereits in `export/diagrams/` vorhanden
sein; deshalb zuerst `export-diagrams.py` ausführen. Der Standard ist „Nein“.

Neue Diagramme ohne vorhandene SVG-Datei und ohne Markdown-Referenz kann
`--check` nicht erraten. Sie können bei Bedarf manuell in die JSON-Datei
eingetragen werden. Die beiden ersten Skripte verwenden nur die
Python-Standardbibliothek, es werden keine neuen Flake-Abhängigkeiten benötigt.
