const { google } = require('googleapis');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

class LeadTrackingService {
  constructor() {
    this.auth = null;
    this.sheets = null;
    this.spreadsheetId = process.env.LEAD_TRACKING_SHEET_ID;
    this.sheetName = 'LeadTracking';
  }

  async initializeAuth() {
    if (!this.auth) {
      this.auth = new google.auth.GoogleAuth({
        credentials: {
          type: 'service_account',
          project_id: process.env.GOOGLE_PROJECT_ID,
          private_key_id: process.env.GOOGLE_PRIVATE_KEY_ID,
          private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
          client_email: process.env.GOOGLE_CLIENT_EMAIL,
          client_id: process.env.GOOGLE_CLIENT_ID,
        },
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
      });
      
      this.sheets = google.sheets({ version: 'v4', auth: this.auth });
    }
  }

  async ensureHeaderRow() {
    await this.initializeAuth();
    
    try {
      // Check if header row exists
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: `${this.sheetName}!A1:K1`,
      });

      if (!response.data.values || response.data.values.length === 0) {
        // Create header row
        const headers = [
          'lead_id',
          'status', 
          'business_legal_name',
          'phase1_folder_id',
          'phase2_folder_id',
          'phase1_submission_data_json',
          'phase2_submission_data_json',
          'created_at',
          'last_updated',
          'error_details',
          'retry_count'
        ];

        await this.sheets.spreadsheets.values.update({
          spreadsheetId: this.spreadsheetId,
          range: `${this.sheetName}!A1:K1`,
          valueInputOption: 'USER_ENTERED',
          resource: {
            values: [headers]
          }
        });

        console.log('Lead tracking header row created');
      }
    } catch (error) {
      console.error('Error ensuring header row:', error);
      throw error;
    }
  }

  generateLeadId() {
    return uuidv4();
  }

  async createLead(leadData) {
    await this.initializeAuth();
    await this.ensureHeaderRow();

    const leadId = this.generateLeadId();
    const timestamp = new Date().toISOString();

    const row = [
      leadId,
      'PHASE_1_COMPLETE',
      leadData.business_legal_name || '',
      leadData.phase1_folder_id || '',
      '', // phase2_folder_id - empty initially
      JSON.stringify(leadData.phase1_submission_data || {}),
      '', // phase2_submission_data_json - empty initially  
      timestamp,
      timestamp,
      '', // error_details
      0 // retry_count
    ];

    try {
      await this.sheets.spreadsheets.values.append({
        spreadsheetId: this.spreadsheetId,
        range: `${this.sheetName}!A:K`,
        valueInputOption: 'USER_ENTERED',
        resource: {
          values: [row]
        }
      });

      console.log(`Lead created with ID: ${leadId}`);
      return leadId;
    } catch (error) {
      console.error('Error creating lead:', error);
      throw error;
    }
  }

  async getLeadById(leadId) {
    await this.initializeAuth();

    try {
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: `${this.sheetName}!A:K`,
      });

      if (!response.data.values) {
        return null;
      }

      const headers = response.data.values[0];
      const rows = response.data.values.slice(1);

      const leadRow = rows.find(row => row[0] === leadId);
      if (!leadRow) {
        return null;
      }

      // Convert row to object
      const lead = {};
      headers.forEach((header, index) => {
        lead[header] = leadRow[index] || '';
      });

      // Parse JSON fields
      try {
        lead.phase1_submission_data = JSON.parse(lead.phase1_submission_data_json || '{}');
      } catch (e) {
        lead.phase1_submission_data = {};
      }

      try {
        lead.phase2_submission_data = JSON.parse(lead.phase2_submission_data_json || '{}');
      } catch (e) {
        lead.phase2_submission_data = {};
      }

      return lead;
    } catch (error) {
      console.error('Error getting lead by ID:', error);
      throw error;
    }
  }

  async updateLeadStatus(leadId, status, updates = {}) {
    await this.initializeAuth();

    try {
      // First get the current row
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: `${this.sheetName}!A:K`,
      });

      if (!response.data.values) {
        throw new Error('Lead tracking sheet not found');
      }

      const headers = response.data.values[0];
      const rows = response.data.values.slice(1);

      const rowIndex = rows.findIndex(row => row[0] === leadId);
      if (rowIndex === -1) {
        throw new Error(`Lead with ID ${leadId} not found`);
      }

      // Update the row
      const rowData = [...rows[rowIndex]];
      
      // Update status
      const statusIndex = headers.indexOf('status');
      if (statusIndex >= 0) {
        rowData[statusIndex] = status;
      }

      // Update last_updated
      const lastUpdatedIndex = headers.indexOf('last_updated');
      if (lastUpdatedIndex >= 0) {
        rowData[lastUpdatedIndex] = new Date().toISOString();
      }

      // Apply other updates
      Object.keys(updates).forEach(key => {
        const index = headers.indexOf(key);
        if (index >= 0) {
          if (key.endsWith('_json') && typeof updates[key] === 'object') {
            rowData[index] = JSON.stringify(updates[key]);
          } else {
            rowData[index] = updates[key];
          }
        }
      });

      // Update the specific row (add 2 to account for 0-based index and header row)
      const range = `${this.sheetName}!A${rowIndex + 2}:K${rowIndex + 2}`;
      await this.sheets.spreadsheets.values.update({
        spreadsheetId: this.spreadsheetId,
        range: range,
        valueInputOption: 'USER_ENTERED',
        resource: {
          values: [rowData]
        }
      });

      console.log(`Lead ${leadId} updated to status: ${status}`);
      return true;
    } catch (error) {
      console.error('Error updating lead status:', error);
      throw error;
    }
  }

  async getLeadsByStatus(status) {
    await this.initializeAuth();

    try {
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: `${this.sheetName}!A:K`,
      });

      if (!response.data.values) {
        return [];
      }

      const headers = response.data.values[0];
      const rows = response.data.values.slice(1);

      const statusIndex = headers.indexOf('status');
      if (statusIndex === -1) {
        return [];
      }

      const matchingRows = rows.filter(row => row[statusIndex] === status);
      
      return matchingRows.map(row => {
        const lead = {};
        headers.forEach((header, index) => {
          lead[header] = row[index] || '';
        });

        // Parse JSON fields
        try {
          lead.phase1_submission_data = JSON.parse(lead.phase1_submission_data_json || '{}');
        } catch (e) {
          lead.phase1_submission_data = {};
        }

        try {
          lead.phase2_submission_data = JSON.parse(lead.phase2_submission_data_json || '{}');
        } catch (e) {
          lead.phase2_submission_data = {};
        }

        return lead;
      });
    } catch (error) {
      console.error('Error getting leads by status:', error);
      throw error;
    }
  }

  async recordError(leadId, errorMessage, retryCount = 0) {
    try {
      await this.updateLeadStatus(leadId, 'ERROR', {
        error_details: errorMessage,
        retry_count: retryCount
      });
    } catch (error) {
      console.error('Error recording error for lead:', error);
    }
  }
}

module.exports = LeadTrackingService;