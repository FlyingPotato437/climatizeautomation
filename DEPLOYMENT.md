# Deployment Guide

This guide covers deploying the Climatize.earth Term Sheet Automation system to various platforms.

## 🚀 Deployment Options

### 1. Heroku (Recommended for Quick Setup)

1. **Prepare for Heroku**:
   ```bash
   # Install Heroku CLI
   npm install -g heroku
   
   # Login to Heroku
   heroku login
   ```

2. **Create Heroku App**:
   ```bash
   heroku create climatize-automation
   ```

3. **Set Environment Variables**:
   ```bash
   heroku config:set GOOGLE_CLIENT_ID=your_client_id
   heroku config:set GOOGLE_CLIENT_SECRET=your_client_secret
   heroku config:set GOOGLE_REFRESH_TOKEN=your_refresh_token
   heroku config:set MASTER_TEMPLATE_ID=your_template_id
   heroku config:set LEADS_PHASE1_FOLDER_ID=your_folder_id
   heroku config:set SMTP_USER=projects@climatize.earth
   heroku config:set SMTP_PASS=your_app_password
   heroku config:set SLACK_BOT_TOKEN=your_slack_token
   heroku config:set FILLOUT_WEBHOOK_SECRET=your_webhook_secret
   # ... add all other environment variables
   ```

4. **Deploy**:
   ```bash
   git add .
   git commit -m "Initial deployment"
   git push heroku main
   ```

5. **Set up Webhook**:
   - Update Fillout webhook URL to: `https://your-app-name.herokuapp.com/webhook/fillout`

### 2. AWS Lambda + API Gateway

1. **Install Serverless Framework**:
   ```bash
   npm install -g serverless
   npm install serverless-offline
   ```

2. **Create serverless.yml**:
   ```yaml
   service: climatize-automation
   
   provider:
     name: aws
     runtime: nodejs18.x
     region: us-east-1
     environment:
       GOOGLE_CLIENT_ID: ${env:GOOGLE_CLIENT_ID}
       GOOGLE_CLIENT_SECRET: ${env:GOOGLE_CLIENT_SECRET}
       # ... other environment variables
   
   functions:
     webhook:
       handler: lambda.webhook
       events:
         - http:
             path: webhook/fillout
             method: post
             cors: true
   ```

3. **Create Lambda Handler** (lambda.js):
   ```javascript
   const serverless = require('serverless-http');
   const app = require('./server');
   
   module.exports.webhook = serverless(app);
   ```

4. **Deploy**:
   ```bash
   serverless deploy
   ```

### 3. Google Cloud Run

1. **Create Dockerfile**:
   ```dockerfile
   FROM node:18-alpine
   
   WORKDIR /app
   COPY package*.json ./
   RUN npm ci --only=production
   COPY . .
   
   EXPOSE 8080
   CMD ["npm", "start"]
   ```

2. **Update package.json**:
   ```json
   {
     "scripts": {
       "start": "PORT=${PORT:-8080} node server.js"
     }
   }
   ```

3. **Deploy to Cloud Run**:
   ```bash
   gcloud run deploy climatize-automation \
     --source . \
     --platform managed \
     --region us-central1 \
     --allow-unauthenticated
   ```

### 4. DigitalOcean App Platform

1. **Create app.yaml**:
   ```yaml
   name: climatize-automation
   services:
   - name: api
     source_dir: /
     github:
       repo: your-username/climatize-automation
       branch: main
     run_command: npm start
     environment_slug: node-js
     instance_count: 1
     instance_size_slug: basic-xxs
     envs:
     - key: GOOGLE_CLIENT_ID
       value: your_client_id
     # ... other environment variables
   ```

2. **Deploy**:
   ```bash
   doctl apps create --spec app.yaml
   ```

### 5. VPS/Dedicated Server

1. **Server Setup** (Ubuntu/Debian):
   ```bash
   # Update system
   sudo apt update && sudo apt upgrade -y
   
   # Install Node.js
   curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
   sudo apt-get install -y nodejs
   
   # Install PM2 for process management
   sudo npm install -g pm2
   
   # Install Nginx for reverse proxy
   sudo apt install nginx
   ```

2. **Deploy Application**:
   ```bash
   # Clone repository
   git clone https://github.com/your-org/climatize-automation.git
   cd climatize-automation
   
   # Install dependencies
   npm install
   
   # Create .env file with production values
   cp .env.example .env
   # Edit .env with production credentials
   
   # Start with PM2
   pm2 start server.js --name "climatize-automation"
   pm2 save
   pm2 startup
   ```

3. **Configure Nginx**:
   ```nginx
   server {
       listen 80;
       server_name yourdomain.com;
       
       location / {
           proxy_pass http://localhost:3000;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
           proxy_set_header X-Forwarded-Proto $scheme;
           proxy_cache_bypass $http_upgrade;
       }
   }
   ```

4. **SSL Setup with Let's Encrypt**:
   ```bash
   sudo apt install certbot python3-certbot-nginx
   sudo certbot --nginx -d yourdomain.com
   ```

## 🔧 Environment Variables for Production

### Required Variables
```env
GOOGLE_CLIENT_ID=your_production_client_id
GOOGLE_CLIENT_SECRET=your_production_client_secret
GOOGLE_REFRESH_TOKEN=your_production_refresh_token
MASTER_TEMPLATE_ID=your_template_document_id
LEADS_PHASE1_FOLDER_ID=your_parent_folder_id

SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=projects@climatize.earth
SMTP_PASS=your_production_app_password

FILLOUT_WEBHOOK_SECRET=your_production_webhook_secret

JIM_EMAIL=jim@climatize.earth
ALBA_EMAIL=alba@climatize.earth
PROJECTS_EMAIL=projects@climatize.earth

CALENDAR_LINK=https://calendly.com/your-production-link
```

### Optional Variables
```env
SLACK_BOT_TOKEN=xoxb-your-production-slack-token
SLACK_CHANNEL=#leads

PORT=3000  # Or 8080 for Cloud Run
NODE_ENV=production
```

## 🔐 Security Considerations

### 1. Environment Variables
- Never commit .env files to version control
- Use platform-specific secret management
- Rotate API keys regularly

### 2. HTTPS Setup
- Always use HTTPS in production
- Configure proper SSL certificates
- Use HSTS headers

### 3. Access Control
- Limit Google Drive permissions to minimum required
- Use service accounts for Google API access
- Implement rate limiting for webhooks

### 4. Monitoring
- Set up health check endpoints
- Monitor error rates and response times
- Configure alerting for failures

## 📊 Production Monitoring

### Health Checks
```bash
# Basic health check
curl https://yourdomain.com/health

# Service connectivity test
curl https://yourdomain.com/test
```

### Logging
- Configure structured logging
- Set up log aggregation (ELK stack, etc.)
- Monitor for error patterns

### Metrics
- Track webhook success/failure rates
- Monitor document generation times
- Watch email delivery rates

## 🔄 Backup and Recovery

### Google Drive Backup
- Regular backup of master template
- Document folder structure snapshots
- API usage monitoring

### Database Backup (if applicable)
- Regular exports of form submission data
- Configuration backup
- Disaster recovery procedures

## 🚀 Performance Optimization

### 1. Caching
- Implement Redis for API response caching
- Cache Google API tokens
- Use CDN for static assets

### 2. Queue Management
- Use job queues for heavy operations
- Implement retry logic for failed operations
- Rate limit API calls

### 3. Scaling
- Horizontal scaling with load balancers
- Database read replicas
- Regional deployments

## 📋 Deployment Checklist

- [ ] Environment variables configured
- [ ] Google API credentials set up
- [ ] Master template created and ID noted
- [ ] Google Drive folder structure ready
- [ ] Email SMTP configuration tested
- [ ] Slack integration configured (optional)
- [ ] Fillout webhook URL updated
- [ ] SSL certificate installed
- [ ] Health checks passing
- [ ] Error monitoring set up
- [ ] Backup procedures implemented
- [ ] Team access configured
- [ ] Documentation updated

## 🆘 Troubleshooting

### Common Deployment Issues

1. **Google API Errors**:
   - Verify API quotas
   - Check service account permissions
   - Validate OAuth scopes

2. **Webhook Failures**:
   - Test webhook endpoint accessibility
   - Verify signature validation
   - Check request/response formats

3. **Email Delivery Issues**:
   - Validate SMTP credentials
   - Check spam folder configurations
   - Monitor delivery rates

4. **Performance Issues**:
   - Monitor response times
   - Check memory usage
   - Optimize API call patterns

### Debug Commands
```bash
# Check service health
curl https://yourdomain.com/health

# Test webhook manually
curl -X POST https://yourdomain.com/webhook/test \
  -H "Content-Type: application/json" \
  -d '{"business_legal_name":"Test Co","contact_email":"test@example.com"}'

# View logs (PM2)
pm2 logs climatize-automation

# Restart service (PM2)
pm2 restart climatize-automation
```