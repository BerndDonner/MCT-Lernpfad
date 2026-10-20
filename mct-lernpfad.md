# Grundwissen

- Die Ascii-Tabelle (Steuerzeichen, Ziffern, Buchstaben alphabetisch geordent,
  keine Umlaute)

- Zwischen Binär- und Hex-Zahlen kann man  blockweise umrechnen.
  
  |Binär|Hexadezimal|Binär|Hexadezimal|
  |:---:|:----------:|:---:|:----------:|
  |`0000`|`0`|`1000`|`8`|
  |`0001`|`1`|`1001`|`9`|
  |`0010`|`2`|`1010`|`A`|
  |`0011`|`3`|`1011`|`B`|
  |`0100`|`4`|`1100`|`C`|
  |`0101`|`5`|`1101`|`D`|
  |`0110`|`6`|`1110`|`E`|
  |`0111`|`7`|`1111`|`F`|

# Git

## Commands / VS-Code-Schaltflächen

|git-Befehl    |Beschreibung                                               |
|:-------------|:----------------------------------------------------------|
|`git commit`  |staged Dateien mit einer sinnvollen Message committen      |
|`git push`    |Arbeit auf Forgejo veröffentlichen                         |
|`git upmaster`|neue Änderungen vom `master` holen                         |

## Workflow

> Herr Donner arbeitet nur auf dem Branch `master` im Verzeichnis `donner`.
>
> Schüler:
> - zu Beginn der Stunde `git upmaster`
> - arbeiten nur im eigenen Branch und im eigenen Verzeichnis.
> - am Ende der Stunde einen commit aller Änderungen und ein push

<!-- begin UE:5 add -->
## Worktrees und Commits

<object
  data="diagrams/git-commit-snapshot-diff.svg"
  type="image/svg+xml"
  width="100%"
  height="720">
</object>
<!-- end -->

# C++ allgemein

<!-- begin UE:1 add -->
## Definitionen und Datentypen

Eine Variable darf nur einmal definiert werden.

```cpp
uint8_t a = 0xaf;   // Definition von a und Initialisierung mit einer hex-Zahl 
a = 0b10101111;     // Zuweisung einer bin-Zahl
```
<!-- end -->

<!-- begin UE:2 add -->
## sizeof

Mit `sizeof` kann man herausfinden, wie viele Bytes ein Datentyp oder eine
Variable im Speicher belegt.

```cpp
uint8_t a = 42;

Serial.println(sizeof(uint8_t));    // 1 Byte
Serial.println(sizeof(uint16_t));   // 2 Bytes
Serial.println(sizeof(a));          // 1 Bytes
```

|Datentypen     |Größe in Bytes   |Wertebereich
|:--------------|:----------------|:-----------
|`uint8_t`      |1                |0...255
|`int8_t`       |1                |-128... 127
|`uint16_t`     |2                |0...65 535
|`int16_t`      |2                |-32 768...32 767
|`uint32_t`     |4                |0...4 294 967 295
|`int32_t`      |4                |-2 147 483 648...2 147 483 647
|`int`          |2 oder 4         |wie int16_t oder int32_t
|`unsigned int` |2 oder 4         |wie uint16_t oder uint32_t
|`char`         |1                |alle ASCII-Zeichen
|`bool`         |1                |true, false

<!-- begin UE:3 add -->
## Ganzzahlen mit Vorzeichen - Zweierkomplement

### 8 Bit: `uint8_t` und `int8_t`

|Bitmuster|`uint8_t`|`int8_t`|
|:--------|---------:|-------:|
|`0000 0000`|0|0|
|`0000 0001`|1|1|
|`0000 0010`|2|2|
|`0000 0011`|3|3|
|…|…|…|
|`0111 1111`|127|127|
|`1000 0000`|128|-128|
|`1000 0001`|129|-127|
|`1000 0010`|130|-126|
|…|…|…|
|`1111 1111`|255|-1|

### 16 Bit: `uint16_t` und `int16_t`

|Bitmuster|`uint16_t`|`int16_t`|
|:--------|----------:|--------:|
|`0000 0000 0000 0000`|0|0|
|`0000 0000 0000 0001`|1|1|
|`0000 0000 0000 0010`|2|2|
|…|…|…|
|`0111 1111 1111 1111`|32767|32767|
|`1000 0000 0000 0000`|32768|-32768|
|`1000 0000 0000 0001`|32769|-32767|
|`1000 0000 0000 0010`|32770|-32766|
|…|…|…|
|`1111 1111 1111 1111`|65535|-1|

Der wichtigste Zusammenhang lautet für alle Ganzzahltypen:

```text
-a = ~a + 1
```
### Überlauf bei vorzeichenlosen Zählern

<object
  data="diagrams/unsigned-overflow.svg"
  type="image/svg+xml"
  width="100%"
  height="330">
  Überlauf eines 8-Bit-Zählers
</object>

```cpp
uint8_t start = 0xFF;
uint8_t ende  = 0x03;

uint8_t delta = static_cast<uint8_t>(ende - start); //delta ist 4, trotz Überlauf!!!
```

<!-- end -->

## Implizite und explizite Typkonvertierungen

Zwischen den elementaren Datentypen erlaubt C/C++ leider sehr viele implizite
Typkonvertierungen – auch solche, bei denen Information verloren gehen
kann.

Müssen wir einen Wert gezielt in einen anderen Datentyp umwandeln, verwenden
wir static_cast.

```cpp
char c = 'A';

Serial.println(c);                            // A
Serial.println(static_cast<uint8_t>(c));      // 65
Serial.println(static_cast<uint8_t>(c), BIN); // 1000001
```
<!-- end -->

## Funktionen

Wir erkennen Funktionen an dem Muster: Text unmittelbar gefolgt von einer
runden Klammer auf.

<!-- begin UE:3 add -->
Eigene Funktionen können genauso erstellt werden. Damit eigene Funktionen
ausgeführt werden müssen diese allerding explizit aufgerufen werden.
Funktionen sind hervorragend dazu geeignet ein Programm in logische Einheiten
zu zerlegen.
<!-- end -->


```cpp
<!-- begin UE:3 add -->
void ausgabe() {                  // Definition einer eigenen Funktionen
  Serial.println("Hallo Welt!");
}


<!-- end -->
void setup() {                    // setup ist eine Funktion
  Serial.begin(115200);           // begin ist eine Funktion
<!-- begin UE:3 add -->
  ausgabe();                      // Aufruf der eigenen Funktion
<!-- end -->
}
```

## Tabs und Newlines

```cpp
Serial.print("Hex\tBinär\tZeichen\n"); // '\t' ist ein Tabulator
                                       // '\n' ist eine Newline
```

## for-Schleife

```cpp
for (uint8_t i = 0; i < 10; ++i) { // starte mit..; solange .. mache {..}; pro Durchlauf..
  // Diese Codezeilen werden pro Durchlauf ausgeführt.
  Serial.println(i);
}

// Wird erst ausgeführt, wenn die Bedingung false ist.
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

<object
  data="diagrams/setup-loop.svg"
  type="image/svg+xml"
  width="100%"
  height="390">
  Ablauf von setup() und loop()
</object>

## Serielle Ausgabe

```cpp
void setup() {
  Serial.begin(115200);          // Initialisierung von Serial
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

<!-- begin UE:2 add -->
## Liste einiger bereits verwendeter Funktionen

```cpp
pinMode(2, INPUT_PULLUP);       //notwendig, um einen Taster an Pin 2 anzuschließen
uint16_t rawX = analogRead(A0); //einlesen eines analogen Wertes (0-1023) vom Pin A0
```
<!-- end -->

<!-- begin UE:3 add -->
## Bitoperationen

<object
  data="diagrams/bitoperationen-masken.svg"
  type="image/svg+xml"
  width="100%"
  height="760">
  Bitoperationen mit Masken
</object>

Der Operator `~` invertiert jedes Bit.

Kurzschreibweise:

```cpp
value += mask;  //value = value + mask;
value /= mask;  //value = value / mask;
value &= mask;  //value = value & mask;
value |= mask;  //value = value | mask;
value ^= mask;  //value = value ^ mask;
```

> [!WARNING]
> Verwechseln Sie die **Bitoperatoren** `~`, `&`, `|`, `^` nicht mit den
> **logischen Operatoren** `!`, `&&`, `||`.

<!-- end -->

<!-- begin UE:4 add -->
<object
  data="diagrams/left-shift.svg"
  type="image/svg+xml"
  width="100%"
  height="760">
  Left Shift
</object>
<!-- end -->


# Mikrocontroller

<!-- begin UE:1 add -->
## Grundlagen

- Ein Byte sind 8 Bits
- Ein Mikrocontroller arbeitet nur mit Bytes nicht mit Bits
- Im Speicher liegen keine Zahlen, Buchstaben oder Texte, sondern nur Bitmuster

<object
  data="diagrams/daten-intern-extern.svg"
  type="image/svg+xml"
  width="100%"
  height="360">
  Eingabe, Bitmuster in den Speicherbytes und Ausgabe
</object>
<!-- end -->

## Modell des Microcontrollers

<object
  data="diagrams/microcontroller-modell.svg"
  type="image/svg+xml"
  width="100%"
  height="220">
  CPU und Speicher
</object>
