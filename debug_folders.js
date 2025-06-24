#!/usr/bin/env node

/**
 * Debug script to help find Google Drive folders and documents
 * Run this script to see where your documents are being created
 */

require('dotenv').config();
const GoogleDriveService = require('./services/googleDrive');

async function debugFolders() {
  try {
    console.log('🔍 DEBUGGING GOOGLE DRIVE SETUP');
    console.log('================================');
    
    const driveService = new GoogleDriveService();
    await driveService.initializeApi();
    await driveService.authService.ensureValidToken();
    
    // Check environment variables
    console.log('\n📋 Environment Variables:');
    console.log(`LEADS_PHASE1_FOLDER_ID: ${process.env.LEADS_PHASE1_FOLDER_ID || '❌ NOT SET'}`);
    
    if (!process.env.LEADS_PHASE1_FOLDER_ID) {
      console.log('\n⚠️  WARNING: LEADS_PHASE1_FOLDER_ID is not set!');
      console.log('   Documents will be created in the root of your Google Drive.');
      console.log('   To organize them properly, set this environment variable.');
    }
    
    // List recent files
    console.log('\n📄 Recent files in your Google Drive (last 10):');
    const recentFiles = await driveService.drive.files.list({
      orderBy: 'createdTime desc',
      pageSize: 10,
      fields: 'files(id, name, mimeType, webViewLink, createdTime, parents)'
    });
    
    recentFiles.data.files.forEach((file, index) => {
      const type = file.mimeType.includes('folder') ? '📁' : '📄';
      const date = new Date(file.createdTime).toLocaleString();
      console.log(`${index + 1}. ${type} ${file.name}`);
      console.log(`   🔗 ${file.webViewLink}`);
      console.log(`   📅 Created: ${date}`);
      console.log('');
    });
    
    // If LEADS_PHASE1_FOLDER_ID is set, check if it exists
    if (process.env.LEADS_PHASE1_FOLDER_ID) {
      try {
        console.log('\n🔍 Checking configured parent folder...');
        const folderInfo = await driveService.getFileInfo(process.env.LEADS_PHASE1_FOLDER_ID);
        console.log(`✅ Parent folder found: ${folderInfo.name}`);
        console.log(`🔗 ${folderInfo.webViewLink}`);
        
        // List contents of the parent folder
        console.log('\n📁 Contents of parent folder:');
        const contents = await driveService.listFiles(process.env.LEADS_PHASE1_FOLDER_ID);
        if (contents.length === 0) {
          console.log('   (Empty)');
        } else {
          contents.forEach((file, index) => {
            const type = file.mimeType.includes('folder') ? '📁' : '📄';
            console.log(`${index + 1}. ${type} ${file.name}`);
            console.log(`   🔗 ${file.webViewLink}`);
          });
        }
      } catch (error) {
        console.log(`❌ Error accessing parent folder: ${error.message}`);
        console.log('   The folder ID may be incorrect or you may not have access.');
      }
    }
    
    console.log('\n✅ Debug complete!');
    console.log('\nNext steps:');
    console.log('1. Run a test webhook to create documents');
    console.log('2. Check the links that will be logged in the console');
    console.log('3. The documents should appear in the locations shown above');
    
  } catch (error) {
    console.error('❌ Debug failed:', error);
  }
}

if (require.main === module) {
  debugFolders();
}

module.exports = debugFolders;