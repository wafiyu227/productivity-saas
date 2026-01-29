import { WebClient } from '@slack/web-api';
import crypto from 'crypto';
import dotenv from 'dotenv';
import logger from '../utils/logger.js';

dotenv.config();

const SLACK_BOT_TOKEN = process.env.SLACK_BOT_TOKEN;
const SLACK_SIGNING_SECRET = process.env.SLACK_SIGNING_SECRET;

class SlackService {
  constructor() {
    if (SLACK_BOT_TOKEN) {
      this.client = new WebClient(SLACK_BOT_TOKEN);
    } else {
      logger.warn('SLACK_BOT_TOKEN not set');
    }
  }

  verifySignature(signature, timestamp, body) {
    if (!SLACK_SIGNING_SECRET) return false;

    const currentTime = Math.floor(Date.now() / 1000);
    if (Math.abs(currentTime - timestamp) > 300) return false;

    const sigBasestring = `v0:${timestamp}:${body}`;
    const expectedSignature = 'v0=' + crypto
      .createHmac('sha256', SLACK_SIGNING_SECRET)
      .update(sigBasestring)
      .digest('hex');

    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  }

  async getChannelMessages(channelId, options = {}, accessToken = null) {
    const token = accessToken || SLACK_BOT_TOKEN;
    if (!token) throw new Error('Slack not configured - no access token');

    const client = new WebClient(token);
    const { limit = 100, oldest } = options;

    const result = await client.conversations.history({
      channel: channelId,
      limit,
      oldest
    });

    return result.messages
      .filter(msg => !msg.bot_id && msg.type === 'message' && msg.text)
      .map(msg => ({
        user: msg.user,
        text: msg.text,
        timestamp: msg.ts
      }));
  }

  async getChannelInfo(channelId, accessToken = null) {
    const token = accessToken || SLACK_BOT_TOKEN;
    if (!token) throw new Error('Slack not configured - no access token');

    const client = new WebClient(token);

    const result = await client.conversations.info({
      channel: channelId
    });

    return {
      id: result.channel.id,
      name: result.channel.name,
      isPrivate: result.channel.is_private
    };
  }

  async listChannels(accessToken = null) {
    // Use provided access token or fall back to bot token
    const token = accessToken || SLACK_BOT_TOKEN;
    if (!token) throw new Error('Slack not configured - no access token or bot token');

    const client = new WebClient(token);

    try {
      const result = await client.conversations.list({
        types: 'public_channel,private_channel',
        exclude_archived: true,
        limit: 100
      });

      return result.channels.map(ch => ({
        id: ch.id,
        name: ch.name
      }));
    } catch (error) {
      logger.error('Error listing channels:', error);
      throw error;
    }
  }

  async getRecentMessages(channelId, hours = 24, accessToken = null) {
    const oldest = Math.floor((Date.now() - hours * 60 * 60 * 1000) / 1000);
    return this.getChannelMessages(channelId, { oldest: oldest.toString() }, accessToken);
  }
}

export default new SlackService();