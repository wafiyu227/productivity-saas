import express from 'express';
import slackService from '../services/slack-service.js';
import aiProcessor from '../services/ai-processor.js';
import { db } from '../services/supabase-client.js';
import logger from '../utils/logger.js';

const router = express.Router();

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