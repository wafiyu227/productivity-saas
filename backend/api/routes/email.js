import express from 'express';
import emailService from '../services/email-service.js';
import { db } from '../services/supabase-client.js';
import logger from '../utils/logger.js';

const router = express.Router();

router.post('/daily-digest', express.json(), async (req, res) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'userId required' });
    }

    const { data: settings, error: settingsError } = await db.supabase
      .from('user_settings')
      .select('email_notifications, daily_digest')
      .eq('user_id', userId)
      .maybeSingle();

    if (settingsError) {
      throw settingsError;
    }

    const emailNotificationsEnabled = settings?.email_notifications ?? true;
    const dailyDigestEnabled = settings?.daily_digest ?? false;

    if (!emailNotificationsEnabled || !dailyDigestEnabled) {
      return res.status(400).json({
        error: 'Enable Email notifications and Daily digest email in Profile Settings first.'
      });
    }

    const profile = await db.getProfile(userId);
    if (!profile?.email) {
      return res.status(400).json({ error: 'User profile email is missing' });
    }

    const summaries = await db.getSummaries(null, userId, 10);
    const result = await emailService.sendDailyDigest(userId, profile.email, summaries || []);

    if (!result.success) {
      return res.status(500).json({ error: result.error || 'Failed to send digest email' });
    }

    res.json({ success: true, messageId: result.messageId });
  } catch (error) {
    logger.error('Daily digest email error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
