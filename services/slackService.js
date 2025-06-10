const { WebClient } = require('@slack/web-api');
require('dotenv').config();

class SlackService {
  constructor() {
    this.slack = new WebClient(process.env.SLACK_BOT_TOKEN);
    this.channel = process.env.SLACK_CHANNEL || '#leads';
  }

  async sendLeadNotification(clientData, documentLink, folderLink) {
    try {
      if (!process.env.SLACK_BOT_TOKEN) {
        console.log('Slack bot token not configured, skipping Slack notification');
        return null;
      }

      const message = this.formatLeadMessage(clientData, documentLink, folderLink);
      
      const result = await this.slack.chat.postMessage({
        channel: this.channel,
        blocks: message.blocks,
        text: message.fallbackText
      });

      console.log(`Slack notification sent to ${this.channel}: ${result.ts}`);
      return result;
    } catch (error) {
      console.error('Error sending Slack notification:', error);
      throw error;
    }
  }

  formatLeadMessage(clientData, documentLink, folderLink) {
    const fallbackText = `🚀 New Phase 1 Lead: ${clientData.business_legal_name || 'New Client'}`;
    
    const blocks = [
      {
        type: "header",
        text: {
          type: "plain_text",
          text: "🚀 New Phase 1 Lead Generated"
        }
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*${clientData.business_legal_name || 'New Client'}*\n\nA new personalized intake packet has been generated and filed.`
        }
      },
      {
        type: "section",
        fields: [
          {
            type: "mrkdwn",
            text: `*Business Name:*\n${clientData.business_legal_name || 'Not provided'}`
          },
          {
            type: "mrkdwn",
            text: `*Contact Email:*\n${clientData.contact_email || 'Not provided'}`
          },
          {
            type: "mrkdwn",
            text: `*Project Type:*\n${clientData.project_type || 'Not specified'}`
          },
          {
            type: "mrkdwn",
            text: `*Submission Time:*\n${new Date().toLocaleString()}`
          }
        ]
      }
    ];

    // Add action buttons if links are available
    if (documentLink || folderLink) {
      const elements = [];
      
      if (documentLink) {
        elements.push({
          type: "button",
          text: {
            type: "plain_text",
            text: "📄 View Document"
          },
          url: documentLink,
          style: "primary"
        });
      }
      
      if (folderLink) {
        elements.push({
          type: "button",
          text: {
            type: "plain_text",
            text: "📁 Open Folder"
          },
          url: folderLink
        });
      }

      blocks.push({
        type: "actions",
        elements: elements
      });
    }

    // Add status section
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: "*Automated Actions Completed:*\n✅ Client folder structure created\n✅ Personalized intake packet generated\n✅ Welcome email sent to client\n✅ Folder permissions configured"
      }
    });

    blocks.push({
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: "Ready for review and MNDA signature request."
        }
      ]
    });

    return {
      blocks: blocks,
      fallbackText: fallbackText
    };
  }

  async sendCustomMessage(channel, message) {
    try {
      if (!process.env.SLACK_BOT_TOKEN) {
        console.log('Slack bot token not configured, skipping custom message');
        return null;
      }

      const result = await this.slack.chat.postMessage({
        channel: channel || this.channel,
        text: message
      });

      console.log(`Custom Slack message sent to ${channel || this.channel}: ${result.ts}`);
      return result;
    } catch (error) {
      console.error('Error sending custom Slack message:', error);
      throw error;
    }
  }

  async testConnection() {
    try {
      if (!process.env.SLACK_BOT_TOKEN) {
        console.log('Slack bot token not configured');
        return false;
      }

      const result = await this.slack.auth.test();
      console.log('Slack connection verified:', result.user);
      return true;
    } catch (error) {
      console.error('Slack connection failed:', error);
      return false;
    }
  }

  async getChannelInfo(channelName) {
    try {
      const result = await this.slack.conversations.list({
        types: 'public_channel,private_channel'
      });

      const channel = result.channels.find(ch => 
        ch.name === channelName.replace('#', '') || ch.id === channelName
      );

      return channel;
    } catch (error) {
      console.error('Error getting channel info:', error);
      throw error;
    }
  }
}

module.exports = SlackService;