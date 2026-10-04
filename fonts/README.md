# Diagramm-Fonts

Die SVG-Diagramme verwenden zwei lokal abgelegte variable Fonts:

- Inter 4.1
- JetBrains Mono 2.304

Die Binärdateien werden nicht im Patch mitgeliefert. Einmalig aus dem Repo-Root ausführen:

```bash
./scripts/fetch-diagram-fonts.sh
```

Danach liegen hier:

- `InterVariable.ttf`
- `JetBrainsMonoVariable.ttf`
- die jeweiligen Lizenzdateien

Die SVGs referenzieren ausschließlich diese lokalen Dateien; Systemfonts dienen nur als Fallback,
falls die Fonts noch nicht geholt wurden.
