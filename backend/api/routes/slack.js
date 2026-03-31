import express from 'express';
import { WebClient } from '@slack/web-api';
import { db } from '../services/supabase-client.js';
import aiProcessor from '../services/ai-processor.js';
import logger from '../utils/logger.js';
import { getSummaryLimit, getHistoryLimitHours } from '../utils/plan-limits.js';

const router = express.Router();

// Get configured channels
router.get('/channels', async (req, res) => {
  try {
    const { userId, teamId } = req.query;

    if (!userId) {
      return res.status(400).json({ error: 'userId required' });
    }

    const integration = await db.getIntegration(userId, 'slack', teamId);

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
    const { channelId, hours = 24, userId, teamId } = req.body;

    if (!userId || !channelId) {
      return res.status(400).json({ error: 'userId and channelId required' });
    }

    const integration = await db.getIntegration(userId, 'slack', teamId);

    if (!integration) {
      return res.status(401).json({ error: 'Slack not connected' });
    }

    const currentTeamId = integration.team_id;

    // --- BILLING LIMITS CHECK ---
    const billingInfo = await db.getTeamBillingInfo(currentTeamId);
    const plan = billingInfo?.plan || 'free';

    const monthYear = new Date().toISOString().slice(0, 7); // e.g., '2026-02'
    const usageCount = await db.getTeamSummaryUsage(currentTeamId, monthYear);

    const summaryLimit = getSummaryLimit(plan);

    if (summaryLimit !== null && usageCount >= summaryLimit) {
      return res.status(403).json({
        error: `Monthly summary limit reached (${summaryLimit}) for ${plan} plan.`,
        code: 'PLAN_LIMIT_REACHED',
        currentPlan: plan
      });
    }

    const maxHistory = getHistoryLimitHours(plan);
    const requestedHours = Math.min(hours, maxHistory); // Cap to plan limit

    const client = new WebClient(integration.access_token);

    // Fetch channel info for name
    const channelInfo = await client.conversations.info({ channel: channelId });
    const channelName = channelInfo.channel?.name || 'unknown-channel';

    // Calculate time range using capped hours
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

    const messages = history.messages.reverse().map(m => ({
      text: m.text,
      user: m.user,
      ts: m.ts
    }));

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

    // Increment usage since successful
    await db.incrementSummaryUsage(currentTeamId, monthYear);

    // Save to DB
    const savedSummary = await db.saveSlackSummary({
      user_id: userId,
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

export default router;
