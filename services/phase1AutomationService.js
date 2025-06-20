const GoogleDocsService = require('./googleDocs');
const GoogleDriveService = require('./googleDrive');
const EmailService = require('./emailService');
const SlackService = require('./slackService');
const LeadTrackingService = require('./leadTrackingService');
const termSheets = require('../config/termSheets');
const { TEMPLATE_IDS, PROJECT_TYPE_CONFIG } = require('../config/templateIds');
require('dotenv').config();

class Phase1AutomationService {
  constructor() {
    console.log('Initializing Phase1AutomationService...');
    this.docsService = null;
    this.driveService = null;
    this.leadTrackingService = new LeadTrackingService();
    // Skip email and slack for now
    // this.emailService = new EmailService();
    // this.slackService = new SlackService();
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

  preprocessFormData(formData) {
    console.log('=== PREPROCESSING FORM DATA ===');
    console.log('Raw form keys:', Object.keys(formData));
    
    // Handle address parsing helper function
    const parseAddress = (addressString) => {
      if (!addressString) return { address: '', city: '', state: '', zip: '' };
      
      // Handle format: "30512 Ratliff Road\nSan Benito Texas 78586\nUnited States"
      const lines = addressString.split('\n').map(line => line.trim()).filter(line => line);
      if (lines.length >= 2) {
        const address = lines[0] || '';
        const cityStateZip = lines[1] || '';
        const parts = cityStateZip.split(' ');
        const zip = parts[parts.length - 1] || '';
        const state = parts[parts.length - 2] || '';
        const city = parts.slice(0, -2).join(' ') || '';
        
        return { address, city, state, zip };
      }
      
      return { address: addressString, city: '', state: '', zip: '' };
    };

    // Parse business address
    const businessAddr = parseAddress(formData['Business Address']);
    // Parse project address  
    const projectAddr = parseAddress(formData['Address']);

    // Map actual form field names to internal field names
    const processedData = {
      // === POC CONTACT INFORMATION ===
      first_name_poc: formData['First Name'] || '',
      last_name_poc: formData['Last Name'] || '',
      title_poc: formData['Title'] || '',
      email_poc: formData['Email'] || '',
      mobile_phone_poc: formData['Phone Number'] || '',
      linkedin_poc: formData['LinkedIn'] || '',
      
      // === SIGNER INFORMATION (numbered fields) ===
      first_name_sign: formData['First Name (1)'] || '',
      last_name_sign: formData['Last Name (1)'] || '',
      title_sign: formData['Title (1)'] || '',
      email_sign: formData['Email (1)'] || '',
      linkedin_sign: formData['LinkedIn (1)'] || '',
      
      // === BUSINESS INFORMATION ===
      business_legal_name: formData['Business Legal Name'] || '',
      doing_business_as: formData['DBA (Doing Buisness As)'] || formData['DBA (Doing Business As)'] || '',
      ein_number: formData['EIN'] || '',
      entity_type: formData['Type of Entity'] || '',
      state_incorporation: formData['State of Incorporation'] || '',
      date_incorporation: formData['Incorporation Date'] || '',
      fiscal_year_end: formData['Fiscal Year End'] || '',
      website_issuer: formData['Website'] || '',
      
      // === BUSINESS ADDRESS ===
      address_issuer: businessAddr.address,
      city_issuer: businessAddr.city,
      state_issuer: businessAddr.state,
      zip_issuer: businessAddr.zip,
      phone_issuer: formData['Business Phone'] || '',
      business_description: formData['Business Description'] || '',
      
      // === PROJECT INFORMATION ===
      tech_offering: formData['What technology are you raising capital for?'] || '',
      other_tech: formData['Please specify your technology'] || '',
      project_name: formData['Project or Portfolio Name'] || '',
      
      // === PROJECT ADDRESS ===
      address_project: projectAddr.address,
      city_project: projectAddr.city,
      state_project: projectAddr.state,
      zip_project: projectAddr.zip,
      
      // === PROJECT DETAILS & FINANCIAL ===
      name_plate_capacity: formData['Project Size'] || '',
      target_issuer: formData['Minimum Capital Needed'] || '',
      maximum_issuer: formData['Maximum Capital Needed'] || '',
      deadline_offering: formData['By when do you need the capital?'] || '',
      project_description: formData['Project Description'] || '',
      use_of_funds: formData['Describe the use of funds'] || '',
      
      // === FINANCING INFORMATION ===
      financing_option: formData['Which of the options above is a better fit for your project?'] || '',
      financing_other: formData['If other, please specify'] || '',
      financing_requirements: formData['Do you have any preferred terms or requirements?'] || '',
      interest_rate: formData['Desired Rate'] || '',
      term_months: formData['Desired Term'] || '',
      
      // === LEGACY COMPATIBILITY - keep any existing fields that might be used ===
      contact_email: formData['Email'] || formData.contact_email || '',
      contact_name: `${formData['First Name'] || ''} ${formData['Last Name'] || ''}`.trim() || formData.contact_name || '',
      project_type: formData['What technology are you raising capital for?'] || formData.project_type || '',
      
      // === PRESERVE ANY ADDITIONAL FIELDS ===
      ...formData  // Keep original fields as fallback
    };

    console.log('=== PROCESSED FORM DATA ===');
    console.log('Business name:', processedData.business_legal_name);
    console.log('Contact name:', processedData.contact_name);
    console.log('Project name:', processedData.project_name);
    console.log('Technology:', processedData.tech_offering);
    console.log('Financing option:', processedData.financing_option);
    console.log('================================');
    
    return processedData;
  }

  async processNewLead(formData) {
    try {
      // Preprocess form data to convert display names to internal field names
      const processedFormData = this.preprocessFormData(formData);
      console.log('Processing new lead:', processedFormData.business_legal_name);
      
      // Initialize services if needed
      this.initializeServices();

      // Step 1: Create client folder structure in "Leads Phase 1"
      const folders = await this.createClientFolders(processedFormData.business_legal_name);
      
      // Step 2: Create all separate documents in Internal folder
      const documents = await this.createAllDocuments(processedFormData, folders.internal.id);
      
      // Step 3: Set folder permissions (TEMPORARILY DISABLED FOR TESTING)
      const clientEmail = processedFormData.contact_email || processedFormData.email_poc;
      console.log(`📧 Client email: ${clientEmail}`);
      console.log('⏭️ SKIPPING folder permissions for testing - will re-enable later');
      // if (clientEmail && !clientEmail.startsWith('[') && clientEmail.includes('@')) {
      //   await this.setFolderPermissions(folders, clientEmail);
      // } else {
      //   console.log('Skipping folder permissions - no valid email provided');
      // }
      
      // Step 4: Send client welcome email (disabled for now)
      // await this.sendClientWelcomeEmail(formData);
      
      // Step 5: Send team notifications (disabled for now)
      // await this.sendTeamNotifications(formData, folders);

      // Step 6: Create lead tracking entry for Phase 2 linkage
      console.log('Creating lead tracking entry...');
      const leadId = await this.leadTrackingService.createLead({
        business_legal_name: processedFormData.business_legal_name,
        phase1_folder_id: folders.main.id,
        phase1_submission_data: processedFormData
      });

      const result = {
        success: true,
        client: processedFormData.business_legal_name,
        lead_id: leadId,
        folders: folders,
        documents: documents,
        message: 'Lead processed successfully'
      };

      console.log('Lead processing completed successfully with lead ID:', leadId);
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

  async createAllDocuments(formData, internalFolderId) {
    try {
      console.log('=== CREATING 5 SEPARATE DOCUMENTS ===');
      console.log('Form data received:', JSON.stringify(formData, null, 2));
      
      // Prepare comprehensive variable replacements
      const replacements = await this.prepareAllReplacements(formData);
      
      const documents = {};
      
      // 1. Create MNDA Document
      console.log('🔐 Creating MNDA Document...');
      documents.mnda = await this.docsService.createDocumentFromTemplate(
        TEMPLATE_IDS.MNDA,
        `${formData.business_legal_name || 'Company'} - MNDA`,
        internalFolderId,
        replacements
      );
      console.log('✅ MNDA Created:', documents.mnda.name);
      
      // 2. Create POA Document  
      console.log('📋 Creating POA Document...');
      documents.poa = await this.docsService.createDocumentFromTemplate(
        TEMPLATE_IDS.POA,
        `${formData.business_legal_name || 'Company'} - POA`,
        internalFolderId,
        replacements
      );
      console.log('✅ POA Created:', documents.poa.name);
      
      // 3. Create Project Overview Document
      console.log('📊 Creating Project Overview Document...');
      documents.projectOverview = await this.docsService.createDocumentFromTemplate(
        TEMPLATE_IDS.PROJECT_OVERVIEW,
        `${formData.business_legal_name || 'Company'} - Project Overview`,
        internalFolderId,
        replacements
      );
      console.log('✅ Project Overview Created:', documents.projectOverview.name);
      
      // 4. Create Form ID Document from template
      console.log('🆔 Creating Form ID Document...');
      documents.formId = await this.docsService.createDocumentFromTemplate(
        TEMPLATE_IDS.FORM_ID,
        `${formData.business_legal_name || 'Company'} - Form ID`,
        internalFolderId,
        replacements
      );
      console.log('✅ Form ID Created:', documents.formId.name);
      
      // 5. Create Term Sheet Document
      console.log('💼 Creating Term Sheet Document...');
      const termSheetId = this.getTermSheetTemplateId(formData);
      const projectTypeName = this.getProjectTypeName(formData);
      console.log('Using Term Sheet Template ID:', termSheetId);
      documents.termSheet = await this.docsService.createDocumentFromTemplate(
        termSheetId,
        `${formData.business_legal_name || 'Company'} - ${projectTypeName} Term Sheet`,
        internalFolderId,
        replacements
      );
      console.log('✅ Term Sheet Created:', documents.termSheet.name);
      
      console.log('🎉 SUCCESS: Created ALL 5 separate documents:');
      console.log('  1. MNDA:', documents.mnda.name);
      console.log('  2. POA:', documents.poa.name);
      console.log('  3. Project Overview:', documents.projectOverview.name);
      console.log('  4. Form ID:', documents.formId.name);
      console.log('  5. Term Sheet:', documents.termSheet.name);
      
      return documents;
      
    } catch (error) {
      console.error('❌ Error creating documents:', error);
      throw error;
    }
  }


  // Helper to get project type details using centralized config
  getProjectTypeDetails(formData) {
    const projectTypeStr = String(formData.financing_option || formData.Financing_option || formData.project_type || '').toLowerCase();
    
    for (const [keyword, details] of Object.entries(PROJECT_TYPE_CONFIG)) {
      if (projectTypeStr.includes(keyword)) {
        return details;
      }
    }
    
    return PROJECT_TYPE_CONFIG.bridge; // Default to bridge
  }

  getTermSheetTemplateId(formData) {
    const details = this.getProjectTypeDetails(formData);
    return TEMPLATE_IDS.TERM_SHEETS[details.id];
  }

  getProjectType(formData) {
    return this.getProjectTypeDetails(formData).key;
  }

  getProjectTypeName(formData) {
    return this.getProjectTypeDetails(formData).name;
  }


  async prepareAllReplacements(formData) {
    // Get comprehensive replacements - case sensitive, exact matches only
    const baseReplacements = await this.prepareDocumentReplacements(formData);
    
    // Check if we have actual form data (not the default fallback placeholders)
    const hasRealFormData = Object.keys(formData).length > 0 && 
      Object.values(formData).some(value => 
        value !== null && value !== undefined && value !== ''
      );
    
    console.log('=== FORM DATA ANALYSIS ===');
    console.log('Has real form data:', hasRealFormData);
    console.log('Form data keys:', Object.keys(formData));
    console.log('Business name from form:', formData.business_legal_name);
    console.log('Contact email from form:', formData.contact_email || formData.email_poc);
    console.log('============================');
    
    // Use test data only if we have NO real form data at all
    const useTestData = !hasRealFormData;
    
    // Support ALL variable formats: bare variables, {{variable}}, and [variable]
    const allReplacements = {};

    // ---------------- WHITELIST ------------------
    // Only these canonical variable keys (and their derived variants) are allowed to appear.
    const allowedKeys = new Set([
      // Top-level
      'project_name', 'phase_one_submission',

      // POC
      'first_name_poc','last_name_poc','title_poc','email_poc','mobile_phone_poc','linkedin_poc',
      // Signer
      'first_name_sign','last_name_sign','title_sign','email_sign','linkedin_sign','mobile_phone_sign',
      // Business
      'business_legal_name','doing_business_as','ein_number','entity_type','state_incorporation','date_incorporation','fiscal_year_end','website_issuer',
      'address_issuer','city_issuer','state_issuer','zip_issuer','phone_issuer','business_description',
      // Project
      'tech_offering','other_tech','address_project','city_project','state_project','zip_project','name_plate_capacity',
      'target_issuer','maximum_issuer','deadline_offering','project_description','use_of_funds',
      // Financing
      'financing_option','financing_other','financing_requirements','interest_rate','term_months',
      
      // === TEMPLATE COMPATIBILITY VARIABLES ===
      // Base variables that templates actually use (mapped from _poc/_sign forms)
      'first_name', 'last_name', 'title', 'email', 'mobile_phone', 'linkedin',
      'ein', 'website', 'tech', 'deadline', 'term', 'rate', 'timeline',
      'target_offering_amount', 'maximum_offering_amount',
      
      // System variables
      'current_date', 'current_time', 'form_id', 'calendar_link', 'term_sheet_content',
      
      // Template-specific variables that need mappings
      'Financing_option', 'Entity_type', 'Name_plate_capacity'
    ]);

    //------------------------------------------------

    Object.keys(baseReplacements).forEach(key => {
      if (!allowedKeys.has(key)) return;   // ❌ Skip any legacy / unapproved variable

      const value = baseReplacements[key];
      
      // Handle null/undefined/empty cases with intelligent fallbacks
      let processedValue = '';
      if (value === null || value === undefined || value === '') {
        // Always use test data fallbacks for missing values
        processedValue = this.getTestDataFallback(key);
      } else if (typeof value === 'object') {
        processedValue = JSON.stringify(value);
      } else {
        processedValue = String(value);
      }
      
      // Support SAFE delimited variable formats used in templates:
      const baseCurly = `{{${key}}}`;
      const baseSquare = `[${key}]`;
      allReplacements[baseCurly] = processedValue;  // {{variable}} format
      allReplacements[baseSquare] = processedValue; // [variable] format
      allReplacements[key] = processedValue;        // bare variable format

      // NEW: double-square variant e.g. [[variable]] (covers docs that wrap {{}} with [])
      allReplacements[`[[${key}]]`] = processedValue;

      // --- NEW: add variants with spaces (e.g., "first_name_poc" -> "first name poc")
      if (key.includes('_')) {
        const spaced = key.replace(/_/g, ' ');
        const titleSpaced = spaced.replace(/\b\w/g, chr => chr.toUpperCase()); // Title Case

        // lower-case spaced variants
        allReplacements[`{{${spaced}}}`] = processedValue;
        allReplacements[`[${spaced}]`] = processedValue;
        allReplacements[`[[${spaced}]]`] = processedValue;
        allReplacements[spaced] = processedValue;

        // Title Case spaced variants (matches templates like "[First Name POC]")
        allReplacements[`{{${titleSpaced}}}`] = processedValue;
        allReplacements[`[${titleSpaced}]`] = processedValue;
        allReplacements[`[[${titleSpaced}]]`] = processedValue;
        allReplacements[titleSpaced] = processedValue;

        // --- NEW variant: last token upper-cased to handle acronyms like "POC"
        const parts = spaced.split(' ');
        if (parts.length > 1) {
          const lastUpper = parts.slice(0, -1).map(w => w.charAt(0).toUpperCase() + w.slice(1)).concat(parts[parts.length - 1].toUpperCase()).join(' ');
          allReplacements[`{{${lastUpper}}}`] = processedValue;
          allReplacements[`[${lastUpper}]`] = processedValue;
          allReplacements[`[[${lastUpper}]]`] = processedValue;
          allReplacements[lastUpper] = processedValue;
        }
      }
    });
    
    // Add debug logging
    console.log('=== VARIABLE REPLACEMENTS PREPARED ===');
    console.log('Using test data fallbacks:', useTestData);
    console.log('Total replacements:', Object.keys(allReplacements).length);
    console.log('Sample replacements:');
    Object.keys(allReplacements).slice(0, 10).forEach(key => {
      console.log(`  ${key} -> ${allReplacements[key]}`);
    });
    console.log('=====================================');
    
    return allReplacements;
  }

  async prepareDocumentReplacements(formData) {
    // Get the appropriate term sheet content using consistent project type detection
    const projectType = formData.financing_option || formData.Financing_option || formData.project_type;
    const termSheetContent = this.getTermSheetContent(projectType, formData);
    
    // Base form data mappings
    const directMappings = this.getDirectFormMappings(formData);
    
    // Generate AI content for complex fields
    const aiGeneratedContent = await this.generateAIContent(formData);
    
    // Smart defaults and calculations
    const calculatedFields = this.getCalculatedFields(formData);
    
    // Combine all sources
    const replacements = {
      ...directMappings,
      ...aiGeneratedContent, 
      ...calculatedFields,
      term_sheet_content: termSheetContent,
      submission_date: new Date().toLocaleDateString(),
      current_date: new Date().toLocaleDateString(),
      current_time: new Date().toLocaleTimeString()
    };

    // Add all form data as potential replacements (in case there are additional fields)
    Object.keys(formData).forEach(key => {
      if (!replacements[key]) {
        replacements[key] = formData[key];
      }
    });

    return replacements;
  }

  getDirectFormMappings(formData) {
    console.log('=== CREATING DIRECT FORM MAPPINGS ===');
    console.log('Input formData keys:', Object.keys(formData));
    
    return {
      // === PROJECT OVERVIEW TEMPLATE EXACT MAPPINGS ===
      
      // Date Submission
      phase_one_submission: formData.phase_one_submission || formData.submission_time || new Date().toISOString(),
      
      // Contact Information (Issuer Point of Contact) 
      first_name_poc: formData.first_name_poc || formData.first_name,
      last_name_poc: formData.last_name_poc || formData.last_name,
      title_poc: formData.title_poc,
      email_poc: formData.email_poc || formData.contact_email,
      mobile_phone_poc: formData.mobile_phone_poc || formData.mobile_phone || formData.phone_number,
      linkedin_poc: formData.linkedin_poc || formData.linkedin,
      
      // Signer Information (with _sign suffix for templates)
      first_name_sign: formData.first_name_sign || formData.first_name,
      last_name_sign: formData.last_name_sign || formData.last_name,
      title_sign: formData.title_sign,
      email_sign: formData.email_sign || formData.contact_email,
      linkedin_sign: formData.linkedin_sign || formData.linkedin,
      mobile_phone_sign: formData.mobile_phone_sign || formData.mobile_phone || formData.phone_number,
      
      // Business Information - Using exact field names from user specification
      business_legal_name: formData.business_legal_name,
      doing_business_as: formData.doing_business_as,
      ein_number: formData.ein_number,
      entity_type: formData.entity_type,
      state_incorporation: formData.state_incorporation,
      date_incorporation: formData.date_incorporation,
      fiscal_year_end: formData.fiscal_year_end,
      website_issuer: formData.website_issuer,
      
      // Business Address
      address_issuer: formData.address_issuer,
      city_issuer: formData.city_issuer,
      state_issuer: formData.state_issuer,
      zip_issuer: formData.zip_issuer,
      phone_issuer: formData.phone_issuer,
      business_description: formData.business_description,
      
      // Project Information
      tech_offering: formData.tech_offering,
      other_tech: formData.other_tech,
      project_name: formData.project_name,
      
      // Project Address (separate from business address)
      address_project: formData.address_project,
      city_project: formData.city_project,
      state_project: formData.state_project,
      zip_project: formData.zip_project,
      
      // Project Details & Financial - Using exact field names from user specification
      name_plate_capacity: formData.name_plate_capacity,
      target_issuer: formData.target_issuer,
      maximum_issuer: formData.maximum_issuer,
      deadline_offering: formData.deadline_offering,
      project_description: formData.project_description,
      use_of_funds: formData.use_of_funds,
      
      // Financing Information
      financing_option: formData.financing_option,
      financing_other: formData.financing_other,
      financing_requirements: formData.financing_requirements,
      interest_rate: formData.interest_rate,
      term_months: formData.term_months,
      
      // === LEGACY COMPATIBILITY FIELDS ===
      contact_email: formData.contact_email || formData.email_poc || '[Contact Email]',
      contact_name: formData.contact_name || `${formData.first_name || ''} ${formData.last_name || ''}`.trim() || '[Contact Name]',
      project_type: formData.project_type || formData.financing_option || formData.Financing_option || '[Project Type]',
      form_id: formData.form_id || '[Form ID]',
      calendar_link: process.env.CALENDAR_LINK || '[Calendar Link]',
      
      // === TEMPLATE COMPATIBILITY MAPPINGS ===
      // Base variables that templates actually use (mapped from _poc/_sign forms)
      first_name: formData.first_name_poc || formData.first_name_sign || formData.first_name || '[First Name]',
      last_name: formData.last_name_poc || formData.last_name_sign || formData.last_name || '[Last Name]',
      title: formData.title_poc || formData.title_sign || '[Title]',
      email: formData.email_poc || formData.email_sign || formData.contact_email || '[Email]',
      mobile_phone: formData.mobile_phone_poc || formData.mobile_phone_sign || formData.mobile_phone || formData.phone_number || '[Mobile Phone]',
      linkedin: formData.linkedin_poc || formData.linkedin_sign || formData.linkedin || '[LinkedIn]',
      
      // Business mappings
      ein: formData.ein_number || '[EIN]',
      website: formData.website_issuer || '[Website]',
      
      // Project mappings  
      tech: formData.tech_offering || '[Technology]',
      deadline: formData.deadline_offering || '[Deadline]',
      
      // Financial mappings
      target_offering_amount: formData.target_issuer || '[Target Amount]',
      maximum_offering_amount: formData.maximum_issuer || '[Maximum Amount]',
      term: formData.term_months || '[Term]',
      rate: formData.interest_rate || '[Interest Rate]',
      timeline: formData.timeline || '[Timeline]',
      
      // Template-specific variable mappings
      Financing_option: formData.financing_option || formData.Financing_option || '[Financing Option]',
      Entity_type: formData.entity_type || formData.Entity_type || '[Entity Type]',  
      Name_plate_capacity: formData.name_plate_capacity || formData.Name_plate_capacity || '[Nameplate Capacity]',
      
      // === ADDITIONAL FINANCIAL FIELDS ===
      annual_revenue: formData.annual_revenue || '[Annual Revenue]',
      appraisal_costs: formData.appraisal_costs || '[Appraisal Costs]',
      audit_fee: formData.audit_fee || '[Audit Fee]',
      balloon_payment: formData.balloon_payment || '[Balloon Payment]',
      carbon_credit_revenue: formData.carbon_credit_revenue || '[Carbon Credit Revenue]',
      carbon_credits: formData.carbon_credits || '[Carbon Credits]',
      closing_costs: formData.closing_costs || '[Closing Costs]',
      credit_limit: formData.credit_limit || '[Credit Limit]',
      estimated_savings: formData.estimated_savings || '[Estimated Savings]',
      expected_return: formData.expected_return || '[Expected Return]',
      expected_roi: formData.expected_roi || '[Expected ROI]',
      funding_amount: formData.funding_amount || '[Funding Amount]',
      initial_disbursement: formData.initial_disbursement || '[Initial Disbursement]',
      initial_investment: formData.initial_investment || '[Initial Investment]',
      interest_payment_schedule: formData.interest_payment_schedule || '[Interest Payment Schedule]',
      investment_structure: formData.investment_structure || '[Investment Structure]',
      legal_fees: formData.legal_fees || '[Legal Fees]',
      loan_amount: formData.loan_amount || '[Loan Amount]',
      milestone_funding: formData.milestone_funding || '[Milestone Funding]',
      monthly_fee: formData.monthly_fee || '[Monthly Fee]',
      monthly_payment: formData.monthly_payment || '[Monthly Payment]',
      npv: formData.npv || '[NPV]',
      operating_costs: formData.operating_costs || '[Operating Costs]',
      origination_fee: formData.origination_fee || '[Origination Fee]',
      prepayment_terms: formData.prepayment_terms || '[Prepayment Terms]',
      repayment_terms: formData.repayment_terms || '[Repayment Terms]',
      roi_timeline: formData.roi_timeline || '[ROI Timeline]',
      setup_fee: formData.setup_fee || '[Setup Fee]',
      success_fee: formData.success_fee || '[Success Fee]',
      value_increase: formData.value_increase || '[Value Increase]',
      wire_fees: formData.wire_fees || '[Wire Fees]',
      
      // Timeline & Duration
      breakeven_point: formData.breakeven_point || '[Breakeven Point]',
      construction_timeline: formData.construction_timeline || '[Construction Timeline]',
      development_timeline: formData.development_timeline || '[Development Timeline]',
      draw_period: formData.draw_period || '[Draw Period]',
      payback_period: formData.payback_period || '[Payback Period]',
      term_length: formData.term_length || '[Term Length]',
      termination_terms: formData.termination_terms || '[Termination Terms]',
      
      // Performance Metrics
      advance_rate: formData.advance_rate || '[Advance Rate]',
      energy_rating: formData.energy_rating || '[Energy Rating]',
      ltv_ratio: formData.ltv_ratio || '[LTV Ratio]',
      max_draw: formData.max_draw || '[Max Draw]',
      minimum_interest: formData.minimum_interest || '[Minimum Interest]',
      renewable_integration: formData.renewable_integration || '[Renewable Integration]',
      
      // Project Details
      building_type: formData.building_type || '[Building Type]',
      capture_capacity: formData.capture_capacity || '[Capture Capacity]',
      financing_purpose: formData.financing_purpose || '[Financing Purpose]',
      grid_connection_type: formData.grid_connection_type || '[Grid Connection Type]',
      project_capacity: formData.project_capacity || '[Project Capacity]',
      project_duration: formData.project_duration || '[Project Duration]',
      project_stage: formData.project_stage || '[Project Stage]',
      total_project_cost: formData.total_project_cost || '[Total Project Cost]',
      
      // Additional fields
      authorized_signatory: formData.authorized_signatory || formData.contact_name || `${formData.first_name || ''} ${formData.last_name || ''}`.trim() || '[Authorized Signatory]',
      timeline: formData.timeline || '[Timeline]'
    };
  }

  async generateAIContent(formData) {
    // For now, return smart defaults. Later we can add AI integration
    const projectType = (formData.financing_option || formData.Financing_option || formData.project_type || '').toLowerCase();
    
    return {
      // Technical Specifications
      capture_technology: this.getTechnicalDefault('capture_technology', projectType),
      capture_technology_details: this.getTechnicalDefault('capture_technology_details', projectType),
      energy_performance: this.getTechnicalDefault('energy_performance', projectType),
      equipment_eligibility: this.getTechnicalDefault('equipment_eligibility', projectType),
      monitoring_system: this.getTechnicalDefault('monitoring_system', projectType),
      storage_location: this.getTechnicalDefault('storage_location', projectType),
      storage_method: this.getTechnicalDefault('storage_method', projectType),
      technology_risk: this.getTechnicalDefault('technology_risk', projectType),
      water_efficiency: this.getTechnicalDefault('water_efficiency', projectType),
      
      // Legal & Contractual Terms
      collateral_description: this.getLegalDefault('collateral_description', projectType),
      development_rights: this.getLegalDefault('development_rights', projectType),
      exit_mechanisms: this.getLegalDefault('exit_mechanisms', projectType),
      exit_strategy: this.getLegalDefault('exit_strategy', projectType),
      financial_covenants: this.getLegalDefault('financial_covenants', projectType),
      permitting_risk: this.getLegalDefault('permitting_risk', projectType),
      personal_guarantees: this.getLegalDefault('personal_guarantees', projectType),
      
      // Risk Factors
      contingency_reserve: this.getRiskDefault('contingency_reserve', projectType),
      development_risk: this.getRiskDefault('development_risk', projectType),
      market_risk: this.getRiskDefault('market_risk', projectType),
      
      // Environmental & Sustainability
      certification_level: this.getEnvironmentalDefault('certification_level', projectType),
      certification_target: this.getEnvironmentalDefault('certification_target', projectType),
      environmental_impact: this.getEnvironmentalDefault('environmental_impact', projectType),
      indoor_quality: this.getEnvironmentalDefault('indoor_quality', projectType),
      sustainable_materials: this.getEnvironmentalDefault('sustainable_materials', projectType),
      waste_reduction: this.getEnvironmentalDefault('waste_reduction', projectType),
      water_features: this.getEnvironmentalDefault('water_features', projectType)
    };
  }

  getCalculatedFields(formData) {
    return {
      // Context-dependent fields with smart defaults
      milestone_structure: this.calculateMilestoneStructure(formData),
      square_footage: formData.square_footage || '[Square Footage]',
      ppa_details: this.calculatePPADetails(formData),
      
      // Fields needing analysis - only fields NOT already in getDirectFormMappings
      ar_eligibility: formData.ar_eligibility || '80% of qualifying receivables under 90 days',
      equity_participation: formData.equity_participation || '[Equity Participation %]',
      financing_structure: this.getFinancingStructure(formData),
      inventory_eligibility: formData.inventory_eligibility || 'Finished goods inventory only',
      renewal_options: formData.renewal_options || 'Annual renewal subject to review',
      reporting_requirements: this.getReportingRequirements(formData),
      total_interest: this.calculateTotalInterest(formData),
      verification_protocol: this.getVerificationProtocol(formData)
    };
  }

  getTermSheetContent(projectType, formData) {
    if (!projectType) {
      return '[Term Sheet Content - Project Type Not Specified]';
    }

    const projectTypeKey = String(projectType).toLowerCase().replace(/[^a-z0-9]/g, '_');
    
    // Map common project type variations
    const typeMapping = {
      'solar': 'solar',
      'solar_energy': 'solar',
      'photovoltaic': 'solar',
      'pv': 'solar',
      'carbon_capture': 'carbon_capture',
      'carbon_sequestration': 'carbon_capture',
      'ccs': 'carbon_capture',
      'construction': 'construction',
      'building': 'construction',
      'sustainable_construction': 'construction',
      'green_building': 'construction',
      'bridge': 'bridge',
      'bridge_financing': 'bridge',
      'interim_financing': 'bridge',
      'working_capital': 'working_capital',
      'working_capital_financing': 'working_capital',
      'line_of_credit': 'working_capital',
      'predevelopment': 'predevelopment',
      'pre_development': 'predevelopment',
      'development_capital': 'predevelopment',
      'permanent_debt': 'permanent_debt',
      'permanent': 'permanent_debt',
      'term_loan': 'permanent_debt',
      'other': 'other',
      'custom': 'other',
      'alternative': 'other'
    };

    const mappedType = typeMapping[projectTypeKey] || projectTypeKey;
    
    if (termSheets[mappedType]) {
      return this.replacePlaceholdersInTermSheet(termSheets[mappedType], formData);
    }

    // Default fallback
    return `[Term Sheet for ${projectType} - Please customize this section with specific terms for this project type]`;
  }

  replacePlaceholdersInTermSheet(termSheetTemplate, formData) {
    let content = termSheetTemplate;
    
    // Replace placeholders in the term sheet content - case sensitive exact matches only
    Object.keys(formData).forEach(key => {
      const placeholder = `{{${key}}}`;
      const value = formData[key] || `[${key}]`;
      // Use case-sensitive replacement, not regex with 'i' flag
      content = content.split(placeholder).join(value);
    });

    return content;
  }

  async setFolderPermissions(folders, clientEmail) {
    try {
      console.log('Setting folder permissions...');
      
      // Internal folder: projects@climatize.earth access
      const internalPermissions = [
        { role: 'writer', type: 'user', emailAddress: 'projects@climatize.earth' }
      ];
      
      // External folder: jim@climatize.earth & alba@climatize.earth & client
      const externalPermissions = [
        { role: 'writer', type: 'user', emailAddress: 'jim@climatize.earth' },
        { role: 'writer', type: 'user', emailAddress: 'alba@climatize.earth' },
        { role: 'reader', type: 'user', emailAddress: clientEmail }
      ].filter(perm => perm.emailAddress);

      await this.driveService.setFolderPermissions(folders.internal.id, internalPermissions);
      await this.driveService.setFolderPermissions(folders.external.id, externalPermissions);

      console.log('Folder permissions set successfully');
    } catch (error) {
      console.error('Error setting folder permissions:', error);
      throw error;
    }
  }

  async sendClientWelcomeEmail(formData) {
    try {
      console.log('Sending client welcome email...');
      
      const emailContent = `Dear ${formData.first_name || 'Valued Client'},

Thank you for completing the form on climatize.earth!

Next steps:
1. You will receive a request to sign the MNDA via Google Drive
2. Please book a meeting with us using this calendar link: ${process.env.CALENDAR_LINK || 'https://calendly.com/climatize'}

We look forward to working with you on ${formData.project_name || 'your project'}.

Best regards,
Climatize.earth Team`;

      // For now, just log the email content
      console.log('Email would be sent to:', formData.email_poc || formData.contact_email);
      console.log('Email content:', emailContent);
      
    } catch (error) {
      console.error('Error sending client email:', error);
    }
  }

  async sendTeamNotifications(formData, folders) {
    try {
      console.log('Sending team notifications...');
      
      const notification = `🚀 New Phase 1 Lead: ${formData.business_legal_name}

Project: ${formData.project_name || 'N/A'}
Contact: ${formData.first_name || ''} ${formData.last_name || ''}
      Email: ${formData.email_poc || formData.contact_email || 'N/A'}
Project Type: ${formData.Financing_option || formData.project_type || 'N/A'}

Folder Link: ${folders.main.webViewLink}

All documents have been created in the Internal folder.`;

      // For now, just log the notification
      console.log('Notification would be sent to jim@climatize.earth and alba@climatize.earth');
      console.log('Notification content:', notification);
      
    } catch (error) {
      console.error('Error sending team notifications:', error);
    }
  }


  async testServices() {
    console.log('Testing automation services...');
    
    const results = {
      email: false,
      slack: false,
      googleAuth: false
    };

    try {
      results.email = await this.emailService.testConnection();
    } catch (error) {
      console.error('Email service test failed:', error.message);
    }

    try {
      results.slack = await this.slackService.testConnection();
    } catch (error) {
      console.error('Slack service test failed:', error.message);
    }

    try {
      results.googleAuth = await this.docsService.authService.ensureValidToken();
    } catch (error) {
      console.error('Google Auth test failed:', error.message);
    }

    console.log('Service test results:', results);
    return results;
  }

  // Helper methods for generating smart defaults
  getTechnicalDefault(field, projectType) {
    const technicalDefaults = {
      solar: {
        capture_technology: 'N/A - Solar Project',
        capture_technology_details: 'N/A - Solar Project',
        energy_performance: 'High-efficiency photovoltaic panels with 20+ year performance warranty',
        equipment_eligibility: 'Tier 1 solar panels, certified inverters, and mounting systems',
        monitoring_system: 'Real-time energy production monitoring with SCADA integration',
        storage_location: 'On-site battery storage system (if applicable)',
        storage_method: 'Lithium-ion battery storage with grid-tie capability',
        technology_risk: 'Low - Proven solar PV technology with established track record',
        water_efficiency: 'Minimal water usage for panel cleaning and maintenance'
      },
      carbon_capture: {
        capture_technology: 'Direct Air Capture (DAC) with chemical absorption',
        capture_technology_details: 'Advanced amine-based CO2 capture with heat recovery systems',
        energy_performance: 'Energy-optimized capture process with renewable energy integration',
        equipment_eligibility: 'Industrial-grade capture equipment with verification systems',
        monitoring_system: 'Continuous CO2 measurement and verification protocols',
        storage_location: 'Deep geological formations or permanent sequestration sites',
        storage_method: 'Underground geological storage in depleted oil/gas reservoirs',
        technology_risk: 'Medium - Emerging technology with demonstrated pilot projects',
        water_efficiency: 'Closed-loop water system with minimal freshwater consumption'
      },
      construction: {
        capture_technology: 'N/A - Construction Project',
        capture_technology_details: 'N/A - Construction Project',
        energy_performance: 'ENERGY STAR certified systems with smart building controls',
        equipment_eligibility: 'Sustainable building materials and energy-efficient systems',
        monitoring_system: 'Building management system with energy monitoring',
        storage_location: 'N/A - Construction Project',
        storage_method: 'N/A - Construction Project',
        technology_risk: 'Low - Proven sustainable construction technologies',
        water_efficiency: 'Low-flow fixtures and greywater recycling systems'
      }
    };

    return technicalDefaults[projectType]?.[field] || `[${field.replace(/_/g, ' ').toUpperCase()}]`;
  }

  getLegalDefault(field, projectType) {
    const legalDefaults = {
      collateral_description: 'Project assets, equipment, and future receivables',
      development_rights: 'Exclusive development rights within defined project area',
      exit_mechanisms: 'Sale to strategic buyer, refinancing, or project completion',
      exit_strategy: 'Project completion and asset transfer or long-term operation',
      financial_covenants: 'Maintain minimum debt service coverage ratio of 1.25x',
      permitting_risk: 'Shared risk with mitigation strategies and contingency planning',
      personal_guarantees: 'Limited personal guarantees from project sponsors'
    };

    return legalDefaults[field] || `[${field.replace(/_/g, ' ').toUpperCase()}]`;
  }

  getRiskDefault(field, projectType) {
    const riskDefaults = {
      contingency_reserve: '10% of total project cost for unforeseen circumstances',
      development_risk: 'Mitigated through experienced development team and proven processes',
      market_risk: 'Reduced through long-term contracts and diversified revenue streams'
    };

    return riskDefaults[field] || `[${field.replace(/_/g, ' ').toUpperCase()}]`;
  }

  getEnvironmentalDefault(field, projectType) {
    const environmentalDefaults = {
      solar: {
        certification_level: 'LEED Gold equivalent for solar installations',
        certification_target: 'NABCEP certified installation and commissioning',
        environmental_impact: 'Significant reduction in carbon emissions and air pollution',
        indoor_quality: 'N/A - Outdoor solar installation',
        sustainable_materials: 'Recycled aluminum framing and sustainable mounting systems',
        waste_reduction: 'Minimal construction waste with recycling protocols',
        water_features: 'Minimal water usage for cleaning and maintenance'
      },
      construction: {
        certification_level: 'LEED Gold or BREEAM Excellent rating',
        certification_target: 'LEED Gold certification',
        environmental_impact: 'Reduced energy consumption and carbon footprint',
        indoor_quality: 'Enhanced air quality with low-VOC materials',
        sustainable_materials: 'Locally sourced, recycled, and renewable materials',
        waste_reduction: 'Construction waste diversion target of 90%',
        water_features: 'Rainwater harvesting and greywater recycling systems'
      }
    };

    return environmentalDefaults[projectType]?.[field] || environmentalDefaults.construction?.[field] || `[${field.replace(/_/g, ' ').toUpperCase()}]`;
  }

  getTestDataFallback(key) {
    // Realistic test data fallbacks for when form submission is empty/null
    const testDataMap = {
      // Contact Information - POC
      'first_name_poc': '[First Name POC]',
      'last_name_poc': '[Last Name POC]', 
      'title_poc': '[Title POC]',
      'email_poc': '[Email POC]',
      'mobile_phone_poc': '[Mobile Phone POC]',
      'linkedin_poc': '[LinkedIn POC]',
      
      // Signer Information
      'first_name_sign': '[First Name Sign]',
      'last_name_sign': '[Last Name Sign]',
      'title_sign': '[Title Sign]',
      'email_sign': '[Email Sign]',
      'linkedin_sign': '[LinkedIn Sign]',
      
      // Business Information
      'business_legal_name': '[Business Legal Name]',
      'doing_business_as': '[Doing Business As]',
      'ein_number': '[EIN Number]',
      'entity_type': '[Entity Type]',
      'state_incorporation': '[State Incorporation]',
      'date_incorporation': '[Date Incorporation]',
      'fiscal_year_end': '[Fiscal Year End]',
      'website_issuer': '[Website Issuer]',
      
      // Business Address
      'address_issuer': '[Address Issuer]',
      'city_issuer': '[City Issuer]',
      'state_issuer': '[State Issuer]',
      'zip_issuer': '[ZIP Issuer]',
      'phone_issuer': '[Phone Issuer]',
      'business_description': '[Business Description]',
      
      // Project Information
      'tech_offering': '[Tech Offering]',
      'other_tech': '[Other Tech]',
      'project_name': '[Project Name]',
      
      // Project Address
      'address_project': '[Address Project]',
      'city_project': '[City Project]',
      'state_project': '[State Project]',
      'zip_project': '[ZIP Project]',
      
      // Project Details & Financial
      'name_plate_capacity': '[Nameplate Capacity]',
      'target_issuer': '[Target Amount]',
      'maximum_issuer': '[Maximum Amount]',
      'deadline_offering': '[Funding Deadline]',
      'project_description': '[Project Description]',
      'use_of_funds': '[Use of Funds]',
      
      // Financing Information
      'financing_option': '[Financing Option]',
      'financing_other': '[Other Financing Details]',
      'financing_requirements': '[Financing Requirements]',
      'interest_rate': '[Interest Rate]',
      'term_months': '[Term Months]',
      
      // Legacy fields and dates (keep some dynamic for realism)
      'contact_email': '[Contact Email]',
      'contact_name': '[Contact Name]',
      'project_type': '[Project Type]',
      'form_id': 'TEST-DEMO-' + Date.now(),
      'calendar_link': process.env.CALENDAR_LINK || 'https://calendly.com/climatize/consultation',
      
      // Date fields (keep dynamic)
      'phase_one_submission': new Date().toISOString(),
      'current_date': new Date().toLocaleDateString(),
      'current_time': new Date().toLocaleTimeString(),
      'submission_time': new Date().toISOString(),
      
      // Additional common fields
      'authorized_signatory': '[Authorized Signatory]',
      'timeline': '[Timeline]',
      'total_project_cost': '[Total Project Cost]'
    };
    
    // Return test data if available, otherwise create a reasonable placeholder
    if (testDataMap[key]) {
      return testDataMap[key];
    }
    
    // Default fallback - create brackets with full field name to avoid overlap issues
    return `[${key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}]`;
  }

  calculateMilestoneStructure(formData) {
    const projectType = String(formData.project_type || '').toLowerCase();
    
    if (projectType === 'solar') {
      return '25% at contract signing, 25% at permitting, 25% at installation start, 25% at commissioning';
    } else if (projectType === 'construction') {
      return '20% at design completion, 30% at foundation, 30% at substantial completion, 20% at final inspection';
    } else {
      return 'Milestone-based payments tied to project development phases';
    }
  }

  calculatePPADetails(formData) {
    const projectType = String(formData.project_type || '').toLowerCase();
    
    if (projectType === 'solar') {
      return '20-year Power Purchase Agreement with annual escalation of 2.5%';
    } else {
      return 'Long-term offtake agreement with creditworthy counterparty';
    }
  }

  getFinancingStructure(formData) {
    const projectType = String(formData.project_type || '').toLowerCase();
    const loanAmount = formData.loan_amount || formData.funding_amount;
    
    if (loanAmount) {
      return `Senior debt financing with ${formData.ltv_ratio || '80'}% loan-to-value ratio`;
    } else {
      return 'Equity and development capital with milestone-based funding';
    }
  }

  getReportingRequirements(formData) {
    return 'Monthly financial statements, quarterly compliance reports, annual audited financials';
  }

  calculateTotalInterest(formData) {
    if (formData.loan_amount && formData.interest_rate && formData.term_length) {
      const principal = parseFloat(formData.loan_amount) || 0;
      const rate = parseFloat(formData.interest_rate) || 0;
      const term = parseFloat(formData.term_length) || 0;
      
      const totalInterest = (principal * (rate / 100) * (term / 12)).toFixed(2);
      return `$${totalInterest}`;
    }
    return '[Total Interest - Requires loan amount, rate, and term]';
  }

  getUseOfFunds(formData) {
    const projectType = String(formData.project_type || '').toLowerCase();
    
    const useOfFunds = {
      solar: 'Equipment procurement (60%), installation costs (25%), development expenses (10%), contingency (5%)',
      construction: 'Construction costs (70%), materials (20%), permits and fees (5%), contingency (5%)',
      carbon_capture: 'Equipment and technology (65%), installation (20%), development (10%), contingency (5%)',
      bridge: 'Property acquisition, interim financing, development costs',
      working_capital: 'Inventory, accounts receivable financing, operational expenses',
      predevelopment: 'Site studies, permitting, engineering, legal and professional fees'
    };

    return useOfFunds[projectType] || 'Project development and operational expenses';
  }

  getVerificationProtocol(formData) {
    const projectType = String(formData.project_type || '').toLowerCase();
    
    if (projectType === 'carbon_capture') {
      return 'Third-party verification following Verified Carbon Standard (VCS) protocols';
    } else if (projectType === 'solar') {
      return 'Energy production verification through utility-grade metering systems';
    } else {
      return 'Independent third-party verification and monitoring protocols';
    }
  }
}

module.exports = Phase1AutomationService;