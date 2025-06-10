const { google } = require('googleapis');
const GoogleAuthService = require('./googleAuth');

class GoogleDriveService {
  constructor() {
    this.authService = new GoogleAuthService();
    this.drive = google.drive({ version: 'v3', auth: this.authService.getAuth() });
  }

  async createFolder(name, parentFolderId = null) {
    try {
      await this.authService.ensureValidToken();

      const folderMetadata = {
        name: name,
        mimeType: 'application/vnd.google-apps.folder'
      };

      if (parentFolderId) {
        folderMetadata.parents = [parentFolderId];
      }

      const folder = await this.drive.files.create({
        resource: folderMetadata,
        fields: 'id, name, webViewLink'
      });

      console.log(`Created folder: ${name} (ID: ${folder.data.id})`);
      return folder.data;
    } catch (error) {
      console.error('Error creating folder:', error);
      throw error;
    }
  }

  async createClientFolderStructure(businessName) {
    try {
      const leadsPhase1FolderId = process.env.LEADS_PHASE1_FOLDER_ID;
      
      // Create main client folder
      const mainFolder = await this.createFolder(businessName, leadsPhase1FolderId);
      
      // Create Internal and External subfolders
      const internalFolder = await this.createFolder('Internal', mainFolder.id);
      const externalFolder = await this.createFolder('External', mainFolder.id);

      return {
        main: mainFolder,
        internal: internalFolder,
        external: externalFolder
      };
    } catch (error) {
      console.error('Error creating client folder structure:', error);
      throw error;
    }
  }

  async setFolderPermissions(folderId, permissions) {
    try {
      await this.authService.ensureValidToken();

      const results = [];
      for (const permission of permissions) {
        const result = await this.drive.permissions.create({
          fileId: folderId,
          resource: {
            role: permission.role,
            type: permission.type,
            emailAddress: permission.emailAddress
          }
        });
        results.push(result.data);
      }

      console.log(`Set permissions for folder ${folderId}`);
      return results;
    } catch (error) {
      console.error('Error setting folder permissions:', error);
      throw error;
    }
  }

  async copyFile(sourceFileId, name, parentFolderId) {
    try {
      await this.authService.ensureValidToken();

      const copiedFile = await this.drive.files.copy({
        fileId: sourceFileId,
        resource: {
          name: name,
          parents: [parentFolderId]
        },
        fields: 'id, name, webViewLink'
      });

      console.log(`Copied file: ${name} (ID: ${copiedFile.data.id})`);
      return copiedFile.data;
    } catch (error) {
      console.error('Error copying file:', error);
      throw error;
    }
  }

  async moveFile(fileId, newParentFolderId, oldParentFolderId = null) {
    try {
      await this.authService.ensureValidToken();

      const updateParams = {
        fileId: fileId,
        addParents: newParentFolderId,
        fields: 'id, parents'
      };

      if (oldParentFolderId) {
        updateParams.removeParents = oldParentFolderId;
      }

      const file = await this.drive.files.update(updateParams);
      console.log(`Moved file ${fileId} to folder ${newParentFolderId}`);
      return file.data;
    } catch (error) {
      console.error('Error moving file:', error);
      throw error;
    }
  }

  async getFileInfo(fileId) {
    try {
      await this.authService.ensureValidToken();

      const file = await this.drive.files.get({
        fileId: fileId,
        fields: 'id, name, mimeType, parents, webViewLink, createdTime, modifiedTime'
      });

      return file.data;
    } catch (error) {
      console.error('Error getting file info:', error);
      throw error;
    }
  }

  async listFiles(parentFolderId = null, mimeType = null) {
    try {
      await this.authService.ensureValidToken();

      let query = '';
      if (parentFolderId) {
        query += `'${parentFolderId}' in parents`;
      }
      if (mimeType) {
        query += query ? ` and mimeType='${mimeType}'` : `mimeType='${mimeType}'`;
      }

      const response = await this.drive.files.list({
        q: query,
        fields: 'files(id, name, mimeType, webViewLink)'
      });

      return response.data.files;
    } catch (error) {
      console.error('Error listing files:', error);
      throw error;
    }
  }
}

module.exports = GoogleDriveService;