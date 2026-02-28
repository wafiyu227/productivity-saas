import express from 'express';
import { WebClient } from '@slack/web-api';
import { db } from '../services/supabase-client.js';
import googleCalendarService from '../services/google-calendar-service.js';
import logger from '../utils/logger.js';
import { requireTeamAdmin, requireTeamMember } from '../utils/team-permissions.js';

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

// Google Calendar OAuth routes
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GOOGLE_REDIRECT_URI = process.env.API_BASE_URL + '/api/auth/google/oauth/callback';

function buildGoogleTokenUpdate(integration, newTokens) {
    const expiresAt = typeof newTokens.expiresIn === 'number'
        ? new Date(Date.now() + newTokens.expiresIn * 1000).toISOString()
        : integration.expires_at;

    return {
        accessToken: newTokens.accessToken,
        refreshToken: newTokens.refreshToken ?? integration.refresh_token,
        expiresAt,
        workspaceId: integration.workspace_id,
        workspaceName: integration.workspace_name,
        teamIdExternal: integration.team_id_external,
        teamName: integration.team_name,
        teamId: integration.team_id
    };
}

async function validateGoogleStatus(userId, teamId, integration) {
    if (!integration) {
        return { integration: null, needsReauth: false };
    }

    const deleteTeamId = integration.scope === 'team'
        ? (integration.team_id || teamId || null)
        : null;

    try {
        // Verify the existing access token still works.
        await googleCalendarService.getUpcomingEvents(integration.access_token, 1);
        return { integration, needsReauth: false };
    } catch (error) {
        if (error.message !== 'Unauthorized' && error.status !== 401) {
            logger.warn('Google status verification failed (non-auth error)', {
                userId,
                teamId,
                error: error.message
            });
            return { integration, needsReauth: false };
        }
    }

    if (!integration.refresh_token) {
        await db.deleteIntegration(userId, 'google_calendar', deleteTeamId);
        return { integration: null, needsReauth: true };
    }

    try {
        const newTokens = await googleCalendarService.refreshAccessToken(integration.refresh_token);
        await db.saveIntegration(
            userId,
            'google_calendar',
            buildGoogleTokenUpdate(integration, newTokens),
            integration.scope || 'team'
        );

        return { integration, needsReauth: false };
    } catch (refreshError) {
        const isInvalidGrant = refreshError?.code === 'invalid_grant';
        if (isInvalidGrant) {
            await db.deleteIntegration(userId, 'google_calendar', deleteTeamId);
            return { integration: null, needsReauth: true };
        }

        logger.warn('Google token refresh failed during status check', {
            userId,
            teamId,
            error: refreshError.message
        });

        return { integration, needsReauth: false };
    }
}

async function ensureTeamAdminForScope(userId, teamId, scope = 'team') {
    if (scope !== 'team') return;
    if (!teamId) {
        const error = new Error('teamId required for team-scoped integration');
        error.status = 400;
        throw error;
    }
    await requireTeamAdmin(teamId, userId);
}

async function ensureTeamMemberForTeamQuery(userId, teamId) {
    if (!teamId) return;
    await requireTeamMember(teamId, userId);
}

// Initiate OAuth flow
router.get('/slack/connect', async (req, res) => {
    const { userId, teamId, scope = 'team' } = req.query;

    if (!userId) {
        return res.status(400).json({ error: 'userId required' });
    }

    try {
        await ensureTeamAdminForScope(userId, teamId, scope);
    } catch (error) {
        return res.status(error.status || 403).json({ error: error.message });
    }

    const state = Buffer.from(JSON.stringify({ userId, teamId, scope })).toString('base64');

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

// Slack OAuth callback
router.get('/slack/oauth/callback', async (req, res) => {
    const { code, state, error } = req.query;
    const FRONTEND_URL = process.env.FRONTEND_URL || 'https://productivity-saas-frontend.vercel.app';

    if (error) {
        logger.error('Slack OAuth error:', error);
        return res.redirect(`${FRONTEND_URL}/app/integrations?error=slack_auth_failed`);
    }

    if (!code || !state) {
        return res.redirect(`${FRONTEND_URL}/app/integrations?error=missing_params`);
    }

    try {
        const { userId, teamId, scope: requestedScope } = JSON.parse(Buffer.from(state, 'base64').toString());
        await ensureTeamAdminForScope(userId, teamId, requestedScope || 'team');

        // Exchange code for access token
        const tokenResponse = await fetch('https://slack.com/api/oauth.v2.access', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: new URLSearchParams({
                code,
                client_id: SLACK_CLIENT_ID,
                client_secret: SLACK_CLIENT_SECRET,
                redirect_uri: REDIRECT_URI
            })
        });

        const tokenData = await tokenResponse.json();

        if (!tokenData.ok) {
            logger.error('Slack token exchange failed:', tokenData);
            throw new Error(tokenData.error || 'Failed to exchange code for token');
        }

        // Save integration
        await db.saveIntegration(userId, 'slack', {
            accessToken: tokenData.access_token,
            teamIdExternal: tokenData.team?.id,
            teamName: tokenData.team?.name,
            teamId, // Our internal teamId
            botUserId: tokenData.bot_user_id,
            scope: tokenData.scope
        }, requestedScope || 'team');

        logger.info('Slack integration saved', { userId, teamId });

        // Redirect back
        res.redirect(`${FRONTEND_URL}/app/integrations?success=slack_connected`);

    } catch (error) {
        logger.error('Slack OAuth callback error:', error);
        res.redirect(`${FRONTEND_URL}/app/integrations?error=oauth_failed`);
    }
});

router.get('/slack/status', async (req, res) => {
    const { userId, teamId } = req.query;

    if (!userId) {
        return res.status(400).json({ error: 'userId required' });
    }

    try {
        await ensureTeamMemberForTeamQuery(userId, teamId);
        const integration = await db.getIntegration(userId, 'slack', teamId);

        res.json({
            connected: !!integration,
            team: integration?.team_name || null
        });
    } catch (error) {
        logger.error('Status check error:', error);
        res.status(500).json({ error: error.message });
    }
});

router.get('/status', async (req, res) => {
    const { userId, platform, teamId } = req.query;

    if (!userId || !platform) {
        return res.status(400).json({ error: 'userId and platform required' });
    }

    try {
        await ensureTeamMemberForTeamQuery(userId, teamId);
        const dbPlatform = platform === 'google' || platform === 'google/calendar' ? 'google_calendar' : platform;
        let integration = await db.getIntegration(userId, dbPlatform, teamId);
        let needsReauth = false;

        if (dbPlatform === 'google_calendar' && integration) {
            const validation = await validateGoogleStatus(userId, teamId, integration);
            integration = validation.integration;
            needsReauth = validation.needsReauth;
        }

        res.json({
            connected: !!integration,
            platform: platform,
            workspace: integration?.workspace_name || integration?.team_name || null,
            needsReauth
        });
    } catch (error) {
        logger.error(`Status check error for ${platform}:`, error);
        res.status(500).json({ error: error.message });
    }
});

// Disconnect Slack
router.delete('/slack/disconnect', async (req, res) => {
    const { userId, teamId } = req.query;

    if (!userId) {
        return res.status(400).json({ error: 'userId required' });
    }

    try {
        await ensureTeamAdminForScope(userId, teamId, teamId ? 'team' : 'personal');
        await db.deleteIntegration(userId, 'slack', teamId);
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
            daily_digest: false,
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
router.get('/asana/connect', async (req, res) => {
    const { userId, teamId, scope = 'team' } = req.query;

    if (!userId) {
        return res.status(400).json({ error: 'userId required' });
    }

    try {
        await ensureTeamAdminForScope(userId, teamId, scope);
    } catch (error) {
        return res.status(error.status || 403).json({ error: error.message });
    }

    const state = Buffer.from(JSON.stringify({ userId, teamId, scope })).toString('base64');

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
        const { userId, teamId, scope: requestedScope } = JSON.parse(Buffer.from(state, 'base64').toString());
        await ensureTeamAdminForScope(userId, teamId, requestedScope || 'team');

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
            workspaceName: workspace?.name,
            teamId // Our internal teamId
        }, requestedScope || 'team');

        logger.info('Asana integration saved', { userId, teamId });

        res.redirect(`${FRONTEND_URL}/app/integrations?success=asana_connected`);

    } catch (error) {
        logger.error('Asana OAuth callback error:', error);
        res.redirect(`${FRONTEND_URL}/app/integrations?error=oauth_failed`);
    }
});

// Check Asana status
router.get('/asana/status', async (req, res) => {
    const { userId, teamId } = req.query;

    if (!userId) {
        return res.status(400).json({ error: 'userId required' });
    }

    try {
        await ensureTeamMemberForTeamQuery(userId, teamId);
        const integration = await db.getIntegration(userId, 'asana', teamId);

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
    const { userId, teamId } = req.query;

    if (!userId) {
        return res.status(400).json({ error: 'userId required' });
    }

    try {
        await ensureTeamAdminForScope(userId, teamId, teamId ? 'team' : 'personal');
        await db.deleteIntegration(userId, 'asana', teamId);
        res.json({ success: true });
    } catch (error) {
        logger.error('Asana disconnect error:', error);
        res.status(500).json({ error: error.message });
    }
});

// ============================================
// GOOGLE CALENDAR OAUTH ROUTES
// ============================================

// ✅ ADDED: Initiate Google OAuth (THIS WAS MISSING!)
router.get('/google/connect', async (req, res) => {
    const { userId, teamId, scope = 'team' } = req.query;

    if (!userId) {
        return res.status(400).json({ error: 'userId required' });
    }

    try {
        await ensureTeamAdminForScope(userId, teamId, scope);
    } catch (error) {
        return res.status(error.status || 403).json({ error: error.message });
    }

    const state = Buffer.from(JSON.stringify({ userId, teamId, scope })).toString('base64');

    // Scopes for Google Calendar and User Info
    const scopes = [
        'https://www.googleapis.com/auth/calendar.readonly',
        'https://www.googleapis.com/auth/calendar.events.readonly',
        'https://www.googleapis.com/auth/userinfo.email',
        'https://www.googleapis.com/auth/userinfo.profile'
    ].join(' ');

    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${GOOGLE_CLIENT_ID}&redirect_uri=${encodeURIComponent(GOOGLE_REDIRECT_URI)}&response_type=code&scope=${encodeURIComponent(scopes)}&access_type=offline&prompt=consent&state=${state}`;

    res.redirect(authUrl);
});

// Google OAuth callback
router.get('/google/oauth/callback', async (req, res) => {
    const { code, state, error } = req.query;
    const FRONTEND_URL = process.env.FRONTEND_URL || 'https://productivity-saas-frontend.vercel.app';

    if (error) {
        logger.error('Google OAuth error:', error);
        return res.redirect(`${FRONTEND_URL}/app/integrations?error=google_auth_failed`);
    }

    if (!code || !state) {
        return res.redirect(`${FRONTEND_URL}/app/integrations?error=missing_params`);
    }

    try {
        const { userId, teamId, scope: requestedScope } = JSON.parse(Buffer.from(state, 'base64').toString());
        await ensureTeamAdminForScope(userId, teamId, requestedScope || 'team');

        // Exchange code for access token
        const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: new URLSearchParams({
                code,
                client_id: GOOGLE_CLIENT_ID,
                client_secret: GOOGLE_CLIENT_SECRET,
                redirect_uri: GOOGLE_REDIRECT_URI,
                grant_type: 'authorization_code'
            })
        });

        if (!tokenResponse.ok) {
            const errData = await tokenResponse.json();
            logger.error('Google token exchange failed:', errData);
            throw new Error('Failed to exchange code for token');
        }

        const tokenData = await tokenResponse.json();

        // Get user info to use as workspace name
        const userResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
            headers: {
                'Authorization': `Bearer ${tokenData.access_token}`
            }
        });
        const userData = await userResponse.json();

        // Save integration
        await db.saveIntegration(userId, 'google_calendar', {
            accessToken: tokenData.access_token,
            refreshToken: tokenData.refresh_token,
            expiresAt: new Date(Date.now() + tokenData.expires_in * 1000).toISOString(),
            workspaceName: userData.email, // Store email as workspace name
            teamId // Our internal teamId
        }, requestedScope || 'team');

        logger.info('Google Calendar integration saved', { userId, teamId });

        res.redirect(`${FRONTEND_URL}/app/integrations?success=google_connected`);

    } catch (error) {
        logger.error('Google OAuth callback error:', error);
        const errorMessage = error.message || 'Unknown error';
        res.redirect(`${FRONTEND_URL}/app/integrations?error=oauth_failed&message=${encodeURIComponent(errorMessage)}`);
    }
});

// Check Google status (REMOVED DUPLICATE - kept only one)
router.get('/google/status', async (req, res) => {
    const { userId, teamId } = req.query;

    if (!userId) {
        return res.status(400).json({ error: 'userId required' });
    }

    try {
        await ensureTeamMemberForTeamQuery(userId, teamId);
        const integration = await db.getIntegration(userId, 'google_calendar', teamId);

        res.json({
            connected: !!integration,
            workspace: integration?.workspace_name || null
        });
    } catch (error) {
        logger.error('Google status check error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Disconnect Google
router.delete('/google/disconnect', async (req, res) => {
    const { userId, teamId } = req.query;

    if (!userId) {
        return res.status(400).json({ error: 'userId required' });
    }

    try {
        await ensureTeamAdminForScope(userId, teamId, teamId ? 'team' : 'personal');
        await db.deleteIntegration(userId, 'google_calendar', teamId);
        res.json({ success: true });
    } catch (error) {
        logger.error('Google disconnect error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Delete account
router.delete('/account', async (req, res) => {
    const { userId } = req.query;

    if (!userId) {
        return res.status(400).json({ error: 'userId required' });
    }

    try {
        await db.deleteUserAccount(userId);
        res.json({ success: true });
    } catch (error) {
        logger.error('Account deletion error:', error);
        res.status(500).json({ error: error.message });
    }
});


// ============================================
// GITHUB OAUTH ROUTES
// ============================================

const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID;
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET;
const GITHUB_REDIRECT_URI = process.env.API_BASE_URL + '/api/auth/github/oauth/callback';

// Initiate GitHub OAuth
router.get('/github/connect', async (req, res) => {
    const { userId, teamId, scope = 'team' } = req.query;

    if (!userId) {
        return res.status(400).json({ error: 'userId required' });
    }

    try {
        await ensureTeamAdminForScope(userId, teamId, scope);
    } catch (error) {
        return res.status(error.status || 403).json({ error: error.message });
    }

    const state = Buffer.from(JSON.stringify({ userId, teamId, scope })).toString('base64');

    // Scopes: https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/scopes-for-oauth-apps
    // read:user - for profile info
    // user:email - for email
    // repo - for private repos (optional, start with less?)
    // read:org - for org membership
    const scopes = [
        'read:user',
        'user:email',
        'repo'
    ].join(' ');

    const authUrl = `https://github.com/login/oauth/authorize?client_id=${GITHUB_CLIENT_ID}&redirect_uri=${encodeURIComponent(GITHUB_REDIRECT_URI)}&scope=${encodeURIComponent(scopes)}&state=${state}`;

    res.redirect(authUrl);
});

// GitHub OAuth callback
router.get('/github/oauth/callback', async (req, res) => {
    const { code, state, error } = req.query;
    const FRONTEND_URL = process.env.FRONTEND_URL || 'https://productivity-saas-frontend.vercel.app';

    if (error) {
        logger.error('GitHub OAuth error:', error);
        return res.redirect(`${FRONTEND_URL}/app/integrations?error=github_auth_failed`);
    }

    if (!code || !state) {
        return res.redirect(`${FRONTEND_URL}/app/integrations?error=missing_params`);
    }

    try {
        const { userId, teamId, scope: requestedScope } = JSON.parse(Buffer.from(state, 'base64').toString());
        await ensureTeamAdminForScope(userId, teamId, requestedScope || 'team');

        // Exchange code for access token
        const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({
                client_id: GITHUB_CLIENT_ID,
                client_secret: GITHUB_CLIENT_SECRET,
                code,
                redirect_uri: GITHUB_REDIRECT_URI
            })
        });

        const tokenData = await tokenResponse.json();

        if (tokenData.error) {
            logger.error('GitHub token exchange failed:', tokenData);
            throw new Error(tokenData.error_description || 'Failed to exchange code for token');
        }

        // Get user info
        const userResponse = await fetch('https://api.github.com/user', {
            headers: {
                'Authorization': `Bearer ${tokenData.access_token}`
            }
        });

        if (!userResponse.ok) {
            throw new Error('Failed to fetch user info');
        }

        const userData = await userResponse.json();

        // Save integration
        await db.saveIntegration(userId, 'github', {
            accessToken: tokenData.access_token,
            refreshToken: tokenData.refresh_token, // GitHub tokens might not have refresh tokens by default depending on app type
            expiresAt: tokenData.expires_in ? new Date(Date.now() + tokenData.expires_in * 1000).toISOString() : null,
            workspaceName: userData.login, // Use username as workspace/account name
            workspaceId: userData.id.toString(),
            teamId // Our internal teamId
        }, requestedScope || 'team');

        logger.info('GitHub integration saved', { userId, teamId });

        res.redirect(`${FRONTEND_URL}/app/integrations?success=github_connected`);

    } catch (error) {
        logger.error('GitHub OAuth callback error:', error);
        const errorMessage = error.message || 'Unknown error';
        res.redirect(`${FRONTEND_URL}/app/integrations?error=oauth_failed&message=${encodeURIComponent(errorMessage)}`);
    }
});

// Check GitHub status
router.get('/github/status', async (req, res) => {
    const { userId, teamId } = req.query;

    if (!userId) {
        return res.status(400).json({ error: 'userId required' });
    }

    try {
        await ensureTeamMemberForTeamQuery(userId, teamId);
        const integration = await db.getIntegration(userId, 'github', teamId);

        res.json({
            connected: !!integration,
            workspace: integration?.workspace_name || null
        });
    } catch (error) {
        logger.error('GitHub status check error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Disconnect GitHub
router.delete('/github/disconnect', async (req, res) => {
    const { userId, teamId } = req.query;

    if (!userId) {
        return res.status(400).json({ error: 'userId required' });
    }

    try {
        await ensureTeamAdminForScope(userId, teamId, teamId ? 'team' : 'personal');
        await db.deleteIntegration(userId, 'github', teamId);
        res.json({ success: true });
    } catch (error) {
        logger.error('GitHub disconnect error:', error);
        res.status(500).json({ error: error.message });
    }
});

export default router;
