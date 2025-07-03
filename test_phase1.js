const fs = require('fs');
const path = require('path');

// Load Phase1AutomationService
const Phase1AutomationService = require('./services/phase1AutomationService');

// === Helper: Load and transform sample payload ===
function loadSampleFormData() {
  const payloadPath = path.join(__dirname, 'fully_wrapped_payload.json');
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
}

async function runTest() {
  console.log('\n=== RUNNING PHASE-1 TEST PAYLOAD ===');
  const formData = loadSampleFormData();

  const phase1 = new Phase1AutomationService();
  stubExternalMethods(phase1);

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