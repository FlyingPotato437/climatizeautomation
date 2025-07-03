const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const crypto = require('crypto');
require('dotenv').config();

const Phase1AutomationService = require('./services/phase1AutomationService');
const GoogleAuthService = require('./services/googleAuth');

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Initialize services
const phase1AutomationService = new Phase1AutomationService();
const googleAuthService = new GoogleAuthService();

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'Climatize.earth Term Sheet Automation API',
    version: '1.0.0',
    status: 'running',
    endpoints: {
      webhook: '/webhook/fillout',
      auth: '/auth/google',
      test: '/test',
      health: '/health'
    }
  });
});

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      message: 'Document generation service ready'
    });
  } catch (error) {
    res.status(500).json({
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Legacy webhook endpoint for backwards compatibility
app.post('/webhook/fillout', async (req, res) => {
  try {
    console.log('=== LEGACY FILLOUT WEBHOOK RECEIVED ===');
    console.log('Redirecting to Phase 1 processing...');
    
    // Process as Phase 1 lead
    const formData = extractFormData(req.body);
    
    // Check for business name in multiple formats (legacy endpoint)
    const businessName = formData.business_legal_name || formData['Business Legal Name'];
    const contactEmail = formData.contact_email || formData['Email'];
    
    if (!businessName && !contactEmail) {
      console.error('Missing required form data');
      console.log('Available fields:', Object.keys(formData));
      return res.status(400).json({ 
        error: 'Missing required fields: business_legal_name or contact_email',
        availableFields: Object.keys(formData)
      });
    }

    console.log('Processing form submission for:', formData.business_legal_name);

    // Process the lead asynchronously
    const result = await phase1AutomationService.processNewLead(formData);

    res.json({
      success: true,
      message: 'Lead processed successfully',
      client: result.client,
      documents: {
        mnda: result.documents.mnda.id,
        poa: result.documents.poa.id,
        projectOverview: result.documents.projectOverview.id,
        formId: result.documents.formId.id,
        termSheet: result.documents.termSheet.id
      },
      folderId: result.folders.main.id
    });

  } catch (error) {
    console.error('Legacy webhook processing error:', error);
    
    // Handle test submissions gracefully
    if (error.message && error.message.includes('Test submission detected')) {
      console.log('📝 Test submission received and acknowledged');
      return res.status(200).json({
        success: true,
        message: 'Test submission acknowledged',
        note: 'This appears to be a test webhook with placeholder values'
      });
    }
    
    // Handle other validation errors more gracefully
    if (error.message && error.message.includes('Form validation failed')) {
      console.warn('📋 Form validation failed:', error.message);
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        message: error.message,
        note: 'Please check that all required fields are filled out correctly'
      });
    }
    
    // Generic server error
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message
    });
  }
});

// Phase 1 Fillout webhook endpoint  
app.post('/webhook/phase1/fillout', async (req, res) => {
  try {
    console.log('=== FILLOUT WEBHOOK RECEIVED ===');
    console.log('Headers:', JSON.stringify(req.headers, null, 2));
    console.log('=== WEBHOOK BODY ===');
    console.log(JSON.stringify(req.body, null, 2));
    
    // Validate webhook structure before processing
    if (!req.body || typeof req.body !== 'object') {
      console.error('Invalid webhook payload: not an object');
      return res.status(400).json({
        success: false,
        error: 'Invalid payload',
        message: 'Webhook payload must be a valid JSON object'
      });
    }
    
    // Check for questions array (main indicator of real submission)
    const hasQuestions = req.body.questions && Array.isArray(req.body.questions);
    const hasSubmission = req.body.submission && req.body.submission.questions && Array.isArray(req.body.submission.questions);
    
    if (!hasQuestions && !hasSubmission) {
      console.log('📝 Webhook received without questions array - likely a test ping');
      return res.status(200).json({
        success: true,
        message: 'Webhook acknowledged',
        note: 'No questions array found - this may be a test webhook or ping'
      });
    }
    
    console.log('=== EXTRACTING FORM DATA ===');
    
    // Skip signature verification for now (TODO: implement based on fillout docs)
    console.log('Webhook signature verification disabled');

    let formData;
    try {
      formData = extractFormData(req.body);
      console.log('=== FORM DATA EXTRACTED ===');
    } catch (extractError) {
      console.error('Error extracting form data:', extractError);
      return res.status(500).json({ 
        error: 'Form data extraction failed',
        message: extractError.message 
      });
    }
    
    if (!formData.business_legal_name && !formData.contact_email) {
      console.error('Missing required form data');
      console.log('Available fields:', Object.keys(formData));
      return res.status(400).json({ 
        error: 'Missing required fields: business_legal_name or contact_email',
        availableFields: Object.keys(formData)
      });
    }

    console.log('Processing form submission for:', formData.business_legal_name);

    // Process the lead asynchronously
    const result = await phase1AutomationService.processNewLead(formData);

    res.json({
      success: true,
      message: 'Lead processed successfully',
      client: result.client,
      documents: {
        mnda: result.documents.mnda.id,
        poa: result.documents.poa.id,
        projectOverview: result.documents.projectOverview.id,
        formId: result.documents.formId.id,
        termSheet: result.documents.termSheet.id
      },
      folderId: result.folders.main.id
    });

  } catch (error) {
    console.error('Webhook processing error:', error);
    
    // Handle test submissions gracefully
    if (error.message && error.message.includes('Test submission detected')) {
      console.log('📝 Test submission received and acknowledged');
      return res.status(200).json({
        success: true,
        message: 'Test submission acknowledged',
        note: 'This appears to be a test webhook with placeholder values'
      });
    }
    
    // Handle other validation errors more gracefully
    if (error.message && error.message.includes('Form validation failed')) {
      console.warn('📋 Form validation failed:', error.message);
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        message: error.message,
        note: 'Please check that all required fields are filled out correctly'
      });
    }
    
    // Generic server error
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message
    });
  }
});

// Phase 2 webhook endpoint removed - not needed for basic document generation

// Manual trigger endpoint for testing
app.post('/webhook/test', async (req, res) => {
  try {
    console.log('Test webhook triggered');
    
    const testData = {
      // Core required fields
      business_legal_name: req.body.business_legal_name || 'Test Replacement Company Inc.',
      contact_email: req.body.contact_email || req.body.email || 'test@example.com',
      email: req.body.email || req.body.contact_email || 'test@example.com',
      contact_name: req.body.contact_name || `${req.body.first_name || 'John'} ${req.body.last_name || 'Doe'}`,
      
      // Contact Information
      first_name: req.body.first_name || 'John',
      last_name: req.body.last_name || 'Doe',
      title: req.body.title || 'CEO',
      mobile_phone: req.body.mobile_phone || req.body.phone_number || '+1-555-0123',
      linkedin: req.body.linkedin || 'https://linkedin.com/in/test',
      
      // Business Information
      dba: req.body.dba || 'Test DBA Name',
      ein: req.body.ein || '12-3456789',
      entity_type: req.body.entity_type || req.body.Entity_type || 'LLC',
      Entity_type: req.body.Entity_type || req.body.entity_type || 'LLC',
      state_incorporation: req.body.state_incorporation || 'Delaware',
      date_incorporation: req.body.date_incorporation || '2020-01-15',
      fiscal_year_end: req.body.fiscal_year_end || '12/31',
      website: req.body.website || 'https://testcompany.com',
      address_issuer: req.body.address_issuer || '123 Business St',
      city_issuer: req.body.city_issuer || 'Test City',
      state_issuer: req.body.state_issuer || 'CA',
      zip_issuer: req.body.zip_issuer || '90210',
      phone_issuer: req.body.phone_issuer || '+1-555-0124',
      business_description: req.body.business_description || 'Test renewable energy company',
      
      // Project Information
      tech: req.body.tech || 'Solar',
      other_tech: req.body.other_tech || 'Photovoltaic panels with battery storage',
      project_name: req.body.project_name || 'Test Solar Installation Project',
      address_project: req.body.address_project || '456 Project Ave',
      city_project: req.body.city_project || 'Project City',
      state_project: req.body.state_project || 'CA',
      zip_project: req.body.zip_project || '90211',
      name_plate_capacity: req.body.name_plate_capacity || '500 kW DC',
      target_issuer: req.body.target_issuer || '$2,500,000',
      maximum_offering_amount: req.body.maximum_offering_amount || '$3,000,000',
      deadline: req.body.deadline || '2025-06-30',
      project_description: req.body.project_description || 'Commercial solar installation with battery storage system',
      use_of_funds: req.body.use_of_funds || 'Equipment purchase (60%), Installation (25%), Development (10%), Contingency (5%)',
      
      // Financing Information
      project_type: req.body.project_type || req.body.financing_option || req.body.Financing_option || 'bridge',
      financing_option: req.body.financing_option || req.body.Financing_option || req.body.project_type || 'Bridge',
      Financing_option: req.body.Financing_option || req.body.financing_option || req.body.project_type || 'Bridge',
      financing_other: req.body.financing_other || '',
      financing_requirements: req.body.financing_requirements || 'Flexible terms with milestone-based funding',
      interest_rate: req.body.interest_rate || '8.5%',
      term_months: req.body.term_months || '24',
      
      // Form metadata
      form_id: 'TEST-' + Date.now(),
      submission_time: new Date().toISOString(),
      phase_one_submission: new Date().toISOString(),
      
      // Add all other fields from request body (this allows override of defaults)
      ...req.body
    };

    const result = await phase1AutomationService.processNewLead(testData);

    res.json({
      success: true,
      message: 'Test lead processed successfully',
      result: result
    });

  } catch (error) {
    console.error('Test webhook error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Google OAuth endpoints
app.get('/auth/google', (req, res) => {
  const authUrl = googleAuthService.getAuthUrl();
  res.redirect(authUrl);
});

app.get('/auth/google/callback', async (req, res) => {
  try {
    const { code } = req.query;
    const tokens = await googleAuthService.getTokens(code);
    
    console.log('=== GOOGLE TOKENS ===');
    console.log('Access Token:', tokens.access_token);
    console.log('Refresh Token:', tokens.refresh_token);
    console.log('==================');
    
    res.json({
      success: true,
      message: 'Authentication successful',
      refresh_token: tokens.refresh_token,
      access_token: tokens.access_token
    });
  } catch (error) {
    console.error('OAuth callback error:', error);
    res.status(500).json({
      success: false,
      error: 'Authentication failed',
      message: error.message
    });
  }
});

// Test endpoint for service verification
app.get('/test', async (req, res) => {
  try {
    res.json({
      success: true,
      message: 'Service ready for document generation',
      status: 'healthy'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Debug endpoint to find recent documents/folders
app.get('/debug/recent', async (req, res) => {
  try {
    const GoogleDriveService = require('./services/googleDrive');
    const driveService = new GoogleDriveService();
    
    console.log('🔍 Searching for recent documents...');
    
    // List recent files (last 10)
    await driveService.initializeApi();
    await driveService.authService.ensureValidToken();
    
    const recentFiles = await driveService.drive.files.list({
      orderBy: 'createdTime desc',
      pageSize: 10,
      fields: 'files(id, name, mimeType, webViewLink, createdTime, parents)'
    });
    
    const results = recentFiles.data.files.map(file => ({
      name: file.name,
      id: file.id,
      type: file.mimeType.includes('folder') ? 'Folder' : 'Document',
      link: file.webViewLink,
      created: file.createdTime,
      parentFolders: file.parents || []
    }));
    
    console.log('📋 Recent files found:', results.length);
    
    res.json({
      success: true,
      message: 'Recent files retrieved',
      files: results,
      config: {
        LEADS_PHASE1_FOLDER_ID: process.env.LEADS_PHASE1_FOLDER_ID || 'NOT SET'
      }
    });
  } catch (error) {
    console.error('Debug endpoint error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Utility functions
function verifyFilloutSignature(payload, signature) {
  if (!process.env.FILLOUT_WEBHOOK_SECRET || !signature) {
    return false;
  }

  const expectedSignature = crypto
    .createHmac('sha256', process.env.FILLOUT_WEBHOOK_SECRET)
    .update(JSON.stringify(payload))
    .digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(signature, 'hex'),
    Buffer.from(expectedSignature, 'hex')
  );
}

function extractFormData(webhookBody) {
  console.log('=== EXTRACTING FORM DATA ===');
  console.log('Webhook body keys:', Object.keys(webhookBody));
  console.log('Has questions?', !!webhookBody.questions);
  console.log('Questions is array?', Array.isArray(webhookBody.questions));
  console.log('Questions length:', webhookBody.questions ? webhookBody.questions.length : 'N/A');
  
  // Handle Fillout webhook format: questions array (direct or nested)
  if (webhookBody.questions && Array.isArray(webhookBody.questions)) {
    console.log('✅ Using direct questions array');
    return extractFromFilloutQuestions(webhookBody.questions, webhookBody);
  }
  
  if (webhookBody.submission && webhookBody.submission.questions) {
    console.log('✅ Using nested submission.questions');
    return extractFromFilloutQuestions(webhookBody.submission.questions, webhookBody);
  }
  
  // Handle other Fillout webhook formats
  if (webhookBody.data) {
    console.log('✅ Using data format');
    return extractFromFilloutData(webhookBody.data);
  }
  
  if (webhookBody.responses) {
    console.log('✅ Using responses format');
    return extractFromFilloutResponses(webhookBody.responses);
  }

  // Direct field access as fallback
  console.log('⚠️ Using direct field access fallback');
  console.log('Fallback data:', {
    business_legal_name: webhookBody.business_legal_name,
    contact_email: webhookBody.contact_email,
    contact_name: webhookBody.contact_name,
    project_type: webhookBody.project_type
  });
  return {
    business_legal_name: webhookBody.business_legal_name,
    contact_email: webhookBody.contact_email,
    contact_name: webhookBody.contact_name,
    project_type: webhookBody.project_type,
    form_id: webhookBody.submissionId || webhookBody.id,
    ...webhookBody
  };
}

function extractFromFilloutData(data) {
  const formData = {};
  
  if (Array.isArray(data)) {
    data.forEach(item => {
      if (item.field && item.value) {
        const fieldName = item.field.toLowerCase().replace(/\s+/g, '_');
        formData[fieldName] = item.value;
      }
    });
  }

  // Map common field variations
  const fieldMappings = {
    'business_name': 'business_legal_name',
    'company_name': 'business_legal_name',
    'legal_name': 'business_legal_name',
    'legal_business_name': 'business_legal_name',
    'email': 'contact_email',
    'email_address': 'contact_email',
    'name': 'contact_name',
    'full_name': 'contact_name',
    'project': 'project_type',
    'project_category': 'project_type'
  };

  Object.keys(fieldMappings).forEach(oldKey => {
    if (formData[oldKey] && !formData[fieldMappings[oldKey]]) {
      formData[fieldMappings[oldKey]] = formData[oldKey];
    }
  });

  return formData;
}

function extractFromFilloutQuestions(questions, webhookBody) {
  const formData = {};
  
  // Extract form metadata
  formData.form_id = webhookBody.formId || webhookBody.submission?.submissionId || 'unknown';
  formData.submission_time = webhookBody.submission?.submissionTime;
  formData.phase_one_submission = webhookBody.submission?.submissionTime || new Date().toISOString();
  
  console.log('=== PROCESSING FILLOUT FORM QUESTIONS ===');
  console.log(`Total questions: ${questions.length}`);
  
  // 🧪 EARLY TEST DETECTION: Temporarily disabled to see real form structure
  // const hasNullBusinessName = questions.some(q => 
  //   q.name === 'Business Legal Name' && String(q.value).toLowerCase() === 'null'
  // );
  // if (hasNullBusinessName) { ... return test data ... }
  
  // Process each question with comprehensive mapping
  questions.forEach((question, index) => {
    if (question.name && question.name.trim()) {
      const originalName = question.name;
      
      // Convert names like "First Name (1)" -> "first_name_1"
      let normalizedName = question.name.toLowerCase()
        .replace(/\s*\((\d+)\)/g, '_$1') // Turn parenthetical numbers into suffix _1, _2, etc.
        .replace(/[^\w\s]/g, '') // Remove remaining special characters
        .replace(/\s+/g, '_') // Replace spaces with underscores
        .trim();
      
      // Avoid overwriting a previously captured non-empty value with empty/"Unanswered" duplicates
      const incomingVal = question.value;
      const valStr = String(incomingVal).toLowerCase().trim();
      const isEmpty = incomingVal === undefined || incomingVal === null || valStr === '' || valStr === 'unanswered' || valStr === 'null';

      if (!isEmpty) {
        formData[normalizedName] = incomingVal;
      } else if (!(normalizedName in formData)) {
        // Keep placeholder only if not already filled
        formData[normalizedName] = '';
      }
      
      // CRITICAL: Also preserve the original field name for validation (especially for business name)
      if (originalName === 'Business Legal Name' && !isEmpty) {
        formData['Business Legal Name'] = incomingVal;
        console.log(`🏢 BUSINESS NAME: Both "${originalName}" and "${normalizedName}" set to "${incomingVal}"`);
      }
      
      console.log(`Q${index + 1}: "${originalName}" -> ${normalizedName} = "${question.value}"`);
      
      // NEW: Enhanced logging for debugging new form structure
      if (question.value && typeof question.value === 'object') {
        console.log(`     📋 OBJECT VALUE:`, JSON.stringify(question.value, null, 2));
      }
      if (Array.isArray(question.value)) {
        console.log(`     📊 ARRAY VALUE (${question.value.length} items):`, question.value);
      }
    }
  });
  
  console.log('=== RAW FORM DATA AFTER QUESTION PROCESSING ===');
  console.log('business_legal_name:', formData.business_legal_name);
  console.log('email:', formData.email);
  console.log('first_name:', formData.first_name);
  console.log('Keys:', Object.keys(formData).slice(0, 10));
  
  console.log('=== CREATING COMPREHENSIVE FIELD MAPPINGS ===');
  
  // Handle dual contact logic FIRST (primary contact vs signing authority)
  const hasSigningAuthority = formData.check_this_box_if_you_have_the_authority_to_sign_legal_documents_on_behalf_of_your_company;
  
  // Helper to check if value is effectively empty/unanswered
  const isEmpty = (value) => {
    if (value === undefined || value === null) return true;
    const str = String(value).toLowerCase().trim();
    return str === '' || str === 'null' || str === 'unanswered';
  };
  
  if (hasSigningAuthority) {
    // Primary contact is the signer - they filled out the form AND can sign
    console.log('Primary contact has signing authority - same person for POC and Signer');
    
    // Set POC fields (Point of Contact) - the person who filled out the form
    // Note: In Abyra example, "First Name (1)" is the PRIMARY contact, "First Name" is empty
    formData.first_name_poc = formData.first_name_1 || formData.first_name;
    formData.last_name_poc = formData.last_name || formData.last_name_1;  // "Last Name" has the value
    formData.title_poc = formData.title || formData.title_1;
    formData.email_poc = formData.email || formData.email_1;
    formData.mobile_phone_poc = formData.phone_number;
    formData.linkedin_poc = formData.linkedin || formData.linkedin_1;
    
    // Set Signer fields (same person)
    formData.first_name_sign = formData.first_name_poc;
    formData.last_name_sign = formData.last_name_poc;
    formData.title_sign = formData.title_poc;
    formData.email_sign = formData.email_poc;
    formData.linkedin_sign = formData.linkedin_poc;
    
  } else {
    // Check if separate signer info was actually provided or if it's all "Unanswered"
    const signerProvided = !isEmpty(formData.first_name_1) || !isEmpty(formData.last_name_1) || !isEmpty(formData.email_1);
    
    if (signerProvided) {
      console.log('Separate signing authority provided - different people for POC and Signer');
      
      // Set POC fields (Point of Contact) - the person who filled out the form
      formData.first_name_poc = formData.first_name_1 || formData.first_name;
      formData.last_name_poc = formData.last_name || formData.last_name_1;
      formData.title_poc = formData.title || formData.title_1;
      formData.email_poc = formData.email || formData.email_1;
      formData.mobile_phone_poc = formData.phone_number;
      formData.linkedin_poc = formData.linkedin || formData.linkedin_1;
      
      // Set Signer fields from the provided signer data
      formData.first_name_sign = formData.first_name_1;
      formData.last_name_sign = formData.last_name_1;
      formData.title_sign = formData.title_1;
      formData.email_sign = formData.email_1;
      formData.linkedin_sign = formData.linkedin_1;
    } else {
      console.log('No separate signer provided - using POC as signer');
      
      // Set POC fields
      formData.first_name_poc = formData.first_name_1 || formData.first_name;
      formData.last_name_poc = formData.last_name || formData.last_name_1;
      formData.title_poc = formData.title || formData.title_1;
      formData.email_poc = formData.email || formData.email_1;
      formData.mobile_phone_poc = formData.phone_number;
      formData.linkedin_poc = formData.linkedin || formData.linkedin_1;
      
      // Use POC as signer
      formData.first_name_sign = formData.first_name_poc;
      formData.last_name_sign = formData.last_name_poc;
      formData.title_sign = formData.title_poc;
      formData.email_sign = formData.email_poc;
      formData.linkedin_sign = formData.linkedin_poc;
    }
  }
  
  // Apply field mappings for other business data (NOT contact info) - USING USER'S EXACT FIELD NAMES
  const businessFieldMappings = {
    // Business Information - Use exact field names user provided
    'ein': 'ein_number',  // Map ein -> ein_number
    'legal_business_name': 'business_legal_name',
    'legal_name': 'business_legal_name',
    'company_name': 'business_legal_name',
    'business_name': 'business_legal_name',
    'company': 'business_legal_name',
    'dba_doing_buisness_as': 'doing_business_as', // Note: Fillout form has typo "Buisness"
    'dba_doing_business_as': 'doing_business_as',
    'dba': 'doing_business_as',
    'type_of_entity': 'entity_type',
    'state_of_incorporation': 'state_incorporation',
    'incorporation_date': 'date_incorporation',
    'fiscal_year_end': 'fiscal_year_end',
    'website': 'website_issuer', // Map website -> website_issuer
    // Contact Info common fallbacks
    'email': 'contact_email',
    'email_address': 'contact_email',
    'phone': 'mobile_phone_poc',
    'phone_number': 'mobile_phone_poc',
    
    // Business Address fields
    'business_phone': 'phone_issuer',
    'business_description': 'business_description',
    
    // Technology/Goal
    'what_technology_are_you_raising_capital_for': 'tech_offering',
    'technology': 'tech_offering',
    'please_specify_your_technology': 'other_tech',
    
    // Project Information
    'project_or_portfolio_name': 'project_name',
    'portfolio_name': 'project_name',
    
    // Project Size & Financial - Use exact field names from user
    'project_size': 'name_plate_capacity',
    'nameplate_capacity': 'name_plate_capacity',
    'minimum_capital_needed': 'target_issuer',
    'maximum_capital_needed': 'maximum_issuer', // User said maximum_issuer not maximum_offering_amount
    'by_when_do_you_need_the_capital': 'deadline_offering', // User said deadline_offering
    'describe_the_use_of_funds': 'use_of_funds',
    'project_description': 'project_description',
    
    // Financing Options
    'which_of_the_options_above_is_a_better_fit_for_your_project': 'financing_option',
    'project_fit': 'financing_option',
    'if_other_please_specify': 'financing_other',
    'do_you_have_any_preferred_terms_or_requirements': 'financing_requirements',
    'desired_rate': 'interest_rate',
    'desired_term': 'term_months'
  };
  
  console.log('=== APPLYING BUSINESS FIELD MAPPINGS ===');
  
  // Apply business field mappings (skip contact fields to avoid overwriting)
  Object.keys(businessFieldMappings).forEach(originalField => {
    const targetField = businessFieldMappings[originalField];
    
    if (originalField in formData && formData[originalField] !== null && formData[originalField] !== undefined) {
      formData[targetField] = formData[originalField];
      console.log(`Mapped: ${originalField} -> ${targetField} = "${formData[originalField]}"`);
      // Don't delete original field if it might be needed for validation
      const criticalFields = ['Business Legal Name', 'business_legal_name', 'Email', 'email'];
      if (targetField !== originalField && !criticalFields.includes(originalField)) {
        delete formData[originalField];            // Delete legacy key to avoid duplicate placeholders
      }
    }
  });
  
  // --- Fallbacks to guarantee required fields ---
  if (!formData.business_legal_name) {
    // Try common alternative fields we may have normalized but not mapped earlier
    formData.business_legal_name = formData.doing_business_as || formData.company_name || formData.legal_name || formData.business_name;
    if (formData.business_legal_name) {
      console.log(`✅ business_legal_name fallback assigned: ${formData.business_legal_name}`);
    }
  }
  
  // CRITICAL FIX: Ensure both original and normalized business name fields are available
  // The validation expects either 'Business Legal Name' or 'business_legal_name'
  if (formData.business_legal_name && !formData['Business Legal Name']) {
    formData['Business Legal Name'] = formData.business_legal_name;
    console.log(`✅ Restored original Business Legal Name field: ${formData.business_legal_name}`);
  }
  if (formData['Business Legal Name'] && !formData.business_legal_name) {
    formData.business_legal_name = formData['Business Legal Name'];
    console.log(`✅ Set normalized business_legal_name: ${formData['Business Legal Name']}`);
  }

  if (!formData.contact_email) {
    formData.contact_email = formData.email || formData.email_poc;
    if (formData.contact_email) {
      console.log(`✅ contact_email fallback assigned: ${formData.contact_email}`);
    }
  }
  
  // Handle business address as object or individual fields
  if (formData.business_address && typeof formData.business_address === 'object') {
    const addrObj = formData.business_address;
    formData.address_issuer = addrObj.address || addrObj.line1 || addrObj.street || JSON.stringify(addrObj);
    formData.city_issuer = addrObj.city || formData.city_issuer;
    formData.state_issuer = addrObj.state || formData.state_issuer; 
    formData.zip_issuer = addrObj.zipCode || addrObj.zip || formData.zip_issuer;
    console.log('Mapped business_address object to issuer address fields (string components)');
    delete formData.business_address; // remove raw object
  }
  
  // Handle individual address fields
  if (formData.address && !formData.address_issuer) {
    formData.address_issuer = formData.address;
    console.log('Mapped address -> address_issuer');
  }
  if (formData.city && !formData.city_issuer) {
    formData.city_issuer = formData.city;
    console.log('Mapped city -> city_issuer');
  }
  if (formData.state && !formData.state_issuer) {
    formData.state_issuer = formData.state;
    console.log('Mapped state -> state_issuer');
  }
  if (formData.zip && !formData.zip_issuer) {
    formData.zip_issuer = formData.zip;
    console.log('Mapped zip -> zip_issuer');
  }
  
  // Set mobile_phone for legacy compatibility
  if (!formData.mobile_phone && formData.phone_number) {
    formData.mobile_phone = formData.phone_number;
  }
  
  // Normalize financing option values
  if (formData.financing_option) {
    const financingMap = {
      'pre-development': 'Pre-Development',
      'predevelopment': 'Pre-Development',
      'construction': 'Construction',
      'permanent debt': 'Permanent Debt',
      'permanent_debt': 'Permanent Debt',
      'bridge': 'Bridge',
      'other': 'Other'
    };
    
    const normalized = String(formData.financing_option).toLowerCase().trim();
    if (financingMap[normalized]) {
      formData.financing_option = financingMap[normalized];
      console.log(`Normalized financing option: ${normalized} -> ${formData.financing_option}`);
    }
  }
  
  // Set contact_email and contact_name for legacy compatibility
  formData.contact_email = formData.email || formData.email_poc || 'test-contact@example.com';
  formData.contact_name = `${formData.first_name || ''} ${formData.last_name || ''}`.trim() || 'Contact Name';
  
  // Format financial amounts
  if (formData.target_issuer && !String(formData.target_issuer).includes('$')) {
    formData.target_issuer = `$${formData.target_issuer}`;
  }

  // Format maximum_issuer amount as currency if missing dollar sign
  if (formData.maximum_issuer && !String(formData.maximum_issuer).includes('$')) {
    formData.maximum_issuer = `$${formData.maximum_issuer}`;
  } else if (formData.maximum_offering_amount && !String(formData.maximum_offering_amount).includes('$')) {
    // Legacy compatibility
    formData.maximum_offering_amount = `$${formData.maximum_offering_amount}`;
  }

  // If project address details are still missing, but we have a generic address captured, reuse it
  if (!formData.address_project && formData.address && formData.address !== formData.address_issuer) {
    formData.address_project = formData.address;
  }
  if (!formData.city_project && formData.city && formData.city !== formData.city_issuer) {
    formData.city_project = formData.city;
  }
  if (!formData.state_project && formData.state && formData.state !== formData.state_issuer) {
    formData.state_project = formData.state;
  }
  if (!formData.zip_project && formData.zip && formData.zip !== formData.zip_issuer) {
    formData.zip_project = formData.zip;
  }
  
  // Add percentage sign to interest rate if missing
  if (formData.interest_rate && !String(formData.interest_rate).includes('%')) {
    formData.interest_rate = `${formData.interest_rate}%`;
  }
  
  console.log('=== FINAL EXTRACTED FORM DATA ===');
  console.log('Business (normalized):', formData.business_legal_name);
  console.log('Business (original):', formData['Business Legal Name']);
  console.log('Primary Contact:', formData.first_name, formData.last_name, `(${formData.email})`);
  console.log('POC Contact:', formData.first_name_poc, formData.last_name_poc, `(${formData.email_poc})`);
  console.log('Signer Contact:', formData.first_name_sign, formData.last_name_sign, `(${formData.email_sign})`);
  console.log('Project:', formData.project_name);
  console.log('Financing:', formData.financing_option);
  console.log('Amount:', formData.target_issuer, '-', formData.maximum_offering_amount);
  
  // VALIDATION CHECK: Ensure we have business name for downstream validation
  const hasBusinessName = formData['Business Legal Name'] || formData.business_legal_name;
  if (!hasBusinessName) {
    console.error('🚨 CRITICAL: No business name found - downstream validation will fail!');
    console.log('All form keys:', Object.keys(formData).slice(0, 20));
  } else {
    console.log('✅ Business name available for validation:', hasBusinessName);
  }
  console.log('====================================');
  
  return formData;
}

function extractFromFilloutResponses(responses) {
  const formData = {};
  
  responses.forEach(response => {
    if (response.question && response.answer) {
      const fieldName = response.question.toLowerCase().replace(/\s+/g, '_');
      formData[fieldName] = response.answer;
    }
  });

  return formData;
}

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Unhandled error:', error);
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    message: error.message
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
    availableEndpoints: [
      '/webhook/fillout',
      '/webhook/test',
      '/auth/google',
      '/test',
      '/health'
    ]
  });
});

// Start server
app.listen(port, () => {
  console.log(`🚀 Climatize.earth Automation Server running on port ${port}`);
  console.log(`📋 Webhook endpoint: http://localhost:${port}/webhook/fillout`);
  console.log(`🔧 Test endpoint: http://localhost:${port}/test`);
  console.log(`❤️  Health check: http://localhost:${port}/health`);
});

module.exports = app;