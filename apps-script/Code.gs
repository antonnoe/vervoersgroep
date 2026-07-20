// --- INSTELLINGEN ---
// Zorg dat de naam hieronder PRECIES matcht met je tabbladnaam onderin je sheet
const SHEET_NAME = 'Oproepen';

function doGet(e) {
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

    const data = rows
      .filter(row => row[0] && row[0].toString().trim() !== "") // Filter lege rijen
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
