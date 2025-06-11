const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const crypto = require('crypto');
require('dotenv').config();

const AutomationService = require('./services/automationService');
const GoogleAuthService = require('./services/googleAuth');

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Initialize services
const automationService = new AutomationService();
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
    const serviceTests = await automationService.testServices();
    
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

// Fillout webhook endpoint
app.post('/webhook/fillout', async (req, res) => {
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
    const result = await automationService.processNewLead(formData);

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

// Manual trigger endpoint for testing
app.post('/webhook/test', async (req, res) => {
  try {
    console.log('Test webhook triggered');
    
    const testData = {
      business_legal_name: req.body.business_legal_name || 'Test Company Inc.',
      contact_email: req.body.contact_email || req.body.email || 'srikanth.samy008@gmail.com',
      contact_name: req.body.contact_name || `${req.body.first_name || 'John'} ${req.body.last_name || 'Doe'}`,
      project_type: req.body.project_type || req.body.Financing_option || 'solar',
      form_id: 'TEST-' + Date.now(),
      ...req.body
    };

    const result = await automationService.processNewLead(testData);

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
    const tests = await automationService.testServices();
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
  
  // Process each question
  questions.forEach(question => {
    if (question.name) {
      // Convert question name to field name
      let fieldName = question.name.toLowerCase()
        .replace(/\s*\([^)]*\)/g, '') // Remove parentheses content like "(1)"
        .replace(/[^\w\s]/g, '') // Remove special characters
        .replace(/\s+/g, '_') // Replace spaces with underscores
        .trim();
      
      // Store value even if null (for test webhooks), but use placeholder for nulls
      formData[fieldName] = question.value || `[${question.name}]`;
      console.log(`Mapped question "${question.name}" -> ${fieldName} = ${formData[fieldName]}`);
    }
  });
  
  // Apply field mappings for common variations
  const fieldMappings = {
    'first_name_1': 'first_name',
    'first_name': 'first_name',
    'first_name_poc': 'first_name_poc',
    'last_name': 'last_name',
    'last_name_poc': 'last_name_poc',
    'business_name': 'business_legal_name',
    'company_name': 'business_legal_name',
    'legal_name': 'business_legal_name',
    'business_legal_name': 'business_legal_name',
    'dba': 'dba',
    'doing_business_as': 'dba',
    'email': 'contact_email',
    'email_address': 'contact_email',
    'contact_email': 'contact_email',
    'email_poc': 'email_poc',
    'project': 'project_type',
    'project_type': 'project_type',
    'financing_option': 'financing_option',
    'financing_type': 'financing_option',
    'nameplate_capacity': 'name_plate_capacity',
    'name_plate_capacity': 'name_plate_capacity',
    'target_amount': 'target_issuer',
    'target_issuer': 'target_issuer',
    'maximum_amount': 'maximum_issuer',
    'maximum_issuer': 'maximum_issuer',
    'financing_other': 'financing_other',
    'other_financing': 'financing_other',
    'term_months': 'term_months',
    'desired_term': 'term_months',
    'interest_rate': 'interest_rate',
    'desired_rate': 'interest_rate',
    'linkedin_poc': 'linkedin_poc',
    'linkedin_profile': 'linkedin_poc',
    'mobile_phone_poc': 'mobile_phone_poc',
    'phone_poc': 'mobile_phone_poc',
    'title_poc': 'title_poc',
    'submission_date': 'phase_one_submission',
    'phase_one_submission': 'phase_one_submission'
  };
  
  // Apply mappings
  Object.keys(fieldMappings).forEach(oldKey => {
    if (formData[oldKey] && !formData[fieldMappings[oldKey]]) {
      formData[fieldMappings[oldKey]] = formData[oldKey];
      console.log(`Applied mapping: ${oldKey} -> ${fieldMappings[oldKey]} = ${formData[oldKey]}`);
    }
  });
  
  console.log('Final extracted form data:', JSON.stringify(formData, null, 2));
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