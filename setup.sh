#!/bin/bash

# Climatize.earth Term Sheet Automation Setup Script
# This script helps set up the automation system

echo "🌍 Climatize.earth Term Sheet Automation Setup"
echo "============================================="

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js first."
    exit 1
fi

echo "✅ Node.js version: $(node --version)"

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed. Please install npm first."
    exit 1
fi

echo "✅ npm version: $(npm --version)"

# Install dependencies
echo ""
echo "📦 Installing dependencies..."
npm install

# Create .env file if it doesn't exist
if [ ! -f .env ]; then
    echo ""
    echo "⚙️  Creating environment configuration file..."
    cp .env.example .env
    echo "✅ Created .env file from template"
    echo "⚠️  Please edit .env file with your actual credentials before running the server"
else
    echo "✅ .env file already exists"
fi

# Create logs directory
if [ ! -d logs ]; then
    mkdir logs
    echo "✅ Created logs directory"
fi

# Set execute permissions for scripts
chmod +x setup.sh

echo ""
echo "🎉 Setup completed successfully!"
echo ""
echo "Next steps:"
echo "1. Edit the .env file with your actual credentials:"
echo "   - Google API credentials"
echo "   - Email configuration"
echo "   - Slack bot token (optional)"
echo "   - Fillout webhook secret"
echo ""
echo "2. Set up Google Cloud Console:"
echo "   - Enable Google Drive API, Google Docs API, and Gmail API"
echo "   - Create OAuth 2.0 credentials"
echo "   - Get your refresh token by visiting /auth/google"
echo ""
echo "3. Prepare your Google Drive:"
echo "   - Create 'Leads Phase 1' folder"
echo "   - Create master template document"
echo "   - Note down the IDs and add them to .env"
echo ""
echo "4. Start the server:"
echo "   npm start"
echo ""
echo "5. Test the setup:"
echo "   curl http://localhost:3000/health"
echo ""
echo "📖 For detailed instructions, see README.md"