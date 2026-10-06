# Bitoperationen, Zahlendarstellung und Zweierkomplement

> [!NOTE]
> Dieses Dokument ist ein **Entwurf**. Es überträgt ältere Tafel-/Screenshot-Notizen in den Stil des MCT-Lernpfads und ist bewusst noch nicht in `mct-lernpfad.md` eingebaut.

## Binär und Hexadezimal

Ein Hexadezimalzeichen beschreibt genau **vier Bits**. Deshalb lässt sich zwischen Binär- und Hexadezimalschreibweise blockweise umrechnen.

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

Beispiel:

```text
1011 0110₂ = B6₁₆
```

### Aufgaben

1. Wandeln Sie ohne Taschenrechner um:
   - `0b00101101` → Hexadezimal
   - `0b11110000` → Hexadezimal
   - `0x3A` → Binär
   - `0xC7` → Binär
2. Wie viele Hexadezimalstellen benötigt man für einen `uint8_t`? Wie viele für einen `uint16_t`?
3. Erklären Sie, warum sich Hexadezimalzahlen für Registerwerte besser lesen lassen als lange Binärzahlen.

## Bitweise Operatoren

Bitoperationen bearbeiten **jedes Bit einzeln**. Die beiden Eingangswerte werden Bit für Bit miteinander verknüpft.

|`a`|`b`|`a & b`|<code>a &#124; b</code>|`a ^ b`|
|:-:|:-:|:-----:|:------:|:-----:|
|0|0|0|0|0|
|0|1|0|1|1|
|1|0|0|1|1|
|1|1|1|1|0|

<object
  data="diagrams/bitoperationen-masken.svg"
  type="image/svg+xml"
  width="100%"
  height="760">
  Bitoperationen mit Masken
</object>

### UND `&`: Bits ausschalten

Bei einer UND-Maske gilt:

- Maskenbit `0` → das Ergebnisbit wird `0`
- Maskenbit `1` → das ursprüngliche Bit bleibt erhalten

```cpp
uint8_t value = 0b10110110;
uint8_t mask  = 0b11110000;

value = value & mask;  // 0b10110000
```

Kurzschreibweise:

```cpp
value &= mask;
```

### ODER `|`: Bits einschalten

Bei einer ODER-Maske gilt:

- Maskenbit `1` → das Ergebnisbit wird `1`
- Maskenbit `0` → das ursprüngliche Bit bleibt erhalten

```cpp
uint8_t value = 0b10110010;
uint8_t mask  = 0b00001101;

value = value | mask;  // 0b10111111
```

Kurzschreibweise:

```cpp
value |= mask;
```

### XOR `^`: Bits umschalten

Bei einer XOR-Maske gilt:

- Maskenbit `1` → das Bit wird umgeschaltet: `0 → 1`, `1 → 0`
- Maskenbit `0` → das ursprüngliche Bit bleibt erhalten

```cpp
uint8_t value = 0b10110010;
uint8_t mask  = 0b11110000;

value = value ^ mask;  // 0b01000010
```

Kurzschreibweise:

```cpp
value ^= mask;
```

### NICHT `~`: alle Bits umdrehen

Der Operator `~` invertiert jedes Bit:

```text
  0010 1101
~ ---------
  1101 0010
```

Bei Rechnungen mit kleinen Integer-Typen wie `uint8_t` führt C++ intern Typumwandlungen durch. Wenn ausdrücklich wieder ein 8-Bit-Wert benötigt wird, schreiben Sie zum Beispiel:

```cpp
uint8_t a = 0b00101101;
uint8_t inverted = static_cast<uint8_t>(~a);
```

### Aufgaben

1. Berechnen Sie jeweils das Ergebnis als Binärzahl:

   ```text
   1010 0110 & 1111 0000
   1010 0110 | 0000 1111
   1010 0110 ^ 1111 0000
   ~1010 0110
   ```

2. Geben Sie eine Maske an, mit der Sie in einem Byte
   - die unteren drei Bits löschen,
   - Bit 7 einschalten,
   - Bit 2 umschalten.
3. Ein Register enthält

   ```text
   1011 0110
   ```

   Die Bits 5 und 4 sollen gelöscht werden, **alle anderen Bits müssen unverändert bleiben**. Formulieren Sie die Operation in C++.
4. Ein Register enthält vier Konfigurationsbits im oberen Nibble. Setzen Sie diese vier Bits auf `0101`, ohne das untere Nibble zu verändern. Überlegen Sie ein Vorgehen aus **Löschen** und anschließendem **Setzen**.

## Bitoperationen sind keine logischen Operatoren

> [!WARNING]
> Verwechseln Sie die **Bitoperatoren** `~`, `&`, `|`, `^` nicht mit den **logischen Operatoren** `!`, `&&`, `||`.

Logische Operatoren behandeln einen ganzen Ausdruck als Wahrheitswert. In C/C++ gilt:

- `0` ist `false`
- jeder Wert ungleich `0` ist `true`

Beispiel:

```cpp
7 || 3
```

Beide Operanden sind ungleich null:

```text
true || true → true
```

Als Zahl entspricht `true` dem Wert `1`.

Das bitweise ODER arbeitet dagegen wirklich mit den einzelnen Bits:

```text
  0111
| 0011
------
  0111
```

also:

```cpp
7 | 3   // Ergebnis: 7
```

### Aufgaben

Bestimmen Sie jeweils zuerst, **ob logisch oder bitweise** gerechnet wird, und danach das Ergebnis:

```cpp
0 || 4
2 && 7
7 | 3
7 & 3
7 ^ 3
!7
~7
```

> [!NOTE]
> Bei `~7` hängt die dezimale Ausgabe vom verwendeten Integer-Typ ab. Zeichnen Sie deshalb zunächst das gewünschte Bitmuster und achten Sie auf den Datentyp.

# Vorzeichenbehaftete und vorzeichenlose Bitmuster

Im Speicher liegt zunächst nur ein **Bitmuster**. Der Datentyp bestimmt, wie dieses Bitmuster als Zahl interpretiert wird.

## 8 Bit: `uint8_t` und `int8_t`

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

Dasselbe Bitmuster kann also abhängig vom Datentyp eine andere Zahl bedeuten.

## 16 Bit: `uint16_t` und `int16_t`

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

### Aufgaben

1. Interpretieren Sie das Bitmuster `1111 1110`
   - als `uint8_t`,
   - als `int8_t`.
2. Interpretieren Sie `1000 0000 0000 0011`
   - als `uint16_t`,
   - als `int16_t`.
3. Welches Bit entscheidet bei einer Zweierkomplementzahl darüber, ob die Zahl negativ ist?
4. Warum kann ein `int8_t` nur bis `127` gehen, obwohl ein Byte 256 verschiedene Bitmuster besitzt?

# Zweierkomplement

C/C++ verwendet für vorzeichenbehaftete Ganzzahlen auf unseren Systemen die Zweierkomplementdarstellung.

Der wichtigste Zusammenhang lautet für ein festes Bitmuster:

```text
-a = ~a + 1
```

Um aus einer positiven Zahl ihr negatives Gegenstück zu bilden:

1. alle Bits umdrehen (`~`),
2. anschließend `1` addieren.

Beispiel mit 8 Bit, aus `5` wird `-5`:

```text
  0000 0101    +5
  1111 1010    alle Bits invertieren
+         1
-----------
  1111 1011    -5
```

Zur Kontrolle kann man die Operation noch einmal durchführen:

```text
  1111 1011    -5
  0000 0100    invertieren
+         1
-----------
  0000 0101    +5
```

> [!MERKSATZ]
> Bei einer N-Bit-Zweierkomplementzahl hat das höchstwertige Bit das Gewicht `-2^(N-1)`. Alle übrigen Bits haben ihre normalen positiven Zweierpotenzen.

Für 8 Bit bedeutet das:

```text
Bit:       7    6    5    4    3    2    1    0
Gewicht: -128   64   32   16    8    4    2    1
```

Damit lässt sich zum Beispiel direkt lesen:

```text
1111 1011 = -128 + 64 + 32 + 16 + 8 + 0 + 2 + 1 = -5
```

### Aufgaben

1. Bilden Sie mit `~a + 1` die 8-Bit-Zweierkomplementdarstellung von
   - `1`,
   - `17`,
   - `42`,
   - `127`.
2. Welche Dezimalzahlen werden durch folgende `int8_t`-Bitmuster dargestellt?
   - `1111 1111`
   - `1111 1110`
   - `1000 0000`
   - `1101 0110`
3. Bestimmen Sie `-204` als **12-Bit-Zweierkomplementzahl**. Diese Aufgabe wird später beim Beschleunigungssensor wieder benötigt.
4. Erklären Sie, warum es bei 8 Bit zwar `-128`, aber kein `+128` als `int8_t` gibt.

# Überlauf bei vorzeichenlosen Zählern

Ein `uint8_t` hat 8 Bit und damit 256 Zustände. Nach `255` folgt wieder `0`.

<object
  data="diagrams/unsigned-overflow.svg"
  type="image/svg+xml"
  width="100%"
  height="330">
  Überlauf eines 8-Bit-Zählers
</object>

Mathematisch wird bei einem N-Bit-Unsigned-Wert **modulo `2^N`** gerechnet. Für 8 Bit also modulo 256.

Das ist bei frei laufenden Hardware-Zählern nützlich: Auch wenn der Zähler zwischen zwei Messungen überläuft, kann der Abstand bestimmt werden.

```cpp
uint8_t start = 0xFF;
uint8_t ende  = 0x03;

uint8_t delta = static_cast<uint8_t>(ende - start);
```

`delta` enthält anschließend `4`:

```text
0xFF → 0x00 → 0x01 → 0x02 → 0x03
        1       2       3       4
```

> [!IMPORTANT]
> Kleine Integer-Typen wie `uint8_t` werden in C++ bei Rechnungen häufig zunächst zu `int` erweitert. Im Beispiel sorgt das Speichern bzw. der `static_cast<uint8_t>` dafür, dass das Ergebnis wieder als 8-Bit-Unsigned-Wert interpretiert wird. Verlassen Sie sich nicht darauf, dass jeder Zwischenausdruck automatisch bereits auf 8 Bit überläuft.

### Aufgaben

1. Ein `uint8_t`-Zähler startet bei `0xFC` und steht später bei `0x04`. Wie viele Schritte sind vergangen?
2. Zeichnen Sie die Folge eines 4-Bit-Unsigned-Zählers von `0xD` über den Überlauf bis `0x3`.
3. Ein 16-Bit-Timer startet bei `0xFFFA` und wird bei `0x0005` erneut gelesen. Bestimmen Sie die vergangene Anzahl von Timerschritten **modulo 65536**.
4. Erklären Sie, warum ein Überlauf bei einem vorzeichenlosen Zähler nicht automatisch bedeutet, dass eine Zeitdifferenzmessung falsch wird.

# Verbindung zum LIS3DH-Treiber

Die bisherigen Werkzeuge werden im Sensortreiber direkt benötigt:

- `<<` verschiebt das High-Byte an seine richtige Position.
- `|` setzt High- und Low-Byte zu einem gemeinsamen Bitmuster zusammen.
- `>>` verschiebt linksbündige Sensordaten an die richtige Stelle.
- Zweierkomplement macht aus dem Rohbitmuster einen positiven oder negativen Messwert.
- `&` mit einer Maske liest oder löscht bestimmte Registerbits.
- `|` setzt bestimmte Registerbits, ohne die übrigen Bits zu verändern.
- `~` hilft beim Löschen eines Bitfeldes: `reg & ~mask`.

Diese Operationen sind kein Selbstzweck: Sie sind das Werkzeug, mit dem Sie Informationen aus einem Datenblatt in funktionierenden Treibercode übersetzen.

## Abschlussaufgabe vor dem Sensor

Gegeben sei ein 8-Bit-Konfigurationsregister:

```text
Bit:       7   6   5   4   3   2   1   0
Inhalt:    1   0   1   1   0   1   1   0
                └───┬───┘
                  Feld F
```

Das Feld `F` liege auf den Bits 5 und 4.

1. Erstellen Sie eine Maske für das Feld `F`.
2. Löschen Sie nur dieses Feld und erhalten Sie alle anderen Bits.
3. Setzen Sie anschließend `F = 01`.
4. Schreiben Sie die beiden Schritte als C++-Code mit `&`, `~` und `|`.
5. Vergleichen Sie dieses Vorgehen später mit `CTRL_REG4` des LIS3DH.
