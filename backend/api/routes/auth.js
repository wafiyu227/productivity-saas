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

// Asana OAuth routes
const ASANA_CLIENT_ID = process.env.ASANA_CLIENT_ID;
const ASANA_CLIENT_SECRET = process.env.ASANA_CLIENT_SECRET;
const ASANA_REDIRECT_URI = process.env.API_BASE_URL + '/api/auth/asana/oauth/callback';

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

// Initiate Asana OAuth
router.get('/asana/connect', (req, res) => {
    const { userId } = req.query;

    if (!userId) {
        return res.status(400).json({ error: 'userId required' });
    }

    const state = Buffer.from(JSON.stringify({ userId })).toString('base64');

    const authUrl = `https://app.asana.com/-/oauth_authorize?client_id=${ASANA_CLIENT_ID}&redirect_uri=${encodeURIComponent(ASANA_REDIRECT_URI)}&response_type=code&state=${state}`;

    res.redirect(authUrl);
});

// Asana OAuth callback
router.get('/asana/oauth/callback', async (req, res) => {
    const { code, state, error } = req.query;
    const FRONTEND_URL = process.env.FRONTEND_URL || 'https://productivity-saas-frontend.vercel.app';

    if (error) {
        logger.error('Asana OAuth error:', error);
        return res.redirect(`${FRONTEND_URL}/app/integrations?error=asana_auth_failed`);
    }

    if (!code || !state) {
        return res.redirect(`${FRONTEND_URL}/app/integrations?error=missing_params`);
    }

    try {
        const { userId } = JSON.parse(Buffer.from(state, 'base64').toString());

        // Exchange code for access token
        const tokenResponse = await fetch('https://app.asana.com/-/oauth_token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: new URLSearchParams({
                grant_type: 'authorization_code',
                client_id: ASANA_CLIENT_ID,
                client_secret: ASANA_CLIENT_SECRET,
                redirect_uri: ASANA_REDIRECT_URI,
                code
            })
        });

        if (!tokenResponse.ok) {
            throw new Error('Failed to exchange code for token');
        }

        const tokenData = await tokenResponse.json();

        // Get user's workspaces
        const workspacesResponse = await fetch('https://app.asana.com/api/1.0/workspaces', {
            headers: {
                'Authorization': `Bearer ${tokenData.access_token}`
            }
        });

        const workspacesData = await workspacesResponse.json();
        const workspace = workspacesData.data?.[0];

        // Save integration
        await db.saveIntegration(userId, 'asana', {
            accessToken: tokenData.access_token,
            refreshToken: tokenData.refresh_token,
            workspaceId: workspace?.gid,
            workspaceName: workspace?.name
        });

        logger.info('Asana integration saved', { userId, workspaceId: workspace?.gid });

        res.redirect(`${FRONTEND_URL}/app/integrations?success=asana_connected`);

    } catch (error) {
        logger.error('Asana OAuth callback error:', error);
        res.redirect(`${FRONTEND_URL}/app/integrations?error=oauth_failed`);
    }
});

// Check Asana status
router.get('/asana/status', async (req, res) => {
    const { userId } = req.query;

    if (!userId) {
        return res.status(400).json({ error: 'userId required' });
    }

    try {
        const integration = await db.getIntegration(userId, 'asana');

        res.json({
            connected: !!integration,
            workspace: integration?.workspace_name || null
        });
    } catch (error) {
        logger.error('Asana status check error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Disconnect Asana
router.delete('/asana/disconnect', async (req, res) => {
    const { userId } = req.query;

    if (!userId) {
        return res.status(400).json({ error: 'userId required' });
    }

    try {
        await db.deleteIntegration(userId, 'asana');
        res.json({ success: true });
    } catch (error) {
        logger.error('Asana disconnect error:', error);
        res.status(500).json({ error: error.message });
    }
});

export default router;