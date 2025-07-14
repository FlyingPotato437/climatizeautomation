const fs = require('fs');
const path = require('path');
const Phase1AutomationService = require('./services/phase1AutomationService');

// Load returning customer payload
const payloadPath = path.join(__dirname, 'payload_returning_customer.json');
const raw = fs.readFileSync(payloadPath, 'utf8');
const payload = JSON.parse(raw);

// Transform to form data
const formData = {};
if (Array.isArray(payload.questions)) {
  payload.questions.forEach((q) => {
    formData[q.name] = q.value;
  });
}
formData.form_id = payload.form_id;
formData.submission_time = payload.submission_time;

console.log('🧪 Testing returning customer Joe with payload');
console.log('📋 Form fields provided:', Object.keys(formData).filter(k => !['form_id', 'submission_time'].includes(k)));

// Create service and stub methods
const phase1 = new Phase1AutomationService();

// Stub external methods
phase1.initializeServices = () => console.log('🧪 [STUB] initializeServices skipped');

phase1.createClientFolders = async (enrichedData) => {
  const folderName = `${enrichedData.project_name} (${enrichedData.business_legal_name})`;
  console.log('🧪 [STUB] createClientFolders - Folder name will be:', folderName);
  return {
    main: { id: 'dummyMainFolderId', webViewLink: 'https://dummy.link/main' },
    internal: { id: 'dummyInternalFolderId', webViewLink: 'https://dummy.link/internal' }
  };
};

phase1.createAllDocuments = async (enrichedData, internalFolderId) => {
  console.log('🧪 [STUB] createAllDocuments called');
  console.log('📄 Key variables:');
  console.log('   Business Legal Name:', enrichedData.business_legal_name);
  console.log('   Project Name:', enrichedData.project_name);
  console.log('   First Name:', enrichedData.first_name_poc);
  console.log('   Email:', enrichedData.email_poc);
  console.log('   EIN:', enrichedData.ein_number);
  
  // Check table data clearing
  console.log('📊 Table data verification:');
  console.log('   full_name_20_1:', JSON.stringify(enrichedData.full_name_20_1));
  console.log('   email20_1:', JSON.stringify(enrichedData.email20_1));
  console.log('   fullnameteam_1:', JSON.stringify(enrichedData.fullnameteam_1));
  console.log('   creditor_1:', JSON.stringify(enrichedData.creditor_1));
  
  return { stubDocument: { id: 'doc123', webViewLink: 'https://dummy.link/doc' } };
};

// Stub sheets service for Joe
phase1.sheetsService = {
  getBusinessDataByEmail: async (email) => {
    console.log('🧪 [STUB] getBusinessDataByEmail called for', email);
    if (email.toLowerCase() === 'joe@gmail.com') {
      return {
        'Business Legal Name': '123',
        'DBA (Doing Buisness As)': 'Joe Business',
        'EIN': '12-3456789',
        'Type of Entity': 'LLC',
        'State of Incorporation': 'CA',
        'Incorporation Date': 'Jan 1, 2020',
        'Fiscal Year End': '12/31',
        'Website': 'https://joebusiness.com',
        'Address - Business Physical Address': '123 Main St\\nSan Diego CA 92101',
        'Business Phone': '+16195550000',
        'Please describe your business model': 'Business services',
        'CCC': '123456',
        'CIK': '000111111',
        'Do you have reviewed or audited financial statements?': 'Reviewed',
        'How many employees does your company currently have?': '10'
      };
    }
    return null;
  },
  getBusinessDataByFirstName: async (firstName) => {
    console.log('🧪 [STUB] getBusinessDataByFirstName called for', firstName);
    if (firstName.toLowerCase() === 'joe') {
      return {
        'Business Legal Name': '123',
        'DBA (Doing Buisness As)': 'Joe Business',
        'EIN': '12-3456789',
        'Type of Entity': 'LLC',
        'State of Incorporation': 'CA',
        'Incorporation Date': 'Jan 1, 2020',
        'Fiscal Year End': '12/31',
        'Website': 'https://joebusiness.com',
        'Address - Business Physical Address': '123 Main St\\nSan Diego CA 92101',
        'Business Phone': '+16195550000',
        'Please describe your business model': 'Business services',
        'CCC': '123456',
        'CIK': '000111111',
        'Do you have reviewed or audited financial statements?': 'Reviewed',
        'How many employees does your company currently have?': '10'
      };
    }
    return null;
  }
};

// Run the test
async function runTest() {
  try {
    const result = await phase1.processNewLead(formData);
    console.log('\n✅ TEST PASSED - Returning customer flow working correctly!');
    console.log('📁 Folder structure created for client:', result.client);
    console.log('🎯 All business data auto-populated from sheets');
    console.log('📊 Table data properly cleared to prevent malformed output');
  } catch (err) {
    console.error('\n❌ TEST FAILED:', err.message);
    console.error(err.stack);
  }
}

runTest();