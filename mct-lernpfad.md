# git

## commands/VS-Code Schaltflächen
git commit   (nachdem Sie in VS-Code ihre veränderten Dateien zu stageing
              hinzugefügt haben, müssen Sie diese dateien mit einer sinnvollen
			  message committen)
git push     (dadurch veröffentlichen Sie die Arbeit auf forgejo)
git upmaster (nachdem Sie ihre Arbeit commited und gepushed haben, holen sie so
              die neuen Änderungen vom master branch)

## workflow

Herr Donner arbeitet nur im master branch im Verzeichnis donner.
Schüler Anton Wurzelsepp arbeitet nur in seinem eigenen Branch wurzelsepp im
Verzeichnis wurzelsepp. D.h. Anton darf niemals Dateien im Verzeichnis donner
verändern. Stattdessen kopiert er die Datei in das Verzeichnis wurzelsepp und
kann dort mit der Datei machen was er möchte.

# c++ allgemein:

## Funktionen

Wir erkennen Funktionen an dem Muster: text unmittelbar gefolgt von einer
runden Klammer auf.

```c++
void setup() {          //setup ist Funktionen
  Serial.begin(115200); //begin ist Funktion
}
````

## Tabs und Newlines

```c++
Serial.print("Hex\tBinär\tZeichen\n"); // '\t' ist ein Tabulator
                                       // '\n' ist eine newline
```


## for Schleife:

for (uint8_t i = 0; i < 10; ++i)  //Start; Abbruchbedingung; wird ausgeführt pro Durchlauf
{
	// diese codezeilen werden pro durchlauf der Schleife ausgeführt
	Serial.println(i);
}
//diese codezeilen werden erst ausgeführt, denn die abbruchbedingung false ist.
Serial.println("Ende der Schleife");

# c++ speziell nur für den Arduino: 

## Programmstruktur

```c++
void setup() { //wird nur einmal aufgerufen
               //Reset erzwingt einen nochmaligen Aufruf
}

void loop() { //die Funktion loop wird immer wieder aufgerufen
              //bis der microcontoller von der Spannung getrennt wird,
			  //oder ein reset erfolgt.
}
```

## Die Serielle Ausgabe:

```c++
Serial.begin(115200);          //initialisierung
Serial.print("1. ");           //Ausgabe ohne neue Zeile
Serial.println("Hallo Welt!"); //Ausgabe mit neuer Zeile
```


# Unser aktuelles Modell des Microcontrollers

CPU <--> Speicher(2048bytes)

