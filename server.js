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
    console.log('Received Fillout webhook:', req.headers);
    console.log('Webhook body:', JSON.stringify(req.body, null, 2));
    
    // Skip signature verification for now
    console.log('Webhook signature verification disabled');

    const formData = extractFormData(req.body);
    
    if (!formData.business_legal_name && !formData.contact_email) {
      console.error('Missing required form data');
      return res.status(400).json({ 
        error: 'Missing required fields: business_legal_name or contact_email' 
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
        termSheet: result.documents.termSheet.id,
        formId: result.documents.formId.id
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
  // Handle different Fillout webhook formats
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