const GoogleDocsService = require('./googleDocs');
const GoogleDriveService = require('./googleDrive');
const LeadTrackingService = require('./leadTrackingService');
const FileUploadService = require('./fileUploadService');
const { TEMPLATE_IDS, PHASE_2_TEMPLATE_IDS } = require('../config/templateIds');
require('dotenv').config();

class Phase2AutomationService {
  constructor() {
    console.log('Initializing Phase2AutomationService...');
    this.docsService = null;
    this.driveService = null;
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
      
      // Step 4: Process file uploads from Phase 2 form
      const uploadedFiles = await this.processFileUploads(phase2FormData, internalFolders);
      
      // Step 5: Generate Phase 2 documents
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

      // Move the folder
      const movedFolder = await this.driveService.moveFolder(
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

      // Find the existing Internal folder
      const internalFolder = await this.driveService.findFolderByName('Internal', parentFolderId);
      if (!internalFolder) {
        throw new Error('Internal folder not found in Phase 1 structure');
      }

      // Create the 5 required subfolders
      const subfolders = [
        'Data Room',
        'Escrow Account', 
        'Financial Statements',
        'Form C',
        'Content'
      ];

      const createdFolders = {};
      
      for (const folderName of subfolders) {
        console.log(`Creating subfolder: ${folderName}`);
        const folder = await this.driveService.createFolder(folderName, internalFolder.id);
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
      
      // Get the Internal folder from Phase 1
      const internalFolder = await this.driveService.findFolderByName('Internal', leadData.phase1_folder_id);
      if (!internalFolder) {
        console.log('No Internal folder found in Phase 1, skipping document move');
        return;
      }

      // Get all files from the Phase 1 Internal folder
      const files = await this.driveService.listFilesInFolder(internalFolder.id);
      
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
      console.log('Generating Phase 2 documents...');
      
      // Combine Phase 1 and Phase 2 data
      const combinedData = {
        ...leadData.phase1_submission_data,
        ...phase2FormData,
        // Add any calculated fields needed for Form C
        submission_date: new Date().toLocaleDateString(),
        filing_date: new Date().toLocaleDateString()
      };

      const documents = {};

      // Generate Form C
      if (PHASE_2_TEMPLATE_IDS?.FORM_C) {
        console.log('Generating Form C...');
        documents.formC = await this.docsService.createDocumentFromTemplate(
          PHASE_2_TEMPLATE_IDS.FORM_C,
          `${leadData.business_legal_name} - Form C`,
          internalFolders.formC.id,
          combinedData
        );
      }

      // Generate Project Summary
      if (PHASE_2_TEMPLATE_IDS?.PROJECT_SUMMARY) {
        console.log('Generating Project Summary...');
        documents.projectSummary = await this.docsService.createDocumentFromTemplate(
          PHASE_2_TEMPLATE_IDS.PROJECT_SUMMARY,
          `${leadData.business_legal_name} - Project Summary`,
          internalFolders.formC.id,
          combinedData
        );
      }

      // Generate Filing Form C
      if (PHASE_2_TEMPLATE_IDS?.FILING_FORM_C) {
        console.log('Generating Filing Form C...');
        documents.filingFormC = await this.docsService.createDocumentFromTemplate(
          PHASE_2_TEMPLATE_IDS.FILING_FORM_C,
          `${leadData.business_legal_name} - Filing Form C`,
          internalFolders.formC.id,
          combinedData
        );
      }

      // Generate Certification Statement
      if (PHASE_2_TEMPLATE_IDS?.CERTIFICATION_STATEMENT) {
        console.log('Generating Certification Statement...');
        documents.certificationStatement = await this.docsService.createDocumentFromTemplate(
          PHASE_2_TEMPLATE_IDS.CERTIFICATION_STATEMENT,
          `${leadData.business_legal_name} - Certification Statement`,
          internalFolders.formC.id,
          combinedData
        );
      }

      // Generate Project Card
      if (PHASE_2_TEMPLATE_IDS?.PROJECT_CARD) {
        console.log('Generating Project Card...');
        documents.projectCard = await this.docsService.createDocumentFromTemplate(
          PHASE_2_TEMPLATE_IDS.PROJECT_CARD,
          `${leadData.business_legal_name} - Project Card`,
          internalFolders.content.id,
          combinedData
        );
      }

      console.log('Phase 2 documents generated successfully');
      return documents;
    } catch (error) {
      console.error('Error generating Phase 2 documents:', error);
      throw error;
    }
  }
}

module.exports = Phase2AutomationService;