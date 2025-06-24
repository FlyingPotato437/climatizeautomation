const { google } = require('googleapis');
const GoogleAuthService = require('./googleAuth');

class GoogleDocsService {
  constructor() {
    this.authService = new GoogleAuthService();
    this.docs = null;
    this.drive = null;
  }

  initializeApis() {
    if (!this.docs) {
      this.docs = google.docs({ version: 'v1', auth: this.authService.getAuth() });
      this.drive = google.drive({ version: 'v3', auth: this.authService.getAuth() });
    }
  }

  async createDocumentFromTemplate(templateId, newDocumentName, destinationFolderId, replacements) {
    try {
      this.initializeApis();
      await this.authService.ensureValidToken();

      // Step 1: Copy the template document
      const copiedDoc = await this.drive.files.copy({
        fileId: templateId,
        resource: {
          name: newDocumentName,
          parents: [destinationFolderId]
        },
        fields: 'id, name, webViewLink'
      });

      const newDocId = copiedDoc.data.id;
      console.log(`📄 Created document: ${newDocumentName}`);
      console.log(`   📍 Document ID: ${newDocId}`);
      console.log(`   🔗 Direct link: ${copiedDoc.data.webViewLink}`);

      // Step 2: Replace placeholders in the document
      await this.replaceTextInDocument(newDocId, replacements);

      return {
        id: newDocId,
        name: copiedDoc.data.name,
        webViewLink: copiedDoc.data.webViewLink
      };
    } catch (error) {
      console.error('Error creating document from template:', error);
      throw error;
    }
  }

  async replaceTextInDocument(documentId, enrichedData) {
    try {
      this.initializeApis();
      await this.authService.ensureValidToken();

      console.log(`=== REPLACING TEXT IN DOCUMENT ${documentId} ===`);
      console.log(`Variables available: ${Object.keys(enrichedData).length}`);

      // Prepare batch update requests for RAW variable names (no delimiters)
      const requests = [];

      // Create simple replacements for raw variable names
      for (const [variable, value] of Object.entries(enrichedData)) {
        if (variable && value !== undefined && value !== null) {
          const replaceText = String(value);
          
          // Replace the raw variable name directly
          requests.push({
            replaceAllText: {
              containsText: {
                text: variable,  // Raw variable name like "first_name_poc"
                matchCase: true  // Case-sensitive for clean matching
              },
              replaceText: replaceText
            }
          });
          
          console.log(`📝 Will replace "${variable}" with "${replaceText}"`);
        }
      }

      // Execute batch update if we have requests
      if (requests.length > 0) {
        console.log(`Executing ${requests.length} raw variable replacement requests...`);
        await this.docs.documents.batchUpdate({
          documentId: documentId,
          resource: {
            requests: requests
          }
        });

        console.log(`✅ Successfully replaced ${requests.length} variables in document ${documentId}`);
      } else {
        console.log('⚠️ No replacement requests to execute');
      }

      return true;
    } catch (error) {
      console.error('❌ Error replacing text in document:', error);
      if (error.response) {
        console.error('Google API Error Details:', error.response.data);
      }
      throw error;
    }
  }

  async getDocumentContent(documentId) {
    try {
      this.initializeApis();
      await this.authService.ensureValidToken();

      const doc = await this.docs.documents.get({
        documentId: documentId
      });

      return doc.data;
    } catch (error) {
      console.error('Error getting document content:', error);
      throw error;
    }
  }

  async addTextToDocument(documentId, text, index = 1) {
    try {
      await this.authService.ensureValidToken();

      const requests = [{
        insertText: {
          location: {
            index: index
          },
          text: text
        }
      }];

      await this.docs.documents.batchUpdate({
        documentId: documentId,
        resource: {
          requests: requests
        }
      });

      console.log(`Added text to document ${documentId}`);
      return true;
    } catch (error) {
      console.error('Error adding text to document:', error);
      throw error;
    }
  }

  async insertPageBreak(documentId, index) {
    try {
      await this.authService.ensureValidToken();

      const requests = [{
        insertPageBreak: {
          location: {
            index: index
          }
        }
      }];

      await this.docs.documents.batchUpdate({
        documentId: documentId,
        resource: {
          requests: requests
        }
      });

      console.log(`Inserted page break in document ${documentId}`);
      return true;
    } catch (error) {
      console.error('Error inserting page break:', error);
      throw error;
    }
  }

  async formatDocument(documentId, formatting) {
    try {
      await this.authService.ensureValidToken();

      const requests = [];

      // Add formatting requests based on the formatting object
      if (formatting.title) {
        requests.push({
          updateParagraphStyle: {
            range: {
              startIndex: formatting.title.startIndex,
              endIndex: formatting.title.endIndex
            },
            paragraphStyle: {
              namedStyleType: 'TITLE'
            },
            fields: 'namedStyleType'
          }
        });
      }

      if (formatting.headings) {
        formatting.headings.forEach(heading => {
          requests.push({
            updateParagraphStyle: {
              range: {
                startIndex: heading.startIndex,
                endIndex: heading.endIndex
              },
              paragraphStyle: {
                namedStyleType: heading.style || 'HEADING_1'
              },
              fields: 'namedStyleType'
            }
          });
        });
      }

      if (requests.length > 0) {
        await this.docs.documents.batchUpdate({
          documentId: documentId,
          resource: {
            requests: requests
          }
        });

        console.log(`Applied formatting to document ${documentId}`);
      }

      return true;
    } catch (error) {
      console.error('Error formatting document:', error);
      throw error;
    }
  }
}

module.exports = GoogleDocsService;