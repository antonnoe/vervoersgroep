// --- INSTELLINGEN ---
// Zorg dat de naam hieronder PRECIES matcht met je tabbladnaam onderin je sheet
const SHEET_NAME = 'Oproepen';

// Hoe lang een oproep zichtbaar blijft ná de vertrekdatum.
// Deze 3 is exact dezelfde grens die script.js in de browser hanteert
// ("Toon ritten tot 3 dagen na vertrekdatum").
const DAGEN_ZICHTBAAR_NA_VERTREK = 3;

// Extra speling bovenop die 3 dagen, uitsluitend als veiligheidsmarge.
// Reden: het clientfilter rekent met middernacht in de TIJDZONE VAN DE BEZOEKER,
// dit serverfilter met middernacht in de tijdzone van het Apps Script-project.
// Die twee kunnen tot 26 uur uiteenlopen. Zonder marge zou een rit die op de
// laatste dag nét binnen de clientgrens valt, server-side al weggefilterd kunnen
// zijn — en dan verdwijnt een oproep die de bezoeker hoort te zien.
// Met deze marge is het serverfilter gegarandeerd NOOIT strenger dan het
// clientfilter; het is hooguit iets ruimer. Het clientfilter blijft de
// uiteindelijke, zichtbare grens bepalen.
const MARGE_DAGEN = 2;

// --- v12: snelheid ---------------------------------------------------------
// De publieke lijst wordt kort bewaard in de scriptcache. Alleen de eerste
// aanroep binnen dat venster leest de spreadsheet; de rest krijgt exact
// dezelfde bytes terug zonder het Sheet aan te raken. Bij het plaatsen van een
// oproep wordt de cache geleegd, zodat een nieuwe rit meteen zichtbaar is.
const CACHE_SLEUTEL = 'oproepen_publiek_v12';
const CACHE_SECONDEN = 30;
// CacheService weigert items boven ongeveer 100 KB. Boven deze grens slaan we
// niets op; de lijst wordt dan gewoon elke keer vers gelezen.
const CACHE_MAX_TEKENS = 90000;

// Kolommen A tot en met I. Kolom J (edit_token) wordt bewust niet eens gelezen.
const PUBLIEKE_KOLOMMEN = 9;

// Zo lang wacht een plaatsing maximaal op de lock. Lezen neemt sinds v12 géén
// lock meer, dus de lock wordt nog maar milliseconden vastgehouden.
const LOCK_WACHT_MS = 20000;

function doGet(e) {
  if (e && e.parameter && e.parameter.action === 'status') {
    return statusCheck();
  }
  return leesOproepen();
}

function doPost(e) {
  if (e && e.postData && e.postData.contents) {
    var data;
    try {
      data = JSON.parse(e.postData.contents);
    } catch (err) {
      return responseJSON({ status: 'error', message: 'Onleesbare inzending: ' + err.toString() });
    }
    if (data && data.action === 'insert') {
      return plaatsOproep(data);
    }
  }
  // Een POST zonder herkende action gedraagt zich als een GET. Dat was in v11
  // ook zo; bewust ongewijzigd gelaten.
  return leesOproepen();
}

/**
 * De publieke lijst. Neemt GEEN script-lock: lezen hoeft niet op elkaar te
 * wachten. Tot v11 stond elke bezoeker in dezelfde rij als elke plaatsing,
 * wat bij gelijktijdig bezoek seconden kostte.
 */
function leesOproepen() {
  try {
    var cache = null;
    try {
      cache = CacheService.getScriptCache();
      var bewaard = cache.get(CACHE_SLEUTEL);
      if (bewaard) return tekstJSON(bewaard);
    } catch (cacheFout) {
      // Cache kapot of niet beschikbaar: gewoon doorlezen uit het Sheet.
      cache = null;
    }

    var sheet = getSheet();
    var laatsteRij = sheet.getLastRow();

    // Alleen een headerrij, of een leeg tabblad.
    if (laatsteRij < 2) {
      return responseJSON({ status: 'success', data: [] });
    }

    // Alleen de rijen onder de header en alleen de publieke kolommen.
    var breedte = Math.min(PUBLIEKE_KOLOMMEN, sheet.getLastColumn());
    var rows = sheet.getRange(2, 1, laatsteRij - 1, breedte).getValues();

    // Referentiemoment voor het datumfilter: vandaag om middernacht.
    // Zelfde constructie als script.js: new Date() + setHours(0,0,0,0).
    var vandaag = new Date();
    vandaag.setHours(0, 0, 0, 0);

    var data = rows
      .filter(function (row) {                                   // Filter lege rijen
        return row[0] && row[0].toString().trim() !== "";
      })
      .filter(function (row) {                                   // Filter verlopen ritten (kolom 7 = vertrekdatum)
        return isActueleRit(row[6], vandaag);
      })
      .map(function (row) {
        return {
          id: row[0],
          created_at: row[1],
          type: row[2],
          naam_oproeper: row[3],
          van_plaats: row[4],
          naar_plaats: row[5],
          vertrekdatum: row[6],
          details: row[7],
          contact_info: row[8]
          // edit_token (kolom 10 in de sheet) wordt bewust NIET meegegeven in
          // de publieke response (13-07-2026 gefixt) en sinds v12 niet eens
          // meer uit de sheet gelezen; hij wordt bij plaatsing wel opgeslagen.
        };
      });

    var json = JSON.stringify({ status: 'success', data: data });

    if (cache && json.length <= CACHE_MAX_TEKENS) {
      try {
        cache.put(CACHE_SLEUTEL, json, CACHE_SECONDEN);
      } catch (putFout) {
        // Niet kunnen cachen is geen reden om de bezoeker een fout te geven.
      }
    }

    return tekstJSON(json);

  } catch (err) {
    return responseJSON({ status: 'error', message: err.toString() });
  }
}

/**
 * Eén oproep toevoegen. Dit is het enige pad dat de script-lock nodig heeft,
 * en het houdt hem alleen vast rond appendRow zelf.
 */
function plaatsOproep(data) {
  var lock = LockService.getScriptLock();
  var vergrendeld = false;

  try {
    vergrendeld = lock.tryLock(LOCK_WACHT_MS);
    if (!vergrendeld) {
      // v11 schreef in dit geval tóch, zonder lock. Melden is veiliger: de
      // bezoeker ziet de foutmelding en kan opnieuw op de knop drukken.
      return responseJSON({
        status: 'error',
        message: 'De server is nu bezet. Probeer het over een paar seconden opnieuw.'
      });
    }

    var sheet = getSheet();

    // appendRow voegt automatisch toe na de LAATSTE regel met data
    sheet.appendRow([
      data.id,
      data.created_at,
      data.type,
      data.naam_oproeper,
      data.van_plaats,
      data.naar_plaats,
      data.vertrekdatum,
      data.details,
      data.contact_info,
      data.edit_token
    ]);

    // De bewaarde lijst is nu verouderd.
    leegCache();

    return responseJSON({ status: 'success', message: 'Oproep geplaatst' });

  } catch (err) {
    return responseJSON({ status: 'error', message: err.toString() });
  } finally {
    if (vergrendeld) lock.releaseLock();
  }
}

function leegCache() {
  try {
    CacheService.getScriptCache().remove(CACHE_SLEUTEL);
  } catch (err) {
    // Cache niet beschikbaar: hij verloopt vanzelf binnen CACHE_SECONDEN.
  }
}

/**
 * Bepaalt of één rij nog meegestuurd moet worden in de publieke GET-response.
 *
 * Dit is de server-side tegenhanger van het filter dat script.js in de browser
 * toepast:
 *
 *   if (!rit.vertrekdatum) return false;
 *   const vertrekDatum = new Date(rit.vertrekdatum);
 *   const dagenVerschil = (vandaag - vertrekDatum) / (1000 * 60 * 60 * 24);
 *   return dagenVerschil <= 3;
 *
 * Verschillen, en alleen deze:
 *  - een vertrekdatum die niet te lezen is, wordt hier BEHOUDEN in plaats van
 *    weggegooid (de browser gooit hem weg, want NaN <= 3 is false). Behouden is
 *    de veilige kant: server-side weggooien zou onherstelbaar zijn voor de
 *    bezoeker, client-side wegfilteren gebeurt daarna alsnog;
 *  - de grens is 3 + MARGE_DAGEN in plaats van kaal 3, zie de toelichting bij
 *    MARGE_DAGEN hierboven.
 * Beide verschillen maken het filter RUIMER, nooit strenger. Er kan dus geen
 * oproep verdwijnen die nu wel zichtbaar is.
 *
 * Er wordt niets verwijderd of gewijzigd in de sheet; de rij blijft staan en
 * wordt alleen niet meer over de lijn gestuurd.
 *
 * Ongewijzigd sinds v11.
 *
 * @param {*} vertrekdatumWaarde De celwaarde uit kolom 7 (Date of tekst).
 * @param {Date} vandaag Vandaag om middernacht.
 * @return {boolean} true = meesturen.
 */
function isActueleRit(vertrekdatumWaarde, vandaag) {
  // Geen vertrekdatum: valt af. Zelfde als `if (!rit.vertrekdatum) return false;`
  if (vertrekdatumWaarde === null || vertrekdatumWaarde === undefined) return false;
  if (typeof vertrekdatumWaarde === 'string' && vertrekdatumWaarde.trim() === '') return false;
  if (vertrekdatumWaarde === '') return false;

  var vertrekDatum = (vertrekdatumWaarde instanceof Date)
    ? vertrekdatumWaarde
    : new Date(vertrekdatumWaarde);

  // Onleesbare datum: bewust BEHOUDEN, zie de toelichting hierboven.
  if (isNaN(vertrekDatum.getTime())) return true;

  var dagenVerschil = (vandaag - vertrekDatum) / (1000 * 60 * 60 * 24);
  return dagenVerschil <= (DAGEN_ZICHTBAAR_NA_VERTREK + MARGE_DAGEN);
}

/**
 * Lichte status-route voor externe monitoring (UptimeRobot).
 * Bevestigt uitsluitend: (1) Apps Script draait, (2) de spreadsheet is
 * gekoppeld, (3) het tabblad is leesbaar. Leest GEEN rij-inhoud en neemt
 * bewust GEEN script-lock, zodat de monitor nooit in de wachtrij staat met
 * echte bezoekers. Schrijft niets.
 *
 * Aanroepen als: <exec-URL>?action=status
 * Monitoren op keyword: "check":"ok"
 *
 * Ongewijzigd sinds v11.
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

function responseJSON(data) {
  return tekstJSON(JSON.stringify(data));
}

function tekstJSON(json) {
  return ContentService.createTextOutput(json).setMimeType(ContentService.MimeType.JSON);
}

function getSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    // Fallback: pak het eerste tabblad als de naam niet klopt
    sheet = ss.getSheets()[0];
  }
  return sheet;
}
