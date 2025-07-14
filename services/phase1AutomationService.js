const GoogleDocsService = require('./googleDocs');
const GoogleDriveService = require('./googleDrive');
const GoogleSheetsService = require('./googleSheets');
const { TEMPLATE_IDS, PHASE_2_TEMPLATE_IDS, PROJECT_TYPE_CONFIG } = require('../config/templateIds');
require('dotenv').config();

class Phase1AutomationService {
  constructor() {
    console.log('Initializing Phase1AutomationService...');
    this.docsService = null;
    this.driveService = null;
    this.sheetsService = null;

    // === OFFLINE TEST STUBS ===
    if (process.env.STUB_GOOGLE === 'true') {
      console.log('🧪 STUB_GOOGLE enabled – Google API calls will be skipped');

      // Monkey-patch initialization to no-op
      this.initializeServices = () => {
        console.log('🧪 [STUB] initializeServices skipped');
      };

      // Stub folder creation to return dummy IDs/links
      this.createClientFolders = async (businessName) => {
        console.log(`🧪 [STUB] createClientFolders called for "${businessName}"`);
        return {
          main: { id: 'dummyMainFolderId', webViewLink: 'https://dummy.link/main' },
          internal: { id: 'dummyInternalFolderId', webViewLink: 'https://dummy.link/internal' }
        };
      };

      // Stub document creation to avoid Google Docs API
      this.createAllDocuments = async (enrichedData, internalFolderId) => {
        console.log('🧪 [STUB] createAllDocuments called');
        console.log('📄 Enriched data contains', Object.keys(enrichedData).length, 'fields');
        const dummyDoc = { id: 'doc123', webViewLink: 'https://dummy.link/doc' };
        return {
          mnda: dummyDoc,
          poa: dummyDoc,
          projectOverview: dummyDoc,
          formId: dummyDoc,
          termSheet: dummyDoc,
          formC: dummyDoc,
          certStatement: dummyDoc,
          projectSummary: dummyDoc
        };
      };
    }
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
    if (!this.sheetsService) {
      console.log('Creating GoogleSheetsService...');
      this.sheetsService = new GoogleSheetsService();
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
      'Middle Name': 'middle_name',
      'Last Name': 'last_name_poc', 
      'Last Name (1)': 'last_name_sign',   // This is for separate signer
      'Title': 'title_poc',
      'Title (1)': 'title_sign',
      'Email': 'email_poc',
      'Email (1)': 'email_sign', 
      'Phone Number': 'mobile_phone_poc',
      'LinkedIn': 'linkedin_poc',
      'LinkedIn (1)': 'linkedin_sign',
      
      // Signing Authority
      'Check this box if you have the authority to sign legal documents on behalf of your company.': 'has_signing_authority',
      'Is this the first time you submit a project for funding with Climatize?': 'first_time_submit',
      'Have you submitted a project to Climatize before?': 'previous_submit',
      'Will you be using the same entity to borrow the funds?': 'same_entity_borrow',
      
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
      'Business Physical Address': 'business_address',
      'Business Phone': 'phone_issuer',
      'Please describe your business model': 'business_model',
      
      // Financial & Regulatory
      'Have you raised funds using Reg CF or Reg D?': 'exempt_offerings_status',
      'Please specify': 'reg_offerings_details',
      'CCC': 'CCC_num',
      'CIK': 'CIK_num',
      'Do you have reviewed or audited financial statements?': 'financial_statements_status',
      'How many employees does your company currently have?': 'num_employees',
      'Who owns the business? Please provide information for anyone who ones 20% or more.': 'owners_20_percent',
      'Please list any directors, general partners, managing members, executive officers who have decision making capacity': 'team_members',
      'Do you have any business debts?': 'debt_status',
      'Business Debt Schedule': 'debt_schedule',
      
      // Project Information
      'What technology are you raising capital for?': 'tech_offering',
      'Please specify your technology': 'other_tech',
      'Project or Portfolio Name': 'project_name',
      'Project Address': 'project_address',
      'Project Size': 'name_plate_capacity',
      'Minimum Capital Needed ($)': 'target_issuer',
      'Maximum Capital Needed ($)': 'maximum_issuer',
      'By when do you need the capital?': 'deadline_offering',
      'Project Description': 'project_description',
      'Describe the use of funds': 'use_of_funds',
      'Project Financial Projections': 'project_financial_projections',
      
      // Document Requirements
      'Reviewed / Audited Financial Statements': 'required_financial_statements',
      'Articles of Incorporation or Certificate of Formation': 'required_articles',
      'EIN Documentation': 'required_ein_docs',
      'Governing Documents': 'required_governing_docs',
      'Project Data Room': 'project_data_room',
      
      // Financing Information
      'Which of the options above is a better fit for your project?': 'financing_option',
      'If other, please specify': 'financing_other',
      'Do you have any preferred terms or requirements?': 'financing_requirements',
      'Desired Rate': 'interest_rate',
      'Desired Term': 'term_months'
    };

    // Create normalized data object
    const normalized = {};
    
    // Map all form fields to template variables, filtering out empty/null values
    for (const [formField, templateVar] of Object.entries(fieldMapping)) {
      const value = formData[formField];
      normalized[templateVar] = isEmpty(value) ? '' : value;

      // --- NEW: Try the NORMALIZED version of the form field name ---
      if (isEmpty(normalized[templateVar])) {
        const altKey = formField.toLowerCase()
          .replace(/\s*\((\d+)\)/g, '_$1') // Parenthetical numbers to suffixes
          .replace(/[^\w\s]/g, '')           // Remove punctuation
          .replace(/\s+/g, '_')               // Spaces -> underscores
          .trim();
        const altVal = formData[altKey];
        if (!isEmpty(altVal)) {
          normalized[templateVar] = altVal;
        }
      }
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

  // Check if business section is empty (indicating returning customer who skipped business section)
  isBusinessSectionEmpty(enriched) {
    const businessFields = [
      'business_legal_name', 'doing_business_as', 'ein_number', 'entity_type',
      'state_incorporation', 'date_incorporation', 'fiscal_year_end', 'website_issuer',
      'address_issuer', 'phone_issuer', 'business_model', 'CCC_num', 'CIK_num',
      'financial_statements_status', 'num_employees', 'debt_status'
    ];
    
    const isEmpty = (value) => {
      if (value === undefined || value === null) return true;
      const str = String(value).toLowerCase().trim();
      return str === '' || str === 'null' || str === 'unanswered';
    };
    
    // Check if majority of business fields are empty
    const emptyCount = businessFields.filter(field => isEmpty(enriched[field])).length;
    const isBusinessEmpty = emptyCount >= (businessFields.length * 0.8); // 80% empty = business section skipped
    
    console.log(`🔍 Business section check: ${emptyCount}/${businessFields.length} fields empty (${isBusinessEmpty ? 'EMPTY' : 'HAS DATA'})`);
    return isBusinessEmpty;
  }

  // Populate entire business section from Google Sheets data
  populateBusinessSectionFromSheets(enriched, sheetData) {
    console.log('📊 Mapping sheets columns to business template variables...');
    
    // Complete mapping from Google Sheets columns to business template variables
    const sheetsToBusinessMapping = {
      // Core Business Information
      'Business Legal Name': 'business_legal_name',
      'DBA (Doing Buisness As)': 'doing_business_as',
      'DBA (Doing Business As)': 'doing_business_as', // Handle correct spelling
      'EIN': 'ein_number',
      'Type of Entity': 'entity_type',
      'State of Incorporation': 'state_incorporation', 
      'Incorporation Date': 'date_incorporation',
      'Fiscal Year End': 'fiscal_year_end',
      'Website': 'website_issuer',
      'Business Phone': 'phone_issuer',
      'Business Model': 'business_model',
      'Please describe your business model': 'business_model',
      
      // Address fields
      'Address - Business Physical Address': 'address_issuer',
      'Business Physical Address': 'address_issuer',
      'Address Line2 - Business Physical Address': 'address_line2_issuer',
      'City - Business Physical Address': 'city_issuer',
      'State - Business Physical Address': 'state_issuer',
      'Zip - Business Physical Address': 'zip_issuer',
      
      // Regulatory Information
      'CCC': 'CCC_num',
      'CIK': 'CIK_num',
      'Do you have reviewed or audited financial statements?': 'financial_statements_status',
      'How many employees does your company currently have?': 'num_employees',
      'Do you have any business debts?': 'debt_status',
      'Have you raised funds using Reg CF or Reg D?': 'exempt_offerings_status',
      
      // Previous Offerings (if any in sheets)
      'Date Offering 1': 'date_offering_1',
      'Exemption 1': 'exemption_1', 
      'Securities Offered 1': 'securities_offered_1',
      'Amount Sold 1': 'amount_sold_1',
      'Use of Proceeds 1': 'proceeds_1',
      
      // Add more as needed based on actual sheets columns
    };
    
    let mappedCount = 0;
    
    // Map each sheets column to corresponding business field
    Object.keys(sheetData).forEach(sheetsColumn => {
      const businessField = sheetsToBusinessMapping[sheetsColumn];
      
      if (businessField && sheetData[sheetsColumn]) {
        enriched[businessField] = sheetData[sheetsColumn];
        console.log(`   📋 ${sheetsColumn} → ${businessField} = "${sheetData[sheetsColumn]}"`);
        mappedCount++;
        
        // Special handling for EIN
        if (businessField === 'ein_number') {
          enriched.ein = sheetData[sheetsColumn];
          enriched.sheets_ein_value = sheetData[sheetsColumn];
        }
        
        // Build business address from components
        if (businessField === 'address_issuer') {
          enriched.business_address = sheetData[sheetsColumn];
        }
      }
    });
    
    // Handle complex table data if present in sheets (20% owners, team members, debt schedule)
    this.populateTableDataFromSheets(enriched, sheetData);
    
    console.log(`✅ Mapped ${mappedCount} business fields from sheets data`);
  }

  // Populate table data (owners, team, debt) from sheets if structured data exists
  populateTableDataFromSheets(enriched, sheetData) {
    console.log('🔍 Checking for structured table data in sheets...');
    
    // Initialize empty table data arrays to prevent undefined issues
    enriched.owners_20_percent = enriched.owners_20_percent || [];
    enriched.team_members = enriched.team_members || [];
    enriched.debt_schedule = enriched.debt_schedule || [];
    
    // Clear any existing table variables to prevent conflicts
    for (let i = 1; i <= 5; i++) {
      // Clear 20% owners fields
      enriched[`full_name_20_${i}`] = '';
      enriched[`email20_${i}`] = '';
      enriched[`type_20_${i}`] = '';
      enriched[`ownership_20_${i}`] = '';
      
      // Clear team member fields  
      enriched[`full_name_team_${i}`] = '';
      enriched[`email_team_${i}`] = '';
      enriched[`title_team_${i}`] = '';
      
      // Clear debt fields
      enriched[`creditor_${i}`] = '';
      enriched[`amount_debt_${i}`] = '';
      enriched[`rate_debt_${i}`] = '';
      enriched[`date_debt_${i}`] = '';
    }
    
    // Parse structured table data from sheets if it exists
    let ownerCount = 0;
    let teamCount = 0;
    let debtCount = 0;
    
    Object.keys(sheetData).forEach(key => {
      // Parse 20% owners data
      const ownerMatch = key.match(/Owner (\d+) (.+)/i);
      if (ownerMatch) {
        const ownerNum = parseInt(ownerMatch[1]);
        const field = ownerMatch[2].toLowerCase();
        if (ownerNum <= 5 && sheetData[key]) {
          if (field.includes('name')) enriched[`full_name_20_${ownerNum}`] = sheetData[key];
          if (field.includes('email')) enriched[`email20_${ownerNum}`] = sheetData[key];
          if (field.includes('type')) enriched[`type_20_${ownerNum}`] = sheetData[key];
          if (field.includes('ownership')) enriched[`ownership_20_${ownerNum}`] = sheetData[key];
          ownerCount = Math.max(ownerCount, ownerNum);
        }
      }
      
      // Parse team member data
      const teamMatch = key.match(/Team (\d+) (.+)/i) || key.match(/Member (\d+) (.+)/i);
      if (teamMatch) {
        const teamNum = parseInt(teamMatch[1]);
        const field = teamMatch[2].toLowerCase();
        if (teamNum <= 5 && sheetData[key]) {
          if (field.includes('name')) enriched[`full_name_team_${teamNum}`] = sheetData[key];
          if (field.includes('email')) enriched[`email_team_${teamNum}`] = sheetData[key];
          if (field.includes('title')) enriched[`title_team_${teamNum}`] = sheetData[key];
          teamCount = Math.max(teamCount, teamNum);
        }
      }
      
      // Parse debt schedule data  
      const debtMatch = key.match(/Debt (\d+) (.+)/i) || key.match(/Creditor (\d+) (.+)/i);
      if (debtMatch) {
        const debtNum = parseInt(debtMatch[1]);
        const field = debtMatch[2].toLowerCase();
        if (debtNum <= 5 && sheetData[key]) {
          if (field.includes('creditor') || field.includes('name')) enriched[`creditor_${debtNum}`] = sheetData[key];
          if (field.includes('amount')) enriched[`amount_debt_${debtNum}`] = sheetData[key];
          if (field.includes('rate') || field.includes('interest')) enriched[`rate_debt_${debtNum}`] = sheetData[key];
          if (field.includes('date') || field.includes('completion')) enriched[`date_debt_${debtNum}`] = sheetData[key];
          debtCount = Math.max(debtCount, debtNum);
        }
      }
    });
    
    // Set debt status based on whether we found any debt data
    if (debtCount > 0) {
      enriched.debt_status = 'Yes';
    } else if (sheetData['Do you have any business debts?']) {
      enriched.debt_status = sheetData['Do you have any business debts?'];
    }
    
    console.log(`📊 Found table data: ${ownerCount} owners, ${teamCount} team members, ${debtCount} debts`);
  }

  // ENRICHMENT - Add derived data like parsed addresses
  async enrichData(normalizedData, formData) {
    console.log('=== ENRICHING DATA ===');
    console.log('🔍 DEBUG: first_name in normalizedData:', normalizedData.first_name);
    console.log('🔍 DEBUG: first_name_poc in normalizedData:', normalizedData.first_name_poc);
    console.log('🔍 DEBUG: first_name in formData:', formData.first_name);
    
    // Clone the normalized data to avoid mutation
    const enriched = { ...normalizedData };

    // === FETCH BUSINESS DATA FROM SHEET IF PRIOR SUBMISSION ===
    try {
      // Check if business section is empty (returning customer flow)
      const isBusinessSectionEmpty = this.isBusinessSectionEmpty(enriched);
      
      if (isBusinessSectionEmpty) {
        console.log('🔍 Business section is empty - detecting returning customer');
        const firstNameToCheck = enriched.first_name_poc || enriched.first_name;
        
        if (firstNameToCheck) {
          console.log(`🔎 Looking up complete business data by first name: "${firstNameToCheck}"`);
          const sheetDataByName = await this.sheetsService.getBusinessDataByFirstName(firstNameToCheck);
          
          if (sheetDataByName) {
            console.log('📑 Found returning customer data - populating entire business section...');
            this.populateBusinessSectionFromSheets(enriched, sheetDataByName);
          } else {
            console.log('❌ No previous data found for returning customer');
          }
        }
      } else {
        // Legacy logic for when business section has some data but we want to enhance it
        const firstNameToCheck = enriched.first_name_poc || enriched.first_name;
        if (firstNameToCheck) {
          console.log(`🔎 Looking up previous business data by first name: "${firstNameToCheck}"`);
          const sheetDataByName = await this.sheetsService.getBusinessDataByFirstName(firstNameToCheck);
          if (sheetDataByName) {
            console.log('📑 Found previous business data by first name, merging...');
            // Merge sheet data - prioritize sheets data for core business fields
            const priorityFields = [
              'business_legal_name', 
              'dba_(doing_buisness_as)', 
              'ein', 
              'type_of_entity',
              'state_of_incorporation',
              'incorporation_date',
              'fiscal_year_end',
              'website',
              'address_-_business_physical_address',
              'address_line2_-_business_physical_address', 
              'city_-_business_physical_address'
            ];
            Object.keys(sheetDataByName).forEach(key => {
              const normalizedKey = key.toLowerCase().replace(/\s+/g, '_');
              const shouldOverride = priorityFields.includes(normalizedKey);
              if (sheetDataByName[key] && (!enriched[normalizedKey] || shouldOverride)) {
                enriched[normalizedKey] = sheetDataByName[key];
                console.log(`   📋 Merged ${key}: ${sheetDataByName[key]}${shouldOverride ? ' (overridden)' : ''}`);
                
                // Special handling for EIN to preserve sheets value
                if (key.toLowerCase() === 'ein') {
                  enriched.sheets_ein_value = sheetDataByName[key];
                  console.log(`   🔒 Preserved sheets EIN: ${sheetDataByName[key]}`);
                }
              }
            });
          }
        }
      }

      // Then do the more specific lookup by email for returning clients
      const alreadySubmitted = (enriched.previous_submit || enriched.first_time_submit || '').toString().toLowerCase();
      const sameEntity = (enriched.same_entity_borrow || '').toString().toLowerCase();
      if ((alreadySubmitted === 'yes' || alreadySubmitted === 'no') && sameEntity === 'yes') {
        // For legacy field: if first_time_submit is 'no', treat as previous submit
        const isPreviousSubmit = (enriched.previous_submit || '').toLowerCase() === 'yes' || alreadySubmitted === 'no';
        if (isPreviousSubmit) {
          const emailToLookup = enriched.email_poc || enriched.email || '';
          if (emailToLookup) {
            console.log('🔎 Looking up previous business data for:', emailToLookup);
            const sheetData = await this.sheetsService.getBusinessDataByEmail(emailToLookup);
            if (sheetData) {
              console.log('📑 Found previous business data, merging...');
              // Map sheet columns to our variable names where current value is empty
              const sheetMapping = {
                'Business Legal Name': 'business_legal_name',
                'DBA (Doing Buisness As)': 'doing_business_as',
                'EIN': 'ein_number',
                'Type of Entity': 'entity_type',
                'State of Incorporation': 'state_incorporation',
                'Incorporation Date': 'date_incorporation',
                'Fiscal Year End': 'fiscal_year_end',
                'Website': 'website_issuer',
                'Address - Business Physical Address': 'address_issuer',
                'Business Phone': 'phone_issuer',
                'Please describe your business model': 'business_model',
                'CCC': 'CCC_num',
                'CIK': 'CIK_num',
                'Do you have reviewed or audited financial statements?': 'financial_statements_status',
                'How many employees does your company currently have?': 'num_employees'
              };
              Object.entries(sheetMapping).forEach(([sheetCol, varName]) => {
                if (!enriched[varName] || enriched[varName] === '') {
                  enriched[varName] = sheetData[sheetCol] || '';
                }
              });
            } else {
              console.log('No previous row found for email in sheet');
            }
          }
        }
      }
    } catch (sheetErr) {
      console.error('Sheet lookup error:', sheetErr.message);
    }

    // === PARSE ADDRESS OBJECTS INTO READABLE STRINGS ===
    // Handle Business Physical Address object
    if (enriched.business_address && typeof enriched.business_address === 'object') {
      const addr = enriched.business_address;
      // Convert object to readable string
      const addressLine = addr.address || '';
      const city = addr.city || '';
      const state = addr.state || '';
      const zip = addr.zipCode || '';
      enriched.business_address = `${addressLine}\n${city} ${state} ${zip}`.trim();
      console.log('📍 Converted business address object to string:', enriched.business_address);
    }

    // Handle Project Address object
    if (enriched.project_address && typeof enriched.project_address === 'object') {
      const addr = enriched.project_address;
      // Convert object to readable string
      const addressLine = addr.address || '';
      const city = addr.city || '';
      const state = addr.state || '';
      const zip = addr.zipCode || '';
      enriched.project_address = `${addressLine}\n${city} ${state} ${zip}`.trim();
      console.log('📍 Converted project address object to string:', enriched.project_address);
    }

    // === PARSE TABLE DATA FROM ARRAYS/OBJECTS ===
    // Handle owners_20_percent table data
    if (enriched.owners_20_percent && Array.isArray(enriched.owners_20_percent)) {
      console.log('📊 Processing owners table with', enriched.owners_20_percent.length, 'entries');
      enriched.owners_20_percent.forEach((owner, index) => {
        const num = index + 1;
        enriched[`full_name_20_${num}`] = owner.fullName || owner.name || '';
        enriched[`email20_${num}`] = owner.email || '';
        enriched[`type_20_${num}`] = owner.type || '';
        enriched[`ownership_20_${num}`] = owner.ownership || owner.ownershipPercentage || '';
        console.log(`   Owner ${num}: ${owner.fullName}, ${owner.email}, ${owner.ownership}`);
      });
    } else if (enriched.owners_20_percent && typeof enriched.owners_20_percent === 'string') {
      // Keep as string if it came as "[object Object],[object Object]" - don't parse
      console.log('📊 Owners data is a string, keeping as-is:', enriched.owners_20_percent);
    }

    // Handle team_members table data  
    if (enriched.team_members && Array.isArray(enriched.team_members)) {
      console.log('👥 Processing team members table with', enriched.team_members.length, 'entries');
      enriched.team_members.forEach((member, index) => {
        const num = index + 1;
        enriched[`full_name_team_${num}`] = member.fullName || member.name || '';
        enriched[`email_team_${num}`] = member.email || '';
        enriched[`title_team_${num}`] = member.title || '';
        console.log(`   Team ${num}: ${member.fullName}, ${member.email}, ${member.title}`);
      });
    } else if (enriched.team_members && typeof enriched.team_members === 'string') {
      // Keep as string if it came as "[object Object],[object Object]" - don't parse
      console.log('👥 Team members data is a string, keeping as-is:', enriched.team_members);
    }

    // Handle debt_schedule table data
    if (enriched.debt_schedule && Array.isArray(enriched.debt_schedule)) {
      console.log('💳 Processing debt schedule with', enriched.debt_schedule.length, 'entries');
      enriched.debt_schedule.forEach((debt, index) => {
        const num = index + 1;
        enriched[`creditor_${num}`] = debt.creditor || '';
        enriched[`amount_debt_${num}`] = debt.amount || '';
        enriched[`rate_debt_${num}`] = debt.interestRate || debt.rate || '';
        enriched[`date_debt_${num}`] = debt.completionDate || debt.date || '';
      });
    }

    // Handle reg_offerings_details table data
    if (enriched.reg_offerings_details && Array.isArray(enriched.reg_offerings_details)) {
      console.log('📋 Processing reg offerings with', enriched.reg_offerings_details.length, 'entries');
      enriched.reg_offerings_details.forEach((offering, index) => {
        const num = index + 1;
        enriched[`date_offering_${num}`] = offering.dateOffering || offering.date || '';
        enriched[`exemption_${num}`] = offering.exemption || '';
        enriched[`securities_offered_${num}`] = offering.securitiesOffered || '';
        enriched[`amount_sold_${num}`] = offering.amountSold || '';
        enriched[`proceeds_${num}`] = offering.useOfProceeds || offering.proceeds || '';
      });
    }

    // Parse business address string (if still a string) using existing logic
    if (enriched.business_address && typeof enriched.business_address === 'string') {
      const addressFields = this.parseAddress(enriched.business_address, 'issuer');
      Object.assign(enriched, addressFields);
    }
    
    // Copy contact info that might be missing
    enriched.contact_email = enriched.email_poc || enriched.email;
    enriched.contact_name = `${enriched.first_name_poc || enriched.first_name || ''} ${enriched.last_name_poc || enriched.last_name || ''}`.trim();
    
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

    // === CALCULATED OFFERING AMOUNTS ===
    console.log('=== CALCULATING OFFERING AMOUNTS ===');
    
    // Helper to extract numeric value from currency strings
    const extractAmount = (amountStr) => {
      if (!amountStr) return 0;
      const numStr = String(amountStr).replace(/[$,]/g, '');
      const num = parseFloat(numStr);
      return isNaN(num) ? 0 : num;
    };
    
    // Get base amounts
    const targetAmount = extractAmount(enriched.target_issuer);
    const maximumAmount = extractAmount(enriched.maximum_issuer);
    const termMonths = parseInt(enriched.term_months) || 24;
    
    // Count 20% owners from the owners array/object
    let numOwners20Percent = 0;
    if (enriched.owners_20_percent) {
      if (Array.isArray(enriched.owners_20_percent)) {
        numOwners20Percent = enriched.owners_20_percent.length;
      } else if (typeof enriched.owners_20_percent === 'string' && enriched.owners_20_percent.length > 0) {
        // If it's a string, try to count entries (rough estimate)
        numOwners20Percent = 1;
      }
    }
    
    // CALCULATE TARGET OFFERING AMOUNTS
    const targetOrigination = targetAmount * 0.05; // 5%
    const targetServicing = targetAmount * (Math.ceil(termMonths / 12) * 0.005); // ROUNDUP(term_months/12) * 0.5%
    const targetExpenses = 575 + 650 + (100 * numOwners20Percent);
    const targetOfferingAmount = targetAmount + targetOrigination + targetServicing + targetExpenses;
    
    // CALCULATE MAXIMUM OFFERING AMOUNTS  
    const maximumOrigination = maximumAmount * 0.05; // 5%
    const maximumServicing = maximumAmount * (Math.ceil(termMonths / 12) * 0.005); // ROUNDUP(term_months/12) * 0.5%
    const maximumExpenses = 575 + 650 + (100 * numOwners20Percent);
    const maximumOfferingAmount = maximumAmount + maximumOrigination + maximumServicing + maximumExpenses;
    
    // Add calculated fields to enriched data
    enriched.target_offering_origination = `$${targetOrigination.toLocaleString()}`;
    enriched.target_offering_servicing = `$${targetServicing.toLocaleString()}`;
    enriched.target_offering_expenses = `$${targetExpenses.toLocaleString()}`;
    enriched.target_offering_amount = `$${targetOfferingAmount.toLocaleString()}`;
    
    enriched.maximum_offering_origination = `$${maximumOrigination.toLocaleString()}`;
    enriched.maximum_offering_servicing = `$${maximumServicing.toLocaleString()}`;
    enriched.maximum_offering_expenses = `$${maximumExpenses.toLocaleString()}`;
    enriched.maximum_offering_amount = `$${maximumOfferingAmount.toLocaleString()}`;
    
    console.log('💰 Calculated offering amounts:');
    console.log(`   Target: $${targetAmount.toLocaleString()} → $${targetOfferingAmount.toLocaleString()}`);
    console.log(`   Maximum: $${maximumAmount.toLocaleString()} → $${maximumOfferingAmount.toLocaleString()}`);
    console.log(`   Owners (20%+): ${numOwners20Percent}, Term: ${termMonths} months`);

    // === PARSE TABLE DATA INTO NUMBERED FIELDS ===
    console.log('=== PARSING TABLE DATA ===');
    
    // Parse 20% Owners table
    if (enriched.owners_20_percent && Array.isArray(enriched.owners_20_percent)) {
      enriched.owners_20_percent.forEach((owner, index) => {
        const num = index + 1;
        enriched[`full_name_20_${num}`] = owner.fullName || owner.name || '';
        enriched[`email20_${num}`] = owner.email || '';
        enriched[`type_20_${num}`] = owner.type || '';
        enriched[`ownership_20_${num}`] = owner.ownership || owner.ownershipPercentage || '';
      });
      console.log(`📊 Parsed ${enriched.owners_20_percent.length} owners (20%+)`);
    }
    
    // Parse Team Members table
    if (enriched.team_members && Array.isArray(enriched.team_members)) {
      enriched.team_members.forEach((member, index) => {
        const num = index + 1;
        enriched[`full_name_team_${num}`] = member.fullName || member.name || '';
        enriched[`email_team_${num}`] = member.email || '';
        enriched[`title_team_${num}`] = member.title || '';
      });
      console.log(`👥 Parsed ${enriched.team_members.length} team members`);
    }
    
    // Parse Debt Schedule table
    if (enriched.debt_schedule && Array.isArray(enriched.debt_schedule)) {
      enriched.debt_schedule.forEach((debt, index) => {
        const num = index + 1;
        enriched[`creditor_${num}`] = debt.creditor || '';
        enriched[`amount_debt_${num}`] = debt.amount || '';
        enriched[`rate_debt_${num}`] = debt.interestRate || debt.rate || '';
        enriched[`date_debt_${num}`] = debt.completionDate || debt.date || '';
      });
      console.log(`💳 Parsed ${enriched.debt_schedule.length} debt items`);
    }
    
    // Parse Reg CF/D Offerings table (if provided)
    if (enriched.reg_offerings_details && Array.isArray(enriched.reg_offerings_details)) {
      enriched.reg_offerings_details.forEach((offering, index) => {
        const num = index + 1;
        enriched[`date_offering_${num}`] = offering.dateOffering || offering.date || '';
        enriched[`exemption_${num}`] = offering.exemption || '';
        enriched[`securities_offered_${num}`] = offering.securitiesOffered || '';
        enriched[`amount_sold_${num}`] = offering.amountSold || '';
        enriched[`proceeds_${num}`] = offering.useOfProceeds || offering.proceeds || '';
      });
      console.log(`📋 Parsed ${enriched.reg_offerings_details.length} previous offerings`);
      
      // Add sample data if no offerings were provided (for testing templates)
      if (enriched.reg_offerings_details.length === 0) {
        console.log('📋 No Reg CF/D offerings provided - adding empty placeholders for template testing');
        enriched.date_offering_1 = '';
        enriched.exemption_1 = '';
        enriched.securities_offered_1 = '';
        enriched.amount_sold_1 = '';
        enriched.proceeds_1 = '';
      }
    } else {
      // If no offerings array, still add empty placeholders  
      console.log('📋 No Reg CF/D offerings data - adding empty placeholders');
      enriched.date_offering_1 = '';
      enriched.exemption_1 = '';
      enriched.securities_offered_1 = '';
      enriched.amount_sold_1 = '';
      enriched.proceeds_1 = '';
    }
    
    // Add empty placeholders for debt schedule if no debt data provided
    if (!enriched.debt_schedule || !Array.isArray(enriched.debt_schedule) || enriched.debt_schedule.length === 0) {
      console.log('💳 No debt schedule provided - adding empty placeholders');
      enriched.creditor_1 = '';
      enriched.amount_debt_1 = '';
      enriched.rate_debt_1 = '';
      enriched.date_debt_1 = '';
    }
    
    // Add empty placeholders for owners if no data provided
    if (!enriched.owners_20_percent || !Array.isArray(enriched.owners_20_percent) || enriched.owners_20_percent.length === 0) {
      console.log('📊 No 20% owners provided - adding empty placeholders');
      enriched.full_name_20_1 = '';
      enriched.email20_1 = '';
      enriched.type_20_1 = '';
      enriched.ownership_20_1 = '';
    }
    
    // Add empty placeholders for team members if no data provided
    if (!enriched.team_members || !Array.isArray(enriched.team_members) || enriched.team_members.length === 0) {
      console.log('👥 No team members provided - adding empty placeholders');
      enriched.full_name_team_1 = '';
      enriched.email_team_1 = '';
      enriched.title_team_1 = '';
    }

    // === PARSE PROJECT ADDRESS OBJECT ===
    console.log('=== PARSING PROJECT ADDRESS ===');
    if (enriched.project_address && typeof enriched.project_address === 'object') {
      console.log('📍 Found project address object:', enriched.project_address);
      
      // Parse project address object into individual fields
      enriched.address_project = enriched.project_address.address || '';
      enriched.city_project = enriched.project_address.city || '';
      enriched.state_project = enriched.project_address.state || '';
      enriched.zip_project = enriched.project_address.zipCode || '';
      
      console.log('📍 Parsed project address:');
      console.log(`   Address: "${enriched.address_project}"`);
      console.log(`   City: "${enriched.city_project}"`);
      console.log(`   State: "${enriched.state_project}"`);
      console.log(`   Zip: "${enriched.zip_project}"`);
    } else if (enriched.project_address && typeof enriched.project_address === 'string') {
      // If it was converted to a string above, parse that string
      const addressFields = this.parseAddress(enriched.project_address, 'project');
      enriched.address_project = addressFields.address_project;
      enriched.city_project = addressFields.city_project;  
      enriched.state_project = addressFields.state_project;
      enriched.zip_project = addressFields.zip_project;
      
      console.log('📍 Parsed project address from string:');
      console.log(`   Address: "${enriched.address_project}"`);
      console.log(`   City: "${enriched.city_project}"`);
      console.log(`   State: "${enriched.state_project}"`);
      console.log(`   Zip: "${enriched.zip_project}"`);
    } else {
      console.log('📍 No project address object found - adding empty placeholders');
      enriched.address_project = '';
      enriched.city_project = '';
      enriched.state_project = '';
      enriched.zip_project = '';
    }

    console.log('Enriched data sample:', {
      business_legal_name: enriched.business_legal_name,
      first_name_poc: enriched.first_name_poc,
      address_issuer: enriched.address_issuer,
      city_issuer: enriched.city_issuer
    });

    // === COMPREHENSIVE VARIABLE LOGGING ===
    console.log('=== ALL VARIABLES AVAILABLE FOR REPLACEMENT ===');
    const allVars = Object.keys(enriched).sort();
    allVars.forEach((key, index) => {
      const value = enriched[key];
      const displayValue = typeof value === 'string' && value.length > 50 
        ? value.substring(0, 50) + '...' 
        : value;
      console.log(`${String(index + 1).padStart(3)}: ${key} = "${displayValue}"`);
    });
    console.log(`📊 TOTAL VARIABLES: ${allVars.length}`);

    // === CLEAN UP TEMPLATE PLACEHOLDERS ===
    console.log('=== CLEANING UP UNUSED TABLE PLACEHOLDERS ===');
    
    // Remove template placeholder variables that end with "_n" (like full_name_20_n, email_20_n)
    // These are fallback placeholders in templates that should be empty if not used
    const placeholderPatterns = [
      // Owner table placeholders
      'full_name_20_n', 'email20_n', 'type_20_n', 'ownership_20_n',
      // Team member placeholders  
      'full_name_team_n', 'email_team_n', 'title_team_n',
      // Debt schedule placeholders
      'creditor_n', 'amount_debt_n', 'rate_debt_n', 'date_debt_n',
      // Reg offerings placeholders
      'date_offering_n', 'exemption_n', 'securities_offered_n', 'amount_sold_n', 'proceeds_n',
      // Also clean up numbered placeholders that might be unused
      'creditor_2', 'amount_debt_2', 'rate_debt_2', 'date_debt_2',
      'creditor_3', 'amount_debt_3', 'rate_debt_3', 'date_debt_3',
      'full_name_20_3', 'email20_3', 'type_20_3', 'ownership_20_3',
      'full_name_team_3', 'email_team_3', 'title_team_3'
    ];
    
    // Replace all these placeholders with empty strings to clean up templates
    placeholderPatterns.forEach(placeholder => {
      enriched[placeholder] = '';
    });
    
    console.log(`🧹 Cleaned up ${placeholderPatterns.length} template placeholders`);

    // FINAL OVERRIDE: Map sheets data to standard field names for templates
    // This happens at the very end to ensure sheets data takes priority over form data
    if (enriched['dba_(doing_buisness_as)']) {
      enriched.doing_business_as = enriched['dba_(doing_buisness_as)'];
      console.log(`🔄 Final override: doing_business_as = "${enriched.doing_business_as}" (from sheets)`);
    }
    if (enriched.ein && enriched.ein !== enriched.ein_number) {
      enriched.ein_number = enriched.ein;
      console.log(`🔄 Final override: ein_number = "${enriched.ein_number}" (from sheets)`);
    }
    if (enriched.type_of_entity && enriched.type_of_entity !== enriched.entity_type) {
      enriched.entity_type = enriched.type_of_entity;
      console.log(`🔄 Final override: entity_type = "${enriched.entity_type}" (from sheets)`);
    }
    if (enriched.state_of_incorporation && enriched.state_of_incorporation !== enriched.state_incorporation) {
      enriched.state_incorporation = enriched.state_of_incorporation;
      console.log(`🔄 Final override: state_incorporation = "${enriched.state_incorporation}" (from sheets)`);
    }
    if (enriched.incorporation_date && enriched.incorporation_date !== enriched.date_incorporation) {
      enriched.date_incorporation = enriched.incorporation_date;
      console.log(`🔄 Final override: date_incorporation = "${enriched.date_incorporation}" (from sheets)`);
    }
    if (enriched.website && enriched.website !== enriched.website_issuer) {
      enriched.website_issuer = enriched.website;
      console.log(`🔄 Final override: website_issuer = "${enriched.website_issuer}" (from sheets)`);
    }
    // Add missing address overrides
    if (enriched['address_-_business_physical_address'] && enriched['address_-_business_physical_address'] !== enriched.address_issuer) {
      enriched.address_issuer = enriched['address_-_business_physical_address'];
      enriched.business_address = enriched['address_-_business_physical_address'];
      console.log(`🔄 Final override: business_address = "${enriched.business_address}" (from sheets)`);
    }
    // EIN override - use the preserved sheets EIN value if available
    if (enriched.sheets_ein_value && enriched.sheets_ein_value !== enriched.ein_number) {
      enriched.ein_number = enriched.sheets_ein_value;
      enriched.ein = enriched.sheets_ein_value;
      console.log(`🔄 Final override: ein_number = "${enriched.ein_number}" (from preserved sheets EIN)`);
    }

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
    const businessName = formData['Business Legal Name'] || formData.business_legal_name
      || formData.business_name || formData.company_name || formData.legal_business_name
      || formData.legal_name || formData.doing_business_as || formData.dba || formData.dba_doing_business_as;
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
    
    // 🧪 SPECIAL HANDLING FOR NULL TEST SUBMISSIONS
    const isNullTestSubmission = String(businessName).toLowerCase() === 'null' || 
                                String(firstName).toLowerCase() === 'null' ||
                                String(email).toLowerCase() === 'null';
    
    if (isNullTestSubmission) {
      console.log('🧪 NULL TEST SUBMISSION DETECTED - Providing test defaults');
      return 'Test Company LLC'; // Return test default for null test submissions
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
      
      // Derive a fallback business name from email domain if possible
      if (!isEmpty(email)) {
        try {
          const domainPart = String(email).split('@')[1] || 'client';
          const fallbackName = domainPart.replace(/\..*/, '').replace(/[^A-Za-z0-9]/g, ' ').trim();
          if (fallbackName) {
            console.warn(`⚠️ No business name provided – using email domain as fallback: "${fallbackName}"`);
            return fallbackName;
          }
        } catch (e) {
          // ignore parsing issues
        }
      }
      // Final fallback to generic placeholder to avoid crashing
      console.warn('⚠️ No business name detected – using generic placeholder');
      return 'Client Company';
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
      
      // Initialize Google services first so enrichment can access Sheets/Drive
      this.initializeServices();

      // STAGE 1: Normalize form data
      const normalizedData = this.normalizeFormData(formData);
      
      // STAGE 2: Enrich with derived data (may call Sheets)
      const enrichedData = await this.enrichData(normalizedData, formData);
       
      // Step 1: Create client folder structure
      const folders = await this.createClientFolders(enrichedData);
      
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

  async createClientFolders(enrichedData) {
    try {
      // Format: project_name (business_legal_name)
      const folderName = `${enrichedData.project_name} (${enrichedData.business_legal_name})`;
      console.log(`Creating folder structure for: ${folderName}`);
      return await this.driveService.createClientFolderStructure(folderName);
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
        { key: 'termSheet', templateId: this.getTermSheetTemplateId(enrichedData), name: `${businessName} - ${this.getProjectTypeName(enrichedData)} Term Sheet`, icon: '💼' },
        { key: 'formC', templateId: PHASE_2_TEMPLATE_IDS.FORM_C, name: `${businessName} - Form C`, icon: '📝' },
        { key: 'certStatement', templateId: PHASE_2_TEMPLATE_IDS.CERTIFICATION_STATEMENT, name: `${businessName} - Certification Statement`, icon: '✅' },
        { key: 'projectSummary', templateId: PHASE_2_TEMPLATE_IDS.PROJECT_SUMMARY, name: `${businessName} - Project Summary`, icon: '📄' }
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