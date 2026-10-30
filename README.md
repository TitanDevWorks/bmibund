# bmibund – Webseite des fiktiven BMIH

> **Fiktives Rollenspiel.** Webseite des „Bundesministeriums für Inneres und Heimat“
> im Rollenspiel „Bundestag Fiktiv“ (Kabinett Gauland I, Minister Dr. Niels Fiedel).
> Kein Angebot der Bundesregierung; Personen, Parteien und Maßnahmen sind erfunden.

Statisches Frontend ohne Build-Schritt:

- `index.html` – Startseite mit Maßnahmenplan (Filter nach Phase und Status), Minister, Schwerpunkten, Pressemitteilungen
- `admin.html` – Verwaltung: Status/Phase ändern, Maßnahmen und Pressemitteilungen anlegen
- `data/*.json` – statische Kopie der Daten, falls das Backend nicht erreichbar ist

Die Daten kommen live aus dem Backend unter `/api/...`
(Repo [bmibund_privat](https://github.com/TitanDevWorks/bmibund_privat)), das diese Seite auch ausliefert.

Lokal ansehen:

```bash
python3 -m http.server 8080
```
