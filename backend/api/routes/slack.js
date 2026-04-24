import express from 'express';
import { WebClient } from '@slack/web-api';
import { db } from '../services/supabase-client.js';
import aiProcessor from '../services/ai-processor.js';
import { createSlackAgentStream } from '../services/agent-chat.js';
import slackService from '../services/slack-service.js';
import logger from '../utils/logger.js';

const router = express.Router();

// Get configured channels
router.get('/channels', async (req, res) => {
  try {
    const { userId } = req.query;

    if (!userId) {
      return res.status(400).json({ error: 'userId required' });
    }

    const integration = await db.getIntegration(userId, 'slack');

    if (!integration) {
      return res.status(401).json({ error: 'Slack not connected' });
    }

    const client = new WebClient(integration.access_token);

    // List public channels
    const result = await client.conversations.list({
      types: 'public_channel,private_channel',
      limit: 100,
      exclude_archived: true
    });

    if (!result.ok) {
      throw new Error(result.error || 'Failed to fetch channels');
    }

    const channels = result.channels.map(c => ({
      id: c.id,
      name: c.name,
      num_members: c.num_members,
      is_private: c.is_private
    }));

    res.json({ channels });
  } catch (error) {
    logger.error('Failed to get channels:', error);
    res.status(500).json({ error: error.message });
  }
});

// Create new summary
router.post('/summarize', express.json(), async (req, res) => {
  try {
    const { channelId, hours = 24, userId } = req.body;

    if (!userId || !channelId) {
      return res.status(400).json({ error: 'userId and channelId required' });
    }

    const integration = await db.getIntegration(userId, 'slack');

    if (!integration) {
      return res.status(401).json({ error: 'Slack not connected' });
    }

    // Use requested hours as-is (no plan limits for individual users)
    const requestedHours = Math.max(1, Math.min(hours, 168)); // Limit to 1 week max for API efficiency

    const client = new WebClient(integration.access_token);

    // Fetch channel info for name
    const channelInfo = await client.conversations.info({ channel: channelId });
    const channelName = channelInfo.channel?.name || 'unknown-channel';

    // Calculate time range using requested hours
    const oldest = (Date.now() - (requestedHours * 60 * 60 * 1000)) / 1000;

    // Fetch messages
    const history = await client.conversations.history({
      channel: channelId,
      oldest: oldest.toString(),
      limit: 100
    });

    if (!history.ok) {
      throw new Error(history.error || 'Failed to fetch messages');
    }

    // Fetch users for name resolution
    const users = await slackService.listUsers(integration.access_token).catch(() => []);
    const userMap = new Map(users.map(u => [u.id, u.name]));

    const messages = history.messages.reverse().map(m => {
      let text = String(m.text || '').trim();
      
      // Resolve user mentions in text: <@U12345> -> @Name
      text = text.replace(/<@(U[A-Z0-9]+)>/g, (match, userId) => {
        const name = userMap.get(userId);
        return name ? `@${name}` : match;
      });

      const authorName = userMap.get(m.user) || 'unknown user';

      return {
        text,
        user: authorName,
        ts: m.ts
      };
    });

    if (messages.length === 0) {
      return res.json({
        count: 0,
        message: 'No new messages found in this channel for the selected time period.',
        summary: null,
        blockers: [],
        keyTopics: []
      });
    }

    // Generate AI summary
    const aiAnalysis = await aiProcessor.summarizeSlackMessages(messages, channelName);

    // Save to DB
    const savedSummary = await db.saveSlackSummary({
      user_id: userId,
      channel_id: channelId,
      channel_name: channelName,
      summary: aiAnalysis.summary,
      blockers: aiAnalysis.blockers,
      key_topics: aiAnalysis.keyTopics,
      message_count: messages.length,
      time_period_start: new Date(oldest * 1000).toISOString(),
      time_period_end: new Date().toISOString()
    });

    // Native Database Notification Check Trigger
    if (aiAnalysis.blockers && aiAnalysis.blockers.length > 0) {
      try {
        const { default: slackService } = await import('../services/slack-service.js');
        await slackService.sendBlockerAlert(userId, channelId, aiAnalysis.blockers, integration.access_token);
      } catch (alertError) {
        logger.error('Failed to process blocker alert:', alertError);
      }
    }

    res.json(savedSummary);

  } catch (error) {
    logger.error('Summary generation failed:', error);
    res.status(500).json({ error: error.message });
  }
});

// Chat with the agent
router.post('/chat', express.json(), async (req, res) => {
  try {
    const { messages, userId } = req.body;

    console.log('Chat request received:', { userId, messageCount: messages?.length });

    if (!userId || !messages) {
      return res.status(400).json({ error: 'userId and messages are required' });
    }

    if (!Array.isArray(messages)) {
      console.error('Messages is not an array:', typeof messages);
      return res.status(400).json({ error: 'messages must be an array' });
    }

    const integration = await db.getIntegration(userId, 'slack');
    if (!integration || !integration.access_token) {
      return res.status(401).json({ error: 'Slack not connected' });
    }

    console.log('Creating agent stream with', messages.length, 'messages');
    const result = await createSlackAgentStream(messages, integration.access_token);
    return result.pipeDataStreamToResponse(res);
  } catch (error) {
    logger.error('Agent chat failed:', error);
    console.error('Full error details:', error.stack || error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
