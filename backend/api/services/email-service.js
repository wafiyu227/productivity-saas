import { Resend } from 'resend';
import 'dotenv/config';
import logger from '../utils/logger.js';

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const RESEND_FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'Teama AI <onboarding@resend.dev>';
const resend = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null;
const FRONTEND_URL = process.env.FRONTEND_URL || 'https://teamaai.xyz';

class EmailService {
  constructor() {
    // ✅ VERIFIED: Custom domain verified at Resend
    this.fromEmail = RESEND_FROM_EMAIL;
  }

  ensureResendConfigured() {
    if (!resend) {
      throw new Error('RESEND_API_KEY is not configured');
    }
  }

  async sendTeamInvitation(invitation, teamName, inviterName) {
    try {
      this.ensureResendConfigured();

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
      this.ensureResendConfigured();

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
      this.ensureResendConfigured();

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

  async sendWaitlistWelcome(email, name, position) {
  try {
    this.ensureResendConfigured();

    logger.info('Sending waitlist welcome email', { email, position });

    const { data, error } = await resend.emails.send({
      from: this.fromEmail,
      to: [email],
      subject: "You're on the Teama AI Waitlist! 🎉",
      html: this.getWaitlistEmailTemplate(name, position)
    });

    if (error) {
      logger.error('Waitlist email error:', error);
      throw error;
    }

    logger.info('✅ Waitlist email sent', { email, messageId: data?.id });
    return data;
  } catch (error) {
    logger.error('Failed to send waitlist email:', error);
    throw error;
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
  getWaitlistEmailTemplate(name, position) {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
            line-height: 1.6; 
            color: #333; 
            margin: 0;
            padding: 0;
          }
          .container { 
            max-width: 600px; 
            margin: 0 auto; 
            padding: 20px; 
          }
          .header { 
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
            color: white; 
            padding: 40px 30px; 
            text-align: center; 
            border-radius: 8px 8px 0 0; 
          }
          .header h1 {
            margin: 0 0 10px 0;
            font-size: 28px;
          }
          .header p {
            margin: 0;
            font-size: 18px;
            opacity: 0.9;
          }
          .content { 
            background: #f9fafb; 
            padding: 30px; 
          }
          .position-card { 
            background: white; 
            padding: 30px; 
            border-radius: 12px; 
            text-align: center; 
            margin: 20px 0; 
            box-shadow: 0 2px 8px rgba(0,0,0,0.05);
          }
          .position-label {
            margin: 0;
            color: #666;
            font-size: 12px;
            text-transform: uppercase;
            letter-spacing: 1px;
            font-weight: 600;
          }
          .position-number { 
            font-size: 64px; 
            font-weight: bold; 
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
            -webkit-background-clip: text; 
            -webkit-text-fill-color: transparent;
            background-clip: text;
            margin: 10px 0;
            line-height: 1;
          }
          .position-sublabel {
            margin: 0;
            color: #666;
            font-size: 14px;
          }
          .features {
            background: white;
            padding: 20px;
            border-radius: 8px;
            margin: 20px 0;
          }
          .feature {
            display: flex;
            align-items: start;
            margin: 12px 0;
          }
          .feature-icon {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            width: 24px;
            height: 24px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            margin-right: 12px;
            flex-shrink: 0;
            font-weight: bold;
            font-size: 14px;
          }
          .button { 
            display: inline-block; 
            background: #667eea; 
            color: white; 
            padding: 14px 32px; 
            text-decoration: none; 
            border-radius: 8px; 
            font-weight: 600; 
            margin: 20px 0; 
          }
          .footer { 
            text-align: center; 
            color: #666; 
            font-size: 12px; 
            margin-top: 30px; 
            padding-top: 20px;
            border-top: 1px solid #e5e7eb;
          }
          .social-share {
            background: #f0f4ff;
            border-left: 4px solid #667eea;
            padding: 16px;
            margin: 20px 0;
            border-radius: 4px;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎉 Welcome to Teama AI!</h1>
            <p>You're officially on the list</p>
          </div>
          
          <div class="content">
            <p style="font-size: 16px; margin-top: 0;">Hi ${name}!</p>
            
            <p>Thanks for joining the Teama AI waitlist. We're building something special to help teams work smarter with AI-powered productivity insights.</p>
            
            <div class="position-card">
              <p class="position-label">Your Position</p>
              <div class="position-number">#${position}</div>
              <p class="position-sublabel">in line</p>
            </div>
            
            <h3 style="color: #333; margin-bottom: 12px;">What happens next?</h3>
            <div class="features">
              <div class="feature">
                <span class="feature-icon">1</span>
                <div>
                  <strong>We'll keep you updated</strong><br>
                  <span style="color: #666; font-size: 14px;">Regular progress updates as we build</span>
                </div>
              </div>
              <div class="feature">
                <span class="feature-icon">2</span>
                <div>
                  <strong>Early access</strong><br>
                  <span style="color: #666; font-size: 14px;">You'll be first in line when we launch</span>
                </div>
              </div>
              <div class="feature">
                <span class="feature-icon">3</span>
                <div>
                  <strong>Founding member perks</strong><br>
                  <span style="color: #666; font-size: 14px;">Special pricing & exclusive features</span>
                </div>
              </div>
            </div>

            <div class="social-share">
              <p style="margin: 0 0 8px 0; font-weight: 600; color: #333;">Want to move up faster?</p>
              <p style="margin: 0; font-size: 14px; color: #666;">
                Share Teama AI with your team and we'll bump you up the list! 🚀
              </p>
            </div>
            
            <div style="text-align: center; margin-top: 30px;">
              <a href="https://teamaai.xyz" class="button">
                Learn More About Teama AI
              </a>
            </div>
            
            <p style="font-size: 13px; color: #666; margin-top: 24px; line-height: 1.5;">
              <strong>What is Teama AI?</strong><br>
              Teama AI turns your Slack chaos into clear, actionable insights. Get AI-powered summaries, automatic blocker detection, and team productivity analytics—all without leaving your workspace.
            </p>
          </div>
          
          <div class="footer">
            <p style="margin: 0 0 8px 0;">Questions? Just reply to this email—we read every message!</p>
            <p style="margin: 0; color: #999;">© 2026 Teama AI. All rights reserved.</p>
          </div>
        </div>
      </body>
    </html>
  `;
}

}



export default new EmailService();
