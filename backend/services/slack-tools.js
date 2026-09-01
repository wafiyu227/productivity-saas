import { WebClient } from '@slack/web-api';
import logger from '../utils/logger.js';

export class SlackAgentTools {
  constructor(userToken) {
    if (!userToken) throw new Error('Slack user token is required for agent tools');
    this.client = new WebClient(userToken);
  }

  normalizeChannelName(value) {
    return String(value || '').trim().replace(/^#/, '').toLowerCase();
  }

  async listAccessibleChannels() {
    const channelsResult = await this.client.conversations.list({
      types: 'public_channel,private_channel',
      exclude_archived: true,
      limit: 200
    });

    return Array.isArray(channelsResult.channels) ? channelsResult.channels : [];
  }

  async resolveChannel(input) {
    const channels = await this.listAccessibleChannels();
    if (!channels.length) {
      throw new Error('No accessible Slack channels were found.');
    }

    if (typeof input === 'string' && /^[CGD][A-Z0-9]+$/i.test(input)) {
      const matchedById = channels.find((channel) => channel.id === input);
      if (matchedById) {
        return { id: matchedById.id, name: matchedById.name };
      }
    }

    const desiredName = this.normalizeChannelName(
      typeof input === 'string' ? input : input?.channelName || input?.name || ''
    );

    if (desiredName) {
      const matchedByName = channels.find((channel) => this.normalizeChannelName(channel.name) === desiredName);
      if (matchedByName) {
        return { id: matchedByName.id, name: matchedByName.name };
      }
    }

    const fallback = channels[0];
    return { id: fallback.id, name: fallback.name };
  }

  async getChannels() {
    try {
      const channels = await this.listAccessibleChannels();
      return channels.map(c => ({
        name: c.name,
        is_private: c.is_private,
        topic: c.topic?.value,
        id: c.id
      }));
    } catch (error) {
      logger.error('Agent tool getChannels error:', error);
      throw error;
    }
  }

  async getUsers() {
    try {
      const result = await this.client.users.list({ limit: 100 });
      return result.members
        .filter(m => !m.deleted && !m.is_bot && m.id !== 'USLACKBOT')
        .map(m => ({
          name: m.real_name || m.name,
          email: m.profile?.email,
          title: m.profile?.title,
          id: m.id
        }));
    } catch (error) {
      logger.error('Agent tool getUsers error:', error);
      throw error;
    }
  }

  async getMessages(channelId, limit = 50) {
    try {
      const resolvedChannel = await this.resolveChannel(channelId);
      const [history, usersResult] = await Promise.all([
        this.client.conversations.history({
          channel: resolvedChannel.id,
          limit: limit
        }),
        this.client.users.list({ limit: 1000 }).catch(() => ({ members: [] }))
      ]);

      const userMap = new Map((usersResult.members || []).map(m => [
        m.id, 
        m.profile?.display_name || m.profile?.real_name || m.name
      ]));

      const messages = (history.messages || []).map(m => {
        let text = String(m.text || '').trim();
        
        // Resolve user mentions in text: <@U12345> -> @Name
        text = text.replace(/<@(U[A-Z0-9]+)>/g, (match, userId) => {
          const name = userMap.get(userId);
          return name ? `@${name}` : match;
        });

        const authorName = userMap.get(m.user) || 'unknown user';

        return {
          channel: `#${resolvedChannel.name}`,
          user: authorName,
          text,
          ts: m.ts
        };
      });

      return {
        channel: `#${resolvedChannel.name}`,
        messageCount: messages.length,
        messages
      };
    } catch (error) {
      logger.error('Agent tool getMessages error:', error);
      throw new Error('Could not fetch messages for that Slack channel. Make sure the app has access.');
    }
  }

  async sendMessage(channelRef, text) {
    try {
      const resolvedChannel = await this.resolveChannel(channelRef);
      const result = await this.client.chat.postMessage({
        channel: resolvedChannel.id,
        text: text,
        as_user: true
      });
      return { success: true, ts: result.ts, channel: `#${resolvedChannel.name}` };
    } catch (error) {
      logger.error('Agent tool sendMessage error:', error);
      throw new Error('Could not send the Slack message. Make sure the app has access to that channel.');
    }
  }

  async createChannel(name, isPrivate = false) {
    try {
      const result = await this.client.conversations.create({
        name: name.toLowerCase().replace(/[^a-z0-9_-]/g, ''),
        is_private: isPrivate
      });
      return { success: true, channel: { id: result.channel.id, name: result.channel.name } };
    } catch (error) {
      logger.error(`Agent tool createChannel error:`, error);
      throw new Error(`Could not create channel ${name}. Error: ${error.message}`);
    }
  }
}
