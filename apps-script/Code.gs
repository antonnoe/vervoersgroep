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

function doGet(e) {
  if (e && e.parameter && e.parameter.action === 'status') {
    return statusCheck();
  }
  return handleRequest(e);
}

function doPost(e) {
  return handleRequest(e);
}

function handleRequest(e) {
  const lock = LockService.getScriptLock();
  lock.tryLock(10000);

  try {
    const sheet = getSheet();

    // 1. IEMAND PLAATST EEN OPROEP (POST)
    if (e.postData && e.postData.contents) {
      const data = JSON.parse(e.postData.contents);

      if (data.action === 'insert') {
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
        return responseJSON({ status: 'success', message: 'Oproep geplaatst' });
      }
    }

    // 2. DATA OPHALEN (GET)
    const rows = sheet.getDataRange().getValues();

    // We nemen aan dat rij 1 de headers zijn.
    // We filteren alle rijen eruit die geen ID hebben (lege regels)
    const headers = rows.shift(); // Haal headers eraf

    // Referentiemoment voor het datumfilter: vandaag om middernacht.
    // Zelfde constructie als script.js: new Date() + setHours(0,0,0,0).
    const vandaag = new Date();
    vandaag.setHours(0, 0, 0, 0);

    const data = rows
      .filter(row => row[0] && row[0].toString().trim() !== "") // Filter lege rijen
      .filter(row => isActueleRit(row[6], vandaag))             // Filter verlopen ritten (kolom 7 = vertrekdatum)
      .map((row) => {
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
          // edit_token (kolom 10 in de sheet) wordt bewust NIET meer
          // meegegeven in de publieke response (13-07-2026 gefixt);
          // hij wordt bij plaatsing wel gewoon opgeslagen.
        };
      });

    return responseJSON({ status: 'success', data: data });

  } catch (e) {
    return responseJSON({ status: 'error', message: e.toString() });
  } finally {
    lock.releaseLock();
  }
}

/**
 * Bepaalt of één rij nog meegestuurd moet worden in de publieke GET-response.
 *
 * Dit is de server-side tegenhanger van het filter dat script.js tot nu toe
 * pas in de browser toepaste:
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
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
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
