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
<!-- end -->

# Mikrocontroller

<!-- begin UE:1 add -->
## Grundlagen

- Ein Byte sind 8 Bits
- Ein Mikrocontroller arbeitet nur mit Bytes nicht mit Bits
- Im Speicher liegen keine Zahlen, Buchstaben oder Texte, sondern nur Bitmuster
<!-- end -->

## Modell des Microcontrollers

![CPU und Speicher](diagrams/microcontroller-modell.svg)

<object
  data="diagrams/git-commit-snapshot-diff.svg"
  type="image/svg+xml"
  width="100%"
  height="720">
</object>
