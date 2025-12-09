import express from 'express';
import slackService from '../services/slack-service.js';
import aiProcessor from '../services/ai-processor.js';
import { db } from '../services/supabase-client.js';
import logger from '../utils/logger.js';

const router = express.Router();

// Webhook endpoint
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    const signature = req.headers['x-slack-signature'];
    const timestamp = req.headers['x-slack-request-timestamp'];
    const rawBody = req.body.toString();

    if (!slackService.verifySignature(signature, timestamp, rawBody)) {
      return res.status(401).json({ error: 'Invalid signature' });
    }

    const payload = JSON.parse(rawBody);

    if (payload.type === 'url_verification') {
      return res.json({ challenge: payload.challenge });
    }

    res.json({ ok: true });
  } catch (error) {
    logger.error('Webhook error:', error);
    res.status(500).json({ error: 'Internal error' });
  }
});

// Generate summary
router.post('/summarize', express.json(), async (req, res) => {
  try {
    const { channelId, hours = 24, teamId } = req.body;

    if (!channelId) {
      return res.status(400).json({ error: 'channelId required' });
    }

    const channelInfo = await slackService.getChannelInfo(channelId);
    const messages = await slackService.getRecentMessages(channelId, hours);

    if (messages.length === 0) {
      return res.json({ message: 'No messages found' });
    }

    const aiResult = await aiProcessor.summarizeSlackMessages(messages, channelInfo.name);

    const summary = await db.saveSlackSummary({
      channel_id: channelId,
      channel_name: channelInfo.name,
      team_id: teamId || 'default',
      summary: aiResult.summary,
      blockers: aiResult.blockers,
      key_topics: aiResult.keyTopics,
      message_count: messages.length,
      time_period_start: new Date(Date.now() - hours * 60 * 60 * 1000).toISOString(),
      time_period_end: new Date().toISOString(),
      created_at: new Date().toISOString()
    });

    res.json({
      success: true,
      summary: {
        id: summary.id,
        channel: channelInfo.name,
        summary: aiResult.summary,
        blockers: aiResult.blockers,
        keyTopics: aiResult.keyTopics,
        messageCount: messages.length
      }
    });
  } catch (error) {
    logger.error('Summary error:', error);
    res.status(500).json({ error: error.message });
  }
});

// List channels
router.get('/channels', async (req, res) => {
  try {
    const channels = await slackService.listChannels();
    res.json({ channels });
  } catch (error) {
    logger.error('List channels error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;