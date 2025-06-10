# Climatize.earth Term Sheet Automation

A comprehensive automation system that processes Fillout form submissions to generate personalized client intake packets, create Google Drive folder structures, and notify the team.

## 🚀 Features

- **Automated Document Generation**: Creates personalized intake packets from Google Doc templates
- **Dynamic Folder Structure**: Automatically creates organized client folders with proper permissions
- **Multiple Term Sheet Types**: Supports Solar, Carbon Capture, Construction, Bridge Financing, Working Capital, and Pre-Development projects
- **Email Notifications**: Sends welcome emails to clients and alerts to the team
- **Slack Integration**: Posts notifications to team channels
- **Webhook Security**: Verifies Fillout webhook signatures for security
- **Comprehensive API**: RESTful endpoints for testing and manual triggers

## 📋 Prerequisites

1. **Google Cloud Console Setup**:
   - Create a Google Cloud project
   - Enable Google Drive API, Google Docs API, and Gmail API
   - Create OAuth 2.0 credentials
   - Set up service account (optional but recommended)

2. **Google Drive Setup**:
   - Create a "Leads Phase 1" folder in Google Drive
   - Create a master Google Doc template with placeholders
   - Note down the folder and template IDs

3. **Email Configuration**:
   - Gmail account with App Password enabled
   - SMTP credentials

4. **Fillout Account**:
   - Form configured with webhook
   - Webhook secret for security

5. **Slack Integration** (Optional):
   - Slack app with bot token
   - Channel for notifications

## 🛠️ Installation

1. **Clone and Install**:
   ```bash
   cd TermSheetAutomation
   npm install
   ```

2. **Environment Configuration**:
   ```bash
   cp .env.example .env
   # Edit .env with your actual credentials
   ```

3. **Google Authentication**:
   ```bash
   npm start
   # Visit http://localhost:3000/auth/google to authenticate
   ```

## ⚙️ Configuration

### Environment Variables

```env
# Google API Configuration
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_REDIRECT_URI=http://localhost:3000/auth/google/callback
GOOGLE_REFRESH_TOKEN=your_refresh_token

# Google Drive Configuration
MASTER_TEMPLATE_ID=your_master_google_doc_template_id
LEADS_PHASE1_FOLDER_ID=your_leads_phase1_folder_id

# Email Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=projects@climatize.earth
SMTP_PASS=your_app_password

# Slack Configuration (Optional)
SLACK_BOT_TOKEN=xoxb-your-slack-bot-token
SLACK_CHANNEL=#leads

# Fillout Configuration
FILLOUT_WEBHOOK_SECRET=your_fillout_webhook_secret

# Team Email Addresses
JIM_EMAIL=jim@climatize.earth
ALBA_EMAIL=alba@climatize.earth
PROJECTS_EMAIL=projects@climatize.earth

# Calendar Link
CALENDAR_LINK=https://calendly.com/your-calendar-link
```

### Master Template Placeholders

Your Google Doc template should include these placeholders:

**Basic Information**:
- `{{business_legal_name}}`
- `{{contact_email}}`
- `{{contact_name}}`
- `{{project_type}}`
- `{{form_id}}`

**Project Details**:
- `{{project_description}}`
- `{{project_location}}`
- `{{estimated_investment}}`
- `{{timeline}}`

**Term Sheet Content**:
- `{{term_sheet_content}}` (dynamically filled based on project type)

## 🎯 Supported Project Types

1. **Solar Energy Projects**
2. **Carbon Capture & Storage**
3. **Sustainable Construction**
4. **Bridge Financing**
5. **Working Capital**
6. **Pre-Development Financing**

Each project type has its own customized term sheet template with relevant fields and conditions.

## 🔧 API Endpoints

### Webhook Endpoints
- `POST /webhook/fillout` - Main Fillout webhook handler
- `POST /webhook/test` - Manual testing endpoint

### Authentication
- `GET /auth/google` - Google OAuth initiation
- `GET /auth/google/callback` - OAuth callback

### Utilities
- `GET /health` - Health check and service status
- `GET /test` - Service connectivity tests
- `GET /` - API information

## 🚀 Usage

### Production Deployment

1. **Start the Server**:
   ```bash
   npm start
   ```

2. **Configure Fillout Webhook**:
   - Point your Fillout form webhook to: `https://yourdomain.com/webhook/fillout`
   - Set webhook secret in environment variables

3. **Test the Integration**:
   ```bash
   curl -X POST http://localhost:3000/webhook/test \
     -H "Content-Type: application/json" \
     -d '{
       "business_legal_name": "Test Company Inc.",
       "contact_email": "test@example.com",
       "project_type": "solar"
     }'
   ```

### Development

1. **Start Development Server**:
   ```bash
   npm run dev
   ```

2. **Test Services**:
   ```bash
   curl http://localhost:3000/test
   ```

## 📁 Folder Structure

```
TermSheetAutomation/
├── config/
│   └── termSheets.js          # Term sheet templates
├── services/
│   ├── googleAuth.js          # Google OAuth handling
│   ├── googleDrive.js         # Drive folder operations
│   ├── googleDocs.js          # Document generation
│   ├── emailService.js        # Email notifications
│   ├── slackService.js        # Slack integration
│   └── automationService.js   # Main orchestration
├── server.js                  # Express server
├── package.json
├── .env.example
└── README.md
```

## 🔄 Automation Workflow

1. **Form Submission**: Client submits Fillout form
2. **Webhook Trigger**: Fillout sends webhook to `/webhook/fillout`
3. **Folder Creation**: Creates client folder structure in Google Drive
4. **Document Generation**: Generates personalized intake packet from template
5. **Permission Setting**: Configures folder access for team and client
6. **Email Notifications**: Sends welcome email to client
7. **Team Alerts**: Notifies team via email and Slack
8. **Completion**: Returns success response with links

## 🔐 Security Features

- **Webhook Signature Verification**: Validates Fillout webhook authenticity
- **OAuth 2.0 Authentication**: Secure Google API access
- **Environment Variable Protection**: Sensitive data in environment variables
- **Permission Management**: Granular Google Drive access controls

## 🧪 Testing

### Manual Testing
```bash
# Test specific client
curl -X POST http://localhost:3000/webhook/test \
  -H "Content-Type: application/json" \
  -d '{
    "business_legal_name": "Green Energy Solutions LLC",
    "contact_email": "john@greenenergy.com",
    "contact_name": "John Smith",
    "project_type": "solar",
    "project_capacity": "5 MW",
    "estimated_investment": "$2,000,000"
  }'
```

### Service Health Check
```bash
curl http://localhost:3000/health
```

## 🚨 Troubleshooting

### Common Issues

1. **Google Authentication Errors**:
   - Verify OAuth credentials in Google Cloud Console
   - Check redirect URI matches exactly
   - Ensure APIs are enabled

2. **Template Not Found**:
   - Verify `MASTER_TEMPLATE_ID` is correct
   - Check template permissions for service account

3. **Email Delivery Issues**:
   - Verify Gmail App Password is correct
   - Check SMTP configuration
   - Ensure less secure apps or App Passwords are enabled

4. **Slack Notifications Failing**:
   - Verify bot token has correct permissions
   - Check channel exists and bot is invited

### Debugging
```bash
# Check service connectivity
curl http://localhost:3000/test

# View server logs
npm start # Check console output for detailed error messages
```

## 📈 Monitoring

The system provides comprehensive logging and health monitoring:

- **Health Endpoint**: Real-time service status
- **Error Logging**: Detailed error messages and stack traces
- **Success Notifications**: Confirmation of completed operations
- **Service Tests**: Automated connectivity verification

## 🤝 Support

For technical support or questions:
- Review server logs for detailed error information
- Check environment variable configuration
- Verify Google API quotas and permissions
- Test individual services using `/test` endpoint

## 📄 License

This project is proprietary to Climatize.earth.