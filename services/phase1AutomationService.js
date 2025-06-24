const GoogleDocsService = require('./googleDocs');
const GoogleDriveService = require('./googleDrive');
const { TEMPLATE_IDS, PROJECT_TYPE_CONFIG } = require('../config/templateIds');
require('dotenv').config();

class Phase1AutomationService {
  constructor() {
    console.log('Initializing Phase1AutomationService...');
    this.docsService = null;
    this.driveService = null;
  }

  initializeServices() {
    if (!this.docsService) {
      console.log('Creating GoogleDocsService...');
      this.docsService = new GoogleDocsService();
    }
    if (!this.driveService) {
      console.log('Creating GoogleDriveService...');
      this.driveService = new GoogleDriveService();
    }
  }

  // CLEAN FORM FIELD MAPPING - Single source of truth
  normalizeFormData(formData) {
    console.log('=== NORMALIZING FORM DATA ===');
    
    // Helper to check if value is effectively empty (including "null" strings)
    const isEmpty = (value) => {
      if (value === undefined || value === null) return true;
      const str = String(value).toLowerCase().trim();
      return str === '' || str === 'null' || str === 'unanswered';
    };
    
    // Simple, clean mapping from form field names to template variables
    const fieldMapping = {
      // POC Contact Information - BOTH formats
      'First Name': 'first_name_poc',
      'First Name (1)': 'first_name_poc',  // Abyra format: First Name (1) is the PRIMARY contact
      'Last Name': 'last_name_poc', 
      'Last Name (1)': 'last_name_sign',   // This is for separate signer
      'Title': 'title_poc',
      'Title (1)': 'title_sign',
      'Email': 'email_poc',
      'Email (1)': 'email_sign', 
      'Phone Number': 'mobile_phone_poc',
      'LinkedIn': 'linkedin_poc',
      'LinkedIn (1)': 'linkedin_sign',
      
      // Signer Information - keep for backwards compatibility
      'First Name Sign': 'first_name_sign',
      'Last Name Sign': 'last_name_sign',
      'Title Sign': 'title_sign',
      'Email Sign': 'email_sign',
      'LinkedIn Sign': 'linkedin_sign',
      
      // Business Information
      'Business Legal Name': 'business_legal_name',
      'DBA (Doing Buisness As)': 'doing_business_as', // Handle typo in form
      'DBA (Doing Business As)': 'doing_business_as', // Handle correct spelling
      'EIN': 'ein_number',
      'Type of Entity': 'entity_type',
      'State of Incorporation': 'state_incorporation',
      'Incorporation Date': 'date_incorporation',
      'Fiscal Year End': 'fiscal_year_end',
      'Website': 'website_issuer',
      'Business Phone': 'phone_issuer',
      'Business Description': 'business_description',
      
      // Project Information
      'What technology are you raising capital for?': 'tech_offering',
      'Please specify your technology': 'other_tech',
      'Project or Portfolio Name': 'project_name',
      'Project Size': 'name_plate_capacity',
      'Minimum Capital Needed': 'target_issuer',
      'Maximum Capital Needed': 'maximum_issuer',
      'By when do you need the capital?': 'deadline_offering',
      'Project Description': 'project_description',
      'Describe the use of funds': 'use_of_funds',
      
      // Financing Information
      'Which of the options above is a better fit for your project?': 'financing_option',
      'If other, please specify': 'financing_other',
      'Do you have any preferred terms or requirements?': 'financing_requirements',
      'Desired Rate': 'interest_rate',
      'Desired Term': 'term_months',
      'Business Address': 'address_issuer',
    };

    // Create normalized data object
    const normalized = {};
    
    // Map all form fields to template variables, filtering out empty/null values
    for (const [formField, templateVar] of Object.entries(fieldMapping)) {
      const value = formData[formField];
      normalized[templateVar] = isEmpty(value) ? '' : value;
    }

    // --------------------
    // NEW: Carry over already-normalized keys
    // If extractFormData() has already produced keys like "first_name_poc" we don't
    // want to wipe them out.  Keep any value that matches a template variable and
    // wasn't populated by the mapping above.
    // --------------------
    const templateVars = new Set(Object.values(fieldMapping));
    for (const [key, val] of Object.entries(formData)) {
      if (templateVars.has(key)) {
        if (!isEmpty(val)) {
          normalized[key] = val;
        }
      }
    }

    console.log('Normalized data keys:', Object.keys(normalized));
    return normalized;
  }

  // ROBUST ADDRESS PARSING
  parseAddress(addressString, prefix) {
    const emptyAddress = {
      [`address_${prefix}`]: addressString || '',
      [`city_${prefix}`]: '',
      [`state_${prefix}`]: '',
      [`zip_${prefix}`]: ''
    };

    if (!addressString) {
      return emptyAddress;
    }

    try {
      // Normalize line breaks and remove country if present
      const lines = addressString
        .replace(/\\n/g, '\n')
        .split('\n')
        .map(l => l.trim())
        .filter(l => l && !/United States/i.test(l));

      if (lines.length === 0) return emptyAddress;

      const streetAddress = lines.slice(0, -1).join(', ');
      const lastLine = lines[lines.length - 1];

      // Multiple regex patterns to handle different address formats
      const patterns = [
        // "Anytown, CA 90210" (comma-separated)
        /^(.*?),\s*([A-Za-z]{2})\s*(\d{5}(?:-\d{4})?)$/,
        // "Anytown CA 90210" (space-separated with 2-letter state)
        /^(.*?)\s+([A-Za-z]{2})\s+(\d{5}(?:-\d{4})?)$/,
        // "San Benito Texas 78586" (space-separated with full state name)
        /^(.*?)\s+(Texas|California|Florida|New York|Illinois|Pennsylvania|Ohio|Georgia|North Carolina|Michigan|New Jersey|Virginia|Washington|Arizona|Massachusetts|Tennessee|Indiana|Missouri|Maryland|Wisconsin|Colorado|Minnesota|South Carolina|Alabama|Louisiana|Kentucky|Oregon|Oklahoma|Connecticut|Utah|Iowa|Nevada|Arkansas|Mississippi|Kansas|New Mexico|Nebraska|West Virginia|Idaho|Hawaii|New Hampshire|Maine|Montana|Rhode Island|Delaware|South Dakota|North Dakota|Alaska|Vermont|Wyoming)\s+(\d{5}(?:-\d{4})?)$/i,
        // Fallback: "City State ZIP" with any state abbreviation
        /^(.*?)\s+([A-Za-z]{2,})\s+(\d{5}(?:-\d{4})?)$/
      ];

      for (const pattern of patterns) {
        const match = lastLine.match(pattern);
        if (match) {
          return {
            [`address_${prefix}`]: streetAddress || match[1].trim(),
            [`city_${prefix}`]: match[1].trim(),
            [`state_${prefix}`]: match[2].trim(),
            [`zip_${prefix}`]: match[3].trim()
          };
        }
      }
      
      // Fallback for single-line addresses that don't match patterns
      if (lines.length === 1) {
        return { ...emptyAddress, [`address_${prefix}`]: lines[0] };
      }

      // Fallback: put everything in address field
      return { ...emptyAddress, [`address_${prefix}`]: streetAddress || lastLine };

    } catch (error) {
      console.log(`Address parsing failed for ${prefix}:`, error.message);
      return emptyAddress;
    }
  }

  // ENRICHMENT - Add derived data like parsed addresses
  enrichData(normalizedData, formData) {
    console.log('=== ENRICHING DATA ===');
    
    const enriched = { ...normalizedData };

    // Parse business address
    if (formData['Business Address']) {
      const businessAddr = this.parseAddress(formData['Business Address'], 'issuer');
      Object.assign(enriched, businessAddr);

      // Build a single-line address string (street, city, state zip) so replacement text has no embedded newlines.
      const parts = [];
      if (businessAddr[`address_issuer`]) parts.push(businessAddr[`address_issuer`]);
      if (businessAddr[`city_issuer`]) parts.push(businessAddr[`city_issuer`]);
      const stateZip = [businessAddr[`state_issuer`], businessAddr[`zip_issuer`]].filter(Boolean).join(' ');
      if (stateZip) parts.push(stateZip);
      enriched.address_issuer = parts.join(', ');
    }

    // Parse project address  
    if (formData['Address']) {
      const projectAddr = this.parseAddress(formData['Address'], 'project');
      Object.assign(enriched, projectAddr);
    }

    // CRITICAL: Map specific _poc/_sign fields to generic template variables
    // Templates expect first_name, last_name, title for signature lines
    // Priority: signer info if available, otherwise fall back to POC info
    enriched.first_name = enriched.first_name_sign || enriched.first_name_poc || '';
    enriched.last_name = enriched.last_name_sign || enriched.last_name_poc || '';
    enriched.title = enriched.title_sign || enriched.title_poc || '';
    enriched.email = enriched.email_sign || enriched.email_poc || '';
    enriched.mobile_phone = enriched.mobile_phone_poc || '';
    enriched.linkedin = enriched.linkedin_sign || enriched.linkedin_poc || '';
    
    // Map EIN field for templates
    enriched.ein = enriched.ein_number || '';

    // Add system fields
    enriched.phase_one_submission = new Date().toISOString();
    enriched.current_date = new Date().toLocaleDateString();
    enriched.current_time = new Date().toLocaleTimeString();
    
    // Add fallbacks for missing critical fields to prevent broken documents
    if (!enriched.first_name) enriched.first_name = 'Contact';
    if (!enriched.last_name) enriched.last_name = 'Person';
    if (!enriched.email) enriched.email = 'contact@company.com';
    if (!enriched.project_name) enriched.project_name = `${enriched.business_legal_name} Project`;
    if (!enriched.financing_option) enriched.financing_option = 'Bridge';
    if (!enriched.target_issuer) enriched.target_issuer = '$1,000,000';
    if (!enriched.maximum_issuer) enriched.maximum_issuer = '$1,500,000';

    console.log('Enriched data sample:', {
      business_legal_name: enriched.business_legal_name,
      first_name_poc: enriched.first_name_poc,
      address_issuer: enriched.address_issuer,
      city_issuer: enriched.city_issuer
    });

    return enriched;
  }

  // CLEAN TEMPLATE RENDERING using Handlebars
  renderTemplate(templateContent, data) {
    console.log('=== RENDERING TEMPLATE ===');
    
    try {
      // Compile template with Handlebars in strict mode to catch missing variables
      const template = Handlebars.compile(templateContent, { strict: true });
      
      // Render with data - will throw error if variables are missing
      const result = template(data);
      
      console.log('Template rendered successfully');
      return result;
      
    } catch (error) {
      console.error('Template rendering failed:', error.message);
      console.log('Available variables:', Object.keys(data));
      return `ERROR: Template rendering failed - ${error.message}`;
    }
  }

  // INPUT VALIDATION with "null" string handling
  validateFormData(formData) {
    const errors = [];
    
    // Helper to check if value is effectively empty (including "null" strings)
    const isEmpty = (value) => {
      if (value === undefined || value === null) return true;
      const str = String(value).toLowerCase().trim();
      return str === '' || str === 'null' || str === 'unanswered';
    };
    
    // Critical fields validation - check both original form format AND normalized format
    const businessName = formData['Business Legal Name'] || formData.business_legal_name;
    if (isEmpty(businessName)) {
      errors.push('Business Legal Name is required');
    }
    
    // Check for first name in multiple possible locations
    const firstName = formData['First Name'] || formData['First Name (1)'] || formData.first_name || formData.first_name_1 || formData.first_name_poc;
    if (isEmpty(firstName)) {
      errors.push('Contact First Name is required');
    }
    
    // Check for email in multiple possible locations  
    const email = formData['Email'] || formData.email || formData.contact_email || formData.email_poc;
    if (isEmpty(email) || !String(email).includes('@')) {
      errors.push('Valid contact email is required');
    }
    
    // Sanitize business name for file system safety
    const businessNameStr = isEmpty(businessName) ? '' : String(businessName);
    const sanitizedName = businessNameStr.replace(/[<>:"/\\|?*]/g, '').trim();
    if (sanitizedName.length === 0) {
      errors.push('Business name contains only invalid characters');
    }
    
    // If we have critical validation errors, log but try to continue if possible
    if (errors.length > 0) {
      console.log('⚠️ Form validation warnings:', errors);
      console.log('📊 Available data:', { businessName, firstName, email });
      
      // Only fail if we have NO business name at all
      if (isEmpty(businessName)) {
        throw new Error('Business name is required for document generation');
      }
      
      console.log('✅ Continuing with available data (business name present)');
    }
    
    console.log('✅ Validation passed for:', { businessName, firstName, email });
    return sanitizedName;
  }

  // MAIN PROCESSING METHOD - Clean pipeline
  async processNewLead(formData) {
    try {
      console.log('=== PROCESSING NEW LEAD ===');
      console.log('Raw form data keys:', Object.keys(formData));
      
      // STAGE 0: Validate input
      const sanitizedBusinessName = this.validateFormData(formData);
      
      // STAGE 1: Normalize form data
      const normalizedData = this.normalizeFormData(formData);
      
      // STAGE 2: Enrich with derived data
      const enrichedData = this.enrichData(normalizedData, formData);
      
      // Initialize services if needed
      this.initializeServices();

      // Step 1: Create client folder structure
      const folders = await this.createClientFolders(sanitizedBusinessName);
      
      // Step 2: Create all documents with clean data and error handling
      const documents = await this.createAllDocuments(enrichedData, folders.internal.id);
      
      const result = {
        success: true,
        client: enrichedData.business_legal_name,
        folders: folders,
        documents: documents,
        message: 'Lead processed successfully'
      };

      console.log('🎉 Lead processing completed successfully!');
      console.log('📁 Folders created:');
      console.log(`   Main: ${folders.main.webViewLink}`);
      console.log(`   Internal: ${folders.internal.webViewLink}`);
      console.log('📄 Documents created:');
      Object.entries(documents).forEach(([key, doc]) => {
        if (doc.webViewLink) {
          console.log(`   ${key}: ${doc.webViewLink}`);
        }
      });
      
      return result;

    } catch (error) {
      console.error('Error processing lead:', error);
      throw error;
    }
  }

  async createClientFolders(businessName) {
    try {
      console.log(`Creating folder structure for: ${businessName}`);
      return await this.driveService.createClientFolderStructure(businessName);
    } catch (error) {
      console.error('Error creating client folders:', error);
      throw error;
    }
  }

  async createAllDocuments(enrichedData, internalFolderId) {
    const documents = {};
    const businessName = enrichedData.business_legal_name || 'Company';
    const createdDocs = []; // Track created docs for cleanup on failure
    
    try {
      console.log('=== CREATING DOCUMENTS ===');
      
      const documentConfigs = [
        { key: 'mnda', templateId: TEMPLATE_IDS.MNDA, name: `${businessName} - MNDA`, icon: '🔐' },
        { key: 'poa', templateId: TEMPLATE_IDS.POA, name: `${businessName} - POA`, icon: '📋' },
        { key: 'projectOverview', templateId: TEMPLATE_IDS.PROJECT_OVERVIEW, name: `${businessName} - Project Overview`, icon: '📊' },
        { key: 'formId', templateId: TEMPLATE_IDS.FORM_ID, name: `${businessName} - Form ID`, icon: '🆔' },
        { key: 'termSheet', templateId: this.getTermSheetTemplateId(enrichedData), name: `${businessName} - ${this.getProjectTypeName(enrichedData)} Term Sheet`, icon: '💼' }
      ];
      
      // Create documents sequentially with error tracking
      for (const config of documentConfigs) {
        try {
          console.log(`${config.icon} Creating ${config.name}...`);
          const doc = await this.docsService.createDocumentFromTemplate(
            config.templateId,
            config.name,
            internalFolderId,
            enrichedData
          );
          documents[config.key] = doc;
          createdDocs.push(doc);
          console.log(`✅ ${config.name} created successfully`);
        } catch (docError) {
          console.error(`❌ Failed to create ${config.name}:`, docError.message);
          // Continue with other documents but log the failure
          documents[config.key] = { error: docError.message, name: config.name };
        }
      }
      
      const successCount = Object.values(documents).filter(doc => doc.id).length;
      const totalCount = documentConfigs.length;
      
      if (successCount === 0) {
        throw new Error('Failed to create any documents');
      } else if (successCount < totalCount) {
        console.log(`⚠️ Partial success: ${successCount}/${totalCount} documents created`);
      } else {
        console.log('✅ All documents created successfully');
      }
      
      return documents;
      
    } catch (error) {
      console.error('❌ Critical error in document creation:', error.message);
      
      // Log partial failures for debugging
      if (createdDocs.length > 0) {
        console.log(`${createdDocs.length} documents were created before failure:`,
          createdDocs.map(doc => doc.name).join(', '));
      }
      
      throw error;
    }
  }

  // Helper methods for project type detection
  getProjectTypeDetails(formData) {
    const projectTypeStr = String(formData.financing_option || formData.tech_offering || '').toLowerCase();
    
    for (const [keyword, details] of Object.entries(PROJECT_TYPE_CONFIG)) {
      if (projectTypeStr.includes(keyword)) {
        return details;
      }
    }
    
    return PROJECT_TYPE_CONFIG.bridge; // Default
  }

  getTermSheetTemplateId(formData) {
    const details = this.getProjectTypeDetails(formData);
    return TEMPLATE_IDS.TERM_SHEETS[details.id];
  }

  getProjectTypeName(formData) {
    return this.getProjectTypeDetails(formData).name;
  }
}

module.exports = Phase1AutomationService;