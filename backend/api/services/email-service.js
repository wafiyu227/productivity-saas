// FIXED: backend/services/email-service.js
// Replace your entire email-service.js with this

import { Resend } from 'resend';
import 'dotenv/config';
import logger from '../utils/logger.js';

const resend = new Resend(process.env.RESEND_API_KEY);
const FRONTEND_URL = process.env.FRONTEND_URL || 'https://productivity-saas-frontend.vercel.app';

class EmailService {
  constructor() {
    // ✅ FIX: Use Resend's test domain until you verify your custom domain
    // Change to 'Teama AI <noreply@teama.ai>' after domain verification
    this.fromEmail = 'Teama AI <onboarding@resend.dev>';
  }

  async sendTeamInvitation(invitation, teamName, inviterName) {
    try {
      logger.info('Attempting to send invitation email', {
        to: invitation.email,
        teamName,
        inviterName,
        token: invitation.token?.substring(0, 10) + '...'
      });

      const inviteUrl = `${FRONTEND_URL}/join?token=${invitation.token}`;

      const { data, error } = await resend.emails.send({
        from: this.fromEmail,
        to: [invitation.email],
        subject: `You're invited to join ${teamName} on Teama AI`,
        html: this.getInvitationEmailTemplate(teamName, inviterName, inviteUrl, invitation.expires_at)
      });

      if (error) {
        logger.error('Resend API error:', error);
        throw error;
      }

      logger.info('✅ Invitation email sent successfully', {
        email: invitation.email,
        teamName,
        messageId: data?.id
      });

      return data;
    } catch (error) {
      logger.error('Failed to send invitation email:', {
        error: error.message,
        stack: error.stack,
        email: invitation.email
      });
      throw error;
    }
  }

  async sendWelcomeEmail(userEmail, userName, teamName) {
    try {
      logger.info('Sending welcome email', { userEmail, userName, teamName });

      const { data, error } = await resend.emails.send({
        from: this.fromEmail,
        to: [userEmail],
        subject: `Welcome to ${teamName}!`,
        html: this.getWelcomeEmailTemplate(userName, teamName)
      });

      if (error) {
        logger.error('Welcome email send error:', error);
        throw error;
      }

      logger.info('✅ Welcome email sent', { userEmail, messageId: data?.id });
      return data;
    } catch (error) {
      logger.error('Failed to send welcome email:', error);
      // Don't throw - welcome email is nice-to-have
    }
  }

  async sendDailyDigest(userEmail, summaries) {
    try {
      const { data, error } = await resend.emails.send({
        from: this.fromEmail,
        to: [userEmail],
        subject: `Daily Summary - ${new Date().toLocaleDateString()}`,
        html: this.generateDigestHTML(summaries)
      });

      if (error) throw error;
      return { success: true, messageId: data.id };
    } catch (error) {
      logger.error('Failed to send daily digest', { userEmail, error: error.message });
      return { success: false, error: error.message };
    }
  }

  getInvitationEmailTemplate(teamName, inviterName, inviteUrl, expiresAt) {
    const expiryDate = new Date(expiresAt).toLocaleDateString();

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { background: #f9fafb; padding: 30px; }
            .button { display: inline-block; background: #667eea; color: white; padding: 14px 32px; text-decoration: none; border-radius: 6px; font-weight: 600; margin: 20px 0; }
            .features { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
            .feature { margin: 10px 0; }
            .footer { text-align: center; color: #666; font-size: 12px; margin-top: 30px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>You're Invited to Join ${teamName}</h1>
            </div>
            <div class="content">
              <p>Hi there!</p>
              
              <p><strong>${inviterName}</strong> has invited you to join <strong>${teamName}</strong> on Teama AI.</p>
              
              <div class="features">
                <p><strong>With Teama AI, your team can:</strong></p>
                <div class="feature">✓ Get AI-powered Slack channel summaries</div>
                <div class="feature">✓ Track project health and team workload</div>
                <div class="feature">✓ Identify blockers automatically</div>
                <div class="feature">✓ Stay aligned with AI insights</div>
              </div>
              
              <p style="text-align: center;">
                <a href="${inviteUrl}" class="button">Accept Invitation & Join Team</a>
              </p>
              
              <p style="font-size: 14px; color: #666;">
                This invitation expires on <strong>${expiryDate}</strong>.
              </p>
              
              <p style="font-size: 14px; color: #666;">
                If you can't click the button, copy and paste this link into your browser:<br>
                <a href="${inviteUrl}">${inviteUrl}</a>
              </p>
            </div>
            <div class="footer">
              <p>Questions? Reply to this email or visit help.teama.ai</p>
              <p>© 2026 Teama AI. All rights reserved.</p>
            </div>
          </div>
        </body>
      </html>
    `;
  }

  getWelcomeEmailTemplate(userName, teamName) {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { background: #f9fafb; padding: 30px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Welcome to ${teamName}! 🎉</h1>
            </div>
            <div class="content">
              <p>Hi ${userName}!</p>
              <p>You've successfully joined <strong>${teamName}</strong> on Teama AI.</p>
              <p>Your team admin has already set up the workspace, so you're ready to start collaborating!</p>
              <p><a href="${FRONTEND_URL}/app" style="color: #667eea;">Go to Dashboard →</a></p>
            </div>
          </div>
        </body>
      </html>
    `;
  }

  generateDigestHTML(summaries) {
    const summariesHTML = summaries
      .map(s => `
        <div style="margin-bottom: 24px; padding: 16px; background-color: #f9fafb; border-radius: 8px; border-left: 4px solid #3b82f6;">
          <h3 style="margin: 0 0 8px 0; color: #111827; font-size: 16px; font-weight: 600;">
            #${s.channel_name}
          </h3>
          <p style="margin: 0 0 12px 0; color: #6b7280; font-size: 14px;">
            ${s.summary}
          </p>
          
          ${s.key_topics && s.key_topics.length > 0 ? `
            <div style="margin-bottom: 12px;">
              <p style="margin: 0 0 6px 0; color: #374151; font-size: 13px; font-weight: 600;">Key Topics:</p>
              <ul style="margin: 0; padding-left: 20px; color: #6b7280; font-size: 13px;">
                ${s.key_topics.map(t => `<li>${t}</li>`).join('')}
              </ul>
            </div>
          ` : ''}

          ${s.blockers && s.blockers.length > 0 ? `
            <div>
              <p style="margin: 0 0 6px 0; color: #dc2626; font-size: 13px; font-weight: 600;">⚠️ Blockers:</p>
              <ul style="margin: 0; padding-left: 20px; color: #6b7280; font-size: 13px;">
                ${s.blockers.map(b => `<li>${b}</li>`).join('')}
              </ul>
            </div>
          ` : ''}
        </div>
      `).join('');

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #111827; }
            a { color: #3b82f6; text-decoration: none; }
            a:hover { text-decoration: underline; }
          </style>
        </head>
        <body style="margin: 0; padding: 0; background-color: #f3f4f6;">
          <div style="max-width: 600px; margin: 0 auto; background-color: white; padding: 40px;">
            <h1 style="margin: 0 0 8px 0; color: #111827; font-size: 28px;">Daily Summary</h1>
            <p style="margin: 0 0 24px 0; color: #6b7280; font-size: 16px;">
              ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </p>

            ${summaries.length > 0 ? `
              <div style="margin-bottom: 32px;">
                <h2 style="margin: 0 0 16px 0; color: #111827; font-size: 20px;">Channel Discussions</h2>
                ${summariesHTML}
              </div>
            ` : `
              <p style="color: #6b7280; font-size: 14px;">No new summaries today.</p>
            `}

            <div style="border-top: 1px solid #e5e7eb; padding-top: 24px; margin-top: 32px;">
              <p style="margin: 0 0 8px 0; color: #6b7280; font-size: 12px;">
                <a href="${FRONTEND_URL}/app/summaries">View all summaries →</a>
              </p>
              <p style="margin: 0; color: #9ca3af; font-size: 11px;">
                Manage your notification preferences in <a href="${FRONTEND_URL}/app/profile">Settings</a>
              </p>
            </div>
          </div>
        </body>
      </html>
    `;
  }
}

export default new EmailService();