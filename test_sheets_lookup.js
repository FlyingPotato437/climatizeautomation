const GoogleSheetsService = require('./services/googleSheets');

async function testSheetsLookup() {
  console.log('🧪 Testing Google Sheets lookup for Joe...');
  
  try {
    const sheetsService = new GoogleSheetsService();
    
    console.log('📋 Sheet ID being used:', sheetsService.sheetId);
    
    // Test lookup for Joe
    const result = await sheetsService.getBusinessDataByFirstName('Joe');
    
    if (result) {
      console.log('✅ SUCCESS: Found data for Joe');
      console.log('📊 Keys returned:', Object.keys(result));
      console.log('🏢 Business Legal Name:', result['Business Legal Name']);
      console.log('📧 Email:', result['Email'] || result['email']);
      console.log('🔢 EIN:', result['EIN']);
      console.log('🏭 Entity Type:', result['Type of Entity']);
      console.log('📅 Submission Time:', result['Submission time']);
      
      // Show first few fields for debugging
      console.log('📝 First 10 fields:');
      Object.keys(result).slice(0, 10).forEach(key => {
        console.log(`   ${key}: ${result[key]}`);
      });
    } else {
      console.log('❌ FAILED: No data found for Joe');
      console.log('💡 This could mean:');
      console.log('   - No "Joe" entry exists in the sheet');
      console.log('   - Sheet access permissions issue');
      console.log('   - Wrong sheet ID or range');
    }
    
  } catch (error) {
    console.error('❌ ERROR:', error.message);
    console.error('🔍 Full error:', error);
  }
}

testSheetsLookup();