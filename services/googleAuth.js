const { google } = require('googleapis');
require('dotenv').config();

class GoogleAuthService {
  constructor() {
    console.log('Google OAuth Config Debug:', {
      clientId: process.env.GOOGLE_CLIENT_ID || 'UNDEFINED',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || 'UNDEFINED', 
      redirectUri: process.env.GOOGLE_REDIRECT_URI || 'UNDEFINED'
    });
    
    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET || !process.env.GOOGLE_REDIRECT_URI) {
      throw new Error('Missing required Google OAuth environment variables');
    }
    
    this.oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );

    // Set refresh token if available
    if (process.env.GOOGLE_REFRESH_TOKEN) {
      this.oauth2Client.setCredentials({
        refresh_token: process.env.GOOGLE_REFRESH_TOKEN
      });
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