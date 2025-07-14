const GoogleDocsService = require('./googleDocs');
const GoogleDriveService = require('./googleDrive');
const Phase2DriveUtils = require('./phase2DriveUtils');
const LeadTrackingService = require('./leadTrackingService');
const FileUploadService = require('./fileUploadService');
const { TEMPLATE_IDS, PHASE_2_TEMPLATE_IDS } = require('../config/templateIds');
require('dotenv').config();

class Phase2AutomationService {
  constructor() {
    console.log('Initializing Phase2AutomationService...');
    this.docsService = null;
    this.driveService = null;
    this.phase2DriveUtils = new Phase2DriveUtils();
    this.leadTrackingService = new LeadTrackingService();
    this.fileUploadService = new FileUploadService();
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

  async processPhase2Lead(leadId, phase2FormData) {
    try {
      console.log('=== PHASE 2 PROCESSING STARTED ===');
      console.log('Lead ID:', leadId);
      
      // Initialize services
      this.initializeServices();

      // Get Phase 1 data from lead tracking
      const leadData = await this.leadTrackingService.getLeadById(leadId);
      if (!leadData) {
        throw new Error(`Lead ${leadId} not found`);
      }

      console.log('Retrieved Phase 1 data for:', leadData.business_legal_name);

      // Step 1: Move folder from Phase 1 to Phase 2
      const phase2FolderId = await this.moveFolderToPhase2(leadData);
      
      // Step 2: Create internal folder structure
      const internalFolders = await this.createInternalFolderStructure(phase2FolderId);
      
      // Step 3: Move existing Phase 1 documents to Data Room
      await this.movePhase1DocumentsToDataRoom(leadData, internalFolders.dataRoom);
      
      // Step 4: Copy required Google Docs from URLs
      await this.copySourceDocuments(leadData, internalFolders);
      
      // Step 5: Upload static files (formc_guidelines.pdf)
      await this.uploadStaticFiles(internalFolders);
      
      // Step 6: Process file uploads from Phase 2 form
      const uploadedFiles = await this.processFileUploads(phase2FormData, internalFolders);
      
      // Step 7: Generate Phase 2 documents
      const generatedDocs = await this.generatePhase2Documents(leadData, phase2FormData, internalFolders);
      
      // Step 6: Update lead tracking with success
      await this.leadTrackingService.updateLeadStatus(leadId, 'PHASE_2_COMPLETE', {
        phase2_folder_id: phase2FolderId,
        phase2_submission_data_json: phase2FormData
      });

      const result = {
        success: true,
        lead_id: leadId,
        business_legal_name: leadData.business_legal_name,
        phase2_folder_id: phase2FolderId,
        internal_folders: internalFolders,
        generated_documents: generatedDocs,
        message: 'Phase 2 processing completed successfully'
      };

      console.log('=== PHASE 2 PROCESSING COMPLETED ===');
      return result;

    } catch (error) {
      console.error('Error in Phase 2 processing:', error);
      
      // Record error in lead tracking
      await this.leadTrackingService.recordError(leadId, error.message);
      
      throw error;
    }
  }

  async moveFolderToPhase2(leadData) {
    try {
      console.log('Moving folder from Phase 1 to Phase 2...');
      
      // Get Phase 2 parent folder ID from environment
      const phase2ParentFolderId = process.env.LEADS_PHASE2_FOLDER_ID;
      if (!phase2ParentFolderId) {
        throw new Error('LEADS_PHASE2_FOLDER_ID environment variable not set');
      }

      // Check if folder is already in Phase 2 (idempotency)
      try {
        const folderInfo = await this.driveService.getFileInfo(leadData.phase1_folder_id);
        if (folderInfo && folderInfo.parents && folderInfo.parents.includes(phase2ParentFolderId)) {
          console.log('Folder already in Phase 2, skipping move');
          return leadData.phase1_folder_id;
        }
      } catch (error) {
        console.log('Could not check folder location, proceeding with move');
      }

      // Move the folder
      const movedFolder = await this.phase2DriveUtils.moveFolder(
        leadData.phase1_folder_id,
        phase2ParentFolderId
      );

      console.log('Folder moved to Phase 2:', movedFolder.id);
      return movedFolder.id;
    } catch (error) {
      console.error('Error moving folder to Phase 2:', error);
      throw error;
    }
  }

  async createInternalFolderStructure(parentFolderId) {
    try {
      console.log('Creating internal folder structure...');

      // Find or create the Internal folder
      const internalFolder = await this.phase2DriveUtils.findOrCreateFolder('Internal', parentFolderId);

      // Create the 5 required subfolders (idempotent)
      const subfolders = [
        'Data Room',
        'Escrow Account', 
        'Financial Statements',
        'Form C',
        'Content'
      ];

      const createdFolders = {};
      
      for (const folderName of subfolders) {
        console.log(`Finding or creating subfolder: ${folderName}`);
        const folder = await this.phase2DriveUtils.findOrCreateFolder(folderName, internalFolder.id);
        const folderKey = folderName.toLowerCase().replace(/\s+/g, '');
        createdFolders[folderKey] = folder;
      }

      console.log('Internal folder structure created successfully');
      return {
        internal: internalFolder,
        dataRoom: createdFolders.dataroom,
        escrowAccount: createdFolders.escrowaccount,
        financialStatements: createdFolders.financialstatements,
        formC: createdFolders.formc,
        content: createdFolders.content
      };
    } catch (error) {
      console.error('Error creating internal folder structure:', error);
      throw error;
    }
  }

  async movePhase1DocumentsToDataRoom(leadData, dataRoomFolder) {
    try {
      console.log('Moving Phase 1 documents to Data Room...');
      
      // Get the Phase 1 "Signed Docs" folder (formerly "Internal")
      const internalFolder = await this.phase2DriveUtils.findFolderByName('5. Signed Docs', leadData.phase1_folder_id);
      if (!internalFolder) {
        console.log('No "5. Signed Docs" folder found in Phase 1, skipping document move');
        return;
      }

      // Get all files from the Phase 1 Internal folder
      const files = await this.phase2DriveUtils.listFilesInFolder(internalFolder.id);
      
      for (const file of files) {
        console.log(`Moving document to Data Room: ${file.name}`);
        await this.driveService.moveFile(file.id, dataRoomFolder.id);
      }

      console.log('Phase 1 documents moved to Data Room successfully');
    } catch (error) {
      console.error('Error moving Phase 1 documents:', error);
      throw error;
    }
  }

  async processFileUploads(phase2FormData, internalFolders) {
    try {
      console.log('Processing file uploads from Phase 2 form...');
      
      // Use the file upload service to process all uploaded files
      const uploadedFiles = await this.fileUploadService.processFormFiles(
        phase2FormData,
        internalFolders
      );

      console.log('File uploads processed successfully');
      console.log('Uploaded files summary:', Object.keys(uploadedFiles));
      
      return uploadedFiles;
    } catch (error) {
      console.error('Error processing file uploads:', error);
      throw error;
    }
  }

  async generatePhase2Documents(leadData, phase2FormData, internalFolders) {
    try {
      console.log('Generating Phase 2 documents with enhanced data processing...');
      
      // STEP 1: Get the already-processed Phase 1 data
      const phase1Data = leadData.phase1_submission_data || {};
      console.log('Phase 1 data available:', Object.keys(phase1Data).length > 0);

      // STEP 2: Normalize the new raw data from the Phase 2 form
      const normalizedPhase2Data = this._normalizeFormData(phase2FormData);
      console.log('Phase 2 normalized data keys:', Object.keys(normalizedPhase2Data));

      // STEP 3: Merge data - Phase 2 values overwrite Phase 1 for updated info
      const combinedNormalizedData = {
        ...phase1Data,
        ...normalizedPhase2Data
      };

      // STEP 4: Enrich the fully combined dataset
      // Pass both normalized and raw data for address parsing and other enrichment
      const combinedRawData = { ...phase1Data, ...phase2FormData };
      let enrichedData = this._enrichData(combinedNormalizedData, combinedRawData);

      // STEP 5: Add Phase 2 specific system fields
      enrichedData.submission_date = new Date().toLocaleDateString();
      enrichedData.filing_date = new Date().toLocaleDateString();
      enrichedData.phase_two_submission = new Date().toISOString();

      console.log('Final enriched data sample:', {
        business_legal_name: enrichedData.business_legal_name,
        first_name: enrichedData.first_name,
        email: enrichedData.email,
        target_issuer: enrichedData.target_issuer,
        current_date: enrichedData.current_date
      });

      const documents = {};
      const businessName = enrichedData.business_legal_name || 'Company';

      // Generate documents with the properly enriched data
      try {
        // Generate Form C
        if (PHASE_2_TEMPLATE_IDS?.FORM_C) {
          console.log('Generating Form C with enriched data...');
          documents.formC = await this.docsService.createDocumentFromTemplate(
            PHASE_2_TEMPLATE_IDS.FORM_C,
            `${businessName} - Form C`,
            internalFolders.formC.id,
            enrichedData
          );
        }

        // Generate Project Summary
        if (PHASE_2_TEMPLATE_IDS?.PROJECT_SUMMARY) {
          console.log('Generating Project Summary with enriched data...');
          documents.projectSummary = await this.docsService.createDocumentFromTemplate(
            PHASE_2_TEMPLATE_IDS.PROJECT_SUMMARY,
            `${businessName} - Project Summary`,
            internalFolders.formC.id,
            enrichedData
          );
        }

        // Generate Filing Form C
        if (PHASE_2_TEMPLATE_IDS?.FILING_FORM_C) {
          console.log('Generating Filing Form C with enriched data...');
          documents.filingFormC = await this.docsService.createDocumentFromTemplate(
            PHASE_2_TEMPLATE_IDS.FILING_FORM_C,
            `${businessName} - Filing Form C`,
            internalFolders.formC.id,
            enrichedData
          );
        }

        // Generate Certification Statement
        if (PHASE_2_TEMPLATE_IDS?.CERTIFICATION_STATEMENT) {
          console.log('Generating Certification Statement with enriched data...');
          documents.certificationStatement = await this.docsService.createDocumentFromTemplate(
            PHASE_2_TEMPLATE_IDS.CERTIFICATION_STATEMENT,
            `${businessName} - Certification Statement`,
            internalFolders.formC.id,
            enrichedData
          );
        }

        // Generate Project Card
        if (PHASE_2_TEMPLATE_IDS?.PROJECT_CARD) {
          console.log('Generating Project Card with enriched data...');
          documents.projectCard = await this.docsService.createDocumentFromTemplate(
            PHASE_2_TEMPLATE_IDS.PROJECT_CARD,
            `${businessName} - Project Card`,
            internalFolders.content.id,
            enrichedData
          );
        }

        console.log('Phase 2 documents generated successfully with proper variable replacement');
        return documents;

      } catch (docError) {
        console.error('Error generating specific document:', docError);
        console.log('Available enriched data keys for debugging:', Object.keys(enrichedData));
        throw docError;
      }

    } catch (error) {
      console.error('Error in Phase 2 document generation pipeline:', error);
      throw error;
    }
  }

  async copySourceDocuments(leadData, internalFolders) {
    try {
      console.log('Copying source documents from URLs...');
      
      const docsToCopy = [
        { 
          url: 'https://docs.google.com/document/d/1OS7q3Zzo8wc6wWXpK-jNsklkiArgs0xndqGClBDSN1Y/edit?usp=drive_link', 
          name: `${leadData.business_legal_name} - Project Summary`, 
          dest: internalFolders.formC.id 
        },
        { 
          url: 'https://docs.google.com/document/d/1wA5llbn1FDU0XfYopcDbK8olc1a5qDUTBJ3svSuRTI8/edit?usp=drive_link', 
          name: `${leadData.business_legal_name} - Form C`, 
          dest: internalFolders.formC.id 
        },
        { 
          url: 'https://docs.google.com/document/d/1_D185sbOY-CTfULWTWk8g6s4pyvAjomOFGB8t9RfuUo/edit?usp=drive_link', 
          name: `${leadData.business_legal_name} - Certification Statement`, 
          dest: internalFolders.formC.id 
        }
      ];

      for (const doc of docsToCopy) {
        try {
          // Check if document already exists (idempotency)
          const existingFiles = await this.phase2DriveUtils.listFilesInFolder(doc.dest);
          const fileExists = existingFiles.some(file => file.name === doc.name);
          
          if (fileExists) {
            console.log(`Document "${doc.name}" already exists. Skipping copy.`);
            continue;
          }

          console.log(`Copying document: ${doc.name}`);
          await this.phase2DriveUtils.copyGoogleDocFromUrl(doc.url, doc.dest, doc.name);
        } catch (error) {
          console.error(`Error copying document ${doc.name}:`, error);
          // Continue with other documents instead of failing completely
        }
      }

      console.log('Source documents copying completed');
    } catch (error) {
      console.error('Error copying source documents:', error);
      throw error;
    }
  }

  async uploadStaticFiles(internalFolders) {
    try {
      console.log('Uploading static files...');
      
      const guidelinesPath = './formc_guidelines.pdf';
      const guidelinesName = 'formc_guidelines.pdf';

      // Check if file already exists (idempotency)
      const existingFiles = await this.phase2DriveUtils.listFilesInFolder(internalFolders.formC.id);
      const fileExists = existingFiles.some(file => file.name === guidelinesName);
      
      if (fileExists) {
        console.log(`File "${guidelinesName}" already exists. Skipping upload.`);
        return;
      }

      console.log(`Uploading file: ${guidelinesName}`);
      await this.phase2DriveUtils.uploadLocalFile(guidelinesPath, internalFolders.formC.id, guidelinesName);
      
      console.log('Static files upload completed');
    } catch (error) {
      console.error('Error uploading static files:', error);
      throw error;
    }
  }

  // DATA PROCESSING METHODS (copied from Phase1AutomationService)
  _normalizeFormData(formData) {
    console.log('=== NORMALIZING PHASE 2 FORM DATA ===');
    
    // Helper to check if value is effectively empty (including "null" strings)
    const isEmpty = (value) => {
      if (value === undefined || value === null) return true;
      const str = String(value).toLowerCase().trim();
      return str === '' || str === 'null' || str === 'unanswered';
    };
    
    // Field mapping from form field names to template variables
    // Includes Phase 1 fields + Phase 2 specific fields
    const fieldMapping = {
      // POC Contact Information - BOTH formats
      'First Name': 'first_name_poc',
      'First Name (1)': 'first_name_poc',  
      'Last Name': 'last_name_poc', 
      'Last Name (1)': 'last_name_sign',   
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
      'DBA (Doing Buisness As)': 'doing_business_as', 
      'DBA (Doing Business As)': 'doing_business_as', 
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

      // PHASE 2 SPECIFIC FIELDS
      'Company Description': 'company_description',
      'Funding Amount': 'funding_amount',
      'Use of Funds': 'use_of_funds_phase2',
      'Team Size': 'team_size',
      'Project Timeline': 'project_timeline',
      'Regulatory Approvals': 'regulatory_approvals',
      'Articles of Incorporation': 'articles_of_incorporation_url',
      'EIN Documentation': 'ein_documentation_url',
      'Cap Table': 'cap_table_url',
      'Governing Documents': 'governing_documents_url',
      'Financial Statements': 'financial_statements_url',
      'Primary Bank': 'escrow_bank_name',
      'Bank Account Number': 'bank_account_number',
      'Routing Number': 'routing_number'
    };

    // Create normalized data object
    const normalized = {};
    
    // Map all form fields to template variables, filtering out empty/null values
    for (const [formField, templateVar] of Object.entries(fieldMapping)) {
      const value = formData[formField];
      normalized[templateVar] = isEmpty(value) ? '' : value;
    }

    // Carry over already-normalized keys
    const templateVars = new Set(Object.values(fieldMapping));
    for (const [key, val] of Object.entries(formData)) {
      if (templateVars.has(key)) {
        if (!isEmpty(val)) {
          normalized[key] = val;
        }
      }
    }

    console.log('Normalized Phase 2 data keys:', Object.keys(normalized));
    return normalized;
  }

  _parseAddress(addressString, prefix) {
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

  _enrichData(normalizedData, formData) {
    console.log('=== ENRICHING PHASE 2 DATA ===');
    
    const enriched = { ...normalizedData };

    // Parse business address
    if (formData['Business Address']) {
      const businessAddr = this._parseAddress(formData['Business Address'], 'issuer');
      Object.assign(enriched, businessAddr);

      // Build a single-line address string
      const parts = [];
      if (businessAddr[`address_issuer`]) parts.push(businessAddr[`address_issuer`]);
      if (businessAddr[`city_issuer`]) parts.push(businessAddr[`city_issuer`]);
      const stateZip = [businessAddr[`state_issuer`], businessAddr[`zip_issuer`]].filter(Boolean).join(' ');
      if (stateZip) parts.push(stateZip);
      enriched.address_issuer = parts.join(', ');
    }

    // Parse project address  
    if (formData['Address']) {
      const projectAddr = this._parseAddress(formData['Address'], 'project');
      Object.assign(enriched, projectAddr);
    }

    // Map specific _poc/_sign fields to generic template variables
    enriched.first_name = enriched.first_name_sign || enriched.first_name_poc || '';
    enriched.last_name = enriched.last_name_sign || enriched.last_name_poc || '';
    enriched.title = enriched.title_sign || enriched.title_poc || '';
    enriched.email = enriched.email_sign || enriched.email_poc || '';
    enriched.mobile_phone = enriched.mobile_phone_poc || '';
    enriched.linkedin = enriched.linkedin_sign || enriched.linkedin_poc || '';
    
    // Map EIN field for templates
    enriched.ein = enriched.ein_number || '';

    // Add system fields (Phase 2 specific - NOT phase_one_submission)
    enriched.current_date = new Date().toLocaleDateString();
    enriched.current_time = new Date().toLocaleTimeString();
    
    // Add fallbacks for missing critical fields
    if (!enriched.first_name) enriched.first_name = 'Contact';
    if (!enriched.last_name) enriched.last_name = 'Person';
    if (!enriched.email) enriched.email = 'contact@company.com';
    if (!enriched.project_name) enriched.project_name = `${enriched.business_legal_name} Project`;
    if (!enriched.financing_option) enriched.financing_option = 'Bridge';
    if (!enriched.target_issuer) enriched.target_issuer = '$1,000,000';
    if (!enriched.maximum_issuer) enriched.maximum_issuer = '$1,500,000';

    console.log('Enriched Phase 2 data sample:', {
      business_legal_name: enriched.business_legal_name,
      first_name_poc: enriched.first_name_poc,
      address_issuer: enriched.address_issuer,
      city_issuer: enriched.city_issuer
    });

    return enriched;
  }
}

module.exports = Phase2AutomationService;