const GoogleDocsService = require('./googleDocs');
const GoogleDriveService = require('./googleDrive');
const EmailService = require('./emailService');
const SlackService = require('./slackService');
const termSheets = require('../config/termSheets');
require('dotenv').config();

class AutomationService {
  constructor() {
    console.log('Initializing AutomationService...');
    this.docsService = null;
    this.driveService = null;
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

  async processNewLead(formData) {
    try {
      console.log('Processing new lead:', formData.business_legal_name);
      
      // Initialize services if needed
      this.initializeServices();

      // Step 1: Create client folder structure in "Leads Phase 1"
      const folders = await this.createClientFolders(formData.business_legal_name);
      
      // Step 2: Create all separate documents in Internal folder
      const documents = await this.createAllDocuments(formData, folders.internal.id);
      
      // Step 3: Set folder permissions (skip if email is placeholder)
      const clientEmail = formData.contact_email || formData.email;
      if (clientEmail && !clientEmail.startsWith('[') && clientEmail.includes('@')) {
        await this.setFolderPermissions(folders, clientEmail);
      } else {
        console.log('Skipping folder permissions - no valid email provided');
      }
      
      // Step 4: Send client welcome email (disabled for now)
      // await this.sendClientWelcomeEmail(formData);
      
      // Step 5: Send team notifications (disabled for now)
      // await this.sendTeamNotifications(formData, folders);

      const result = {
        success: true,
        client: formData.business_legal_name,
        folders: folders,
        documents: documents,
        message: 'Lead processed successfully'
      };

      console.log('Lead processing completed successfully');
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
      
      // Prepare comprehensive variable replacements
      const replacements = await this.prepareAllReplacements(formData);
      
      const documents = {};
      
      // 1. Create MNDA Document
      console.log('🔐 Creating MNDA Document...');
      documents.mnda = await this.docsService.createDocumentFromTemplate(
        '19SJ_sAOrSV6o1ZHwKOcLyTfCQ73EgVcyiYIjvKDOLDI',
        `${formData.business_legal_name || 'Company'} - MNDA`,
        internalFolderId,
        replacements
      );
      console.log('✅ MNDA Created:', documents.mnda.name);
      
      // 2. Create POA Document  
      console.log('📋 Creating POA Document...');
      documents.poa = await this.docsService.createDocumentFromTemplate(
        '1YQyzmifc6sEQ8uBMwFiEq3fA05Jbik7lNmM1jIvgKxs',
        `${formData.business_legal_name || 'Company'} - POA`,
        internalFolderId,
        replacements
      );
      console.log('✅ POA Created:', documents.poa.name);
      
      // 3. Create Project Overview Document
      console.log('📊 Creating Project Overview Document...');
      documents.projectOverview = await this.docsService.createDocumentFromTemplate(
        '1ZAXqe15o2R7y7BkXSQVB2u9o403k_i0-Qh3XU-YC-JA',
        `${formData.business_legal_name || 'Company'} - Project Overview`,
        internalFolderId,
        replacements
      );
      console.log('✅ Project Overview Created:', documents.projectOverview.name);
      
      // 4. Create Form ID Document from template
      console.log('🆔 Creating Form ID Document...');
      documents.formId = await this.docsService.createDocumentFromTemplate(
        '1dnDPLokfLlFmzrTS0obKZSHJH8NgBF0hMZ78rIxfXCw',
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


  getTermSheetTemplateId(formData) {
    const projectType = (formData.financing_option || formData.Financing_option || formData.project_type || '').toLowerCase();
    
    if (projectType.includes('working capital')) return '1MZ1W52MApg4-Vv6NHdk9atomByH7VYQ5WfSCxQyGtqw';
    if (projectType.includes('pre-dev') || projectType.includes('predevelopment')) return '1vrmDNpoD8JFFlhDID-mNpOQUeIvh-6EERCUbpnmOHG8';
    if (projectType.includes('construction plus')) return '128EYSDnvbDiiUvQNgLotuG4PzE4L3NXTwv-c94T9fbM';
    if (projectType.includes('construction')) return '1GYhaPRGAfXdGDVojKYu4VdJ_FU46IBYiPc5mwmsxUe0';
    if (projectType.includes('bridge')) return '1beRm9hyiPmpwJ_2NXeT4JvsM1J5HaVNMwd7yosIJiAM';
    if (projectType.includes('permanent debt')) return '128VpiqE4rsWsMcpQXTurg-TLEaDlpTfEBLTA3vlLMc8';
    if (projectType.includes('other')) return '1wdTYw3VIXwv4SpwfoAkIIC_b3skD8PZHbCkVYIeBCTE';
    
    return '1beRm9hyiPmpwJ_2NXeT4JvsM1J5HaVNMwd7yosIJiAM'; // default to bridge
  }

  getProjectType(formData) {
    const projectType = (formData.financing_option || formData.Financing_option || formData.project_type || '').toLowerCase();
    
    if (projectType.includes('working capital')) return 'working_capital';
    if (projectType.includes('pre-dev') || projectType.includes('predevelopment')) return 'predev';
    if (projectType.includes('construction plus')) return 'construction_plus';
    if (projectType.includes('construction')) return 'construction';
    if (projectType.includes('bridge')) return 'bridge';
    if (projectType.includes('permanent debt')) return 'permanent_debt';
    if (projectType.includes('other')) return 'other';
    
    return 'bridge'; // default
  }

  getProjectTypeName(formData) {
    const projectType = (formData.financing_option || formData.Financing_option || formData.project_type || '').toLowerCase();
    
    if (projectType.includes('working capital')) return 'Working Capital';
    if (projectType.includes('pre-dev') || projectType.includes('predevelopment')) return 'Pre-Development';
    if (projectType.includes('construction plus')) return 'Construction Plus';
    if (projectType.includes('construction')) return 'Construction';
    if (projectType.includes('bridge')) return 'Bridge';
    if (projectType.includes('permanent debt')) return 'Permanent Debt';
    if (projectType.includes('other')) return 'Other';
    
    return 'Bridge'; // default
  }


  async prepareAllReplacements(formData) {
    // Get comprehensive replacements including all possible variables
    const baseReplacements = await this.prepareDocumentReplacements(formData);
    
    // Add multiple placeholder patterns ONLY for known field names
    const allReplacements = {};
    Object.keys(baseReplacements).forEach(key => {
      const value = baseReplacements[key] || 'N/A';
      // Add all possible patterns for actual field names only
      allReplacements[key] = value;                    // bare: business_legal_name
      allReplacements[`{{${key}}}`] = value;           // curly: {{business_legal_name}}
      allReplacements[`[${key}]`] = value;             // square: [business_legal_name]
      
      // Convert underscores to spaces and title case for square brackets, but avoid common words
      const skipTitleCase = ['term', 'rate', 'technology', 'tech', 'name', 'type', 'option'];
      if (!skipTitleCase.includes(key.toLowerCase())) {
        const titleCase = key.split('_').map(word => 
          word.charAt(0).toUpperCase() + word.slice(1)
        ).join(' ');
        allReplacements[`[${titleCase}]`] = value;       // [Business Legal Name]
      }
    });
    
    // Add special mappings for template inconsistencies
    allReplacements['legal_business_name'] = formData.business_legal_name || formData.legal_business_name || 'N/A';
    allReplacements['first_name last_name'] = `${formData.first_name || ''} ${formData.last_name || ''}`.trim() || 'N/A';
    
    // Add specific missing field mappings
    allReplacements['[Fiscal Year End]'] = formData.fiscal_year_end || 'December 31';
    allReplacements['[Mobile Phone]'] = formData.mobile_phone || formData.phone_issuer || 'N/A';
    allReplacements['[Project Name]'] = formData.project_name || 'N/A';
    allReplacements['[Interest Rate]'] = formData.rate || formData.interest_rate || 'N/A';
    allReplacements['[Target Amount]'] = formData.target_offering_amount || 'N/A';
    allReplacements['[Maximum Amount]'] = formData.maximum_offering_amount || 'N/A';
    allReplacements['[Funding Deadline]'] = formData.deadline || 'N/A';
    
    return allReplacements;
  }

  async prepareDocumentReplacements(formData) {
    // Get the appropriate term sheet content
    const termSheetContent = this.getTermSheetContent(formData.project_type, formData);
    
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
    return {
      // Point of Contact (Primary)
      first_name: formData.first_name || '[First Name]',
      last_name: formData.last_name || '[Last Name]',
      email: formData.email || formData.contact_email || '[Email]',
      title: formData.title || '[Title]',
      linkedin: formData.linkedin || '[LinkedIn Profile]',
      mobile_phone: formData.mobile_phone || '[Mobile Phone]',
      
      // Point of Contact (Issuer POC - if different)
      first_name_poc: formData.first_name_poc || formData.first_name || '[First Name POC]',
      last_name_poc: formData.last_name_poc || formData.last_name || '[Last Name POC]',
      title_poc: formData.title_poc || formData.title || '[Title POC]',
      email_poc: formData.email_poc || formData.email || formData.contact_email || '[Email POC]',
      mobile_phone_poc: formData.mobile_phone_poc || formData.mobile_phone || '[Mobile Phone POC]',
      linkedin_poc: formData.linkedin_poc || formData.linkedin || '[LinkedIn Profile POC]',
      
      // Business Information
      business_legal_name: formData.business_legal_name || '[Business Legal Name]',
      dba: formData.dba || '[DBA]',
      ein: formData.ein || '[EIN]',
      entity_type: formData.entity_type || formData.Entity_type || '[Entity Type]',
      state_incorporation: formData.state_incorporation || '[State of Incorporation]',
      date_incorporation: formData.date_incorporation || '[Date of Incorporation]',
      fiscal_year_end: formData.fiscal_year_end || '[Fiscal Year End]',
      website: formData.website || '[Website]',
      address_issuer: formData.address_issuer || '[Business Address]',
      city_issuer: formData.city_issuer || '[City]',
      state_issuer: formData.state_issuer || '[State]',
      zip_issuer: formData.zip_issuer || '[ZIP Code]',
      phone_issuer: formData.phone_issuer || '[Phone Number]',
      business_description: formData.business_description || '[Business Description]',
      
      // Project Information  
      tech: formData.tech || '[Technology]',
      other_tech: formData.other_tech || '[Other Technology Details]',
      project_name: formData.project_name || '[Project Name]',
      address_project: formData.address_project || '[Project Address]',
      city_project: formData.city_project || '[Project City]',
      state_project: formData.state_project || '[Project State]',
      zip_project: formData.zip_project || '[Project ZIP]',
      name_plate_capacity: formData.name_plate_capacity || formData.Name_plate_capacity || '[Nameplate Capacity]',
      target_issuer: formData.target_issuer || formData.target_offering_amount || '[Target Amount]',
      maximum_issuer: formData.maximum_issuer || formData.maximum_offering_amount || '[Maximum Amount]',
      deadline: formData.deadline || '[Funding Deadline]',
      project_description: formData.project_description || '[Project Description]',
      use_of_funds: formData.use_of_funds || '[Use of Funds]',
      
      // Financing
      financing_option: formData.financing_option || formData.Financing_option || '[Financing Option]',
      financing_other: formData.financing_other || '[Other Financing Details]',
      financing_requirements: formData.financing_requirements || '[Financing Requirements]',
      term_months: formData.term_months || formData.term || '[Term Months]',
      interest_rate: formData.interest_rate || formData.rate || '[Interest Rate]',
      timeline: formData.timeline || '[Timeline]',
      
      // Legacy fields for compatibility
      contact_email: formData.contact_email || formData.email || '[Contact Email]',
      contact_name: formData.contact_name || `${formData.first_name || ''} ${formData.last_name || ''}`.trim() || '[Contact Name]',
      project_type: formData.project_type || formData.Financing_option || '[Project Type]',
      form_id: formData.form_id || '[Form ID]',
      calendar_link: process.env.CALENDAR_LINK || '[Calendar Link]',
      
      // Financial Data (52 form input candidates)
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
      
      // Contact information
      authorized_signatory: formData.authorized_signatory || formData.contact_name || '[Authorized Signatory]',
      title: formData.title || '[Title]',
      
      // Additional Phase 1 fields
      phase_one_submission: formData.phase_one_submission || formData.submission_time || new Date().toISOString() || '[Phase One Submission Date]'
    };
  }

  async generateAIContent(formData) {
    // For now, return smart defaults. Later we can add AI integration
    const projectType = formData.project_type?.toLowerCase() || 'general';
    
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
      
      // Fields needing analysis
      ar_eligibility: formData.ar_eligibility || '80% of qualifying receivables under 90 days',
      equity_participation: formData.equity_participation || '[Equity Participation %]',
      financing_structure: this.getFinancingStructure(formData),
      interest_rate: formData.interest_rate || '[Interest Rate]',
      inventory_eligibility: formData.inventory_eligibility || 'Finished goods inventory only',
      renewal_options: formData.renewal_options || 'Annual renewal subject to review',
      reporting_requirements: this.getReportingRequirements(formData),
      total_interest: this.calculateTotalInterest(formData),
      use_of_funds: this.getUseOfFunds(formData),
      verification_protocol: this.getVerificationProtocol(formData)
    };
  }

  getTermSheetContent(projectType, formData) {
    if (!projectType) {
      return '[Term Sheet Content - Project Type Not Specified]';
    }

    const projectTypeKey = projectType.toLowerCase().replace(/[^a-z0-9]/g, '_');
    
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
    
    // Replace placeholders in the term sheet content
    Object.keys(formData).forEach(key => {
      const placeholder = `{{${key}}}`;
      const value = formData[key] || `[${key.replace(/_/g, ' ').toUpperCase()}]`;
      content = content.replace(new RegExp(placeholder, 'g'), value);
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
      console.log('Email would be sent to:', formData.email || formData.contact_email);
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
Email: ${formData.email || formData.contact_email || 'N/A'}
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

  calculateMilestoneStructure(formData) {
    const projectType = formData.project_type?.toLowerCase();
    
    if (projectType === 'solar') {
      return '25% at contract signing, 25% at permitting, 25% at installation start, 25% at commissioning';
    } else if (projectType === 'construction') {
      return '20% at design completion, 30% at foundation, 30% at substantial completion, 20% at final inspection';
    } else {
      return 'Milestone-based payments tied to project development phases';
    }
  }

  calculatePPADetails(formData) {
    const projectType = formData.project_type?.toLowerCase();
    
    if (projectType === 'solar') {
      return '20-year Power Purchase Agreement with annual escalation of 2.5%';
    } else {
      return 'Long-term offtake agreement with creditworthy counterparty';
    }
  }

  getFinancingStructure(formData) {
    const projectType = formData.project_type?.toLowerCase();
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
    const projectType = formData.project_type?.toLowerCase();
    
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
    const projectType = formData.project_type?.toLowerCase();
    
    if (projectType === 'carbon_capture') {
      return 'Third-party verification following Verified Carbon Standard (VCS) protocols';
    } else if (projectType === 'solar') {
      return 'Energy production verification through utility-grade metering systems';
    } else {
      return 'Independent third-party verification and monitoring protocols';
    }
  }
}

module.exports = AutomationService;