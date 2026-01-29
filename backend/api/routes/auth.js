import express from 'express';
import { WebClient } from '@slack/web-api';
import { db } from '../services/supabase-client.js';
import logger from '../utils/logger.js';

const router = express.Router();

const SLACK_CLIENT_ID = process.env.SLACK_CLIENT_ID;
const SLACK_CLIENT_SECRET = process.env.SLACK_CLIENT_SECRET;
const API_BASE_URL = process.env.API_BASE_URL || 'https://productivity-saas-tau.vercel.app';
const REDIRECT_URI = `${API_BASE_URL}/api/auth/slack/oauth/callback`;
const FRONTEND_URL = process.env.FRONTEND_URL || 'https://productivity-saas-frontend.vercel.app';

// Initiate OAuth flow
router.get('/slack/connect', (req, res) => {
    const { userId } = req.query;

    if (!userId) {
        return res.status(400).json({ error: 'userId required' });
    }

    const state = Buffer.from(JSON.stringify({ userId })).toString('base64');

    const scopes = [
        'channels:history',
        'channels:read',
        'chat:write',
        'groups:history',
        'groups:read',
        'users:read'
    ].join(',');

    const authUrl = `https://slack.com/oauth/v2/authorize?client_id=${SLACK_CLIENT_ID}&scope=${scopes}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&state=${state}`;

    res.redirect(authUrl);
});

// Check integration status
router.get('/slack/status', async (req, res) => {
    const { userId } = req.query;

    if (!userId) {
        return res.status(400).json({ error: 'userId required' });
    }

    try {
        const integration = await db.getIntegration(userId, 'slack');

        res.json({
            connected: !!integration,
            team: integration?.team_name || null
        });
    } catch (error) {
        logger.error('Status check error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Disconnect Slack
router.delete('/slack/disconnect', async (req, res) => {
    const { userId } = req.query;

    if (!userId) {
        return res.status(400).json({ error: 'userId required' });
    }

    try {
        await db.deleteIntegration(userId, 'slack');
        res.json({ success: true });
    } catch (error) {
        logger.error('Disconnect error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get user settings
router.get('/settings', async (req, res) => {
    const { userId } = req.query;

    if (!userId) {
        return res.status(400).json({ error: 'userId required' });
    }

    try {
        const { data, error } = await db.supabase
            .from('user_settings')
            .select('*')
            .eq('user_id', userId)
            .single();

        if (error && error.code !== 'PGRST116') {
            throw error;
        }

        // Return defaults if no settings exist
        const settings = data || {
            user_id: userId,
            email_notifications: true,
            slack_notifications: true,
            blocker_alerts: false,
            daily_digest: true,
            appearance: 'light',
            created_at: new Date().toISOString()
        };

        res.json(settings);
    } catch (error) {
        logger.error('Settings fetch error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Update user settings
router.post('/settings', async (req, res) => {
    const { userId, settings } = req.body;

    if (!userId || !settings) {
        return res.status(400).json({ error: 'userId and settings required' });
    }

    try {
        const { data, error } = await db.supabase
            .from('user_settings')
            .upsert({
                user_id: userId,
                ...settings,
                updated_at: new Date().toISOString()
            }, { onConflict: 'user_id' })
            .select()
            .single();

        if (error) throw error;

        logger.info('Settings updated', { userId });
        res.json(data);
    } catch (error) {
        logger.error('Settings update error:', error);
        res.status(500).json({ error: error.message });
    }
});

export default router;