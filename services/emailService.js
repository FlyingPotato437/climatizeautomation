const nodemailer = require('nodemailer');
require('dotenv').config();

class EmailService {
  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT,
      secure: false, // true for 465, false for other ports
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });
  }

  async sendClientWelcomeEmail(clientData, documentLink) {
    try {
      const emailContent = this.generateClientWelcomeEmail(clientData, documentLink);
      
      const mailOptions = {
        from: `"Climatize.earth" <${process.env.SMTP_USER}>`,
        to: clientData.contact_email,
        subject: `Next Steps for ${clientData.business_legal_name}`,
        html: emailContent
      };

      const result = await this.transporter.sendMail(mailOptions);
      console.log(`Welcome email sent to ${clientData.contact_email}: ${result.messageId}`);
      return result;
    } catch (error) {
      console.error('Error sending client welcome email:', error);
      throw error;
    }
  }

  async sendTeamNotificationEmail(clientData, documentLink, folderLink) {
    try {
      const emailContent = this.generateTeamNotificationEmail(clientData, documentLink, folderLink);
      
      const recipients = [
        process.env.JIM_EMAIL,
        process.env.ALBA_EMAIL,
        process.env.PROJECTS_EMAIL
      ].filter(email => email); // Filter out undefined emails

      const mailOptions = {
        from: `"Climatize.earth Automation" <${process.env.SMTP_USER}>`,
        to: recipients.join(', '),
        subject: `🚀 New Phase 1 Lead: ${clientData.business_legal_name}`,
        html: emailContent
      };

      const result = await this.transporter.sendMail(mailOptions);
      console.log(`Team notification email sent: ${result.messageId}`);
      return result;
    } catch (error) {
      console.error('Error sending team notification email:', error);
      throw error;
    }
  }

  generateClientWelcomeEmail(clientData, documentLink) {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Welcome to Climatize.earth</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #2c5f2f; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background-color: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
        .button { display: inline-block; background-color: #4CAF50; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin: 15px 0; }
        .footer { text-align: center; margin-top: 30px; font-size: 12px; color: #666; }
        .highlight { background-color: #e8f5e8; padding: 15px; border-left: 4px solid #4CAF50; margin: 20px 0; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Welcome to Climatize.earth!</h1>
        </div>
        <div class="content">
            <h2>Hello ${clientData.business_legal_name || 'Valued Partner'},</h2>
            
            <p>Thank you for your interest in partnering with Climatize.earth for your sustainable development project. We're excited to begin this journey with you!</p>
            
            <div class="highlight">
                <strong>Next Steps:</strong>
                <ol>
                    <li>We're preparing your personalized intake packet, including the Mutual Non-Disclosure Agreement (MNDA)</li>
                    <li>Our team will review your project details and prepare initial recommendations</li>
                    <li>Schedule a follow-up consultation to discuss your project in detail</li>
                </ol>
            </div>

            <p>To move forward efficiently, please schedule a consultation with our team:</p>
            
            <div style="text-align: center;">
                <a href="${process.env.CALENDAR_LINK || '#'}" class="button">Schedule Consultation</a>
            </div>

            <p><strong>What to Expect:</strong></p>
            <ul>
                <li>Comprehensive project assessment</li>
                <li>Customized financing solutions</li>
                <li>Expert guidance through the development process</li>
                <li>Ongoing support from our experienced team</li>
            </ul>

            <p>If you have any immediate questions, please don't hesitate to reach out to us at <a href="mailto:${process.env.PROJECTS_EMAIL}">${process.env.PROJECTS_EMAIL}</a>.</p>

            <p>We look forward to helping you bring your sustainable project to life!</p>

            <p>Best regards,<br>
            <strong>The Climatize.earth Team</strong></p>
        </div>
        <div class="footer">
            <p>This email was sent by Climatize.earth's automated system.<br>
            If you have any questions, please contact us at ${process.env.PROJECTS_EMAIL}</p>
        </div>
    </div>
</body>
</html>
    `;
  }

  generateTeamNotificationEmail(clientData, documentLink, folderLink) {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>New Phase 1 Lead</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #1e3d5f; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background-color: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
        .button { display: inline-block; background-color: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; margin: 10px 5px; }
        .client-info { background-color: white; padding: 20px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #007bff; }
        .actions { background-color: #e8f4fd; padding: 20px; border-radius: 5px; margin: 20px 0; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🚀 New Phase 1 Lead</h1>
            <h2>${clientData.business_legal_name || 'New Client'}</h2>
        </div>
        <div class="content">
            <p>A new lead has been automatically processed and is ready for review!</p>

            <div class="client-info">
                <h3>Client Information:</h3>
                <p><strong>Business Name:</strong> ${clientData.business_legal_name || 'Not provided'}</p>
                <p><strong>Contact Email:</strong> ${clientData.contact_email || 'Not provided'}</p>
                <p><strong>Project Type:</strong> ${clientData.project_type || 'Not specified'}</p>
                <p><strong>Form Submission ID:</strong> ${clientData.form_id || 'Not available'}</p>
                <p><strong>Submission Time:</strong> ${new Date().toLocaleString()}</p>
            </div>

            <div class="actions">
                <h3>Quick Actions:</h3>
                <div style="text-align: center;">
                    ${documentLink ? `<a href="${documentLink}" class="button">View Intake Document</a>` : ''}
                    ${folderLink ? `<a href="${folderLink}" class="button">Open Client Folder</a>` : ''}
                </div>
            </div>

            <h3>Automated Actions Completed:</h3>
            <ul>
                <li>✅ Client folder structure created</li>
                <li>✅ Personalized intake packet generated</li>
                <li>✅ Welcome email sent to client</li>
                <li>✅ Folder permissions configured</li>
            </ul>

            <h3>Next Steps:</h3>
            <ol>
                <li>Review the generated intake packet</li>
                <li>Verify client information accuracy</li>
                <li>Prepare MNDA for client signature</li>
                <li>Schedule follow-up consultation</li>
            </ol>

            <p><strong>Note:</strong> The client has been sent a welcome email with next steps and calendar scheduling link.</p>
        </div>
    </div>
</body>
</html>
    `;
  }

  async testConnection() {
    try {
      await this.transporter.verify();
      console.log('Email service connection verified');
      return true;
    } catch (error) {
      console.error('Email service connection failed:', error);
      return false;
    }
  }
}

module.exports = EmailService;