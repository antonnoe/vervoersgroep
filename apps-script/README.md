# Apps Script-backend (referentiekopie)

**Bron van waarheid: Google Apps Script**, niet dit bestand. Wijzigingen hier
worden NIET automatisch live; de live code staat in het Apps Script-project
"Vervoershub", gekoppeld aan de ritten-spreadsheet (Extensies → Apps Script).

- Live sinds: versie 10, 20-07-2026 (implementatie "Live versie")
- Endpoint: de /exec-URL in script.js (implementatie-ID begint met AKfycbzZTLO8e3OQ)
- Opslag: Google Sheet, tabblad "Oproepen"
- Wijziging in v10: edit_token wordt niet meer meegegeven in de publieke
  GET-response (werd voorheen gelekt); wordt bij plaatsing wel opgeslagen.
- Er bestaat GEEN server-side edit/update-route; edit.html en edit.js in deze
  repo zijn daardoor niet-functioneel (bewust zo gelaten).
- Deploy-procedure bij wijziging: code aanpassen in de Apps Script-editor →
  opslaan → Implementeren → Implementaties beheren → potlood bij "Live versie"
  → Versie: Nieuwe versie → Implementeren. NOOIT "Nieuwe implementatie"
  gebruiken (geeft een nieuwe URL en breekt de tool).
