import logger from '../utils/logger.js';

const RESEND_API_KEY = process.env.RESEND_API_KEY;

class EmailService {
  async sendDailyDigest(userEmail, summaries) {
    if (!RESEND_API_KEY) {
      logger.warn('RESEND_API_KEY not configured, skipping email');
      return { success: false, error: 'Email service not configured' };
    }

    try {
      const emailHtml = this.generateDigestHTML(summaries);

      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: 'Teama AI <noreply@teama-ai.com>',
          to: userEmail,
          subject: `Daily Summary - ${new Date().toLocaleDateString()}`,
          html: emailHtml
        })
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Resend API error: ${error}`);
      }

      const result = await response.json();
      logger.info('Daily digest sent', { userEmail, summaryCount: summaries.length });
      return { success: true, messageId: result.id };
    } catch (error) {
      logger.error('Failed to send daily digest', { userEmail, error: error.message });
      return { success: false, error: error.message };
    }
  }

  async sendInvitation(email, invitation, inviterName) {
    if (!RESEND_API_KEY) {
      logger.warn('RESEND_API_KEY not configured, skipping invitation email');
      return { success: false, error: 'Email service not configured' };
    }

    try {
      const joinUrl = `${process.env.FRONTEND_URL || 'https://teama-ai.vercel.app'}/join?token=${invitation.token}`;

      const emailHtml = `
        <!DOCTYPE html>
        <html>
          <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #111827; background-color: #f3f4f6; padding: 20px;">
            <div style="max-width: 600px; margin: 0 auto; background-color: white; padding: 40px; border-radius: 8px;">
              <h1 style="margin-top: 0; color: #111827;">Join the team on Teama AI</h1>
              <p style="font-size: 16px; color: #4b5563;">
                <strong>${inviterName}</strong> has invited you to join their team on Teama AI.
              </p>
              <div style="margin: 32px 0; text-align: center;">
                <a href="${joinUrl}" style="background-color: #2563eb; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 600; display: inline-block;">
                  Accept Invitation
                </a>
              </div>
              <p style="font-size: 14px; color: #6b7280;">
                Or copy and paste this link into your browser:<br>
                <a href="${joinUrl}" style="color: #2563eb;">${joinUrl}</a>
              </p>
            </div>
          </body>
        </html>
      `;

      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: 'Teama AI <noreply@teama-ai.com>',
          to: email,
          subject: `${inviterName} invited you to join a team on Teama AI`,
          html: emailHtml
        })
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Resend API error: ${error}`);
      }

      const result = await response.json();
      logger.info('Invitation sent', { email, messageId: result.id });
      return { success: true, messageId: result.id };
    } catch (error) {
      logger.error('Failed to send invitation', { email, error: error.message });
      // Don't throw, just return failure so api doesn't crash
      return { success: false, error: error.message };
    }
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
                <a href="https://teama-ai.vercel.app/app/summaries">View all summaries →</a>
              </p>
              <p style="margin: 0; color: #9ca3af; font-size: 11px;">
                Manage your notification preferences in <a href="https://teama-ai.vercel.app/app/profile">Settings</a>
              </p>
            </div>
          </div>
        </body>
      </html>
    `;
  }
}

export default new EmailService();
