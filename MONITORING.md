# Monitoring en performance-audit — Lift- en transportcentrale

Datum audit: 6 augustus 2026
Scope: `index.html`, `edit.html`, `script.js`, `edit.js` (plus `style.css` en
`apps-script/Code.gs` waar die de aanroepen verklaren).
Aan de live bestanden is **niets gewijzigd**. Dit document is het enige nieuwe bestand.

> **Belangrijk vooraf — de metingen uit punt 2 zijn NIET uitgevoerd.**
> De omgeving waarin deze audit draaide, staat geen uitgaand verkeer toe naar
> `script.google.com`, `script.googleusercontent.com`, `cdn.jsdelivr.net`,
> `fonts.googleapis.com` en `www.nederlanders.fr`. Elke poging kreeg
> `CONNECT tunnel failed, response 403` van de egress-proxy. Er staan daarom
> **geen verzonnen responstijden, statuscodes of payloadgroottes** in dit
> document. In hoofdstuk 2 staat een kant-en-klaar meetscript waarmee u de
> tabel zelf in één minuut vult. Alles in hoofdstuk 1, 3, 4 en 5 komt
> letterlijk uit de code en is wél verifieerbaar.

---

## 1. Inventarisatie van alle externe aanroepen

### 1.1 Overzichtstabel

| # | Endpoint | Methode | Parameters / action | Moment in de flow | Blokkerend voor renderen? |
|---|---|---|---|---|---|
| 1 | `https://fonts.googleapis.com/css2?family=Mulish:wght@400;600&family=Poppins:wght@600;700&display=swap` | GET | `family`, `display=swap` (in URL) | Tijdens het parsen van `<head>`, via `@import` in `style.css:2` | **Ja, en serieel.** `style.css` is render-blocking; de `@import` wordt pas ontdekt nádat `style.css` binnen is, dus twee opeenvolgende blokkerende hops |
| 2 | `https://script.google.com/macros/s/AKfycbzZTLO8e3OQCC6iZBGXCYz8YVLBH23att20npzUiP3uTsDZrq8zc3Xs8hZ9lR3BqNrU7g/exec` | GET | `?timestamp=<Date.now()>` — cache-buster, wordt server-side genegeerd | `DOMContentLoaded` → `laadRitten()` (`script.js:12, 23`) | Niet voor de HTML-shell, **wel voor alle inhoud**: `#ritten-lijst` staat op `display:none` (`script.js:16`) tot de respons binnen is (`script.js:61`) |
| 3 | dezelfde `/exec`-URL als #2 | POST | Body = JSON met `id`, `created_at`, `type`, `naam_oproeper`, `van_plaats`, `naar_plaats`, `vertrekdatum`, `details`, `contact_info`, `edit_token`, **`action: 'insert'`** | Bij submit van `#vervoer-form` (`script.js:120, 140`) | Nee, maar blokkeert de knop (`disabled`) tot de respons er is |
| 4 | dezelfde `/exec`-URL als #2 | GET | `?timestamp=<Date.now()>` | Direct ná een geslaagde POST: `laadRitten()` wordt opnieuw aangeroepen (`script.js:170`) | Nee — maar dit is een **tweede volledige datadump in dezelfde handeling** |
| 5 | `https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2` | GET | geen | Tijdens het parsen van `edit.html:77` | **Ja.** Klassiek `<script>` zonder `defer`/`async`, vóór `edit.js`. Zie 1.3 — deze library wordt nergens gebruikt |
| 6 | `https://script.google.com/macros/s/AKfycbx1bATQlNIu7vTY1VFIX98zfznYk86vZ2C3WUo2-CcazWdzPOquahzgCmBJKBUwnpOFKw/exec` | GET | `?timestamp=<Date.now()>` | `DOMContentLoaded` op `edit.html` → `laadOproepData()` (`edit.js:16, 70`) | Gates het bewerkformulier (`edit.js:34-35`). Zie 1.3 — **andere URL dan #2** |
| 7 | dezelfde `/exec`-URL als #6 | POST | Body = JSON met de formuliervelden + `edit_token`, **`action: 'update'`** | Bij submit van `#edit-form` (`edit.js:54`) | Nee. Zie 1.3 — deze action bestaat niet server-side |

Volledig lokaal (geen netwerk naar derden): `style.css`, `script.js?v=43`
(`index.html:183`), `edit.js?v=3` (`edit.html:78`), de inline FAQ-toggle
(`index.html:184-193`). Er zijn geen afbeeldingen, geen trackers, geen
analytics en geen andere CDN's in de vier bestanden.

### 1.2 Wat de backend met die aanroepen doet

`apps-script/Code.gs` (referentiekopie, v10) kent maar één handler:
`doGet` en `doPost` gaan beide naar `handleRequest`. Alleen `action === 'insert'`
heeft een eigen tak (regel 24-39). **Elk ander verzoek — ook elke POST die geen
`insert` is — valt door naar het GET-pad** en krijgt de volledige datadump terug
(regel 43-68). Er is geen aparte, lichte route.

### 1.3 Drie afwijkingen die opvallen bij de inventarisatie

Deze wijzigen niets aan de opdracht, maar u wilt ze weten:

1. **`edit.js` wijst naar een andere backend dan `script.js`.** `script.js`
   gebruikt implementatie-ID `AKfycbzZTLO8e3OQ…`, `edit.js` gebruikt
   `AKfycbx1bATQ…`. Dat is een oudere implementatie-URL.
2. **`action: 'update'` bestaat niet server-side.** In `Code.gs` is er geen
   enkele tak voor `update`; het verzoek valt door naar de datadump, waarna
   `edit.js:59` faalt op `result.status !== 'success'`… of juist onterecht
   slaagt, omdat de dump wél `status: 'success'` teruggeeft. De gebruiker krijgt
   dan "succesvol bijgewerkt" te zien terwijl er niets is opgeslagen.
   `apps-script/README.md` bevestigt dat de edit-route bewust niet bestaat.
3. **De Supabase-library op `edit.html` wordt nul keer gebruikt.**
   `grep -c -i supabase edit.js` geeft `0`. Het is een render-blocking
   download van een complete SDK die niets doet.

---

## 2. Metingen per GET-endpoint — NIET UITGEVOERD

### 2.1 Waarom niet

De auditomgeving blokkeert al het uitgaande verkeer naar de betrokken hosts op
proxy-niveau. De proxy registreerde de weigeringen als volgt:

| Host | Resultaat | Tijdstip (UTC) |
|---|---|---|
| `script.google.com:443` | `connect_rejected` — gateway antwoordde 403 op CONNECT | 2026-08-06T05:32:25Z |
| `cdn.jsdelivr.net:443` | `connect_rejected` | 2026-08-06T05:32:36Z |
| `script.googleusercontent.com:443` | `connect_rejected` | 2026-08-06T05:32:36Z |
| `www.nederlanders.fr:443` | `connect_rejected` | 2026-08-06T05:32:36Z |

Ook de fetch-tool met eigen netwerkpad kreeg HTTP 403 op de `/exec`-URL. Het
beleid van de proxy schrijft voor dat een 403 niet omzeild wordt, dus is er
niet verder geprobeerd. **Dit zegt niets over de gezondheid van uw backend** —
het is een beperking van deze auditomgeving, geen storing bij Google.

### 2.2 Meetscript — draai dit zelf

Bewaar als `meet.sh`, `chmod +x meet.sh`, en draai vanaf een machine met normaal
internet. Het doet uitsluitend GET-verzoeken; er wordt niets geschreven of
verwijderd. De `cb=`-parameter is een cache-buster zodat u de echte
round-trip meet en niet een tussencache.

```bash
#!/usr/bin/env bash
# Meet een GET-endpoint 5x. Gebruik: ./meet.sh "<url>"
URL="$1"
[ -z "$URL" ] && { echo "Gebruik: $0 <url>"; exit 1; }
codes=(); times=(); sizes=()
for i in 1 2 3 4 5; do
  out=$(curl -sS -L -o /dev/null \
        -w "%{http_code} %{time_total} %{size_download} %{num_redirects}" \
        "${URL}$( [[ "$URL" == *\?* ]] && echo "&" || echo "?" )cb=$(date +%s%N)")
  read -r code t size redir <<< "$out"
  echo "run $i: status=$code tijd=${t}s bytes=$size redirects=$redir"
  codes+=("$code"); times+=("$t"); sizes+=("$size")
done
printf '%s\n' "${times[@]}" | sort -n | awk '
  {v[NR]=$1} END {
    printf "\nmin=%.3fs  mediaan=%.3fs  max=%.3fs\n", v[1], v[int((NR+1)/2)], v[NR] }'
printf '%s\n' "${sizes[@]}" | sort -n | awk '
  {v[NR]=$1} END {
    printf "bytes: min=%d mediaan=%d max=%d\n", v[1], v[int((NR+1)/2)], v[NR] }'
```

Aan te roepen als:

```bash
./meet.sh "https://script.google.com/macros/s/AKfycbzZTLO8e3OQCC6iZBGXCYz8YVLBH23att20npzUiP3uTsDZrq8zc3Xs8hZ9lR3BqNrU7g/exec"
./meet.sh "https://script.google.com/macros/s/AKfycbx1bATQlNIu7vTY1VFIX98zfznYk86vZ2C3WUo2-CcazWdzPOquahzgCmBJKBUwnpOFKw/exec"
./meet.sh "https://fonts.googleapis.com/css2?family=Mulish:wght@400;600&family=Poppins:wght@600;700&display=swap"
./meet.sh "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"
```

Het script is gecontroleerd tegen een lokale testserver; de rekenlogica voor
min/mediaan/max klopt. De getallen uit die test waren van een dummy-server en
staan daarom bewust niet in dit document.

### 2.3 In te vullen tabel

De POST-endpoints (#3 en #7) staan hier bewust niet in: die schrijven, en er
is opdracht gegeven géén schrijfacties uit te voeren.

| Endpoint | Status | Tijd min | Tijd mediaan | Tijd max | Bytes | Redirects |
|---|---|---|---|---|---|---|
| `/exec` hoofd (`AKfycbzZ…`) — de datadump | niet gemeten | niet gemeten | niet gemeten | niet gemeten | niet gemeten | niet gemeten |
| `/exec` edit (`AKfycbx1…`) | niet gemeten | niet gemeten | niet gemeten | niet gemeten | niet gemeten | niet gemeten |
| Google Fonts `css2?family=…` | niet gemeten | niet gemeten | niet gemeten | niet gemeten | niet gemeten | niet gemeten |
| jsDelivr `@supabase/supabase-js@2` | niet gemeten | niet gemeten | niet gemeten | niet gemeten | niet gemeten | niet gemeten |

Let bij het invullen op de kolom **Redirects**. Een Apps Script `/exec`-URL
stuurt in de regel door naar `script.googleusercontent.com`; of dat hier ook
gebeurt en hoeveel tijd die extra hop kost, is in deze sessie **niet
geverifieerd**. De `-L` in het script volgt de redirect en `%{num_redirects}`
maakt zichtbaar of hij er is.

---

## 3. Welk bestaand GET-endpoint is geschikt als monitorpunt?

**Bruikbaar, maar niet ideaal:** het enige bestaande GET-endpoint is de
volledige datadump op de hoofd-`/exec`-URL. Dat endpoint bewijst wél precies
wat u wilt bewijzen: een gezonde respons betekent dat Apps Script draait, dat
de spreadsheet gekoppeld is, dat het tabblad `Oproepen` gelezen kan worden en
dat er data terugkomt. Als de Google-laag uitvalt of de sheet-koppeling breekt,
vangt `Code.gs:70-71` dat af en komt er `{"status":"error",…}` terug — met
HTTP 200. **Alleen op statuscode monitoren is dus zinloos; een kapotte backend
geeft gewoon 200.** Inhoudelijk matchen is hier geen luxe maar noodzaak.

**Monitorinstelling met het huidige endpoint:**

| Veld | Waarde |
|---|---|
| Type | HTTP(s) — Keyword |
| URL | `https://script.google.com/macros/s/AKfycbzZTLO8e3OQCC6iZBGXCYz8YVLBH23att20npzUiP3uTsDZrq8zc3Xs8hZ9lR3BqNrU7g/exec` |
| Keyword | `"status":"success"` |
| Keyword type | Exists (alarm als het keyword ontbreekt) |

Het keyword komt uit `Code.gs:68` in combinatie met `responseJSON` (regel 78):
`JSON.stringify` produceert `{"status":"success","data":[…]}` zonder spaties.
De fouttak (regel 71) produceert `"status":"error"` en matcht dus niet — precies
het gewenste gedrag.

**Waarom dit tóch niet het eindantwoord is.** Het is geen licht endpoint:

- het leest bij élke poll de complete sheet in geheugen
  (`sheet.getDataRange().getValues()`, `Code.gs:43`);
- het neemt bij élke poll de script-lock (`Code.gs:14-15`), dus een monitor die
  elke 5 minuten polt, staat structureel in de wachtrij mét uw bezoekers;
- het verbruikt Apps Script-uitvoeringsquota voor een controle die geen data
  nodig heeft;
- de payload groeit mee met de sheet, dus uw monitorverkeer groeit ook mee.

Een lichte statusroute bestaat niet. Die staat daarom hieronder, kant-en-klaar.

---

## 4. Kant-en-klare Apps Script-code voor een lichte statusroute

Deze code is **niet uitgevoerd**. Plak hem zelf in het Apps Script-project.

**Stap 1 — vervang de bestaande `doGet` (nu regel 5-7 van `Code.gs`) door:**

```javascript
function doGet(e) {
  if (e && e.parameter && e.parameter.action === 'status') {
    return statusCheck();
  }
  return handleRequest(e);
}
```

**Stap 2 — plak deze functie erbij, bijvoorbeeld onderaan het bestand:**

```javascript
/**
 * Lichte status-route voor externe monitoring (UptimeRobot).
 * Bevestigt uitsluitend: (1) Apps Script draait, (2) de spreadsheet is
 * gekoppeld, (3) het tabblad is leesbaar. Leest GEEN rij-inhoud en neemt
 * bewust GEEN script-lock, zodat de monitor nooit in de wachtrij staat met
 * echte bezoekers. Schrijft niets.
 */
function statusCheck() {
  try {
    var sheet = getSheet();
    var lastRow = sheet.getLastRow();   // goedkoop: leest geen celwaarden

    return responseJSON({
      status: 'success',
      check: 'ok',
      sheet: sheet.getName(),
      rows: Math.max(0, lastRow - 1),   // -1 voor de headerrij
      served_at: new Date().toISOString()
    });
  } catch (err) {
    return responseJSON({
      status: 'error',
      check: 'failed',
      message: err.toString()
    });
  }
}
```

**Stap 3 — opnieuw implementeren.** Volg exact de procedure uit
`apps-script/README.md`: Implementeren → Implementaties beheren → potlood bij
"Live versie" → Versie: **Nieuwe versie** → Implementeren. **Nooit "Nieuwe
implementatie"** — dat geeft een nieuwe URL en breekt de tool. De `/exec`-URL
blijft hierdoor ongewijzigd; `script.js` hoeft niet aangepast te worden.

**Stap 4 — UptimeRobot instellen:**

| Veld | Waarde |
|---|---|
| Type | HTTP(s) — Keyword |
| URL | `https://script.google.com/macros/s/AKfycbzZTLO8e3OQCC6iZBGXCYz8YVLBH23att20npzUiP3uTsDZrq8zc3Xs8hZ9lR3BqNrU7g/exec?action=status` |
| Keyword | `"check":"ok"` |
| Keyword type | Exists (alarm als het keyword ontbreekt) |
| Interval | 5 minuten is ruim voldoende |

`"check":"ok"` komt alleen voor in de geslaagde tak. Valt de spreadsheet weg of
verliest het script leesrechten, dan slaat de `catch` toe en komt er
`"check":"failed"` terug — het keyword ontbreekt en UptimeRobot alarmeert. Zo
detecteert u een uitval van de Google-laag, niet slechts van de HTML-pagina.

**Twee aandachtspunten:**

- Het veld `sheet` in de respons geeft de werkelijke tabbladnaam terug. Zo ziet
  u meteen of `getSheet()` op de fallback is teruggevallen (`Code.gs:84-87`):
  als daar iets anders dan `Oproepen` staat, klopt de tabbladnaam niet meer.
- Controleer na het implementeren of UptimeRobot redirects volgt; Apps Script
  stuurt doorgaans door naar `script.googleusercontent.com`. Dat is in deze
  sessie **niet geverifieerd**. Roep de URL eerst één keer met
  `curl -L` aan en kijk of het keyword daadwerkelijk in de body staat, vóór u
  op de monitor vertrouwt.

---

## 5. Waar komt de traagheid vandaan?

**Onderbouwing vooraf:** hieronder staat geen enkel meetgetal, om de reden in
hoofdstuk 2. Alle onderbouwing is statisch en met regelnummers na te lopen in
de code. Waar een meting het beeld zou moeten bevestigen, staat dat er expliciet
bij.

### Oorzaak 1 — Elke pageview trekt de complete sheet over de lijn, ongefilterd en ongecached

Dit is vrijwel zeker de zwaarste post.

- `Code.gs:43` doet `sheet.getDataRange().getValues()`. Dat leest **alle rijen
  die ooit zijn geplaatst**, niet alleen de actuele.
- De enige filtering die overblijft is regel 50: rijen zonder ID eruit. Er is
  geen filter op datum, geen paginering, geen limiet.
- Het filteren op "toekomst of maximaal 3 dagen oud" gebeurt pas **in de
  browser van de bezoeker**, in `script.js:37-43`. Alles wat daar wegvalt, is
  dus wél gedownload en daarna weggegooid.
- Per rij gaan negen velden mee (`Code.gs:52-65`), waaronder het vrije
  tekstveld `details`. Dat `script.js:89` een afkapgrens van 1100 tekens hanteert,
  laat zien dat die teksten in de praktijk lang genoeg worden om die grens te
  raken — de volledige tekst wordt altijd verstuurd, ook als hij ingeklapt
  getoond wordt.
- **Er staat in deze referentiekopie geen enkele opschoonroutine.** Geen
  `deleteRow`, geen tijdgestuurde trigger, geen `action: 'delete'`. De FAQ
  belooft in `index.html:106` dat een oproep 3 dagen na de vertrekdatum
  "automatisch verwijderd" wordt, maar wat de code doet is hem **verbergen in
  de browser**. De rij blijft in de sheet en blijft meegestuurd worden, voor
  altijd, aan iedere bezoeker. De payload groeit dus monotoon met alles wat er
  ooit geplaatst is.
- `script.js:23` hangt `?timestamp=<Date.now()>` aan elke aanroep. Elke pageview
  is daardoor een unieke URL en dus gegarandeerd een cache-misser — geen
  browsercache, geen tussencache, niets.

*Te bevestigen met een meting:* draai het script uit 2.2 op het hoofdendpoint
en kijk naar de kolom bytes. Vergelijk dat aantal met het aantal oproepen dat
op de pagina zichtbaar is. Het verschil is pure verspilling.

### Oorzaak 2 — Leesverkeer neemt de script-lock en wordt daardoor geserialiseerd

`Code.gs:14-15` staat vóór álles:

```javascript
const lock = LockService.getScriptLock();
lock.tryLock(10000);
```

De lock wordt genomen bij **elk** verzoek, dus ook bij een gewone GET die
alleen leest. Twee bezoekers die tegelijk de pagina openen, lezen niet
tegelijk: de tweede wacht tot de eerste klaar is, tot maximaal 10 seconden.
Omdat het lezen zelf zwaar is (oorzaak 1), is het venster waarin die lock
vastgehouden wordt navenant lang. Dit verklaart waarom de traagheid onder druk
onevenredig verergert: het is niet alleen een grote download, het is een grote
download die andere bezoekers tegenhoudt. Een monitor die elk kwartier polt,
gaat in die rij meestaan — reden te meer voor de lichte route uit hoofdstuk 4,
die de lock bewust níét neemt.

*Te bevestigen met een meting:* draai het script uit 2.2 twee keer gelijktijdig
vanuit twee terminals. Loopt de mediaan zichtbaar op ten opzichte van een
enkele run, dan is de lock-contentie bevestigd.

### Oorzaak 3 — De laadvolgorde is een seriële waterval, en bij plaatsen wordt de dump twee keer gehaald

Alles op het kritieke pad staat achter elkaar in plaats van naast elkaar:

1. Browser haalt `index.html`.
2. Browser haalt `style.css` (`index.html:7`, render-blocking).
3. **Pas daarna** ontdekt hij de `@import` op `style.css:2` en haalt de
   Google Fonts-CSS op — een tweede render-blocking hop naar een derde partij
   die niet parallel kon starten omdat hij verstopt zit in een `@import` in
   plaats van in een `<link>` in de `<head>`.
4. Daarna volgen nog de lettertypebestanden waar die CSS naar verwijst.
5. Pas op `DOMContentLoaded` start het ene, zware verzoek naar Apps Script
   (`script.js:12, 23`) — mogelijk plus een redirect-hop naar
   `script.googleusercontent.com` (niet geverifieerd).
6. Tot dat verzoek terug is, staat `#ritten-lijst` op `display:none`
   (`script.js:16`) en ziet de bezoeker "Ritten worden geladen…". De vier
   `<div>`'s met "Laden…" in `index.html:152-167` blijven onzichtbaar
   daarachter.

Daar bovenop: na een geslaagde plaatsing roept `script.js:170` opnieuw
`laadRitten()` aan. Eén handeling van de gebruiker levert dus **twee** volledige
datadumps op — één na de POST, terwijl de server bij die POST al alles in
handen had om de nieuwe lijst direct mee terug te geven.

*Te bevestigen met een meting:* open de pagina met het netwerkpaneel van de
browser open en kijk naar de watervalgrafiek; de trapvorm bij stap 2-4 en het
gat tot stap 5 zijn daar direct zichtbaar.

### Verder opgemerkt (lichter, maar wel echt)

- **`edit.html` laadt de volledige Supabase-SDK die nul keer gebruikt wordt**
  (`edit.html:77`, `grep -c -i supabase edit.js` = 0). Render-blocking, geen
  `defer`, geen `async`, en hij vertraagt bovendien `edit.js` erachter.
- **Twee verschillende backend-URL's** (zie 1.3) betekent dat er ook twee
  Apps Script-implementaties warm gehouden worden.
- **De POST verstuurt geen `Content-Type`-header** (`script.js:140-143`,
  `edit.js:54-57`). Dat is hier gunstig: er is daardoor geen CORS-preflight en
  de POST kost één round trip in plaats van twee. Niet aanpassen dus.

### Wat níét de oorzaak is

Voor de volledigheid: de front-end-bestanden zelf zijn klein — `index.html`
10.298 bytes, `script.js` 9.040, `style.css` 7.722, `edit.html` 3.510,
`edit.js` 3.260. Er zijn geen afbeeldingen, geen trackers, geen frameworks op
`index.html`. Het probleem zit niet in de omvang van uw eigen code; het zit in
de Google-laag erachter en in de volgorde waarin alles wordt opgehaald.

---

## Samenvatting in één alinea

Er zijn twee Apps Script-implementaties in gebruik, waarvan de tweede
(`edit.js`) op een backend wijst die de gevraagde `update`-action niet kent.
Er bestaat geen licht GET-endpoint: de enige leesroute is een ongefilterde dump
van de complete spreadsheet, die bij elke pageview opnieuw over de lijn gaat,
nooit gecached wordt, en bij het lezen de script-lock neemt. Monitoren kan op
dat endpoint met keyword `"status":"success"`, maar beter is de lichte
`?action=status`-route uit hoofdstuk 4 met keyword `"check":"ok"` — die bewijst
hetzelfde zonder de sheet te lezen en zonder de lock te nemen. Monitor in beide
gevallen **op inhoud en niet op statuscode**: een kapotte backend geeft hier
gewoon HTTP 200 terug.
