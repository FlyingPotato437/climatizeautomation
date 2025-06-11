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
      console.log(`Created document: ${newDocumentName} (ID: ${newDocId})`);

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

  async replaceTextInDocument(documentId, replacements) {
    try {
      this.initializeApis();
      await this.authService.ensureValidToken();

      // Get the document content first
      const doc = await this.docs.documents.get({
        documentId: documentId
      });

      // Prepare batch update requests
      const requests = [];

      // Sort variables by length (longest first) to prevent partial word replacements
      // For example, "technology" should be processed before "tech" to avoid conflicts
      const sortedVariables = Object.keys(replacements).sort((a, b) => b.length - a.length);

      // Create replacement requests for each variable
      for (const variable of sortedVariables) {
        const replacement = replacements[variable];
        
        // Ensure replacement is a string, not an object
        let replaceText = '';
        if (replacement && typeof replacement === 'object') {
          replaceText = JSON.stringify(replacement);
        } else {
          replaceText = String(replacement || '');
        }
        
        requests.push({
          replaceAllText: {
            containsText: {
              text: variable,
              matchCase: false
            },
            replaceText: replaceText
          }
        });
      }

      // Execute batch update if we have requests
      if (requests.length > 0) {
        await this.docs.documents.batchUpdate({
          documentId: documentId,
          resource: {
            requests: requests
          }
        });

        console.log(`Replaced ${requests.length} placeholders in document ${documentId}`);
      }

      return true;
    } catch (error) {
      console.error('Error replacing text in document:', error);
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