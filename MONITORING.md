# Monitoring en performance-audit — Lift- en transportcentrale

Datum audit: 6 augustus 2026
Bijgewerkt: 6 augustus 2026 — metingen tegen de live backend toegevoegd
(hoofdstuk 2), voorbehoud per bevinding toegevoegd (hoofdstuk 6).
Scope: `index.html`, `edit.html`, `script.js`, `edit.js` (plus `style.css` en
`apps-script/Code.gs` waar die de aanroepen verklaren).
Aan `index.html`, `edit.html`, `script.js`, `edit.js` en `style.css` is
**niets gewijzigd**.

> **Belangrijk vooraf — wie heeft wat gemeten.**
> De omgeving waarin deze audit draaide, staat geen uitgaand verkeer toe naar
> `script.google.com`, `script.googleusercontent.com`, `cdn.jsdelivr.net`,
> `fonts.googleapis.com` en `www.nederlanders.fr`. Elke poging kreeg
> `CONNECT tunnel failed, response 403` van de egress-proxy. Er staan daarom
> **geen door de audit verzonnen responstijden, statuscodes of
> payloadgroottes** in dit document.
> De opdrachtgever heeft het hoofdendpoint inmiddels zelf vanaf een normale
> internetverbinding aangeroepen. Die cijfers staan in hoofdstuk 2 en zijn als
> zodanig gelabeld. Alles in hoofdstuk 1, 3, 4 en 5 komt uit de code; hoofdstuk
> 6 zegt per bevinding waar hij precies op rust.

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

## 2. Metingen per GET-endpoint

### 2.0 Wél gemeten: het hoofdendpoint, tegen de live backend

**Bron: meting door de opdrachtgever, 6 augustus 2026, drie aanroepen van de
`/exec`-URL uit `script.js` (`AKfycbzZ…`). Niet door deze audit uitgevoerd —
zie 2.1 — maar wel tegen de echte, draaiende backend.**

| Wat | Meetwaarde |
|---|---|
| HTTP-status | 200 (alle drie de aanroepen) |
| Payload | 47.630 bytes |
| Aantal rijen in de respons | 92 |
| Rijen met een e-mailadres in `contact_info` | 91 |
| Responstijd koud | 44,9 s en 66,0 s |
| Responstijd warm | 1,9 s |
| Oudste `vertrekdatum` in de payload | 1960 |
| Nieuwste `vertrekdatum` in de payload | 2027 |

Wat deze meting hard maakt:

1. **De backend stuurt de volledige sheet mee, ongefilterd.** Een payload met
   vertrekdatums van 1960 tot 2027 kan alleen ontstaan als er server-side geen
   datumfilter is. Dit bevestigt oorzaak 1 in hoofdstuk 5 rechtstreeks, niet
   langer alleen uit de code afgeleid.
2. **De opschoning bestaat niet.** Rijen met een vertrekdatum uit 1960 staan er
   nog steeds in. De FAQ-belofte "wordt automatisch verwijderd 3 dagen na de
   vertrekdatum" (`index.html:106`) wordt dus in geen enkele vorm waargemaakt;
   het clientfilter in `script.js:37-43` verbergt ze slechts.
3. **Contactgegevens van vrijwel elke inzender ooit zijn zonder inlog
   opvraagbaar.** 91 van de 92 rijen bevatten een e-mailadres, en de hele set
   komt mee op één publieke URL — ook de 
   rijen die de bezoeker nooit te zien krijgt.
4. **De koude start is de dominante vertraging**, niet de omvang van de
   payload: 44,9 s en 66,0 s koud tegenover 1,9 s warm bij dezelfde 47.630
   bytes. Een kleinere payload helpt, maar lost de koude start niet op — dat
   doet alleen een monitor of iets anders dat de implementatie warm houdt.

> Wat deze meting **niet** aantoont: hoeveel van de 92 rijen na filtering
> overblijven (niet uitgesplitst), of er een redirect-hop naar
> `script.googleusercontent.com` in zit, en hoe de tijden zich onder
> gelijktijdige bezoekers gedragen. Voor dat laatste: zie het meetscript in 2.2.

### 2.1 Waarom de audit zelf niet kon meten

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
| `/exec` hoofd (`AKfycbzZ…`) — de datadump | **200** | **1,9 s (warm)** | niet bepaald (3 metingen) | **66,0 s (koud)** | **47.630** | niet bepaald |
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

**Onderbouwing vooraf:** oorzaak 1 is inmiddels **gemeten** tegen de live
backend (zie 2.0). Oorzaak 2 en 3 rusten nog uitsluitend op code: statisch, met
regelnummers na te lopen. Waar een meting het beeld nog moet bevestigen, staat
dat er expliciet bij. Hoofdstuk 6 zet per bevinding op welke grond hij rust.

### Oorzaak 1 — Elke pageview trekt de complete sheet over de lijn, ongefilterd en ongecached

**Status: GEVERIFIEERD tegen de live backend** (zie 2.0: 92 rijen, 47.630 bytes,
vertrekdatums van 1960 tot 2027). Dit was bij het schrijven van deze audit nog
een uit de code afgeleide verwachting; het is nu een meting.

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

*Bevestigd:* de meting uit 2.0 geeft 47.630 bytes en 92 rijen, met
vertrekdatums vanaf 1960 — terwijl de pagina alleen de actuele ritten toont.
Het verschil is pure verspilling, en tegelijk een privacylek: 91 van die 92
rijen bevatten een e-mailadres.

*Aangepakt in `apps-script/Code.gs` v11 (in deze repo, nog niet uitgerold):*
het GET-pad filtert de rijen nu vóór het serialiseren, met dezelfde regel die
`script.js:37-43` in de browser toepast. Er wordt niets uit de sheet
verwijderd; de rijen blijven staan, ze gaan alleen niet meer over de lijn.

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

## 6. Voorbehoud per bevinding — waar rust elke uitspraak op?

Vier soorten grond, van sterk naar zwak:

- **A — Gemeten tegen de live backend.** Hardste categorie. Bron staat erbij.
- **B — Gelezen code.** Staat letterlijk in een bestand in deze repo. Voor
  `index.html`, `script.js`, `edit.html`, `edit.js` en `style.css` is dat
  tegelijk de live code. Voor `apps-script/Code.gs` **niet**: dat is een
  handmatige referentiekopie van 20-07-2026 en dus ongeverifieerd, zie de
  waarschuwing onderaan dit hoofdstuk.
- **C — README-tekst.** Berust op wat `apps-script/README.md` beweert, niet op
  code die is ingezien.
- **D — Afgeleid gedrag.** Redenering over wat de code zal doen, zonder meting.
  Plausibel, niet bewezen.

| # | Bevinding | Grond | Toelichting |
|---|---|---|---|
| 1 | De backend stuurt de volledige sheet ongefilterd mee | **A** | 92 rijen, 47.630 bytes, vertrekdatums 1960-2027 (2.0) |
| 2 | Er bestaat geen opschoning; verlopen rijen blijven staan | **A** | Rijen uit 1960 zitten nog in de live payload (2.0). Eerder alleen B+C |
| 3 | Contactgegevens van vrijwel elke inzender ooit zijn publiek opvraagbaar | **A** | 91 van 92 rijen met e-mailadres in de publieke response (2.0) |
| 4 | Het datumfilter draait pas in de browser | **B** | `script.js:37-43`, live bestand |
| 5 | De koude start domineert de responstijd | **A** | 44,9 s en 66,0 s koud tegen 1,9 s warm, zelfde payload (2.0) |
| 6 | Elk verzoek neemt de script-lock, ook een gewone GET | **B**, kopie | `Code.gs:14-15` in de referentiekopie. Dat leesverkeer daardoor serialiseert bij gelijktijdig bezoek is **D** — niet gemeten |
| 7 | Er is geen licht GET-endpoint; élk verzoek valt door naar de dump | **B**, kopie | Alleen `action === 'insert'` heeft een eigen tak in de kopie |
| 8 | `"status":"success"` is bruikbaar als monitorkeyword | **B** | Volgt uit `JSON.stringify` in `responseJSON`; **niet** tegen de live respons gecontroleerd op exacte spatiëring |
| 9 | Een kapotte backend geeft HTTP 200 met `"status":"error"` | **D** | Volgt uit de `catch`-tak in de kopie; niet uitgelokt, dus niet waargenomen |
| 10 | `?action=status` gaat werken zoals beschreven | **D+** | Code is uitgevoerd tegen *gesimuleerde* Apps Script-services (zie 6.1) en gaf `"check":"ok"` zonder de lock te nemen. Niet in de echte Apps Script-runtime gedraaid; pas hard te bevestigen ná uitrollen |
| 11 | Er bestaat geen server-side `update`-route | **B** + **C** | Geen `update`-tak in de kopie; `README.md` bevestigt dat het bewust zo is |
| 12 | `edit.js` wijst naar een oudere implementatie-URL | **B** voor de URL zelf, **D** voor "ouder" | Dat `AKfycbx1…` een oudere implementatie is, is afgeleid, niet gecontroleerd |
| 13 | De Supabase-SDK op `edit.html` wordt nul keer gebruikt | **B** | `grep -c -i supabase edit.js` = 0 |
| 14 | Google Fonts via `@import` is een seriële render-blocking hop | **B** + **D** | De `@import` staat er (`style.css:2`); het watervalgedrag is standaard browsergedrag, hier niet gemeten |
| 15 | De POST zonder `Content-Type` vermijdt een CORS-preflight | **D** | Standaardgedrag volgens de Fetch-specificatie; niet in een netwerkpaneel waargenomen |
| 16 | De live Apps Script-code is gelijk aan `apps-script/Code.gs` | **C**, en zwak | **Dit is het grootste voorbehoud.** Zie hieronder |
| 17 | Het v11-serverfilter is nooit strenger dan het clientfilter | **B**, getest | Differentieel getest over 19.468.674 combinaties, 0 overtredingen — zie 6.1. Sterkste onderbouwing in dit document na de metingen |
| 18 | Het POST-pad is onveranderd door v11 | **B**, getest | De diff van v10 naar v11 raakt de `insert`-tak niet; uitgevoerd gaf hij dezelfde respons en schreef `edit_token` nog steeds in kolom 10 (6.1) |
| 19 | v11 verwijdert niets uit de sheet | **B** | Er staat geen `deleteRow`, `deleteRows`, `clear` of `setValue` in het bestand; na een uitgevoerde GET was de gesimuleerde sheet onveranderd (6.1) |

### 6.1 Hoe rij 17, 18 en 19 zijn getoetst

De riskantste eigenschap van v11 is dat het serverfilter **nooit strenger** mag
uitpakken dan het filter dat `script.js` al in de browser toepast — anders
verdwijnen er zichtbare oproepen. Dat is niet op het oog vast te stellen, want
de twee filters rekenen in verschillende tijdzones. Daarom is het differentieel
getoetst, buiten Apps Script om:

- `isActueleRit()` uit `apps-script/Code.gs` is naast een letterlijke kopie van
  `script.js:37-43` gezet en op **19.468.674** combinaties vergeleken: elke
  combinatie van 27 servertijdzones × 27 bezoekerstijdzones × 6 tijdstippen
  (waaronder beide Europese zomertijdovergangen van 2026 en een
  jaarwisseling) × ruim 4.400 vertrekdatums
  van 1960 tot 2027, in vier vormen (Date-object, ISO-tekst, datum-only tekst,
  onleesbare rommel), inclusief de JSON-heen-en-weer die er in werkelijkheid
  tussen zit.
- Getelde gevallen waarin de server een rij wegfiltert die de browser wél zou
  tonen: **0**.
- Controle dat die test niet leeg draait: met `MARGE_DAGEN` op `0` vindt
  dezelfde test **726** overtredingen. De test detecteert dus precies de fout
  die hij moet detecteren, en de marge is aantoonbaar nodig.

Daarnaast zijn `doGet`, `doPost` en `statusCheck` uitgevoerd tegen gesimuleerde
`SpreadsheetApp`-, `LockService`- en `ContentService`-objecten, met een sheet
van 94 rijen met vertrekdatums van 1960 tot 2027:

| Toets | Uitkomst |
|---|---|
| GET stuurt alleen actuele rijen | 14 van de 94 rijen, uitsluitend uit het lopende jaar |
| Sheet na afloop | 94 rijen, ongewijzigd — niets verwijderd |
| `?action=status` | `{"status":"success","check":"ok","sheet":"Oproepen","rows":94,…}` |
| Lock bij de statusroute | niet genomen |
| POST `insert` | `{"status":"success","message":"Oproep geplaatst"}`, rij toegevoegd, `edit_token` in kolom 10 |

**Wat dit níét bewijst.** Het is de V8-engine van Node, niet de Apps
Script-runtime, en het zijn nagebootste Google-objecten. Verschillen in hoe
Apps Script celwaarden teruggeeft of tijdzones toepast, vallen hier buiten. Het
bewijst de *logica* van het filter, niet het gedrag op Google's infrastructuur.

> **Het voorbehoud dat alle andere overstijgt.** `apps-script/Code.gs` is een
> handmatig bijgehouden kopie van 20-07-2026. `script.google.com` is vanuit
> deze omgeving niet bereikbaar (HTTP 403), dus de live code is nooit ingezien.
> Elke bevinding met grond **B, kopie** of **C** valt om zodra iemand na
> 20-07-2026 rechtstreeks in de Apps Script-editor iets heeft gewijzigd zonder
> dat hier te spiegelen. De metingen uit 2.0 zijn daar ongevoelig voor: die
> komen van de draaiende backend zelf. Ze bevestigen ook dat de kopie op de
> twee belangrijkste punten (geen datumfilter, geen opschoning) nog steeds met
> de werkelijkheid overeenkomt. Dat is geen bewijs dat de rest ongewijzigd is.
> Loop daarom vóór het plakken de verschil-checklijst na die bij de v11-wijziging
> is geleverd.

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
gewoon HTTP 200 terug. De meting van 6-8-2026 bevestigt de kern hiervan tegen
de draaiende backend: 92 rijen en 47.630 bytes per pageview, met vertrekdatums
tot terug in 1960 en een e-mailadres in 91 van die 92 rijen. `Code.gs` v11 in
deze repo lost de eerste twee punten op (server-side datumfilter én de lichte
`?action=status`-route), maar is pas van kracht zodra hij handmatig in de Apps
Script-editor is geplakt en als **nieuwe versie op de bestaande implementatie**
is uitgerold.
