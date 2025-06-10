const GoogleDriveService = require('./services/googleDrive');
const GoogleDocsService = require('./services/googleDocs');
require('dotenv').config();

class PlaceholderInstructions {
  constructor() {
    this.driveService = new GoogleDriveService();
    this.docsService = new GoogleDocsService();
  }

  generateInstructions() {
    const documents = [
      {
        name: "Construction Plus Term Loan",
        id: "128EYSDnvbDiiUvQNgLotuG4PzE4L3NXTwv-c94T9fbM",
        type: "Construction",
        placeholders: [
          { location: "Header", instructions: "Replace recipient name with {{first_name}} {{last_name}}" },
          { location: "Header", instructions: "Replace business name with {{business_legal_name}}" },
          { location: "Header", instructions: "Replace email with {{email}}" },
          { location: "Header", instructions: "Replace phone with {{mobile_phone}}" },
          { location: "Salutation", instructions: "Replace greeting with 'Dear {{first_name}}:'" },
          { location: "Project Description", instructions: "Replace project name with {{project_name}}" },
          { location: "Project Description", instructions: "Replace project address with {{address_project}}, {{city_project}}, {{state_project}} {{zip_project}}" },
          { location: "Project Description", instructions: "Replace system capacity with {{Name_plate_capacity}} kW dc" },
          { location: "Financing Terms", instructions: "Replace target amount with ${{target_offering_amount}}" },
          { location: "Financing Terms", instructions: "Replace maximum amount with ${{maximum_offering_amount}}" },
          { location: "Financing Terms", instructions: "Replace interest rate with {{rate}}%" },
          { location: "Financing Terms", instructions: "Replace loan term with {{term}}" },
          { location: "Use of Funds", instructions: "Replace use description with {{use_of_funds}}" },
          { location: "Technology", instructions: "Replace technology type with {{tech}}" },
          { location: "Timeline", instructions: "Replace deadline with {{deadline}}" },
          { location: "Business Info", instructions: "Replace EIN with {{ein}}" },
          { location: "Business Info", instructions: "Replace entity type with {{Entity_type}}" },
          { location: "Business Info", instructions: "Replace incorporation state with {{state_incorporation}}" },
          { location: "Business Info", instructions: "Replace incorporation date with {{date_incorporation}}" }
        ]
      },
      {
        name: "Construction",
        id: "1GYhaPRGAfXdGDVojKYu4VdJ_FU46IBYiPc5mwmsxUe0",
        type: "Construction",
        placeholders: [
          { location: "Header", instructions: "Replace recipient name with {{first_name}} {{last_name}}" },
          { location: "Header", instructions: "Replace business name with {{business_legal_name}}" },
          { location: "Header", instructions: "Replace email with {{email}}" },
          { location: "Header", instructions: "Replace phone with {{mobile_phone}}" },
          { location: "Salutation", instructions: "Replace greeting with 'Dear {{first_name}}:'" },
          { location: "Project Description", instructions: "Replace project name with {{project_name}}" },
          { location: "Project Description", instructions: "Replace project address with {{address_project}}, {{city_project}}, {{state_project}} {{zip_project}}" },
          { location: "Project Description", instructions: "Replace system capacity with {{Name_plate_capacity}} kW dc" },
          { location: "Financing Terms", instructions: "Replace target amount with ${{target_offering_amount}}" },
          { location: "Financing Terms", instructions: "Replace maximum amount with ${{maximum_offering_amount}}" },
          { location: "Financing Terms", instructions: "Replace interest rate with {{rate}}%" },
          { location: "Financing Terms", instructions: "Replace loan term with {{term}}" },
          { location: "Use of Funds", instructions: "Replace use description with {{use_of_funds}}" },
          { location: "Technology", instructions: "Replace technology type with {{tech}}" },
          { location: "Timeline", instructions: "Replace deadline with {{deadline}}" }
        ]
      },
      {
        name: "Bridge",
        id: "1beRm9hyiPmpwJ_2NXeT4JvsM1J5HaVNMwd7yosIJiAM",
        type: "Bridge",
        placeholders: [
          { location: "Header", instructions: "Replace recipient name with {{first_name}} {{last_name}}" },
          { location: "Header", instructions: "Replace business name with {{business_legal_name}}" },
          { location: "Header", instructions: "Replace email with {{email}}" },
          { location: "Header", instructions: "Replace phone with {{mobile_phone}}" },
          { location: "Salutation", instructions: "Replace greeting with 'Dear {{first_name}}:'" },
          { location: "Project Description", instructions: "Replace project name with {{project_name}}" },
          { location: "Project Description", instructions: "Replace project address with {{address_project}}, {{city_project}}, {{state_project}} {{zip_project}}" },
          { location: "Project Description", instructions: "Replace system capacity with {{Name_plate_capacity}} kW dc" },
          { location: "Financing Terms", instructions: "Replace target amount with ${{target_offering_amount}}" },
          { location: "Financing Terms", instructions: "Replace maximum amount with ${{maximum_offering_amount}}" },
          { location: "Financing Terms", instructions: "Replace interest rate with {{rate}}%" },
          { location: "Financing Terms", instructions: "Replace loan term with {{term}}" },
          { location: "Technology", instructions: "Replace technology type with {{tech}}" },
          { location: "Timeline", instructions: "Replace deadline with {{deadline}}" }
        ]
      },
      {
        name: "Pre-Dev",
        id: "1vrmDNpoD8JFFlhDID-mNpOQUeIvh-6EERCUbpnmOHG8",
        type: "PreDev",
        placeholders: [
          { location: "Header", instructions: "Replace recipient name with {{first_name}} {{last_name}}" },
          { location: "Header", instructions: "Replace business name with {{business_legal_name}}" },
          { location: "Header", instructions: "Replace email with {{email}}" },
          { location: "Header", instructions: "Replace phone with {{mobile_phone}}" },
          { location: "Salutation", instructions: "Replace greeting with 'Dear {{first_name}}:'" },
          { location: "Project Description", instructions: "Replace project name with {{project_name}}" },
          { location: "Project Description", instructions: "Replace project address with {{address_project}}, {{city_project}}, {{state_project}} {{zip_project}}" },
          { location: "Project Description", instructions: "Replace system capacity with {{Name_plate_capacity}} kW dc" },
          { location: "Financing Terms", instructions: "Replace target amount with ${{target_offering_amount}}" },
          { location: "Financing Terms", instructions: "Replace maximum amount with ${{maximum_offering_amount}}" },
          { location: "Financing Terms", instructions: "Replace interest rate with {{rate}}%" },
          { location: "Financing Terms", instructions: "Replace loan term with {{term}}" },
          { location: "Technology", instructions: "Replace technology type with {{tech}}" },
          { location: "Timeline", instructions: "Replace deadline with {{deadline}}" },
          { location: "Project Listing Table", instructions: "Replace project names with {{project_name}}" },
          { location: "Project Listing Table", instructions: "Replace location/county with {{city_project}}, {{state_project}}" }
        ]
      },
      {
        name: "Working Capital",
        id: "1MZ1W52MApg4-Vv6NHdk9atomByH7VYQ5WfSCxQyGtqw",
        type: "Working Capital",
        placeholders: [
          { location: "Header", instructions: "Replace recipient name with {{first_name}} {{last_name}}" },
          { location: "Header", instructions: "Replace business name with {{business_legal_name}}" },
          { location: "Header", instructions: "Replace email with {{email}}" },
          { location: "Header", instructions: "Replace phone with {{mobile_phone}}" },
          { location: "Salutation", instructions: "Replace greeting with 'Dear {{first_name}}:'" },
          { location: "Project Description", instructions: "Replace project name with {{project_name}}" },
          { location: "Project Description", instructions: "Replace project description with {{project_description}}" },
          { location: "Financing Terms", instructions: "Replace target amount with ${{target_offering_amount}}" },
          { location: "Financing Terms", instructions: "Replace maximum amount with ${{maximum_offering_amount}}" },
          { location: "Financing Terms", instructions: "Replace interest rate with {{rate}}%" },
          { location: "Financing Terms", instructions: "Replace loan term with {{term}}" },
          { location: "Business Operations", instructions: "Replace business description with {{business_description}}" },
          { location: "Technology", instructions: "Replace technology type with {{tech}}" },
          { location: "Timeline", instructions: "Replace deadline with {{deadline}}" }
        ]
      },
      {
        name: "POA",
        id: "1YQyzmifc6sEQ8uBMwFiEq3fA05Jbik7lNmM1jIvgKxs",
        type: "POA",
        placeholders: [
          { location: "Principal Section", instructions: "Replace principal company name with {{business_legal_name}}" },
          { location: "Principal Section", instructions: "Replace entity type with {{Entity_type}}" },
          { location: "Principal Section", instructions: "Replace state of incorporation with {{state_incorporation}}" },
          { location: "Principal Address", instructions: "Replace address with {{address_issuer}}, {{city_issuer}}, {{state_issuer}} {{zip_issuer}}" },
          { location: "Attorney-in-Fact", instructions: "Replace name with {{first_name}} {{last_name}}" },
          { location: "Attorney-in-Fact", instructions: "Replace title with {{title}}" },
          { location: "Attorney-in-Fact", instructions: "Replace email with {{email}}" },
          { location: "Attorney-in-Fact", instructions: "Replace phone with {{mobile_phone}}" },
          { location: "Effective Date", instructions: "Replace date with {{date_incorporation}}" },
          { location: "Signature Block", instructions: "Replace signatory name with {{first_name}} {{last_name}}" },
          { location: "Signature Block", instructions: "Replace signatory title with {{title}}" },
          { location: "Company Name", instructions: "Replace company name with {{business_legal_name}}" }
        ]
      },
      {
        name: "MNDA",
        id: "19SJ_sAOrSV6o1ZHwKOcLyTfCQ73EgVcyiYIjvKDOLDI",
        type: "MNDA",
        placeholders: [
          { location: "Party 1 (Disclosing Party)", instructions: "Replace company name with {{business_legal_name}}" },
          { location: "Party 1 Address", instructions: "Replace address with {{address_issuer}}, {{city_issuer}}, {{state_issuer}} {{zip_issuer}}" },
          { location: "Contact Information", instructions: "Replace contact name with {{first_name}} {{last_name}}" },
          { location: "Contact Information", instructions: "Replace email with {{email}}" },
          { location: "Contact Information", instructions: "Replace phone with {{mobile_phone}}" },
          { location: "Contact Information", instructions: "Replace title with {{title}}" },
          { location: "Website", instructions: "Replace website with {{website}}" },
          { location: "LinkedIn", instructions: "Replace LinkedIn profile with {{linkedin}}" },
          { location: "Signature Block", instructions: "Replace signatory name with {{first_name}} {{last_name}}" },
          { location: "Signature Block", instructions: "Replace signatory title with {{title}}" },
          { location: "Company Name in Signature", instructions: "Replace company name with {{business_legal_name}}" },
          { location: "Entity Information", instructions: "Replace entity type with {{Entity_type}}" },
          { location: "Entity Information", instructions: "Replace EIN with {{ein}}" }
        ]
      }
    ];

    return documents;
  }

  generateReport() {
    const instructions = this.generateInstructions();
    
    console.log('\n=== PLACEHOLDER IMPLEMENTATION INSTRUCTIONS ===\n');
    console.log('FOLDER: https://drive.google.com/drive/u/1/folders/1E4imDQa0OFWMBME-DIPaZhGJbtgYz4sm\n');
    
    instructions.forEach((doc, index) => {
      console.log(`${index + 1}. ${doc.name.toUpperCase()}`);
      console.log(`   Document ID: ${doc.id}`);
      console.log(`   Type: ${doc.type}`);
      console.log(`   Link: https://docs.google.com/document/d/${doc.id}/edit\n`);
      
      console.log('   PLACEHOLDERS TO ADD:');
      doc.placeholders.forEach((placeholder, i) => {
        console.log(`   ${String.fromCharCode(97 + i)}. ${placeholder.location}: ${placeholder.instructions}`);
      });
      console.log('\n' + '='.repeat(80) + '\n');
    });

    console.log('COMPLETE VARIABLE LIST FOR REFERENCE:');
    console.log('\nPoint of Contact:');
    console.log('- {{first_name}} - Contact first name');
    console.log('- {{last_name}} - Contact last name');
    console.log('- {{email}} - Contact email address');
    console.log('- {{title}} - Contact job title');
    console.log('- {{linkedin}} - LinkedIn profile URL');
    console.log('- {{mobile_phone}} - Contact phone number');

    console.log('\nBusiness Information:');
    console.log('- {{business_legal_name}} - Legal business name');
    console.log('- {{ein}} - Employer Identification Number');
    console.log('- {{Entity_type}} - Business entity type (LLC, Corp, etc.)');
    console.log('- {{state_incorporation}} - State of incorporation');
    console.log('- {{date_incorporation}} - Date of incorporation');
    console.log('- {{fiscal_year_end}} - Fiscal year end date');
    console.log('- {{website}} - Company website URL');
    console.log('- {{address_issuer}} - Business street address');
    console.log('- {{city_issuer}} - Business city');
    console.log('- {{state_issuer}} - Business state');
    console.log('- {{zip_issuer}} - Business ZIP code');
    console.log('- {{phone_issuer}} - Business phone number');
    console.log('- {{business_description}} - Description of business');

    console.log('\nProject Information:');
    console.log('- {{tech}} - Technology type');
    console.log('- {{other_tech}} - Other technology details');
    console.log('- {{project_name}} - Name of the project');
    console.log('- {{address_project}} - Project street address');
    console.log('- {{city_project}} - Project city');
    console.log('- {{state_project}} - Project state');
    console.log('- {{zip_project}} - Project ZIP code');
    console.log('- {{Name_plate_capacity}} - System capacity in kW dc');
    console.log('- {{target_offering_amount}} - Target funding amount');
    console.log('- {{maximum_offering_amount}} - Maximum funding amount');
    console.log('- {{deadline}} - Funding deadline date');
    console.log('- {{project_description}} - Description of the project');

    console.log('\nFinancing:');
    console.log('- {{Financing_option}} - Type of financing');
    console.log('- {{financing_other}} - Other financing details');
    console.log('- {{financing_requirements}} - Financing requirements');
    console.log('- {{term}} - Loan term period');
    console.log('- {{rate}} - Interest rate');
    console.log('- {{timeline}} - Financing timeline');
    console.log('- {{use_of_funds}} - How funds will be used');

    console.log('\n=== IMPLEMENTATION NOTES ===');
    console.log('1. Some documents already contain placeholder variables');
    console.log('2. Look for existing patterns like "first_name", "business_legal_name", etc.');
    console.log('3. Replace hardcoded values with the {{variable_name}} format');
    console.log('4. Ensure consistent formatting across all documents');
    console.log('5. Test with sample data after implementation');
  }
}

// Main execution
const instructionsGenerator = new PlaceholderInstructions();
instructionsGenerator.generateReport();