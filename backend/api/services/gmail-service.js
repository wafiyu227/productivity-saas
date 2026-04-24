import logger from '../utils/logger.js';

class GmailService {
  constructor() {
    this.baseUrl = 'https://gmail.googleapis.com/gmail/v1/users/me';
  }

  async gmailRequest(url, accessToken, options = {}) {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json',
        ...options.headers
      }
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      logger.error('Gmail API Request Error:', {
        url,
        status: response.status,
        error: errorData
      });
      const error = new Error(errorData?.error?.message || `Gmail API error: ${response.status}`);
      error.status = response.status;
      throw error;
    }

    if (response.status === 204) return null;
    return await response.json();
  }

  async searchMessages(accessToken, query = '', maxResults = 10) {
    const params = new URLSearchParams({
      maxResults: String(maxResults),
      q: query || ''
    });
    const data = await this.gmailRequest(`${this.baseUrl}/messages?${params}`, accessToken);
    
    if (!data.messages) return [];

    // Fetch minimal details for each message
    const details = await Promise.all(
      data.messages.slice(0, 5).map(m => this.getMessageDetails(accessToken, m.id, 'minimal'))
    );
    
    return details;
  }

  async getMessageDetails(accessToken, messageId, format = 'full') {
    const params = new URLSearchParams({ format });
    const msg = await this.gmailRequest(`${this.baseUrl}/messages/${messageId}?${params}`, accessToken);
    
    const headers = msg.payload?.headers || [];
    const getHeader = (name) => headers.find(h => h.name.toLowerCase() === name.toLowerCase())?.value || '';

    let body = '';
    if (format === 'full') {
      // Decode body from parts or direct payload
      if (msg.payload?.parts) {
        const textPart = msg.payload.parts.find(p => p.mimeType === 'text/plain') || msg.payload.parts[0];
        if (textPart?.body?.data) {
          body = Buffer.from(textPart.body.data, 'base64').toString();
        }
      } else if (msg.payload?.body?.data) {
        body = Buffer.from(msg.payload.body.data, 'base64').toString();
      }
    }

    return {
      id: msg.id,
      threadId: msg.threadId,
      subject: getHeader('Subject'),
      from: getHeader('From'),
      to: getHeader('To'),
      date: getHeader('Date'),
      snippet: msg.snippet,
      body: body.trim(),
      labels: msg.labelIds || []
    };
  }

  async sendEmail(accessToken, { to, subject, body }) {
    // Construct RFC 2822 message
    const emailContent = [
      `To: ${to}`,
      `Subject: ${subject}`,
      'Content-Type: text/plain; charset=utf-8',
      '',
      body
    ].join('\r\n');

    const encodedEmail = Buffer.from(emailContent)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    return await this.gmailRequest(`${this.baseUrl}/messages/send`, accessToken, {
      method: 'POST',
      body: JSON.stringify({ raw: encodedEmail })
    });
  }
}

export const gmailService = new GmailService();
export default gmailService;
