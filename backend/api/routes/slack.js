import express from 'express';
import slackService from '../services/slack-service.js';
import aiProcessor from '../services/ai-processor.js';
import { db } from '../services/supabase-client.js';
import logger from '../utils/logger.js';

const router = express.Router();

// Get Slack channels
router.get('/channels', async (req, res) => {
  try {
    const { userId } = req.query;
    
    logger.info('Channels request received', { userId });
    
    if (!userId) {
      logger.warn('Missing userId in request');
      return res.status(400).json({ error: 'userId required', channels: [] });
    }

    // Check if user has Slack integration
    logger.info('Looking up Slack integration for user', { userId });
    const integration = await db.getIntegration(userId, 'slack');
    
    if (!integration) {
      logger.warn('No Slack integration found', { userId });
      return res.status(401).json({ 
        error: 'Slack not connected - please connect in Integrations',
        channels: []
      });
    }

    logger.info('Integration found', { userId, teamId: integration.team_id });

    if (!integration.access_token) {
      logger.error('No access token in integration', { userId });
      return res.status(401).json({ 
        error: 'No access token found - please reconnect Slack',
        channels: []
      });
    }

    logger.info('Fetching channels from Slack for user', { userId, teamId: integration.team_id });

    // Get channels from Slack service using user's access token
    let channels;
    try {
      channels = await slackService.listChannels(integration.access_token);
    } catch (slackError) {
      logger.error('Slack API error', { userId, error: slackError.message });
      return res.status(500).json({ 
        error: `Slack error: ${slackError.message}`, 
        channels: [] 
      });
    }
    
    logger.info('Channels fetched successfully', { userId, count: channels.length });

    res.json({
      channels: channels || [],
      teamId: integration.team_id,
      teamName: integration.team_name
    });
  } catch (error) {
    logger.error('Failed to fetch channels', { error: error.message, stack: error.stack });
    res.status(500).json({ error: error.message || 'Failed to fetch channels', channels: [] });
  }
});

// Summarize channel messages
router.post('/summarize', async (req, res) => {
  try {
    const { channelId, hours = 24, userId } = req.body;

    logger.info('Summarize request received', { channelId, hours, userId });

    if (!channelId || !userId) {
      return res.status(400).json({ error: 'channelId and userId required' });
    }

    // Get user's integration
    const integration = await db.getIntegration(userId, 'slack');
    if (!integration || !integration.access_token) {
      return res.status(401).json({ error: 'Slack not connected' });
    }

    logger.info('Fetching messages from channel', { channelId, hours });

    // Get recent messages using user's access token
    const messages = await slackService.getRecentMessages(channelId, hours, integration.access_token);

    if (!messages || messages.length === 0) {
      logger.warn('No messages found in channel', { channelId });
      return res.json({
        summary: 'No messages found in this channel for the selected time period',
        blockers: [],
        keyTopics: [],
        messageCount: 0
      });
    }

    logger.info('Messages retrieved', { channelId, count: messages.length });

    // Get channel info for context
    const channelInfo = await slackService.getChannelInfo(channelId, integration.access_token);
    const channelName = channelInfo.name;

    logger.info('Processing messages with AI', { channelName, messageCount: messages.length });

    // Process with AI
    let aiResult;
    try {
      aiResult = await aiProcessor.summarizeSlackMessages(messages, channelName);
      logger.info('AI processing complete', { aiResult });
    } catch (aiError) {
      logger.error('AI processing failed', { error: aiError.message });
      throw new Error(`AI processing failed: ${aiError.message}`);
    }

    // Save summary to database
    logger.info('Saving summary with data:', {
      channelId,
      summary: aiResult.summary,
      blockers: aiResult.blockers,
      keyTopics: aiResult.keyTopics
    });

    const summaryRecord = await db.saveSlackSummary({
      channel_id: channelId,
      channel_name: channelName,
      team_id: integration.team_id,
      summary: aiResult.summary,
      blockers: aiResult.blockers || [],
      key_topics: aiResult.keyTopics || [],
      message_count: messages.length,
      time_period_start: new Date(Date.now() - hours * 60 * 60 * 1000),
      time_period_end: new Date()
    });

    logger.info('Summary saved to database', { channelId, summaryId: summaryRecord.id });

    res.json({
      id: summaryRecord.id,
      summary: aiResult.summary,
      blockers: aiResult.blockers || [],
      keyTopics: aiResult.keyTopics || [],
      messageCount: messages.length,
      channelName,
      createdAt: summaryRecord.created_at
    });

  } catch (error) {
    logger.error('Summarize error:', { error: error.message, stack: error.stack });
    res.status(500).json({ error: error.message || 'Failed to generate summary' });
  }
});

// Webhook endpoint
router.post('/webhook', async (req, res) => {
  try {
    const payload = req.body;

    logger.info('Slack webhook received:', { type: payload?.type });

    // Handle URL verification challenge
    if (payload.type === 'url_verification') {
      logger.info('Slack URL verification - sending challenge response');
      return res.type('text/plain').send(payload.challenge);
    }

    // Verify signature for other events
    const signature = req.headers['x-slack-signature'];
    const timestamp = req.headers['x-slack-request-timestamp'];
    const body = JSON.stringify(req.body);

    if (!slackService.verifySignature(signature, timestamp, body)) {
      logger.warn('Invalid Slack signature');
      return res.status(401).json({ error: 'Invalid signature' });
    }

    logger.info('Slack event processed successfully');
    res.json({ ok: true });
  } catch (error) {
    logger.error('Webhook error:', error);
    res.status(500).json({ error: 'Internal error' });
  }
});

export default router;