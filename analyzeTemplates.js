const GoogleDriveService = require('./services/googleDrive');
const GoogleDocsService = require('./services/googleDocs');
require('dotenv').config();

class TemplateAnalyzer {
  constructor() {
    this.driveService = new GoogleDriveService();
    this.docsService = new GoogleDocsService();
    this.variables = {
      pointOfContact: ['first_name', 'last_name', 'email', 'title', 'linkedin', 'mobile_phone'],
      businessInfo: ['business_legal_name', 'ein', 'Entity_type', 'state_incorporation', 'date_incorporation', 'fiscal_year_end', 'website', 'address_issuer', 'city_issuer', 'state_issuer', 'zip_issuer', 'phone_issuer', 'business_description'],
      projectInfo: ['tech', 'other_tech', 'project_name', 'address_project', 'city_project', 'state_project', 'zip_project', 'Name_plate_capacity', 'target_offering_amount', 'maximum_offering_amount', 'deadline', 'project_description'],
      financing: ['Financing_option', 'financing_other', 'financing_requirements', 'term', 'rate', 'timeline', 'use_of_funds']
    };
  }

  extractFolderIdFromUrl(url) {
    // Extract folder ID from Google Drive URL
    const match = url.match(/folders\/([a-zA-Z0-9-_]+)/);
    return match ? match[1] : null;
  }

  async analyzeFolderContents(folderUrl) {
    try {
      const folderId = this.extractFolderIdFromUrl(folderUrl);
      if (!folderId) {
        throw new Error('Could not extract folder ID from URL');
      }

      console.log(`Analyzing folder: ${folderId}`);
      
      // List all files in the folder
      const files = await this.driveService.listFiles(folderId);
      console.log(`Found ${files.length} files in the folder`);

      const analysis = {
        folderId,
        folderUrl,
        documents: []
      };

      for (const file of files) {
        console.log(`\nAnalyzing: ${file.name} (${file.id})`);
        
        const docAnalysis = {
          id: file.id,
          name: file.name,
          mimeType: file.mimeType,
          webViewLink: file.webViewLink,
          documentType: this.identifyDocumentType(file.name),
          content: null,
          suggestedPlaceholders: []
        };

        // Only analyze Google Docs documents
        if (file.mimeType === 'application/vnd.google-apps.document') {
          try {
            const content = await this.docsService.getDocumentContent(file.id);
            docAnalysis.content = this.extractTextFromDocument(content);
            docAnalysis.suggestedPlaceholders = this.suggestPlaceholders(docAnalysis.content, docAnalysis.documentType);
          } catch (error) {
            console.error(`Error reading document ${file.name}:`, error.message);
            docAnalysis.error = error.message;
          }
        } else {
          console.log(`Skipping non-Google Doc file: ${file.name} (${file.mimeType})`);
        }

        analysis.documents.push(docAnalysis);
      }

      return analysis;
    } catch (error) {
      console.error('Error analyzing folder:', error);
      throw error;
    }
  }

  identifyDocumentType(filename) {
    const name = filename.toLowerCase();
    
    if (name.includes('mnda') || name.includes('nda') || name.includes('non-disclosure')) {
      return 'MNDA';
    } else if (name.includes('poa') || name.includes('power of attorney')) {
      return 'POA';
    } else if (name.includes('term') && name.includes('sheet')) {
      return 'Term Sheet';
    } else if (name.includes('bridge')) {
      return 'Bridge';
    } else if (name.includes('construction') || name.includes('construc')) {
      return 'Construction';
    } else if (name.includes('predev') || name.includes('pre-dev')) {
      return 'PreDev';
    } else if (name.includes('working') && name.includes('capital')) {
      return 'Working Capital';
    } else {
      return 'Unknown';
    }
  }

  extractTextFromDocument(docData) {
    let text = '';
    
    if (docData.body && docData.body.content) {
      for (const element of docData.body.content) {
        if (element.paragraph) {
          for (const textElement of element.paragraph.elements || []) {
            if (textElement.textRun) {
              text += textElement.textRun.content;
            }
          }
        } else if (element.table) {
          // Handle table content
          for (const row of element.table.tableRows || []) {
            for (const cell of row.tableCells || []) {
              for (const cellElement of cell.content || []) {
                if (cellElement.paragraph) {
                  for (const textElement of cellElement.paragraph.elements || []) {
                    if (textElement.textRun) {
                      text += textElement.textRun.content;
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
    
    return text;
  }

  suggestPlaceholders(content, documentType) {
    const suggestions = [];
    const allVariables = [
      ...this.variables.pointOfContact,
      ...this.variables.businessInfo,
      ...this.variables.projectInfo,
      ...this.variables.financing
    ];

    // Look for common patterns that might need replacement
    const patterns = [
      // Business names
      { pattern: /\b[A-Z][a-z]+ (?:LLC|Inc|Corp|Corporation|Company|Co\.)\b/g, suggest: 'business_legal_name' },
      // Email addresses
      { pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, suggest: 'email' },
      // Phone numbers
      { pattern: /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g, suggest: 'mobile_phone' },
      // Addresses
      { pattern: /\b\d+\s+[A-Za-z\s]+(?:Street|St|Avenue|Ave|Road|Rd|Drive|Dr|Lane|Ln|Boulevard|Blvd)\b/g, suggest: 'address_project' },
      // Dollar amounts
      { pattern: /\$[\d,]+(?:\.\d{2})?/g, suggest: 'target_offering_amount' },
      // Dates
      { pattern: /\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/g, suggest: 'deadline' },
      // EIN
      { pattern: /\b\d{2}-\d{7}\b/g, suggest: 'ein' },
      // Percentage rates
      { pattern: /\b\d+(?:\.\d+)?%\b/g, suggest: 'rate' },
      // kW capacity
      { pattern: /\b\d+(?:,\d{3})*\s*kW\b/gi, suggest: 'Name_plate_capacity' },
      // Generic name patterns
      { pattern: /\b[A-Z][a-z]+\s+[A-Z][a-z]+\b/g, suggest: 'first_name and last_name' }
    ];

    for (const { pattern, suggest } of patterns) {
      const matches = content.match(pattern);
      if (matches) {
        const uniqueMatches = [...new Set(matches)];
        for (const match of uniqueMatches) {
          suggestions.push({
            foundText: match,
            suggestedVariable: suggest,
            placeholder: `{{${suggest}}}`
          });
        }
      }
    }

    // Document-specific suggestions
    switch (documentType) {
      case 'MNDA':
        suggestions.push(
          { suggestedVariable: 'business_legal_name', placeholder: '{{business_legal_name}}', context: 'Company name in signature blocks' },
          { suggestedVariable: 'first_name', placeholder: '{{first_name}}', context: 'Signatory first name' },
          { suggestedVariable: 'last_name', placeholder: '{{last_name}}', context: 'Signatory last name' },
          { suggestedVariable: 'title', placeholder: '{{title}}', context: 'Signatory title' }
        );
        break;
      case 'POA':
        suggestions.push(
          { suggestedVariable: 'business_legal_name', placeholder: '{{business_legal_name}}', context: 'Principal company name' },
          { suggestedVariable: 'state_incorporation', placeholder: '{{state_incorporation}}', context: 'State of incorporation' },
          { suggestedVariable: 'first_name', placeholder: '{{first_name}}', context: 'Attorney-in-fact first name' },
          { suggestedVariable: 'last_name', placeholder: '{{last_name}}', context: 'Attorney-in-fact last name' }
        );
        break;
      case 'Term Sheet':
        suggestions.push(
          { suggestedVariable: 'project_name', placeholder: '{{project_name}}', context: 'Project name' },
          { suggestedVariable: 'target_offering_amount', placeholder: '{{target_offering_amount}}', context: 'Target funding amount' },
          { suggestedVariable: 'maximum_offering_amount', placeholder: '{{maximum_offering_amount}}', context: 'Maximum funding amount' },
          { suggestedVariable: 'rate', placeholder: '{{rate}}', context: 'Interest rate' },
          { suggestedVariable: 'term', placeholder: '{{term}}', context: 'Loan term' },
          { suggestedVariable: 'Name_plate_capacity', placeholder: '{{Name_plate_capacity}}', context: 'System capacity' }
        );
        break;
    }

    return suggestions;
  }

  generateReport(analysis) {
    console.log('\n=== TEMPLATE ANALYSIS REPORT ===');
    console.log(`Folder ID: ${analysis.folderId}`);
    console.log(`Folder URL: ${analysis.folderUrl}`);
    console.log(`Total Documents: ${analysis.documents.length}`);

    for (const doc of analysis.documents) {
      console.log(`\n--- ${doc.name} ---`);
      console.log(`Document ID: ${doc.id}`);
      console.log(`Document Type: ${doc.documentType}`);
      console.log(`MIME Type: ${doc.mimeType}`);
      console.log(`Web View Link: ${doc.webViewLink}`);

      if (doc.error) {
        console.log(`ERROR: ${doc.error}`);
        continue;
      }

      if (doc.mimeType !== 'application/vnd.google-apps.document') {
        console.log('SKIPPED: Not a Google Doc');
        continue;
      }

      console.log('\nSUGGESTED PLACEHOLDERS:');
      if (doc.suggestedPlaceholders.length === 0) {
        console.log('  No specific placeholders suggested');
      } else {
        for (const suggestion of doc.suggestedPlaceholders) {
          if (suggestion.foundText) {
            console.log(`  "${suggestion.foundText}" → ${suggestion.placeholder}`);
          } else {
            console.log(`  ${suggestion.placeholder} - ${suggestion.context || suggestion.suggestedVariable}`);
          }
        }
      }

      if (doc.content) {
        const preview = doc.content.substring(0, 200).replace(/\n/g, ' ');
        console.log(`\nCONTENT PREVIEW: ${preview}...`);
      }
    }

    console.log('\n=== RECOMMENDED ACTIONS ===');
    console.log('For each document, manually review and add the following placeholders:');
    
    const allVariables = [
      ...this.variables.pointOfContact,
      ...this.variables.businessInfo,
      ...this.variables.projectInfo,
      ...this.variables.financing
    ];

    console.log('\nALL AVAILABLE VARIABLES:');
    console.log('Point of Contact:', this.variables.pointOfContact.map(v => `{{${v}}}`).join(', '));
    console.log('Business Info:', this.variables.businessInfo.map(v => `{{${v}}}`).join(', '));
    console.log('Project Info:', this.variables.projectInfo.map(v => `{{${v}}}`).join(', '));
    console.log('Financing:', this.variables.financing.map(v => `{{${v}}}`).join(', '));
  }
}

// Main execution
async function main() {
  const analyzer = new TemplateAnalyzer();
  const folderUrl = 'https://drive.google.com/drive/u/1/folders/1E4imDQa0OFWMBME-DIPaZhGJbtgYz4sm';
  
  try {
    const analysis = await analyzer.analyzeFolderContents(folderUrl);
    analyzer.generateReport(analysis);
    
    // Save analysis to file for reference
    const fs = require('fs');
    fs.writeFileSync('./template_analysis.json', JSON.stringify(analysis, null, 2));
    console.log('\nAnalysis saved to template_analysis.json');
    
  } catch (error) {
    console.error('Analysis failed:', error);
  }
}

if (require.main === module) {
  main();
}

module.exports = TemplateAnalyzer;