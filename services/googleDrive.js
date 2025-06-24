const { google } = require('googleapis');
const GoogleAuthService = require('./googleAuth');

class GoogleDriveService {
  constructor() {
    this.authService = new GoogleAuthService();
    this.drive = null;
  }

  initializeApi() {
    if (!this.drive) {
      this.drive = google.drive({ version: 'v3', auth: this.authService.getAuth() });
    }
  }

  async createFolder(name, parentFolderId = null) {
    try {
      this.initializeApi();
      await this.authService.ensureValidToken();

      const folderMetadata = {
        name: name,
        mimeType: 'application/vnd.google-apps.folder'
      };

      if (parentFolderId) {
        folderMetadata.parents = [parentFolderId];
        console.log(`📁 Creating folder "${name}" inside parent folder ID: ${parentFolderId}`);
      } else {
        console.log(`📁 Creating folder "${name}" in root Drive`);
      }

      const folder = await this.drive.files.create({
        resource: folderMetadata,
        fields: 'id, name, webViewLink'
      });

      console.log(`✅ Created folder: ${name}`);
      console.log(`   📍 Folder ID: ${folder.data.id}`);
      console.log(`   🔗 Direct link: ${folder.data.webViewLink}`);
      
      return folder.data;
    } catch (error) {
      console.error('❌ Error creating folder:', error);
      throw error;
    }
  }

  async createClientFolderStructure(businessName) {
    try {
      this.initializeApi();
      const leadsPhase1FolderId = process.env.LEADS_PHASE1_FOLDER_ID;
      
      console.log(`🏗️  Creating folder structure for: ${businessName}`);
      console.log(`📂 Parent folder ID: ${leadsPhase1FolderId || 'NOT SET - will create in root!'}`);
      
      // Create main client folder
      const mainFolder = await this.createFolder(businessName, leadsPhase1FolderId);
      
      // Create Internal and External subfolders
      console.log('📁 Creating subfolders...');
      const internalFolder = await this.createFolder('Internal', mainFolder.id);
      const externalFolder = await this.createFolder('External', mainFolder.id);

      const result = {
        main: mainFolder,
        internal: internalFolder,
        external: externalFolder
      };

      console.log('🎉 Folder structure created successfully!');
      console.log(`   📁 Main: ${mainFolder.webViewLink}`);
      console.log(`   📁 Internal: ${internalFolder.webViewLink}`);
      console.log(`   📁 External: ${externalFolder.webViewLink}`);

      return result;
    } catch (error) {
      console.error('❌ Error creating client folder structure:', error);
      throw error;
    }
  }

  async setFolderPermissions(folderId, permissions) {
    try {
      this.initializeApi();
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
      this.initializeApi();
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
      this.initializeApi();
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
      this.initializeApi();
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
      this.initializeApi();
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