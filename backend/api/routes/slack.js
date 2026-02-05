import express from 'express';
import { WebClient } from '@slack/web-api';
import { db } from '../services/supabase-client.js';
import aiProcessor from '../services/ai-processor.js';
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

    const client = new WebClient(integration.access_token);

    // Fetch channel info for name
    const channelInfo = await client.conversations.info({ channel: channelId });
    const channelName = channelInfo.channel?.name || 'unknown-channel';

    // Calculate time range
    const oldest = (Date.now() - (hours * 60 * 60 * 1000)) / 1000;

    // Fetch messages
    const history = await client.conversations.history({
      channel: channelId,
      oldest: oldest.toString(),
      limit: 100
    });

    if (!history.ok) {
      throw new Error(history.error || 'Failed to fetch messages');
    }

    const messages = history.messages.reverse().map(m => ({
      text: m.text,
      user: m.user,
      ts: m.ts
    }));

    if (messages.length === 0) {
      return res.json({
        summary: 'No messages found in this time period.',
        blockers: [],
        keyTopics: []
      });
    }

    // Generate AI summary
    const aiAnalysis = await aiProcessor.summarizeSlackMessages(messages, channelName);

    // Save to DB
    const savedSummary = await db.saveSlackSummary({
      channel_id: channelId,
      channel_name: channelName,
      team_id: integration.team_id,
      summary: aiAnalysis.summary,
      blockers: aiAnalysis.blockers,
      key_topics: aiAnalysis.keyTopics,
      message_count: messages.length,
      time_period_start: new Date(oldest * 1000).toISOString(),
      time_period_end: new Date().toISOString()
    });

    res.json(savedSummary);

  } catch (error) {
    logger.error('Summary generation failed:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;