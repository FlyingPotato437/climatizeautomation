console.log('🔧 Testing server startup...');

try {
  console.log('1. Testing dotenv...');
  require('dotenv').config();
  console.log('✅ Dotenv loaded');
  
  console.log('2. Testing express...');
  const express = require('express');
  console.log('✅ Express loaded');
  
  console.log('3. Testing googleapis...');
  const { google } = require('googleapis');
  console.log('✅ Google APIs loaded');
  
  console.log('4. Testing env vars...');
  console.log('GOOGLE_CLIENT_ID:', process.env.GOOGLE_CLIENT_ID ? 'PRESENT' : 'MISSING');
  console.log('GOOGLE_CLIENT_SECRET:', process.env.GOOGLE_CLIENT_SECRET ? 'PRESENT' : 'MISSING');
  console.log('GOOGLE_REDIRECT_URI:', process.env.GOOGLE_REDIRECT_URI ? 'PRESENT' : 'MISSING');
  
  console.log('5. Testing OAuth2 creation...');
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
  console.log('✅ OAuth2 client created');
  
  console.log('6. Testing express app...');
  const app = express();
  const port = 3000;
  
  app.get('/', (req, res) => {
    res.json({ message: 'Test server working!' });
  });
  
  app.listen(port, () => {
    console.log(`🚀 Test server running on port ${port}`);
    console.log(`Visit: http://localhost:${port}`);
  });
  
} catch (error) {
  console.error('❌ Error:', error.message);
  console.error('Stack:', error.stack);
}