const { google } = require('googleapis');
const GoogleAuthService = require('./googleAuth');
const fs = require('fs');
const path = require('path');

class Phase2DriveUtils {
  constructor() {
    this.authService = new GoogleAuthService();
    this.drive = null;
  }

  initializeApi() {
    if (!this.drive) {
      this.drive = google.drive({ version: 'v3', auth: this.authService.getAuth() });
    }
  }

  async findFolderByName(name, parentId) {
    try {
      this.initializeApi();
      await this.authService.ensureValidToken();

      const query = `name = '${name}' and '${parentId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
      
      const response = await this.drive.files.list({
        q: query,
        fields: 'files(id, name, webViewLink)',
        spaces: 'drive'
      });

      return response.data.files.length > 0 ? response.data.files[0] : null;
    } catch (error) {
      console.error('Error finding folder by name:', error);
      throw error;
    }
  }

  async listFilesInFolder(folderId) {
    try {
      this.initializeApi();
      await this.authService.ensureValidToken();

      const response = await this.drive.files.list({
        q: `'${folderId}' in parents and trashed = false`,
        fields: 'files(id, name, mimeType, webViewLink)',
        spaces: 'drive'
      });

      return response.data.files;
    } catch (error) {
      console.error('Error listing files in folder:', error);
      throw error;
    }
  }

  async moveFolder(folderId, newParentId) {
    try {
      this.initializeApi();
      await this.authService.ensureValidToken();

      // First, get the current parent(s) of the folder
      const file = await this.drive.files.get({
        fileId: folderId,
        fields: 'parents'
      });
      
      const previousParents = file.data.parents.join(',');

      // Then, update the folder to move it
      const result = await this.drive.files.update({
        fileId: folderId,
        addParents: newParentId,
        removeParents: previousParents,
        fields: 'id, parents, name, webViewLink'
      });

      console.log(`Moved folder ${folderId} to new parent ${newParentId}`);
      return result.data;
    } catch (error) {
      console.error('Error moving folder:', error);
      throw error;
    }
  }

  async uploadLocalFile(filePath, destinationFolderId, newFileName = null) {
    try {
      this.initializeApi();
      await this.authService.ensureValidToken();

      const fileName = newFileName || path.basename(filePath);
      const mimeType = path.extname(filePath).toLowerCase() === '.pdf' ? 'application/pdf' : 'application/octet-stream';

      const fileMetadata = {
        name: fileName,
        parents: [destinationFolderId]
      };

      const media = {
        mimeType: mimeType,
        body: fs.createReadStream(filePath)
      };

      const response = await this.drive.files.create({
        resource: fileMetadata,
        media: media,
        fields: 'id, name, webViewLink'
      });

      console.log(`Uploaded local file: ${fileName} (ID: ${response.data.id})`);
      return response.data;
    } catch (error) {
      console.error('Error uploading local file:', error);
      throw error;
    }
  }

  async createFolder(name, parentId) {
    try {
      this.initializeApi();
      await this.authService.ensureValidToken();

      const fileMetadata = {
        name: name,
        mimeType: 'application/vnd.google-apps.folder'
      };

      if (parentId) {
        fileMetadata.parents = [parentId];
      }

      const response = await this.drive.files.create({
        resource: fileMetadata,
        fields: 'id, name, webViewLink'
      });

      console.log(`Created folder: ${name} (ID: ${response.data.id})`);
      return response.data;
    } catch (error) {
      console.error(`Error creating folder "${name}":`, error);
      throw error;
    }
  }

  async findOrCreateFolder(name, parentId) {
    try {
      // First try to find existing folder
      const existingFolder = await this.findFolderByName(name, parentId);
      if (existingFolder) {
        console.log(`Found existing folder: ${name}`);
        return existingFolder;
      }

      // If not found, create new folder
      console.log(`Creating new folder: ${name}`);
      return await this.createFolder(name, parentId);
    } catch (error) {
      console.error('Error finding or creating folder:', error);
      throw error;
    }
  }

  extractFileIdFromUrl(url) {
    const regex = /\/document\/d\/([a-zA-Z0-9-_]+)/;
    const match = url.match(regex);
    return match ? match[1] : null;
  }

  async copyFileById(sourceFileId, destinationFolderId, newFileName) {
    try {
      this.initializeApi();
      await this.authService.ensureValidToken();

      const copiedFile = await this.drive.files.copy({
        fileId: sourceFileId,
        resource: {
          name: newFileName,
          parents: [destinationFolderId]
        },
        fields: 'id, name, webViewLink'
      });

      console.log(`Copied file: ${newFileName} (ID: ${copiedFile.data.id})`);
      return copiedFile.data;
    } catch (error) {
      console.error('Error copying file:', error);
      throw error;
    }
  }

  async copyGoogleDocFromUrl(url, destinationFolderId, newFileName) {
    try {
      const fileId = this.extractFileIdFromUrl(url);
      if (!fileId) {
        throw new Error(`Could not extract file ID from URL: ${url}`);
      }

      return await this.copyFileById(fileId, destinationFolderId, newFileName);
    } catch (error) {
      console.error('Error copying Google Doc from URL:', error);
      throw error;
    }
  }
}

module.exports = Phase2DriveUtils;