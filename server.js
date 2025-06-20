const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const crypto = require('crypto');
require('dotenv').config();

const Phase1AutomationService = require('./services/phase1AutomationService');
const Phase2AutomationService = require('./services/phase2AutomationService');
const LeadTrackingService = require('./services/leadTrackingService');
const GoogleAuthService = require('./services/googleAuth');

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Initialize services
const phase1AutomationService = new Phase1AutomationService();
const phase2AutomationService = new Phase2AutomationService();
const leadTrackingService = new LeadTrackingService();
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
    const serviceTests = await phase1AutomationService.testServices();
    
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: serviceTests
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
    console.error('Legacy webhook processing error:', error);
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
    console.log('=== EXTRACTING FORM DATA ===');
    
    // Skip signature verification for now
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
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message
    });
  }
});

// Phase 2 Fillout webhook endpoint
app.post('/webhook/phase2/fillout', async (req, res) => {
  try {
    console.log('=== PHASE 2 FILLOUT WEBHOOK RECEIVED ===');
    console.log('Headers:', JSON.stringify(req.headers, null, 2));
    console.log('=== PHASE 2 WEBHOOK BODY ===');
    console.log(JSON.stringify(req.body, null, 2));
    
    // Extract lead_id from the form submission
    const leadId = req.body.lead_id || (req.body.questions && req.body.questions.find(q => q.name === 'lead_id')?.value);
    
    if (!leadId) {
      return res.status(400).json({
        success: false,
        error: 'Missing lead_id',
        message: 'Phase 2 form must include lead_id from Phase 1'
      });
    }

    console.log('Processing Phase 2 for lead ID:', leadId);

    // Get the Phase 1 data from lead tracking
    const leadData = await leadTrackingService.getLeadById(leadId);
    if (!leadData) {
      return res.status(404).json({
        success: false,
        error: 'Lead not found',
        message: `Lead with ID ${leadId} not found in tracking system`
      });
    }

    if (leadData.status !== 'PHASE_1_COMPLETE') {
      return res.status(400).json({
        success: false,
        error: 'Invalid lead status',
        message: `Lead ${leadId} is not ready for Phase 2. Current status: ${leadData.status}`
      });
    }

    // Update lead status to indicate Phase 2 is starting
    await leadTrackingService.updateLeadStatus(leadId, 'PHASE_2_IN_PROGRESS', {
      phase2_submission_data_json: req.body
    });

    // Process Phase 2 with automation service
    console.log('Starting Phase 2 automation processing...');
    const result = await phase2AutomationService.processPhase2Lead(leadId, req.body);
    
    res.json({
      success: true,
      message: 'Phase 2 processing completed successfully',
      lead_id: leadId,
      business_legal_name: result.business_legal_name,
      result: result
    });

  } catch (error) {
    console.error('Phase 2 webhook processing error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message
    });
  }
});

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
    const tests = await phase1AutomationService.testServices();
    res.json({
      success: true,
      message: 'Service tests completed',
      results: tests
    });
  } catch (error) {
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
  // Handle Fillout webhook format: submission.questions
  if (webhookBody.submission && webhookBody.submission.questions) {
    return extractFromFilloutQuestions(webhookBody.submission.questions, webhookBody);
  }
  
  // Handle other Fillout webhook formats
  if (webhookBody.data) {
    return extractFromFilloutData(webhookBody.data);
  }
  
  if (webhookBody.responses) {
    return extractFromFilloutResponses(webhookBody.responses);
  }

  // Direct field access
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
  
  // Process each question with comprehensive mapping
  questions.forEach((question, index) => {
    if (question.name && question.name.trim()) {
      const originalName = question.name;
      
      // Normalize question name for mapping
      let normalizedName = question.name.toLowerCase()
        .replace(/\s*\([^)]*\)/g, '') // Remove parentheses content like "(1)"
        .replace(/[^\w\s]/g, '') // Remove special characters except spaces and underscores
        .replace(/\s+/g, '_') // Replace spaces with underscores
        .trim();
      
      // Store raw value first
      formData[normalizedName] = question.value;
      
      console.log(`Q${index + 1}: "${originalName}" -> ${normalizedName} = "${question.value}"`);
    }
  });
  
  // COMPREHENSIVE FIELD MAPPING based on actual Fillout form structure
  const comprehensiveFieldMappings = {
    // Contact Information (Primary Contact)
    'first_name': 'first_name',
    'last_name': 'last_name', 
    'title': 'title',
    'email': 'email',
    'phone_number': 'mobile_phone',
    'linkedin': 'linkedin',
    
    // Alternative Contact Information (if different person has signing authority)
    'first_name_1': 'first_name_signer', // If they don't have authority, this is the signer
    'last_name_1': 'last_name_signer',
    'title_1': 'title_signer', 
    'email_1': 'email_signer',
    
    // Business Information
    'business_legal_name': 'business_legal_name',
    'dba_doing_buisness_as': 'dba', // Note: Fillout form has typo "Buisness"
    'dba_doing_business_as': 'dba',
    'dba': 'dba',
    'ein': 'ein',
    'type_of_entity': 'entity_type',
    'entity_type': 'entity_type',
    'state_of_incorporation': 'state_incorporation',
    'incorporation_date': 'date_incorporation',
    'fiscal_year_end': 'fiscal_year_end',
    'website': 'website',
    
    // Business Address
    'business_address': 'address_issuer',
    'address': 'address_issuer',
    'city': 'city_issuer',
    'state__province': 'state_issuer',
    'state_province': 'state_issuer',
    'zip__postal_code': 'zip_issuer',
    'zip_postal_code': 'zip_issuer',
    'business_phone': 'phone_issuer',
    'business_description': 'business_description',
    
    // Technology/Goal
    'what_technology_are_you_raising_capital_for': 'tech',
    'technology': 'tech',
    'please_specify_your_technology': 'other_tech',
    'specify_technology': 'other_tech',
    
    // Project Information
    'project_or_portfolio_name': 'project_name',
    'project_name': 'project_name',
    'portfolio_name': 'project_name',
    
    // Project Address (separate from business address)
    'address_1': 'address_project', // Second address field in form
    'project_address': 'address_project',
    'city_1': 'city_project',
    'project_city': 'city_project',
    'state__province_1': 'state_project',
    'state_province_1': 'state_project',
    'project_state': 'state_project',
    'zip__postal_code_1': 'zip_project',
    'zip_postal_code_1': 'zip_project',
    'project_zip': 'zip_project',
    
    // Project Size & Financial
    'project_size': 'name_plate_capacity',
    'nameplate_capacity': 'name_plate_capacity',
    'minimum_capital_needed': 'target_issuer',
    'target_amount': 'target_issuer',
    'maximum_capital_needed': 'maximum_offering_amount',
    'maximum_amount': 'maximum_offering_amount',
    'by_when_do_you_need_the_capital': 'deadline',
    'deadline': 'deadline',
    'project_description': 'project_description',
    'describe_the_use_of_funds': 'use_of_funds',
    'use_of_funds': 'use_of_funds',
    
    // Financing Options
    'which_of_the_options_above_is_a_better_fit_for_your_project': 'financing_option',
    'financing_option': 'financing_option',
    'project_fit': 'financing_option',
    'if_other_please_specify': 'financing_other',
    'other_specify': 'financing_other',
    'financing_other': 'financing_other',
    'do_you_have_any_preferred_terms_or_requirements': 'financing_requirements',
    'preferred_terms': 'financing_requirements',
    'financing_requirements': 'financing_requirements',
    'desired_rate': 'interest_rate',
    'interest_rate': 'interest_rate',
    'rate': 'interest_rate',
    'desired_term': 'term_months',
    'term_months': 'term_months',
    'term': 'term_months',
    
    // Legacy mappings for compatibility
    'contact_email': 'email',
    'email_address': 'email',
    'mobile_phone': 'mobile_phone',
    'phone': 'mobile_phone'
  };
  
  console.log('=== APPLYING FIELD MAPPINGS ===');
  
  // Apply comprehensive mappings
  Object.keys(comprehensiveFieldMappings).forEach(originalField => {
    const targetField = comprehensiveFieldMappings[originalField];
    
    if (originalField in formData) {
      const value = formData[originalField];
      
      // Don't overwrite if target already has a value (preserve more specific mappings)
      if (!(targetField in formData) || formData[targetField] === null || formData[targetField] === undefined) {
        formData[targetField] = value;
        console.log(`Mapped: ${originalField} -> ${targetField} = "${value}"`);
      }
    }
  });
  
  // Ensure mobile_phone is available from phone_number if needed
  if (!formData.mobile_phone && formData.phone_number) {
    formData.mobile_phone = formData.phone_number;
  }
  
  // Handle dual contact logic (primary contact vs signing authority)
  const hasSigningAuthority = formData.check_this_box_if_you_have_the_authority_to_sign_legal_documents_on_behalf_of_your_company;
  
  if (hasSigningAuthority) {
    // Primary contact is the signer
    console.log('Primary contact has signing authority');
    // POC fields same as signer fields
    formData.first_name_poc = formData.first_name;
    formData.last_name_poc = formData.last_name;
    formData.title_poc = formData.title;
    formData.email_poc = formData.email;
    formData.mobile_phone_poc = formData.mobile_phone || formData.phone_number;
    formData.linkedin_poc = formData.linkedin;
  } else {
    // Separate signer provided
    console.log('Separate signing authority provided');
    if (formData.first_name_signer) {
      formData.first_name = formData.first_name_signer;
      formData.last_name = formData.last_name_signer;
      formData.title = formData.title_signer;
      formData.email = formData.email_signer;
    }
    // Primary contact becomes POC (the person filling out the form)
    formData.first_name_poc = formData.first_name_poc || formData.first_name;
    formData.last_name_poc = formData.last_name_poc || formData.last_name;
    formData.title_poc = formData.title_poc || formData.title;
    formData.email_poc = formData.email_poc || formData.email;
    formData.mobile_phone_poc = formData.mobile_phone_poc || formData.mobile_phone || formData.phone_number;
    formData.linkedin_poc = formData.linkedin_poc || formData.linkedin;
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
  if (formData.maximum_offering_amount && !String(formData.maximum_offering_amount).includes('$')) {
    formData.maximum_offering_amount = `$${formData.maximum_offering_amount}`;
  }
  
  // Add percentage sign to interest rate if missing
  if (formData.interest_rate && !String(formData.interest_rate).includes('%')) {
    formData.interest_rate = `${formData.interest_rate}%`;
  }
  
  console.log('=== FINAL EXTRACTED FORM DATA ===');
  console.log('Business:', formData.business_legal_name);
  console.log('Primary Contact:', formData.first_name, formData.last_name, `(${formData.email})`);
  console.log('Project:', formData.project_name);
  console.log('Financing:', formData.financing_option);
  console.log('Amount:', formData.target_issuer, '-', formData.maximum_offering_amount);
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