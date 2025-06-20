const multer = require('multer');
const mime = require('mime-types');
const GoogleDriveService = require('./googleDrive');
require('dotenv').config();

class FileUploadService {
  constructor() {
    this.driveService = new GoogleDriveService();
    this.maxFileSize = parseInt(process.env.FILE_UPLOAD_MAX_SIZE) || 10485760; // 10MB default
    this.allowedMimeTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'image/jpeg',
      'image/png',
      'image/gif',
      'text/plain'
    ];
  }

  // Configure multer for file uploads
  getMulterConfig() {
    const storage = multer.memoryStorage();
    
    return multer({
      storage: storage,
      limits: {
        fileSize: this.maxFileSize
      },
      fileFilter: (req, file, cb) => {
        // Validate MIME type
        if (this.allowedMimeTypes.includes(file.mimetype)) {
          cb(null, true);
        } else {
          cb(new Error(`File type ${file.mimetype} not allowed`), false);
        }
      }
    });
  }

  // Process files from Fillout form submission
  async processFormFiles(formData, internalFolders) {
    try {
      console.log('Processing files from form submission...');
      
      // Map of form field names to their target folders
      const fileFieldMapping = {
        'articles_of_incorporation': internalFolders.escrowAccount,
        'certificate_of_formation': internalFolders.escrowAccount,
        'ein_documentation': internalFolders.escrowAccount,
        'cap_table': internalFolders.escrowAccount,
        'investor_rights_schedule': internalFolders.escrowAccount,
        'governing_documents': internalFolders.escrowAccount,
        'financial_statements': internalFolders.financialStatements,
        'audited_financials': internalFolders.financialStatements,
        'reviewed_financials': internalFolders.financialStatements,
        'project_pictures': internalFolders.content,
        'team_headshots': internalFolders.content
      };

      const uploadedFiles = {};

      // Process each file field in the form
      for (const [fieldName, targetFolder] of Object.entries(fileFieldMapping)) {
        if (formData[fieldName]) {
          console.log(`Processing files for field: ${fieldName}`);
          
          // Handle both single files and arrays of files
          const files = Array.isArray(formData[fieldName]) ? formData[fieldName] : [formData[fieldName]];
          
          for (const fileData of files) {
            if (fileData && fileData.url) {
              try {
                const uploadedFile = await this.uploadFileFromUrl(
                  fileData.url,
                  fileData.name || `${fieldName}_upload`,
                  targetFolder.id
                );
                
                if (!uploadedFiles[fieldName]) {
                  uploadedFiles[fieldName] = [];
                }
                uploadedFiles[fieldName].push(uploadedFile);
                
                console.log(`Successfully uploaded: ${fileData.name} to ${targetFolder.name}`);
              } catch (uploadError) {
                console.error(`Error uploading file ${fileData.name}:`, uploadError);
                // Continue with other files even if one fails
              }
            }
          }
        }
      }

      console.log('File processing completed');
      return uploadedFiles;
    } catch (error) {
      console.error('Error processing form files:', error);
      throw error;
    }
  }

  // Upload a file from URL to Google Drive
  async uploadFileFromUrl(fileUrl, fileName, folderId) {
    try {
      console.log(`Downloading file from URL: ${fileUrl}`);
      
      // Download file from Fillout's file URL
      const response = await fetch(fileUrl);
      if (!response.ok) {
        throw new Error(`Failed to download file: ${response.statusText}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      
      // Validate file size
      if (buffer.length > this.maxFileSize) {
        throw new Error(`File ${fileName} exceeds maximum size of ${this.maxFileSize} bytes`);
      }

      // Detect MIME type
      const mimeType = mime.lookup(fileName) || 'application/octet-stream';
      
      // Validate MIME type
      if (!this.allowedMimeTypes.includes(mimeType)) {
        throw new Error(`File type ${mimeType} not allowed for file ${fileName}`);
      }

      // Sanitize filename
      const sanitizedFileName = this.sanitizeFileName(fileName);

      // Upload to Google Drive
      const uploadedFile = await this.driveService.uploadFile(
        buffer,
        sanitizedFileName,
        mimeType,
        folderId
      );

      console.log(`File uploaded successfully: ${sanitizedFileName}`);
      return {
        id: uploadedFile.id,
        name: sanitizedFileName,
        mimeType: mimeType,
        size: buffer.length,
        webViewLink: uploadedFile.webViewLink
      };
    } catch (error) {
      console.error(`Error uploading file from URL ${fileUrl}:`, error);
      throw error;
    }
  }

  // Sanitize filename to prevent security issues
  sanitizeFileName(fileName) {
    // Remove any path traversal attempts and dangerous characters
    return fileName
      .replace(/[<>:"/\\|?*]/g, '') // Remove invalid filename characters
      .replace(/\.\./g, '') // Remove path traversal attempts
      .replace(/^\.+/, '') // Remove leading dots
      .trim()
      .substring(0, 255) // Limit length
      || 'uploaded_file'; // Fallback name
  }

  // Validate uploaded file
  validateFile(file) {
    const errors = [];

    // Check file size
    if (file.size > this.maxFileSize) {
      errors.push(`File size ${file.size} exceeds maximum allowed size of ${this.maxFileSize} bytes`);
    }

    // Check MIME type
    if (!this.allowedMimeTypes.includes(file.mimetype)) {
      errors.push(`File type ${file.mimetype} is not allowed`);
    }

    // Check filename
    if (!file.originalname || file.originalname.trim().length === 0) {
      errors.push('Filename is required');
    }

    return {
      isValid: errors.length === 0,
      errors: errors
    };
  }

  // Get file info from Google Drive
  async getFileInfo(fileId) {
    try {
      return await this.driveService.getFileMetadata(fileId);
    } catch (error) {
      console.error('Error getting file info:', error);
      throw error;
    }
  }

  // Delete file from Google Drive
  async deleteFile(fileId) {
    try {
      return await this.driveService.deleteFile(fileId);
    } catch (error) {
      console.error('Error deleting file:', error);
      throw error;
    }
  }
}

module.exports = FileUploadService;