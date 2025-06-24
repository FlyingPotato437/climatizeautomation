#!/usr/bin/env node

/**
 * Verify the complete folder structure for the user
 */

require('dotenv').config();
const GoogleDriveService = require('./services/googleDrive');

async function verifyStructure() {
  try {
    console.log('🔍 VERIFYING COMPLETE FOLDER STRUCTURE');
    console.log('=====================================');
    
    const driveService = new GoogleDriveService();
    await driveService.initializeApi();
    await driveService.authService.ensureValidToken();
    
    const parentFolderId = process.env.LEADS_PHASE1_FOLDER_ID;
    console.log(`📂 Parent: Leads Phase 1 folder`);
    console.log(`🔗 https://drive.google.com/drive/folders/${parentFolderId}`);
    
    // Get contents of parent folder
    const parentContents = await driveService.listFiles(parentFolderId);
    console.log(`\n📁 Found ${parentContents.length} client folders in Leads Phase 1:`);
    
    // Find the most recent folder (should be our test)
    const recentFolder = parentContents[0]; // Most recent should be first
    console.log(`\n🎯 Most Recent: ${recentFolder.name}`);
    console.log(`🔗 ${recentFolder.webViewLink}`);
    
    // Get subfolders
    const subfolders = await driveService.listFiles(recentFolder.id);
    console.log(`\n📂 Subfolders in ${recentFolder.name}:`);
    
    let internalFolderId = null;
    subfolders.forEach(folder => {
      console.log(`   📁 ${folder.name} - ${folder.webViewLink}`);
      if (folder.name === 'Internal') {
        internalFolderId = folder.id;
      }
    });
    
    // Get documents in Internal folder
    if (internalFolderId) {
      const documents = await driveService.listFiles(internalFolderId);
      console.log(`\n📄 Documents in Internal folder (${documents.length} total):`);
      documents.forEach((doc, index) => {
        console.log(`   ${index + 1}. ${doc.name}`);
        console.log(`      🔗 ${doc.webViewLink}`);
      });
    }
    
    console.log('\n✅ STRUCTURE VERIFICATION COMPLETE!');
    console.log('\n🗺️  NAVIGATION PATH:');
    console.log('1. Go to Leads Phase 1 folder');
    console.log('2. Find your company folder (most recent)');
    console.log('3. Open Internal subfolder'); 
    console.log('4. All your documents are there!');
    
  } catch (error) {
    console.error('❌ Verification failed:', error);
  }
}

if (require.main === module) {
  verifyStructure();
}

module.exports = verifyStructure;