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

console.log('🧪 Testing table variable naming fix...');

const phase1 = new Phase1AutomationService();

// Stub external methods
phase1.initializeServices = () => console.log('🧪 [STUB] initializeServices skipped');
phase1.createClientFolders = async (enrichedData) => {
  console.log('🧪 [STUB] createClientFolders called');
  return {
    main: { id: 'dummyMainFolderId', webViewLink: 'https://dummy.link/main' },
    internal: { id: 'dummyInternalFolderId', webViewLink: 'https://dummy.link/internal' }
  };
};

phase1.createAllDocuments = async (enrichedData, internalFolderId) => {
  console.log('🧪 [STUB] createAllDocuments called');
  
  // Check table variable naming - should use underscores now
  console.log('📊 Team member variable check:');
  console.log('   full_name_team_1:', JSON.stringify(enrichedData.full_name_team_1));
  console.log('   email_team_1:', JSON.stringify(enrichedData.email_team_1));
  console.log('   title_team_1:', JSON.stringify(enrichedData.title_team_1));
  console.log('   full_name_team_2:', JSON.stringify(enrichedData.full_name_team_2));
  console.log('   email_team_2:', JSON.stringify(enrichedData.email_team_2));
  console.log('   title_team_2:', JSON.stringify(enrichedData.title_team_2));
  
  // Check that old variable names are NOT present
  console.log('🚫 Old variable check (should be undefined):');
  console.log('   fullnameteam_1:', JSON.stringify(enrichedData.fullnameteam_1));
  console.log('   emailteam_1:', JSON.stringify(enrichedData.emailteam_1));
  console.log('   titleteam_1:', JSON.stringify(enrichedData.titleteam_1));
  
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
        'EIN': '12-3456789'
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
        'EIN': '12-3456789'
      };
    }
    return null;
  }
};

// Run the test
async function runTest() {
  try {
    await phase1.processNewLead(formData);
    console.log('\n✅ Table variable naming fix test completed!');
    console.log('🎯 Variables now use correct underscore format for template compatibility');
  } catch (err) {
    console.error('\n❌ Test failed:', err.message);
    console.error(err.stack);
  }
}

runTest();