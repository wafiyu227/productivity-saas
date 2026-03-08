import express from 'express';
import { WebClient } from '@slack/web-api';
import { db } from '../services/supabase-client.js';
import googleCalendarService from '../services/google-calendar-service.js';
import logger from '../utils/logger.js';
import { requireTeamAdmin, requireTeamMember } from '../utils/team-permissions.js';

const router = express.Router();

const SLACK_CLIENT_ID = process.env.SLACK_CLIENT_ID;
const SLACK_CLIENT_SECRET = process.env.SLACK_CLIENT_SECRET;
const FRONTEND_URL = process.env.FRONTEND_URL || 'https://teamaai.xyz';

// Asana OAuth routes
const ASANA_CLIENT_ID = process.env.ASANA_CLIENT_ID;
const ASANA_CLIENT_SECRET = process.env.ASANA_CLIENT_SECRET;

// Jira OAuth routes
const JIRA_CLIENT_ID = process.env.JIRA_CLIENT_ID;
const JIRA_CLIENT_SECRET = process.env.JIRA_CLIENT_SECRET;
const JIRA_SCOPES = (process.env.JIRA_SCOPES || 'read:jira-user read:jira-work')
    .split(/[,\s]+/)
    .filter(Boolean)
    .join(' ');

// Trello OAuth routes
const TRELLO_API_KEY = process.env.TRELLO_API_KEY;
const TRELLO_APP_NAME = process.env.TRELLO_APP_NAME || 'Teama AI';
const TRELLO_SCOPES = (process.env.TRELLO_SCOPES || 'read')
    .split(/[,\s]+/)
    .filter(Boolean)
    .join(',');
const TRELLO_EXPIRATION = process.env.TRELLO_TOKEN_EXPIRATION || '30days';

const PROJECT_MANAGEMENT_PLATFORMS = ['jira', 'asana', 'trello'];

// Google Calendar OAuth routes
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;

function resolvePublicApiBaseUrl(req) {
    const forwardedProto = req.headers['x-forwarded-proto']?.toString().split(',')[0].trim();
    const forwardedHost = req.headers['x-forwarded-host']?.toString().split(',')[0].trim();
    const protocol = forwardedProto || req.protocol || 'https';
    const host = forwardedHost || req.get('host');
    if (host) {
        return `${protocol}://${host}`;
    }

    const configuredBaseUrl = process.env.API_BASE_URL?.trim();
    if (configuredBaseUrl) {
        return configuredBaseUrl.replace(/\/+$/, '');
    }

    return 'https://api.teamaai.xyz';
}

function resolveGoogleRedirectUri(req) {
    return `${resolvePublicApiBaseUrl(req)}/api/auth/google/oauth/callback`;
}

function resolveSlackRedirectUri(req) {
    return `${resolvePublicApiBaseUrl(req)}/api/auth/slack/oauth/callback`;
}

function resolveAsanaRedirectUri(req) {
    return `${resolvePublicApiBaseUrl(req)}/api/auth/asana/oauth/callback`;
}

function resolveJiraRedirectUri(req) {
    return `${resolvePublicApiBaseUrl(req)}/api/auth/jira/oauth/callback`;
}

function resolveGithubRedirectUri(req) {
    return `${resolvePublicApiBaseUrl(req)}/api/auth/github/oauth/callback`;
}

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

/**
 * Check if token is near expiration
 * In test mode, we're more conservative (5 min buffer)
 * In production, we use 10 min buffer
 */
function isTokenNearExpiration(expiresAt) {
    if (!expiresAt) return false;
    
    const bufferMs = process.env.NODE_ENV === 'production' ? 10 * 60 * 1000 : 5 * 60 * 1000;
    const expirationTime = new Date(expiresAt).getTime();
    const currentTime = Date.now();
    
    return currentTime + bufferMs > expirationTime;
}

async function validateGoogleStatus(userId, teamId, integration) {
    if (!integration) {
        return { integration: null, needsReauth: false };
    }

    const deleteTeamId = integration.scope === 'team'
        ? (integration.team_id || teamId || null)
        : null;

    // Proactively refresh if token is near expiration
    if (isTokenNearExpiration(integration.expires_at) && integration.refresh_token) {
        try {
            logger.info('Proactively refreshing Google token during status check (near expiration)', { userId });
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
                logger.warn('Refresh token invalid, disconnecting', { userId, teamId });
                await db.deleteIntegration(userId, 'google_calendar', deleteTeamId);
                return { integration: null, needsReauth: true };
            }

            logger.warn('Proactive token refresh failed during status check', {
                userId,
                teamId,
                error: refreshError.message
            });
        }
    }

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

async function ensureSingleProjectPlatform(userId, teamId, platformToConnect) {
    const conflictingPlatforms = [];

    for (const platform of PROJECT_MANAGEMENT_PLATFORMS) {
        if (platform === platformToConnect) continue;

        const integration = await db.getIntegration(userId, platform, teamId);
        if (integration) {
            conflictingPlatforms.push(platform);
        }
    }

    if (conflictingPlatforms.length === 0) return;

    const error = new Error(
        `Only one project management platform can be connected at once. Disconnect ${conflictingPlatforms.join(', ')} before connecting ${platformToConnect}.`
    );
    error.status = 409;
    throw error;
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
    const slackRedirectUri = resolveSlackRedirectUri(req);

    const authUrl = `https://slack.com/oauth/v2/authorize?client_id=${SLACK_CLIENT_ID}&scope=${scopes}&redirect_uri=${encodeURIComponent(slackRedirectUri)}&state=${state}`;

    res.redirect(authUrl);
});

// Slack OAuth callback
router.get('/slack/oauth/callback', async (req, res) => {
    const { code, state, error } = req.query;
    const FRONTEND_URL = process.env.FRONTEND_URL || 'https://teamaai.xyz';

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
        const slackRedirectUri = resolveSlackRedirectUri(req);

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
                redirect_uri: slackRedirectUri
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
        await ensureSingleProjectPlatform(userId, teamId, 'asana');
    } catch (error) {
        if (error.status === 409) {
            return res.redirect(`${FRONTEND_URL}/app/integrations?error=oauth_failed&message=${encodeURIComponent(error.message)}`);
        }
        return res.status(error.status || 403).json({ error: error.message });
    }

    const state = Buffer.from(JSON.stringify({ userId, teamId, scope })).toString('base64');
    const asanaRedirectUri = resolveAsanaRedirectUri(req);

    const authUrl = `https://app.asana.com/-/oauth_authorize?client_id=${ASANA_CLIENT_ID}&redirect_uri=${encodeURIComponent(asanaRedirectUri)}&response_type=code&state=${state}`;

    res.redirect(authUrl);
});

// Asana OAuth callback
router.get('/asana/oauth/callback', async (req, res) => {
    const { code, state, error } = req.query;
    const FRONTEND_URL = process.env.FRONTEND_URL || 'https://teamaai.xyz';

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
        const asanaRedirectUri = resolveAsanaRedirectUri(req);

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
                redirect_uri: asanaRedirectUri,
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
// JIRA OAUTH ROUTES
// ============================================

router.get('/jira/connect', async (req, res) => {
    const { userId, teamId, scope = 'team' } = req.query;

    if (!userId) {
        return res.status(400).json({ error: 'userId required' });
    }
    if (!JIRA_CLIENT_ID || !JIRA_CLIENT_SECRET) {
        const message = 'Jira OAuth is not configured on the server.';
        return res.redirect(`${FRONTEND_URL}/app/integrations?error=oauth_failed&message=${encodeURIComponent(message)}`);
    }

    try {
        await ensureTeamAdminForScope(userId, teamId, scope);
        await ensureSingleProjectPlatform(userId, teamId, 'jira');
    } catch (error) {
        if (error.status === 409) {
            return res.redirect(`${FRONTEND_URL}/app/integrations?error=oauth_failed&message=${encodeURIComponent(error.message)}`);
        }
        return res.status(error.status || 403).json({ error: error.message });
    }

    const state = Buffer.from(JSON.stringify({ userId, teamId, scope })).toString('base64');
    const jiraRedirectUri = resolveJiraRedirectUri(req);

    const authUrl = `https://auth.atlassian.com/authorize?audience=api.atlassian.com&client_id=${JIRA_CLIENT_ID}&scope=${encodeURIComponent(JIRA_SCOPES)}&redirect_uri=${encodeURIComponent(jiraRedirectUri)}&state=${encodeURIComponent(state)}&response_type=code&prompt=consent`;

    res.redirect(authUrl);
});

router.get('/jira/oauth/callback', async (req, res) => {
    const { code, state, error } = req.query;
    const jiraRedirectUri = resolveJiraRedirectUri(req);

    if (error) {
        logger.error('Jira OAuth error:', error);
        return res.redirect(`${FRONTEND_URL}/app/integrations?error=jira_auth_failed`);
    }

    if (!code || !state) {
        return res.redirect(`${FRONTEND_URL}/app/integrations?error=missing_params`);
    }

    try {
        const { userId, teamId, scope: requestedScope } = JSON.parse(Buffer.from(state, 'base64').toString());
        await ensureTeamAdminForScope(userId, teamId, requestedScope || 'team');

        const tokenResponse = await fetch('https://auth.atlassian.com/oauth/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({
                grant_type: 'authorization_code',
                client_id: JIRA_CLIENT_ID,
                client_secret: JIRA_CLIENT_SECRET,
                code,
                redirect_uri: jiraRedirectUri
            })
        });

        if (!tokenResponse.ok) {
            const errorText = await tokenResponse.text();
            logger.error('Jira token exchange failed:', errorText);
            throw new Error('Failed to exchange Jira authorization code for token');
        }

        const tokenData = await tokenResponse.json();
        let workspace = null;

        try {
            const resourcesResponse = await fetch('https://api.atlassian.com/oauth/token/accessible-resources', {
                headers: {
                    'Authorization': `Bearer ${tokenData.access_token}`,
                    'Accept': 'application/json'
                }
            });

            if (resourcesResponse.ok) {
                const resourcesData = await resourcesResponse.json();
                workspace = Array.isArray(resourcesData) ? resourcesData[0] : null;
            }
        } catch (resourceError) {
            logger.warn('Unable to fetch Jira accessible resources:', resourceError.message);
        }

        await db.saveIntegration(userId, 'jira', {
            accessToken: tokenData.access_token,
            refreshToken: tokenData.refresh_token,
            expiresAt: Number.isFinite(tokenData.expires_in)
                ? new Date(Date.now() + tokenData.expires_in * 1000).toISOString()
                : null,
            workspaceId: workspace?.id || null,
            workspaceName: workspace?.name || workspace?.url || 'Jira',
            teamId
        }, requestedScope || 'team');

        logger.info('Jira integration saved', { userId, teamId });
        res.redirect(`${FRONTEND_URL}/app/integrations?success=jira_connected`);
    } catch (callbackError) {
        logger.error('Jira OAuth callback error:', callbackError);
        res.redirect(`${FRONTEND_URL}/app/integrations?error=oauth_failed&message=${encodeURIComponent(callbackError.message || 'Jira OAuth failed')}`);
    }
});

router.delete('/jira/disconnect', async (req, res) => {
    const { userId, teamId } = req.query;

    if (!userId) {
        return res.status(400).json({ error: 'userId required' });
    }

    try {
        await ensureTeamAdminForScope(userId, teamId, teamId ? 'team' : 'personal');
        await db.deleteIntegration(userId, 'jira', teamId);
        res.json({ success: true });
    } catch (error) {
        logger.error('Jira disconnect error:', error);
        res.status(500).json({ error: error.message });
    }
});

// ============================================
// TRELLO OAUTH ROUTES
// ============================================

router.get('/trello/connect', async (req, res) => {
    const { userId, teamId, scope = 'team' } = req.query;

    if (!userId) {
        return res.status(400).json({ error: 'userId required' });
    }
    if (!TRELLO_API_KEY) {
        const message = 'Trello OAuth is not configured on the server.';
        return res.redirect(`${FRONTEND_URL}/app/integrations?error=oauth_failed&message=${encodeURIComponent(message)}`);
    }

    try {
        await ensureTeamAdminForScope(userId, teamId, scope);
        await ensureSingleProjectPlatform(userId, teamId, 'trello');
    } catch (error) {
        if (error.status === 409) {
            return res.redirect(`${FRONTEND_URL}/app/integrations?error=oauth_failed&message=${encodeURIComponent(error.message)}`);
        }
        return res.status(error.status || 403).json({ error: error.message });
    }

    const state = Buffer.from(JSON.stringify({ userId, teamId, scope })).toString('base64');
    const returnUrl = `${FRONTEND_URL}/app/integrations?trello_oauth=1&state=${encodeURIComponent(state)}`;

    const authUrl = `https://trello.com/1/authorize?expiration=${encodeURIComponent(TRELLO_EXPIRATION)}&name=${encodeURIComponent(TRELLO_APP_NAME)}&scope=${encodeURIComponent(TRELLO_SCOPES)}&response_type=token&callback_method=fragment&key=${encodeURIComponent(TRELLO_API_KEY)}&return_url=${encodeURIComponent(returnUrl)}`;

    res.redirect(authUrl);
});

router.post('/trello/token', async (req, res) => {
    const { token, state } = req.body || {};

    if (!token || !state) {
        return res.status(400).json({ error: 'token and state are required' });
    }
    if (!TRELLO_API_KEY) {
        return res.status(500).json({ error: 'Trello API key is not configured' });
    }

    try {
        const decodedState = JSON.parse(Buffer.from(state, 'base64').toString());
        const { userId, teamId, scope: requestedScope } = decodedState;

        if (!userId) {
            return res.status(400).json({ error: 'Invalid state payload' });
        }

        await ensureTeamAdminForScope(userId, teamId, requestedScope || 'team');
        await ensureSingleProjectPlatform(userId, teamId, 'trello');

        const memberUrl = new URL('https://api.trello.com/1/members/me');
        memberUrl.searchParams.append('key', TRELLO_API_KEY);
        memberUrl.searchParams.append('token', token);

        const memberResponse = await fetch(memberUrl.toString());
        if (!memberResponse.ok) {
            const errorText = await memberResponse.text();
            logger.error('Trello member fetch failed:', errorText);
            throw new Error('Failed to validate Trello token');
        }

        const member = await memberResponse.json();

        await db.saveIntegration(userId, 'trello', {
            accessToken: token,
            workspaceId: member?.id || null,
            workspaceName: member?.fullName || member?.username || 'Trello',
            teamId
        }, requestedScope || 'team');

        logger.info('Trello integration saved', { userId, teamId });
        res.json({
            success: true,
            workspace: member?.fullName || member?.username || 'Trello'
        });
    } catch (error) {
        logger.error('Trello token save error:', error);
        res.status(error.status || 500).json({ error: error.message });
    }
});

router.delete('/trello/disconnect', async (req, res) => {
    const { userId, teamId } = req.query;

    if (!userId) {
        return res.status(400).json({ error: 'userId required' });
    }

    try {
        await ensureTeamAdminForScope(userId, teamId, teamId ? 'team' : 'personal');
        await db.deleteIntegration(userId, 'trello', teamId);
        res.json({ success: true });
    } catch (error) {
        logger.error('Trello disconnect error:', error);
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

    const googleRedirectUri = resolveGoogleRedirectUri(req);
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${GOOGLE_CLIENT_ID}&redirect_uri=${encodeURIComponent(googleRedirectUri)}&response_type=code&scope=${encodeURIComponent(scopes)}&access_type=offline&prompt=consent&state=${encodeURIComponent(state)}`;

    res.redirect(authUrl);
});

// Google OAuth callback
router.get('/google/oauth/callback', async (req, res) => {
    const { code, state, error } = req.query;
    const FRONTEND_URL = process.env.FRONTEND_URL || 'https://teamaai.xyz';
    const googleRedirectUri = resolveGoogleRedirectUri(req);

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
                redirect_uri: googleRedirectUri,
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
    const githubRedirectUri = resolveGithubRedirectUri(req);

    const authUrl = `https://github.com/login/oauth/authorize?client_id=${GITHUB_CLIENT_ID}&redirect_uri=${encodeURIComponent(githubRedirectUri)}&scope=${encodeURIComponent(scopes)}&state=${state}`;

    res.redirect(authUrl);
});

// GitHub OAuth callback
router.get('/github/oauth/callback', async (req, res) => {
    const { code, state, error } = req.query;
    const FRONTEND_URL = process.env.FRONTEND_URL || 'https://teamaai.xyz';

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
        const githubRedirectUri = resolveGithubRedirectUri(req);

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
                redirect_uri: githubRedirectUri
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
