const fs = require('fs');
const path = require('path');

// Load Phase1AutomationService
const Phase1AutomationService = require('./services/phase1AutomationService');

// === Helper: Load and transform sample payload ===
function loadSampleFormData() {
  const fileName = process.env.NO_BUSINESS ? 'payload_no_business.json' : 'fully_wrapped_payload.json';
  const payloadPath = path.join(__dirname, fileName);
  const raw = fs.readFileSync(payloadPath, 'utf8');
  const payload = JSON.parse(raw);

  // Transform the Fillout structure {questions: [{name, value}, ...]} into a flat object
  const formData = {};
  if (Array.isArray(payload.questions)) {
    payload.questions.forEach((q) => {
      formData[q.name] = q.value;
    });
  }

  // Preserve some useful top-level metadata
  formData.form_id = payload.form_id;
  formData.submission_time = payload.submission_time;

  return formData;
}

// === Helper: create stub methods to avoid external API calls ===
function stubExternalMethods(service) {
  // Skip initialization of real Google services
  service.initializeServices = () => {
    console.log('🧪 [STUB] initializeServices skipped');
  };

  // Stub folder creation: return dummy IDs/links
  service.createClientFolders = async (businessName) => {
    console.log(`🧪 [STUB] createClientFolders called for "${businessName}"`);
    return {
      main: { id: 'dummyMainFolderId', webViewLink: 'https://dummy.link/main' },
      internal: { id: 'dummyInternalFolderId', webViewLink: 'https://dummy.link/internal' }
    };
  };

  // Stub document creation: just log the variables that would be inserted
  service.createAllDocuments = async (enrichedData, internalFolderId) => {
    console.log('🧪 [STUB] createAllDocuments called');
    console.log('📄 Enriched data contains', Object.keys(enrichedData).length, 'fields');

    // Display lookup result for business data
    console.log('🏷️  Business Legal Name:', enrichedData.business_legal_name);

    // Display a preview focusing on table-related arrays
    const previewKeys = [
      'owners_20_percent',
      'team_members',
      'debt_schedule',
      'reg_offerings_details'
    ];
    previewKeys.forEach((k) => {
      if (k in enrichedData) {
        console.log(`\n🔎 ${k}:`);
        console.dir(enrichedData[k], { depth: null });
      }
    });

    // Return fake documents so downstream logic succeeds
    return {
      stubDocument: { id: 'doc123', webViewLink: 'https://dummy.link/doc' }
    };
  };

  // Stub Google Sheets service so enrichData can run without hitting real API
  service.sheetsService = {
    getBusinessDataByEmail: async (email) => {
      console.log(`🧪 [STUB] getBusinessDataByEmail called for ${email}`);
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
          'Address - Business Physical Address': '123 Main St\nSan Diego CA 92101',
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
      console.log(`🧪 [STUB] getBusinessDataByFirstName called for ${firstName}`);
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
          'Address - Business Physical Address': '123 Main St\nSan Diego CA 92101',
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
}

async function runTest() {
  console.log('\n=== RUNNING PHASE-1 TEST PAYLOAD ===');
  const formData = loadSampleFormData();

  const phase1 = new Phase1AutomationService();
  if (!process.env.REAL_RUN) {
    console.log('\n[TEST] REAL_RUN not set – using stubbed external methods');
    stubExternalMethods(phase1);
  } else {
    console.log('\n[TEST] REAL_RUN detected – will execute real Google API calls');
  }

  try {
    const result = await phase1.processNewLead(formData);
    console.log('\n✅ Test completed. Summary:');
    console.dir(result, { depth: null });
  } catch (err) {
    console.error('\n❌ Test run failed:', err.message);
  }
}

if (require.main === module) {
  runTest();
} 