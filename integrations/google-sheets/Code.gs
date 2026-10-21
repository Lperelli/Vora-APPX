/**
 * VORA lead receiver. Configure script properties, then deploy as a web app.
 * This script never sends email and exposes no lead-reading endpoint.
 */
function doGet() {
  return json_({ ok: false });
}

function doPost(event) {
  var lock;
  try {
    if (!event || !event.postData || event.postData.contents.length > 2048) return json_({ ok: false });
    var data = JSON.parse(event.postData.contents);
    var properties = PropertiesService.getScriptProperties();
    var secret = properties.getProperty('LEADS_SECRET');
    if (!secret || !data || typeof data.token !== 'string' || data.token !== secret) return json_({ ok: false });
    var email = typeof data.email === 'string' ? data.email.trim().toLowerCase() : '';
    var requestId = typeof data.requestId === 'string' ? data.requestId : '';
    if (email.length > 254 || /[\x00-\x20\x7f]/.test(email) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json_({ ok: false });
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestId)) return json_({ ok: false });
    var firstName = typeof data.firstName === 'string' ? data.firstName.trim() : '';
    var lastName = typeof data.lastName === 'string' ? data.lastName.trim() : '';
    if (!firstName || !lastName || firstName.length > 80 || lastName.length > 80 || /[\x00-\x1f\x7f]/.test(firstName + lastName)) return json_({ ok: false });
    if (typeof data.subscribe !== 'boolean' || typeof data.legalVersion !== 'string' || !data.legalVersion || data.legalVersion.length > 80) return json_({ ok: false });
    if (data.source !== 'vora-app') return json_({ ok: false });

    lock = LockService.getScriptLock();
    if (!lock.tryLock(5000)) return json_({ ok: false });
    var spreadsheet = SpreadsheetApp.openById(properties.getProperty('LEADS_SHEET_ID'));
    var sheet = spreadsheet.getSheetByName('Leads');
    if (!sheet) return json_({ ok: false });
    var expected = ['Email', 'Fecha de registro (UTC)', 'Origen', 'ID de solicitud', 'Nombre', 'Apellido', 'Suscripcion', 'Version legal'];
    var headers = sheet.getRange(1, 1, 1, 8).getValues()[0];
    if (headers.some(function (value, index) { return value !== expected[index]; })) return json_({ ok: false });
    // Dedicated lead sheet uses UTC so Date values remain sortable and unambiguous.
    if (spreadsheet.getSpreadsheetTimeZone() !== 'Etc/UTC') return json_({ ok: false });
    var lastRow = sheet.getLastRow();
    var nextRow = lastRow + 1;
    if (lastRow > 1) {
      var previousId = sheet.getRange(2, 4, lastRow - 1, 1).createTextFinder(requestId).matchEntireCell(true).findNext();
      if (previousId) {
        var previousEmail = sheet.getRange(previousId.getRow(), 1).getDisplayValue().toLowerCase();
        var previous = sheet.getRange(previousId.getRow(), 1, 1, 8).getValues()[0];
        return json_({ ok: previousEmail === email && plainText_(previous[4]) === firstName && plainText_(previous[5]) === lastName && previous[6] === data.subscribe && plainText_(previous[7]) === data.legalVersion, requestId: requestId });
      }
      var existingEmail = sheet.getRange(2, 1, lastRow - 1, 1).createTextFinder(email).matchEntireCell(true).matchCase(false).findNext();
      // A new request updates the explicit choice; an old opted-in value must not win.
      if (existingEmail) nextRow = existingEmail.getRow();
    }
    // Prefix formula-like addresses so user-supplied text cannot execute in Sheets.
    var safeEmail = /^[=+\-@]/.test(email) ? "'" + email : email;
    if (nextRow > sheet.getMaxRows()) sheet.insertRowsAfter(sheet.getMaxRows(), 100);
    sheet.getRange(nextRow, 1, 1, 8).setValues([[safeEmail, new Date(), 'vora-app', requestId, safeText_(firstName), safeText_(lastName), data.subscribe, safeText_(data.legalVersion)]]);
    sheet.getRange(nextRow, 2).setNumberFormat('yyyy-mm-dd hh:mm:ss');
    SpreadsheetApp.flush();
    return json_({ ok: true, requestId: requestId });
  } catch (error) {
    // Do not record emails, tokens, or request contents in logs.
    return json_({ ok: false });
  } finally {
    if (lock && lock.hasLock()) lock.releaseLock();
  }
}

function json_(body) {
  return ContentService.createTextOutput(JSON.stringify(body)).setMimeType(ContentService.MimeType.JSON);
}

function safeText_(value) {
  return /^[=+\-@]/.test(value) ? "'" + value : value;
}

function plainText_(value) {
  return String(value).replace(/^'(?=[=+\-@])/, '');
}
