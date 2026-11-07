# bmibund – Webseite des fiktiven BMIH

> **Fiktives Rollenspiel.** Webseite des „Bundesministeriums für Inneres und Heimat“
> im Rollenspiel „Bundestag Fiktiv“ (Kabinett Gauland I, Minister Dr. Niels Fiedel).
> Kein Angebot der Bundesregierung; Personen, Parteien und Maßnahmen sind erfunden.

Statisches Frontend ohne Build-Schritt:

- `index.html` – Startseite mit Maßnahmenplan (Filter nach Phase und Status), Minister, Schwerpunkten, Pressemitteilungen
- `admin.html` – Verwaltung (nur dunkel, `assets/admin-nacht.css`): Cockpit mit „Heute wichtig“, Maßnahmen-Board
  (Ziehen zwischen den Spalten ändert den Status), Terminkalender, Presse-Editor mit Live-Vorschau und Bildauswahl,
  Postfach mit Antworten und Bürgerdialog, Schnellsuche mit Strg+K (`assets/admin-plus.js`)
- `buergerdialog.html` – öffentlich beantwortete Fragen (nur mit Zustimmung im Kontaktformular, Vorname + Anfangsbuchstabe)
- `data/*.json` – statische Kopie der Daten, falls das Backend nicht erreichbar ist

Die Daten kommen live aus dem Backend unter `/api/...`
(Repo [bmibund_privat](https://github.com/TitanDevWorks/bmibund_privat)), das diese Seite auch ausliefert.

Lokal ansehen:

```bash
python3 -m http.server 8080
```

## Pressefotos

Bilder von Minister Dr. Niels Fiedel liegen unter `assets/presse/fiedel/`, die Liste mit Titel, Thema
und Stichworten in `data/pressefotos.json`. Je Bild gibt es drei Dateien:
`<id>.jpg` (Download, bis 1920 px), `<id>.webp` (Webseite) und `<id>-s.webp` (Vorschau).

- Seite `pressefotos.html`: alle Bilder nach Thema, Großansicht, Bildunterschrift und JPG-Download.
- Pressemitteilungen bekommen automatisch ein passendes Bild über die Stichworte
  (z. B. „Verfassungsschutz“ → Bild vor dem BfV). Ein festes Bild geht über das Feld `bild` mit der Bild-ID.
- Neues Bild aufnehmen: `python3 tools/pressefoto.py <datei> <id> <thema> "<Titel>" --en "<title>" --tags "a,b"`
  (Themen: portraet, bundestag, ministerium, presse, sicherheit, einsatz, migration, vorort, berlin).

Alle Bilder sind KI-generierte, fiktive Szenen für das Rollenspiel.
