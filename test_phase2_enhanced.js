const Phase2AutomationService = require('./services/phase2AutomationService');

// Test Phase 2 automation with enhanced functionality
async function testPhase2Enhanced() {
  console.log('=== TESTING ENHANCED PHASE 2 AUTOMATION ===');
  
  const phase2Service = new Phase2AutomationService();
  
  // Test data - replace with actual lead ID from your system
  const testLeadId = 'test-lead-12345';
  
  const testPhase2FormData = {
    // Form data from fillout.com - adjust fields as needed
    company_description: 'Clean energy project focused on solar installations',
    funding_amount: '$2,500,000',
    use_of_funds: 'Equipment purchase and installation costs',
    team_size: 15,
    project_timeline: '18 months',
    regulatory_approvals: 'SEC Form D filed, state permits obtained',
    
    // File upload data (URLs from fillout form)
    articles_of_incorporation: 'https://example.com/articles.pdf',
    ein_documentation: 'https://example.com/ein.pdf',
    cap_table: 'https://example.com/captable.pdf',
    governing_documents: 'https://example.com/bylaws.pdf',
    
    // Additional metadata
    submission_timestamp: new Date().toISOString(),
    form_version: '2.1'
  };

  try {
    console.log('Starting Phase 2 processing...');
    console.log('Lead ID:', testLeadId);
    console.log('Form Data:', JSON.stringify(testPhase2FormData, null, 2));
    
    const result = await phase2Service.processPhase2Lead(testLeadId, testPhase2FormData);
    
    console.log('=== PHASE 2 PROCESSING COMPLETED ===');
    console.log('Result:', JSON.stringify(result, null, 2));
    
    console.log('\\n=== SUMMARY ===');
    console.log('✅ Business Name:', result.business_legal_name);
    console.log('✅ Phase 2 Folder ID:', result.phase2_folder_id);
    console.log('✅ Internal Folders Created:');
    Object.entries(result.internal_folders).forEach(([key, folder]) => {
      console.log(`   - ${key}: ${folder.id} (${folder.webViewLink})`);
    });
    
    if (result.generated_documents) {
      console.log('✅ Generated Documents:');
      Object.entries(result.generated_documents).forEach(([key, doc]) => {
        console.log(`   - ${key}: ${doc.id} (${doc.webViewLink})`);
      });
    }
    
  } catch (error) {
    console.error('❌ Phase 2 processing failed:');
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
    
    // Log additional debugging info
    if (error.response?.data) {
      console.error('Google API Error:', error.response.data);
    }
  }
}

// Helper function to test individual components
async function testIndividualComponents() {
  console.log('\\n=== TESTING INDIVIDUAL COMPONENTS ===');
  
  const Phase2DriveUtils = require('./services/phase2DriveUtils');
  const driveUtils = new Phase2DriveUtils();
  
  try {
    // Test URL extraction
    const testUrl = 'https://docs.google.com/document/d/1OS7q3Zzo8wc6wWXpK-jNsklkiArgs0xndqGClBDSN1Y/edit?usp=drive_link';
    const extractedId = driveUtils.extractFileIdFromUrl(testUrl);
    console.log('✅ URL Extraction Test:');
    console.log('   URL:', testUrl);
    console.log('   Extracted ID:', extractedId);
    
    // Test environment variables
    console.log('\\n✅ Environment Variables:');
    console.log('   LEADS_PHASE1_FOLDER_ID:', process.env.LEADS_PHASE1_FOLDER_ID || '❌ NOT SET');
    console.log('   LEADS_PHASE2_FOLDER_ID:', process.env.LEADS_PHASE2_FOLDER_ID || '❌ NOT SET');
    console.log('   GOOGLE_CREDENTIALS_PATH:', process.env.GOOGLE_CREDENTIALS_PATH || '❌ NOT SET');
    
  } catch (error) {
    console.error('❌ Component test failed:', error.message);
  }
}

// Run tests
async function runAllTests() {
  try {
    await testIndividualComponents();
    console.log('\\n' + '='.repeat(50));
    await testPhase2Enhanced();
  } catch (error) {
    console.error('Test suite failed:', error);
    process.exit(1);
  }
}

// Execute if run directly
if (require.main === module) {
  runAllTests();
}

module.exports = {
  testPhase2Enhanced,
  testIndividualComponents,
  runAllTests
};