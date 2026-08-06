# Apps Script-backend (referentiekopie)

**Bron van waarheid: Google Apps Script**, niet dit bestand. Wijzigingen hier
worden NIET automatisch live; de live code staat in het Apps Script-project
"Vervoershub", gekoppeld aan de ritten-spreadsheet (Extensies → Apps Script).

- Versie in deze repo: **v11, 06-08-2026 — NOG NIET UITGEROLD.**
  Deze kopie loopt vóór op de live code en moet handmatig in de Apps
  Script-editor geplakt worden. Zolang dat niet gebeurd is, draait live nog v10.
- Live sinds: versie 10, 20-07-2026 (implementatie "Live versie")
- Endpoint: de /exec-URL in script.js (implementatie-ID begint met AKfycbzZTLO8e3OQ)
- Opslag: Google Sheet, tabblad "Oproepen"

## Wijzigingen per versie

### v11 — 06-08-2026 (in deze repo, nog niet live)

1. **Server-side datumfilter in het GET-pad.** De GET-response bevat alleen nog
   ritten tot en met 3 dagen na de vertrekdatum, plus alle toekomstige ritten.
   Rijen zonder vertrekdatum vallen af. Tot nu toe stuurde de backend de
   volledige sheet mee en filterde `script.js` pas in de browser
   (regels 37-43); daardoor waren contactgegevens van álle inzenders ooit
   opvraagbaar via de publieke /exec-URL, en was elke pageview een dump van de
   hele sheet. Nieuwe helper: `isActueleRit()`.
   - Het serverfilter is bewust nooit *strenger* dan het clientfilter: een
     onleesbare vertrekdatum wordt behouden (de browser gooit hem alsnog weg),
     en er zit `MARGE_DAGEN = 2` speling bovenop de 3 dagen om het verschil
     tussen de tijdzone van de bezoeker en die van het script op te vangen.
     Het clientfilter blijft dus de zichtbare grens bepalen; er kan geen
     zichtbare oproep verdwijnen.
   - **Er wordt niets verwijderd of gewijzigd in de sheet.** Verlopen rijen
     blijven gewoon staan, ze gaan alleen niet meer over de lijn. Een
     opschoonroutine bestaat nog steeds niet.
2. **Nieuwe route `?action=status`.** Lichte monitorroute: leest geen
   rij-inhoud (alleen `getLastRow()`) en neemt bewust géén script-lock, zodat
   een monitor nooit in de wachtrij staat met echte bezoekers. Antwoordt met
   `"check":"ok"` als het goed gaat en `"check":"failed"` in de foutafhandeling.
   Monitoren op dat keyword, niet op de HTTP-statuscode — een kapotte backend
   geeft hier gewoon 200 terug. Zie `MONITORING.md`, hoofdstuk 4.
3. Het POST-pad (`action: 'insert'`) is **ongewijzigd**: zelfde velden, zelfde
   volgorde, zelfde respons. `script.js` en `index.html` hoeven niet aangepast.

### v10 — 20-07-2026 (live)

- edit_token wordt niet meer meegegeven in de publieke GET-response (werd
  voorheen gelekt); wordt bij plaatsing wel opgeslagen.

## Bekende beperkingen (ongewijzigd in v11)

- Er bestaat GEEN server-side edit/update-route; edit.html en edit.js in deze
  repo zijn daardoor niet-functioneel (bewust zo gelaten).
- Er bestaat GEEN opschoonroutine: geen `deleteRow`, geen tijdgestuurde
  trigger, geen `action: 'delete'`. De FAQ-belofte "wordt automatisch
  verwijderd" wordt niet waargemaakt; met v11 wordt de rij alleen niet meer
  gepubliceerd.
- De script-lock wordt nog steeds bij élk verzoek genomen, ook bij een gewone
  leesactie. Alleen `?action=status` omzeilt hem.

## Verschil-checklijst — doe dit VÓÓR u plakt

Deze kopie is van 20-07-2026 en is nooit tegen de live code geverifieerd
(`script.google.com` is niet bereikbaar vanuit de omgeving waarin v11 is
geschreven). Als er sinds 20-07 rechtstreeks in de editor iets is gewijzigd,
gooit plakken dat weg. Open dus eerst de live code en controleer deze zeven
punten. **Wijkt er iets af: niet plakken, eerst melden.**

1. Bovenaan staat `const SHEET_NAME = 'Oproepen';` — en verder geen andere
   instellingen of constanten.
2. Er zijn precies twee entrypoints, `function doGet(e)` en `function doPost(e)`,
   die allebei niets anders doen dan `return handleRequest(e);`.
3. In `handleRequest` staan de eerste twee regels: `LockService.getScriptLock()`
   gevolgd door `lock.tryLock(10000);`.
4. De POST-tak test op `data.action === 'insert'` en doet één `sheet.appendRow([…])`
   met exact deze tien velden in deze volgorde: `data.id`, `data.created_at`,
   `data.type`, `data.naam_oproeper`, `data.van_plaats`, `data.naar_plaats`,
   `data.vertrekdatum`, `data.details`, `data.contact_info`, `data.edit_token`.
   Antwoord: `{ status: 'success', message: 'Oproep geplaatst' }`.
5. Het GET-pad leest `sheet.getDataRange().getValues()`, doet `rows.shift()` voor
   de headers, en heeft **precies één** `.filter(...)`, namelijk
   `row => row[0] && row[0].toString().trim() !== ""`. Staat er al een tweede
   filter, of een `.slice`, een limiet of een datumcontrole: dan is er al iets
   gewijzigd sinds 20-07 — niet plakken.
6. De `.map` geeft negen velden terug, van `id: row[0]` tot en met
   `contact_info: row[8]`, en **geen** `edit_token: row[9]`. Staat `edit_token`
   er wél weer in, dan draait er een oudere versie dan v10.
7. Onderaan staan alleen `function responseJSON(data)` (met
   `ContentService.createTextOutput(JSON.stringify(data))`) en `function getSheet()`
   (met de fallback `sheet = ss.getSheets()[0];`). Er is géén `statusCheck`,
   géén `deleteRow`, géén `action === 'update'` en géén tijdgestuurde trigger.

Zit er in de live code iets wat hierboven niet voorkomt — een extra functie, een
extra route, een trigger — dan mist deze kopie dat, en gaat het bij plakken
verloren.

## Uitrollen — LET OP

Deploy-procedure bij wijziging: code aanpassen in de Apps Script-editor →
opslaan → Implementeren → Implementaties beheren → potlood bij "Live versie"
→ Versie: **Nieuwe versie** → Implementeren.

> **NOOIT "Nieuwe implementatie" gebruiken.** Dat maakt een nieuwe /exec-URL
> aan. De URL in `script.js` wijst dan naar de oude implementatie en de
> centrale ligt eruit: de bezoeker krijgt geen ritten meer te zien en nieuwe
> oproepen komen in de oude, niet meer gelezen omgeving terecht. Alleen een
> **nieuwe versie op de bestaande implementatie** behoudt de /exec-URL, en
> alleen daardoor hoeft er niets aan `script.js` te veranderen.

Controleer na het uitrollen twee dingen met een gewone browser of `curl -L`:

1. `<exec-URL>` geeft nog steeds `{"status":"success","data":[…]}`, maar
   merkbaar kleiner, en zonder ritten uit het verre verleden.
2. `<exec-URL>?action=status` geeft `"check":"ok"` terug.
