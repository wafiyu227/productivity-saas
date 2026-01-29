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
    
    if (!userId) {
      return res.status(400).json({ error: 'userId required' });
    }

    // Check if user has Slack integration
    const integration = await db.getIntegration(userId, 'slack');
    
    if (!integration) {
      return res.status(401).json({ 
        error: 'Slack not connected',
        channels: []
      });
    }

    // Get channels from Slack service
    const channels = await slackService.listChannels();
    
    res.json({
      channels: channels || [],
      teamId: integration.team_id,
      teamName: integration.team_name
    });
  } catch (error) {
    logger.error('Failed to fetch channels:', error);
    res.status(500).json({ error: 'Failed to fetch channels', channels: [] });
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