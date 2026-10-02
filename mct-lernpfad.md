# Git

## Commands / VS-Code-Schaltflächen

`git commit` – staged Dateien mit einer sinnvollen Message committen  
`git push` – Arbeit auf Forgejo veröffentlichen  
`git upmaster` – neue Änderungen vom `master` holen

## Workflow

> [!Achtung]
> Herr Donner arbeitet nur auf dem Branch `master` im Verzeichnis `donner`.
Schüler arbeiten nur im eigenen Branch und im eigenen Verzeichnis.

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
Serial.begin(115200);          // Initialisierung
Serial.print("1. ");           // Ausgabe ohne neue Zeile
Serial.println("Hallo Welt!"); // Ausgabe mit neuer Zeile
```

# Unser aktuelles Modell des Mikrocontrollers

![CPU und Speicher](diagrams/microcontroller-modell.svg)

<object
  data="diagrams/git-commit-snapshot-diff.svg"
  type="image/svg+xml"
  width="100%"
  height="720">
</object>
