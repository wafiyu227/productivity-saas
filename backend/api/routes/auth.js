import express from 'express';
import { WebClient } from '@slack/web-api';
import { db } from '../services/supabase-client.js';
import logger from '../utils/logger.js';

const router = express.Router();

const SLACK_CLIENT_ID = process.env.SLACK_CLIENT_ID;
const SLACK_CLIENT_SECRET = process.env.SLACK_CLIENT_SECRET;
const REDIRECT_URI = process.env.API_BASE_URL + '/api/auth/slack/oauth/callback';
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

// OAuth callback
router.get('/slack/oauth/callback', async (req, res) => {
    const { code, state, error } = req.query;

    if (error) {
        logger.error('Slack OAuth error:', error);
        return res.redirect(`${FRONTEND_URL}/app?error=slack_auth_failed`);
    }

    if (!code || !state) {
        return res.redirect(`${FRONTEND_URL}/app?error=missing_params`);
    }

    try {
        // Decode state to get userId
        const { userId } = JSON.parse(Buffer.from(state, 'base64').toString());

        // Exchange code for access token
        const client = new WebClient();
        const result = await client.oauth.v2.access({
            client_id: SLACK_CLIENT_ID,
            client_secret: SLACK_CLIENT_SECRET,
            code,
            redirect_uri: REDIRECT_URI
        });

        if (!result.ok) {
            throw new Error('Failed to exchange code for token');
        }

        // Save integration to database
        await db.saveIntegration(userId, 'slack', {
            accessToken: result.access_token,
            teamId: result.team.id,
            teamName: result.team.name,
            botUserId: result.bot_user_id
        });

        logger.info('Slack integration saved', { userId, teamId: result.team.id });

        // Redirect back to frontend
        res.redirect(`${FRONTEND_URL}/app?success=slack_connected`);

    } catch (error) {
        logger.error('OAuth callback error:', error);
        res.redirect(`${FRONTEND_URL}/app?error=oauth_failed`);
    }
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

export default router;