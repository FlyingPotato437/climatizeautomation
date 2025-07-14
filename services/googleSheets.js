const { google } = require('googleapis');
const GoogleAuthService = require('./googleAuth');

class GoogleSheetsService {
  constructor() {
    this.authService = new GoogleAuthService();
    this.sheets = null;
    this.sheetId = process.env.PREVIOUS_PROJECTS_SHEET_ID || '1kULYAYpo6KinbTPXkRVbYn1lvsq37tcaTiBDRW75vYs';
  }

  initializeApi() {
    if (!this.sheets) {
      this.sheets = google.sheets({ version: 'v4', auth: this.authService.getAuth() });
    }
  }

  async getBusinessDataByFirstName(firstName) {
    try {
      console.log(`🔍 SHEETS DEBUG: Looking up business data for first name: "${firstName}"`);
      this.initializeApi();
      await this.authService.ensureValidToken();
      console.log(`🔍 SHEETS DEBUG: Auth token validated, accessing sheet ID: ${this.sheetId}`);

      let sheetRange = 'Form Responses 1';
      let res;
      try {
        res = await this.sheets.spreadsheets.values.get({
          spreadsheetId: this.sheetId,
          range: sheetRange
        });
      } catch (rangeErr) {
        if (rangeErr.errors && rangeErr.errors[0] && rangeErr.errors[0].reason === 'badRequest') {
          console.log('ℹ️ Range "Form Responses 1" not found, discovering sheet names...');
          const meta = await this.sheets.spreadsheets.get({ spreadsheetId: this.sheetId });
          const firstSheet = meta.data.sheets && meta.data.sheets[0];
          if (!firstSheet) throw rangeErr;
          sheetRange = firstSheet.properties.title;
          console.log('↪️ Using sheet:', sheetRange);
          res = await this.sheets.spreadsheets.values.get({
            spreadsheetId: this.sheetId,
            range: sheetRange
          });
        } else {
          throw rangeErr;
        }
      }

      const rows = res.data.values;
      if (!rows || rows.length === 0) {
        console.log('No data found in previous projects sheet.');
        return null;
      }

      const header = rows[0];
      const nameIndex = header.findIndex(h => h.toLowerCase().includes('first name'));
      if (nameIndex === -1) {
        console.log('First Name column not found in sheet');
        return null;
      }

      // Find ALL matching rows for the first name
      const matches = rows
        .slice(1) // skip header
        .filter(r => ((r[nameIndex] || '').trim().toLowerCase()) === firstName.trim().toLowerCase());

      if (matches.length === 0) {
        console.log(`🔍 SHEETS DEBUG: No matches found for "${firstName}"`);
        return null;
      }

      // Prefer the one with the newest Submission time if that column exists, otherwise the last match
      let chosenRow = matches[matches.length - 1];

      const timeIndex = header.findIndex(h => h.toLowerCase().includes('submission time'));
      if (timeIndex !== -1) {
        chosenRow = matches.reduce((latest, current) => {
          const latestTime = new Date(latest[timeIndex] || 0);
          const currentTime = new Date(current[timeIndex] || 0);
          return currentTime > latestTime ? current : latest;
        }, matches[0]);
      }

      const data = {};
      header.forEach((col, idx) => {
        data[col] = chosenRow[idx];
      });

      // DEBUG: log all matching rows for inspection
      console.log('📊 Sheet matches for', firstName, ':');
      matches.forEach((r, idx) => {
        console.log(`   #${idx + 1}:`, {
          submissionTime: timeIndex !== -1 ? r[timeIndex] : 'n/a',
          businessLegalName: r[header.findIndex(h=>h.includes('Business Legal Name'))] || '',
          ein: r[header.findIndex(h=>h === 'EIN')] || ''
        });
      });

      console.log('✅ Chosen row:', {
        submissionTime: timeIndex !== -1 ? chosenRow[timeIndex] : 'n/a',
        businessLegalName: data['Business Legal Name'],
        ein: data['EIN']
      });
      console.log(`🔍 SHEETS DEBUG: Successfully found data for "${firstName}", returning business: ${data['Business Legal Name']}`);
      return data;
    } catch (err) {
      console.error('Error fetching sheet data:', err.message);
      return null;
    }
  }
}

module.exports = GoogleSheetsService; 