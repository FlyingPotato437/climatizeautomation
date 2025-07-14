const GoogleSheetsService = require('./services/googleSheets');

(async () => {
  const email = process.argv[2] || 'joe@gmail.com';
  const sheets = new GoogleSheetsService();
  const row = await sheets.getBusinessDataByEmail(email);
  if (!row) {
    console.log('No row found for', email);
  } else {
    console.log('Row for', email, '->');
    Object.entries(row).forEach(([k, v]) => console.log(`${k}: ${v}`));
  }
})(); 