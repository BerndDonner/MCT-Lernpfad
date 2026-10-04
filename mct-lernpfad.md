# Git

## Commands / VS-Code-Schaltflächen

|git-Befehl    |Beschreibung                                               |
|:-------------|:----------------------------------------------------------|
|`git commit`  |staged Dateien mit einer sinnvollen Message committen      |
|`git push`    |Arbeit auf Forgejo veröffentlichen                         |
|`git upmaster`|neue Änderungen vom `master` holen                         |

## Workflow


> Herr Donner arbeitet nur auf dem Branch `master` im Verzeichnis `donner`.
> Schüler:
> - zu Beginn der Stunde `git upmaster`
> - arbeiten nur im eigenen Branch und im eigenen Verzeichnis.
> - am Ende der Stunde einen commit aller Änderungen und ein push

# C++ allgemein

<!-- begin UE:1 add -->
## Deklarationen, Definitionen und Datentypen

uint8_t a = 0xaf; //Angabe einer Hex-Zahl bei der Definition
a = 0b10101111; //bin-Zahl
<!-- end -->

## Funktionen

Wir erkennen Funktionen an dem Muster: Text unmittelbar gefolgt von einer
runden Klammer auf.

```cpp
void setup() {          // setup ist eine Funktion
  Serial.begin(115200); // begin ist eine Funktion
}
```

## Tabs und Newlines

```cpp
Serial.print("Hex\tBinär\tZeichen\n"); // '\t' ist ein Tabulator
                                         // '\n' ist eine Newline
```

## for-Schleife

```cpp
for (uint8_t i = 0; i < 10; ++i) { // Start; Abbruchbedingung; pro Durchlauf
  // Diese Codezeilen werden pro Durchlauf ausgeführt.
  Serial.println(i);
}

// Wird erst ausgeführt, wenn die Abbruchbedingung false ist.
Serial.println("Ende der Schleife");
```

# C++ auf dem Arduino

## Programmstruktur

```cpp
void setup() {
}

void loop() {
}
```

![Ablauf von setup() und loop()](diagrams/setup-loop.svg)

## Serielle Ausgabe

```cpp
void setup() {
  Serial.begin(115200);          // Initialisierung
  Serial.print("1. ");           // Ausgabe ohne neue Zeile
  Serial.println("Hallo Welt!"); // Ausgabe mit neuer Zeile
<!-- begin UE:1 add -->
  Serial.println(43, HEX);       // Ausgabe von 43 als hex-Zahl - ohne führende Nullen
  Serial.println(43, BIN);       // Ausgabe von 43 als bin-Zahl - ohne führende Nullen
<!-- end -->
}
```

<!-- begin UE:1 add -->
Für Ausgaben mit führenden Nullen gibt es:
```cpp
#include "donner.h"

void setup() {
  Serial.begin(115200);
  printHex(43);      
  printHexNice(43);  //mit Präfix und Gruppierung 
  printBin(43);
  printBinNice(43);  //mit Präfix und Gruppierung
}
```

Alle vier Funktionen gibt es auch als Newline Variante mit ln (printlnHex)

<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="430" viewBox="0 0 1200 430">
  <defs>
    <marker id="arrow" markerWidth="12" markerHeight="12" refX="10" refY="6" orient="auto" markerUnits="strokeWidth">
      <path d="M 0 0 L 12 6 L 0 12 z" fill="#333"/>
    </marker>
    <style>
      .title {
        font-family: Arial, Helvetica, sans-serif;
        font-size: 22px;
        font-weight: bold;
        fill: #111;
      }
      .subtitle {
        font-family: Arial, Helvetica, sans-serif;
        font-size: 20px;
        font-weight: bold;
        fill: #111;
      }
      .label {
        font-family: Arial, Helvetica, sans-serif;
        font-size: 18px;
        fill: #111;
      }
      .mono {
        font-family: "Courier New", Courier, monospace;
        font-size: 22px;
        fill: #111;
      }
      .mono-small {
        font-family: "Courier New", Courier, monospace;
        font-size: 18px;
        fill: #111;
      }
      .memory-bit {
        font-family: "Courier New", Courier, monospace;
        font-size: 24px;
        font-weight: bold;
        fill: #111;
      }
      .box {
        fill: #ffffff;
        stroke: #222;
        stroke-width: 2;
      }
      .arrow-line {
        stroke: #333;
        stroke-width: 3;
        fill: none;
        marker-end: url(#arrow);
      }
      .guide {
        stroke: #ddd;
        stroke-width: 1;
      }
    </style>
  </defs>

  <!-- Spaltenüberschriften -->
  <text x="140" y="55" class="title" text-anchor="middle">EINGABE</text>
  <text x="600" y="55" class="title" text-anchor="middle">MIKROCONTROLLER</text>
  <text x="1035" y="55" class="title" text-anchor="middle">AUSGABE</text>

  <!-- Unterüberschriften -->
  <text x="140" y="100" class="subtitle" text-anchor="middle">unser Code</text>
  <text x="600" y="100" class="subtitle" text-anchor="middle">Bitmuster in den Speicherbytes</text>
  <text x="1035" y="100" class="subtitle" text-anchor="middle">Darstellung</text>

  <!-- Pfeile oben -->
  <line x1="240" y1="92" x2="455" y2="92" class="arrow-line"/>
  <line x1="745" y1="92" x2="920" y2="92" class="arrow-line"/>

  <!-- optionale Hilfslinien für Zeilenausrichtung -->
  <line x1="55" y1="160" x2="1140" y2="160" class="guide"/>
  <line x1="55" y1="215" x2="1140" y2="215" class="guide"/>
  <line x1="55" y1="270" x2="1140" y2="270" class="guide"/>
  <line x1="55" y1="325" x2="1140" y2="325" class="guide"/>

  <!-- Linke Spalte: verschiedene Schreibweisen -->
  <text x="110" y="167" class="mono">0b01000001</text>
  <text x="110" y="222" class="mono">65</text>
  <text x="110" y="277" class="mono">0x41</text>
  <text x="110" y="332" class="mono">'A'</text>

  <!-- Mittlere Spalte: ein Byte im Speicher -->
  <rect x="500" y="135" width="200" height="70" rx="6" ry="6" class="box"/>
  <text x="600" y="180" class="memory-bit" text-anchor="middle">01000001</text>

  <!-- Kleiner Hinweis unter dem Byte -->
  <text x="600" y="230" class="mono-small" text-anchor="middle">1 Byte</text>

  <!-- Rechte Spalte: jeweilige Darstellung -->
  <text x="980" y="167" class="mono">01000001</text>
  <text x="980" y="222" class="mono">65</text>
  <text x="980" y="277" class="mono">41</text>
  <text x="980" y="332" class="mono">A</text>
</svg>
<!-- end -->




# Mikrocontroller

<!-- begin UE:1 add -->
## Grundlagen

- Ein Byte sind 8 Bits
- Ein Mikrocontroller arbeitet nur mit Bytes nicht mit Bits
- Im Speicher liegen keine Zahlen, Buchstaben oder Texte, sondern nur Bitmuster<!-- end -->

## Modell des Microcontrollers

![CPU und Speicher](diagrams/microcontroller-modell.svg)

<object
  data="diagrams/git-commit-snapshot-diff.svg"
  type="image/svg+xml"
  width="100%"
  height="720">
</object>
