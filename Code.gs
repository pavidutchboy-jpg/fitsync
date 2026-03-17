// ============================================
// FitSync — Google Apps Script Backend
// Paste this into script.google.com
// Replace YOUR_SHEET_ID with your actual ID
// ============================================

const SHEET_ID = "YOUR_SHEET_ID";
const SHEET_NAME = "Sheet1";

function doPost(e) {
  try {
    const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(SHEET_NAME);
    const data = JSON.parse(e.postData.contents);

    sheet.appendRow([
      new Date().toISOString(),  // Timestamp
      data.name || '',           // Name (Me / Wife)
      data.protein || 0,         // Protein (g)
      data.creatine ? 1 : 0,     // Creatine (1 or 0)
      data.workout || '',        // Workout type
      data.mood || '',           // Energy level (1-5)
      data.notes || '',          // Notes
      data.date || ''            // Date (YYYY-MM-DD)
    ]);

    return ContentService
      .createTextOutput(JSON.stringify({ status: 'ok' }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ status: 'error', message: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  try {
    const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(SHEET_NAME);

    // Add headers row if sheet is empty
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(['Timestamp', 'Name', 'Protein', 'Creatine', 'Workout', 'Mood', 'Notes', 'Date']);
    }

    const data = sheet.getDataRange().getValues();

    return ContentService
      .createTextOutput(JSON.stringify(data))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ status: 'error', message: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// Optional: Weekly summary email (set a weekly trigger on this function)
function weeklySummary() {
  const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(SHEET_NAME);
  const data = sheet.getDataRange().getValues().slice(1); // skip header

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 7);

  const thisWeek = data.filter(r => new Date(r[0]) >= cutoff);

  const summary = {
    Me: { protein: 0, creatine: 0, workout: 0, days: 0 },
    Wife: { protein: 0, creatine: 0, workout: 0, days: 0 }
  };

  thisWeek.forEach(r => {
    const name = r[1];
    if (!summary[name]) return;
    summary[name].days++;
    summary[name].protein += r[2] || 0;
    summary[name].creatine += r[3] || 0;
    if (r[4]) summary[name].workout++;
  });

  const body = `
FitSync Weekly Summary 💪

ME:
  Days logged: ${summary['Me'].days}
  Total protein: ${summary['Me'].protein}g
  Creatine days: ${summary['Me'].creatine}/7
  Workouts: ${summary['Me'].workout}

WIFE:
  Days logged: ${summary['Wife'].days}
  Total protein: ${summary['Wife'].protein}g
  Creatine days: ${summary['Wife'].creatine}/7
  Workouts: ${summary['Wife'].workout}
`;

  MailApp.sendEmail(Session.getActiveUser().getEmail(), 'FitSync Weekly Summary', body);
}
