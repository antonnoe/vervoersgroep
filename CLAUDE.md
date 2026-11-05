# CLAUDE.md

Repo: vervoersgroep

## Wat dit is
Vervoerscentrale (lift- en transportcentrale): statische website waar ritten worden aangeboden en gezocht. Bezoekers kunnen oproepen bekijken, plaatsen en bewerken. De gegevens staan in een Google Sheet, tabblad "Oproepen", achter een Google Apps Script.

## Live adres
https://vervoersgroep.vercel.app (de proxy staat op https://vervoersgroep.vercel.app/api/ritten). De site is bedoeld voor Nederlanders.fr, de proxy meldt zich met https://www.nederlanders.fr in de User-Agent.

## Opbouw
- index.html, script.js, style.css: overzicht en plaatsen van oproepen
- edit.html, edit.js: oproep bewerken
- api/ritten.js: Vercel-functie, doorgeefluik (GET en POST) naar Google Apps Script, zonder cookies van de bezoeker, time-out 45 s
- apps-script/Code.gs en apps-script/README.md: referentiekopie van de backend (bron van waarheid is het Apps Script-project, niet deze kopie)
- vercel.json: alleen maxDuration 60 voor api/ritten.js
- MONITORING.md: audit en monitoring van de externe aanroepen

## Techniek
Statische HTML, CSS en JavaScript zonder build en zonder package.json. Eén Vercel-functie in Node. Backend in Google Apps Script. script.js laadt via het doorgeefluik (PROXY_URL), edit.js roept het Apps Script rechtstreeks aan. Apps Script kent ook een lichte statusroute (?action=status, antwoord met "check":"ok") voor monitoring, zie MONITORING.md en apps-script/README.md.

## Externe diensten en namen van omgevingsvariabelen
- Google Apps Script en Google Sheets (de /exec-adressen staan in script.js, edit.js en api/ritten.js; het zijn adressen, geen sleutels)
- Vercel
- cdn.jsdelivr.net en Google Fonts voor frontendbronnen
- Omgevingsvariabelen: geen

## Hoe het live gaat
De site en api/ritten.js draaien op Vercel. De Apps Script-code gaat niet automatisch live: wijzigingen in apps-script/Code.gs moeten met de hand in de Apps Script-editor worden geplakt en als nieuwe implementatie worden uitgerold (zie apps-script/README.md).

## Regels en besluiten
Bron: apps-script/README.md en MONITORING.md.
- Bron van waarheid voor de backend is Google Apps Script, niet apps-script/Code.gs.
- Oproepen blijven zichtbaar tot 3 dagen na de vertrekdatum, in de browser en server-side met een marge van 2 dagen.
- De monitor moet Google meten en niet de cache: gebruik ?verse=1 op het hoofdendpoint en de statusroute zonder script-lock.

Laatst nagelopen: 5 november 2026
