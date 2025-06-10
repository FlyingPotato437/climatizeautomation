const { google } = require('googleapis');
require('dotenv').config();

// Simple fallback to environment variables for now
function getConfig(key, fallback) {
  return fallback;
}

class GoogleAuthService {
  constructor() {
    console.log('Google OAuth Config Debug:', {
      clientId: process.env.GOOGLE_CLIENT_ID ? `${process.env.GOOGLE_CLIENT_ID.substring(0, 20)}...` : 'UNDEFINED',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ? 'PRESENT' : 'UNDEFINED', 
      redirectUri: process.env.GOOGLE_REDIRECT_URI || 'UNDEFINED'
    });
    
    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET || !process.env.GOOGLE_REDIRECT_URI) {
      throw new Error('Missing required Google OAuth configuration');
    }
    
    this.oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );

    // Set refresh token if available and valid
    if (process.env.GOOGLE_REFRESH_TOKEN && process.env.GOOGLE_REFRESH_TOKEN !== 'DISABLED') {
      console.log('Setting refresh token...');
      this.oauth2Client.setCredentials({
        refresh_token: process.env.GOOGLE_REFRESH_TOKEN
      });
    } else {
      console.log('No refresh token configured - OAuth flow required');
    }
  }

  getAuthUrl() {
    const scopes = [
      'https://www.googleapis.com/auth/drive',
      'https://www.googleapis.com/auth/documents',
      'https://www.googleapis.com/auth/gmail.send'
    ];

    return this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      prompt: 'consent'
    });
  }

  async getTokens(code) {
    try {
      const { tokens } = await this.oauth2Client.getToken(code);
      this.oauth2Client.setCredentials(tokens);
      return tokens;
    } catch (error) {
      console.error('Error getting tokens:', error);
      throw error;
    }
  }

  async refreshAccessToken() {
    try {
      const { credentials } = await this.oauth2Client.refreshAccessToken();
      this.oauth2Client.setCredentials(credentials);
      return credentials;
    } catch (error) {
      console.error('Error refreshing token:', error);
      throw error;
    }
  }

  getAuth() {
    return this.oauth2Client;
  }

  async ensureValidToken() {
    try {
      // Check if we have a valid access token
      const tokenInfo = await this.oauth2Client.getAccessToken();
      if (!tokenInfo.token) {
        await this.refreshAccessToken();
      }
      return true;
    } catch (error) {
      console.error('Error ensuring valid token:', error);
      return false;
    }
  }
}

module.exports = GoogleAuthService;