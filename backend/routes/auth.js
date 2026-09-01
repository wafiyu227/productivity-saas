import express from 'express';
import { WebClient } from '@slack/web-api';
import { db } from '../services/supabase-client.js';
import googleCalendarService from '../services/google-calendar-service.js';
import { buildIntegrationCapabilitySummary, getSlackRequestedScopes, parseScopeList } from '../services/integration-capabilities.js';
import logger from '../utils/logger.js';

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
const JIRA_SCOPES = (process.env.JIRA_SCOPES || 'read:jira-user read:jira-work write:jira-work offline_access')
    .split(/[,\s]+/)
    .filter(Boolean)
    .join(' ');



const PROJECT_MANAGEMENT_PLATFORMS = ['jira', 'asana'];

// Google Calendar OAuth routes
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const DEFAULT_FRONTEND_RETURN_PATH = '/app/integrations';

function normalizeFrontendReturnPath(returnTo) {
    if (typeof returnTo !== 'string') {
        return DEFAULT_FRONTEND_RETURN_PATH;
    }

    const trimmed = returnTo.trim();
    if (!trimmed || trimmed.startsWith('//')) {
        return DEFAULT_FRONTEND_RETURN_PATH;
    }

    if (trimmed.startsWith('/')) {
        return trimmed;
    }

    try {
        const parsed = new URL(trimmed, FRONTEND_URL);
        const frontendOrigin = new URL(FRONTEND_URL).origin;

        if (parsed.origin === frontendOrigin) {
            return `${parsed.pathname}${parsed.search}${parsed.hash}`;
        }
    } catch {
        // Fall back to the default integrations page.
    }

    return DEFAULT_FRONTEND_RETURN_PATH;
}

function encodeOAuthState(payload) {
    return Buffer.from(JSON.stringify(payload)).toString('base64');
}

function decodeOAuthState(rawState) {
    if (typeof rawState !== 'string' || !rawState) {
        return null;
    }

    try {
        return JSON.parse(Buffer.from(rawState, 'base64').toString());
    } catch {
        return null;
    }
}

function resolveFrontendReturnPath(req, statePayload = null) {
    const requestedReturnTo = typeof req.query.returnTo === 'string'
        ? req.query.returnTo
        : statePayload?.returnTo;

    return normalizeFrontendReturnPath(requestedReturnTo);
}

function buildFrontendRedirectUrl(returnTo, params = {}) {
    const redirectUrl = new URL(normalizeFrontendReturnPath(returnTo), FRONTEND_URL);

    Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
            redirectUrl.searchParams.set(key, value);
        }
    });

    return redirectUrl.toString();
}

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

async function validateGoogleStatus(userId, integration) {
    if (!integration) {
        return { integration: null, needsReauth: false };
    }


    // Proactively refresh if token is near expiration
    if (isTokenNearExpiration(integration.expires_at) && integration.refresh_token) {
        try {
            logger.info('Proactively refreshing Google token during status check (near expiration)', { userId });
            const newTokens = await googleCalendarService.refreshAccessToken(integration.refresh_token);
            await db.saveIntegration(
                userId,
                'google_workspace',
                buildGoogleTokenUpdate(integration, newTokens),
                integration.scope || 'team'
            );

            return { integration, needsReauth: false };
        } catch (refreshError) {
            const isInvalidGrant = refreshError?.code === 'invalid_grant';
            if (isInvalidGrant) {
                logger.warn('Refresh token invalid, disconnecting', { userId });
                await db.deleteIntegration(userId, 'google_workspace');
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
                error: error.message
            });
            return { integration, needsReauth: false };
        }
    }

    if (!integration.refresh_token) {
        await db.deleteIntegration(userId, 'google_workspace');
        return { integration: null, needsReauth: true };
    }

    try {
        const newTokens = await googleCalendarService.refreshAccessToken(integration.refresh_token);
        await db.saveIntegration(
            userId,
            'google_workspace',
            buildGoogleTokenUpdate(integration, newTokens)
        );

        return { integration, needsReauth: false };
    } catch (refreshError) {
        const isInvalidGrant = refreshError?.code === 'invalid_grant';
        if (isInvalidGrant) {
            await db.deleteIntegration(userId, 'google_workspace');
            return { integration: null, needsReauth: true };
        }

        logger.warn('Google token refresh failed during status check', {
            userId,
            error: refreshError.message
        });

        return { integration, needsReauth: false };
    }
}





// Initiate OAuth flow
router.get('/slack/connect', async (req, res) => {
    const { userId } = req.query;

    const returnTo = resolveFrontendReturnPath(req);

    if (!userId) {
        return res.status(400).json({ error: 'userId required' });
    }

    const state = Buffer.from(JSON.stringify({ userId })).toString('base64');


    const userScopes = getSlackRequestedScopes().join(',');
    const slackRedirectUri = resolveSlackRedirectUri(req);

    const authUrl = `https://slack.com/oauth/v2/authorize?client_id=${SLACK_CLIENT_ID}&user_scope=${userScopes}&redirect_uri=${encodeURIComponent(slackRedirectUri)}&state=${state}`;

    res.redirect(authUrl);
});

// Slack OAuth callback
router.get('/slack/oauth/callback', async (req, res) => {
    const { code, state, error } = req.query;
    const statePayload = decodeOAuthState(state);
    const returnTo = resolveFrontendReturnPath(req, statePayload);

    if (error) {
        logger.error('Slack OAuth error:', error);
        return res.redirect(buildFrontendRedirectUrl(returnTo, { error: 'slack_auth_failed' }));
    }

    if (!code || !state) {
        return res.redirect(buildFrontendRedirectUrl(returnTo, { error: 'missing_params' }));
    }

    try {
        if (!statePayload?.userId) {
            return res.redirect(buildFrontendRedirectUrl(returnTo, { error: 'missing_params' }));
        }

        const { userId } = statePayload;

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

        const userToken = tokenData.authed_user?.access_token;
        const botToken = tokenData.access_token;
        const finalAccessToken = userToken || botToken;

        await db.saveIntegration(userId, 'slack', {
            accessToken: finalAccessToken,
            botUserId: tokenData.bot_user_id || tokenData.authed_user?.id,
            scope: tokenData.authed_user?.scope || tokenData.scope,
            grantedScopes: parseScopeList(tokenData.authed_user?.scope || tokenData.scope),
            workspaceId: tokenData.team?.id,
            workspaceName: tokenData.team?.name
        });

        logger.info('Slack integration saved', { userId });


        // Redirect back
        res.redirect(buildFrontendRedirectUrl(returnTo, { success: 'slack_connected' }));

    } catch (error) {
        logger.error('Slack OAuth callback error:', error);
        res.redirect(buildFrontendRedirectUrl(returnTo, { error: 'oauth_failed' }));
    }
});

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

router.get('/status', async (req, res) => {
    const { userId, platform } = req.query;


    if (!userId || !platform) {
        return res.status(400).json({ error: 'userId and platform required' });
    }

    try {
        const dbPlatform = platform === 'google' || platform === 'google_workspace' ? 'google_workspace' : platform;
        let integration = await db.getIntegration(userId, dbPlatform);
        let needsReauth = false;

        if (dbPlatform === 'google_workspace' && integration) {
            const validation = await validateGoogleStatus(userId, integration);
            integration = validation.integration;
            needsReauth = validation.needsReauth;
        }


        const capabilitySummary = buildIntegrationCapabilitySummary(dbPlatform, integration);

        res.json({
            connected: !!integration,
            platform: platform,
            workspace: integration?.workspace_name || integration?.team_name || null,
            team: integration?.team_name || null,
            workspaceId: integration?.workspace_id || integration?.team_id || null,
            createdAt: integration?.created_at || null,
            updatedAt: integration?.updated_at || null,
            needsReauth,
            grantedScopes: capabilitySummary?.grantedScopes || [],
            grantedScopeCount: capabilitySummary?.grantedScopeCount || 0,
            capabilities: capabilitySummary?.capabilities || [],
            agentActions: capabilitySummary?.agentActions || [],
            additionalScopes: capabilitySummary?.additionalScopes || [],
            scopeSource: capabilitySummary?.scopeSource || null,
            metadata: integration?.metadata || {}
        });
    } catch (error) {
        logger.error(`Status check error for ${platform}:`, error);
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
    const { userId } = req.query;

    const returnTo = resolveFrontendReturnPath(req);

    if (!userId) {
        return res.status(400).json({ error: 'userId required' });
    }



    const state = encodeOAuthState({ userId, returnTo });

    const asanaRedirectUri = resolveAsanaRedirectUri(req);

    const authUrl = `https://app.asana.com/-/oauth_authorize?client_id=${ASANA_CLIENT_ID}&redirect_uri=${encodeURIComponent(asanaRedirectUri)}&response_type=code&state=${state}`;

    res.redirect(authUrl);
});

// Asana OAuth callback
router.get('/asana/oauth/callback', async (req, res) => {
    const { code, state, error } = req.query;
    const statePayload = decodeOAuthState(state);
    const returnTo = resolveFrontendReturnPath(req, statePayload);

    if (error) {
        logger.error('Asana OAuth error:', error);
        return res.redirect(buildFrontendRedirectUrl(returnTo, { error: 'asana_auth_failed' }));
    }

    if (!code || !state) {
        return res.redirect(buildFrontendRedirectUrl(returnTo, { error: 'missing_params' }));
    }

    try {
        if (!statePayload?.userId) {
            return res.redirect(buildFrontendRedirectUrl(returnTo, { error: 'missing_params' }));
        }

        const { userId, teamId, scope: requestedScope } = statePayload;
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

        await db.saveIntegration(userId, 'asana', {
            accessToken: tokenData.access_token,
            refreshToken: tokenData.refresh_token,
            scope: tokenData.scope,
            grantedScopes: parseScopeList(tokenData.scope),
            workspaceId: workspace?.gid,
            workspaceName: workspace?.name,
        });

        logger.info('Asana integration saved', { userId });


        res.redirect(buildFrontendRedirectUrl(returnTo, { success: 'asana_connected' }));

    } catch (error) {
        logger.error('Asana OAuth callback error:', error);
        res.redirect(buildFrontendRedirectUrl(returnTo, { error: 'oauth_failed' }));
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

// ============================================
// JIRA OAUTH ROUTES
// ============================================

router.get('/jira/connect', async (req, res) => {
    const { userId } = req.query;

    const returnTo = resolveFrontendReturnPath(req);

    if (!userId) {
        return res.status(400).json({ error: 'userId required' });
    }
    const jiraClientId = process.env.JIRA_CLIENT_ID || JIRA_CLIENT_ID;
    const jiraClientSecret = process.env.JIRA_CLIENT_SECRET || JIRA_CLIENT_SECRET;
    if (!jiraClientId || !jiraClientSecret) {
        logger.error('Jira OAuth not configured', { hasClientId: !!jiraClientId, hasClientSecret: !!jiraClientSecret });
        const message = 'Jira OAuth is not configured on the server.';
        return res.redirect(buildFrontendRedirectUrl(returnTo, {
            error: 'oauth_failed',
            message
        }));
    }



    const jiraScopes = (process.env.JIRA_SCOPES || JIRA_SCOPES || 'read:jira-user read:jira-work write:jira-work offline_access').split(/[,\s]+/).filter(Boolean).join(' ');
    const state = encodeOAuthState({ userId, returnTo });

    const jiraRedirectUri = resolveJiraRedirectUri(req);

    const authUrl = `https://auth.atlassian.com/authorize?audience=api.atlassian.com&client_id=${jiraClientId}&scope=${encodeURIComponent(jiraScopes)}&redirect_uri=${encodeURIComponent(jiraRedirectUri)}&state=${encodeURIComponent(state)}&response_type=code&prompt=consent`;

    res.redirect(authUrl);
});

router.get('/jira/oauth/callback', async (req, res) => {
    const { code, state, error } = req.query;
    const statePayload = decodeOAuthState(state);
    const returnTo = resolveFrontendReturnPath(req, statePayload);
    const jiraRedirectUri = resolveJiraRedirectUri(req);

    if (error) {
        logger.error('Jira OAuth error:', error);
        return res.redirect(buildFrontendRedirectUrl(returnTo, { error: 'jira_auth_failed' }));
    }

    if (!code || !state) {
        return res.redirect(buildFrontendRedirectUrl(returnTo, { error: 'missing_params' }));
    }

    try {
        if (!statePayload?.userId) {
            return res.redirect(buildFrontendRedirectUrl(returnTo, { error: 'missing_params' }));
        }

        const { userId, teamId, scope: requestedScope } = statePayload;

        const tokenResponse = await fetch('https://auth.atlassian.com/oauth/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({
                grant_type: 'authorization_code',
                client_id: process.env.JIRA_CLIENT_ID || JIRA_CLIENT_ID,
                client_secret: process.env.JIRA_CLIENT_SECRET || JIRA_CLIENT_SECRET,
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
            scope: tokenData.scope,
            grantedScopes: parseScopeList(tokenData.scope),
            workspaceId: workspace?.id || null,
            workspaceName: workspace?.name || workspace?.url || 'Jira',
        });

        logger.info('Jira integration saved', { userId });

        res.redirect(buildFrontendRedirectUrl(returnTo, { success: 'jira_connected' }));
    } catch (callbackError) {
        logger.error('Jira OAuth callback error:', callbackError);
        res.redirect(buildFrontendRedirectUrl(returnTo, {
            error: 'oauth_failed',
            message: callbackError.message || 'Jira OAuth failed'
        }));
    }
});

router.delete('/jira/disconnect', async (req, res) => {
    const { userId } = req.query;


    if (!userId) {
        return res.status(400).json({ error: 'userId required' });
    }

    try {
        await db.deleteIntegration(userId, 'jira');

        res.json({ success: true });
    } catch (error) {
        logger.error('Jira disconnect error:', error);
        res.status(500).json({ error: error.message });
    }
});



// ============================================
// GOOGLE WORKSPACE OAUTH ROUTES
// ============================================

// Map each virtual tool to its Google OAuth scope(s)
const GOOGLE_TOOL_SCOPES = {
    google_drive: ['https://www.googleapis.com/auth/drive'],
    google_docs: ['https://www.googleapis.com/auth/documents'],
    google_sheets: ['https://www.googleapis.com/auth/spreadsheets'],
    google_slides: ['https://www.googleapis.com/auth/presentations'],
    google_calendar: ['https://www.googleapis.com/auth/calendar', 'https://www.googleapis.com/auth/calendar.events'],
    google_tasks: ['https://www.googleapis.com/auth/tasks'],
    gmail: ['https://mail.google.com/']
};

const GOOGLE_BASE_SCOPES = [
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/userinfo.profile'
];

const ALL_GOOGLE_VIRTUAL_TOOLS = Object.keys(GOOGLE_TOOL_SCOPES);

/**
 * Build the Google OAuth scope string, excluding scopes for disabled tools.
 * @param {string[]} disabledTools - Array of virtual tool keys to exclude
 * @returns {string} Space-separated scope string
 */
function buildGoogleScopesForTools(disabledTools = []) {
    const disabledSet = new Set(disabledTools);
    const scopes = [...GOOGLE_BASE_SCOPES];

    for (const [tool, toolScopes] of Object.entries(GOOGLE_TOOL_SCOPES)) {
        if (!disabledSet.has(tool)) {
            scopes.push(...toolScopes);
        }
    }

    return scopes.join(' ');
}

// Initiate Google Workspace OAuth
// Accepts optional `disabledTools` query param (comma-separated) to exclude scopes for specific tools
router.get('/google_workspace/connect', async (req, res) => {
    const { userId } = req.query;

    const returnTo = resolveFrontendReturnPath(req);

    if (!userId) {
        return res.status(400).json({ error: 'userId required' });
    }

    // Parse disabled tools from query param (comma-separated)
    const disabledToolsParam = typeof req.query.disabledTools === 'string' ? req.query.disabledTools : '';
    const disabledTools = disabledToolsParam
        .split(',')
        .map(t => t.trim())
        .filter(t => ALL_GOOGLE_VIRTUAL_TOOLS.includes(t));

    const state = encodeOAuthState({ userId, returnTo, disabledTools });

    // Build scopes excluding disabled tools
    const scopes = buildGoogleScopesForTools(disabledTools);

    const googleRedirectUri = resolveGoogleRedirectUri(req);
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${GOOGLE_CLIENT_ID}&redirect_uri=${encodeURIComponent(googleRedirectUri)}&response_type=code&scope=${encodeURIComponent(scopes)}&access_type=offline&prompt=consent&state=${encodeURIComponent(state)}`;

    res.redirect(authUrl);
});

// Google OAuth callback (Keeping /google/oauth/callback to avoid breaking Google Console redirect URIs)
router.get('/google/oauth/callback', async (req, res) => {
    const { code, state, error } = req.query;
    const statePayload = decodeOAuthState(state);
    const returnTo = resolveFrontendReturnPath(req, statePayload);
    const googleRedirectUri = resolveGoogleRedirectUri(req);

    if (error) {
        logger.error('Google OAuth error:', error);
        return res.redirect(buildFrontendRedirectUrl(returnTo, { error: 'google_auth_failed' }));
    }

    if (!code || !state) {
        return res.redirect(buildFrontendRedirectUrl(returnTo, { error: 'missing_params' }));
    }

    try {
        if (!statePayload?.userId) {
            return res.redirect(buildFrontendRedirectUrl(returnTo, { error: 'missing_params' }));
        }

        const { userId, disabledTools } = statePayload;

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

        // Build metadata with disabled_tools from OAuth state
        const metadata = {};
        if (Array.isArray(disabledTools) && disabledTools.length > 0) {
            metadata.disabled_tools = disabledTools.filter(t => ALL_GOOGLE_VIRTUAL_TOOLS.includes(t));
        } else {
            metadata.disabled_tools = [];
        }

        await db.saveIntegration(userId, 'google_workspace', {
            accessToken: tokenData.access_token,
            refreshToken: tokenData.refresh_token,
            expiresAt: new Date(Date.now() + tokenData.expires_in * 1000).toISOString(),
            scope: tokenData.scope,
            grantedScopes: parseScopeList(tokenData.scope),
            workspaceName: userData.email, // Store email as workspace name
            metadata,
        });

        logger.info('Google Workspace integration saved', { userId, disabledTools: metadata.disabled_tools });

        res.redirect(buildFrontendRedirectUrl(returnTo, { success: 'google_workspace_connected' }));

    } catch (error) {
        logger.error('Google OAuth callback error:', error);
        const errorMessage = error.message || 'Unknown error';
        res.redirect(buildFrontendRedirectUrl(returnTo, {
            error: 'oauth_failed',
            message: errorMessage
        }));
    }
});

// Check Google Workspace status
router.get('/google_workspace/status', async (req, res) => {
    const { userId } = req.query;

    if (!userId) {
        return res.status(400).json({ error: 'userId required' });
    }

    try {
        const integration = await db.getIntegration(userId, 'google_workspace');

        res.json({
            connected: !!integration,
            workspace: integration?.workspace_name || null
        });
    } catch (error) {
        logger.error('Google Workspace status check error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Delete Google Workspace integration
router.delete('/google_workspace/disconnect', async (req, res) => {
    const { userId } = req.query;

    if (!userId) {
        return res.status(400).json({ error: 'userId is required' });
    }

    try {
        await db.deleteIntegration(userId, 'google_workspace');
        res.json({ success: true });
    } catch (error) {
        logger.error('Failed to delete Google Workspace integration:', error);
        res.status(500).json({ error: error.message });
    }
});

// Toggle virtual tools within Google Workspace
router.patch('/google_workspace/virtual_tool', async (req, res) => {
    const { userId, tool, action } = req.body;
    if (!userId || !tool || !['enable', 'disable'].includes(action)) {
        return res.status(400).json({ error: 'userId, tool, and action required' });
    }
    try {
        const integration = await db.getIntegration(userId, 'google_workspace');
        if (!integration) return res.status(404).json({ error: 'Google workspace not connected' });
        
        let metadata = integration.metadata || {};
        metadata.disabled_tools = metadata.disabled_tools || [];
        
        if (action === 'disable') {
            if (!metadata.disabled_tools.includes(tool)) metadata.disabled_tools.push(tool);
        } else {
            metadata.disabled_tools = metadata.disabled_tools.filter(t => t !== tool);
        }

        const ALL_VIRTUAL_TOOLS = ['google_drive', 'google_sheets', 'google_slides', 'google_docs', 'google_calendar', 'google_tasks', 'gmail'];
        
        if (metadata.disabled_tools.length >= ALL_VIRTUAL_TOOLS.length && action === 'disable') {
            // All tools disabled, so disconnect entirely
            await db.deleteIntegration(userId, 'google_workspace');
            return res.json({ connected: false });
        }

        const { error } = await db.supabase
            .from('integrations')
            .update({ metadata })
            .eq('id', integration.id);
            
        if (error) throw error;

        res.json({ success: true, metadata });
    } catch (error) {
        logger.error('Failed to update virtual tool:', error);
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
    const { userId } = req.query;


    if (!userId) {
        return res.status(400).json({ error: 'userId required' });
    }

    const state = Buffer.from(JSON.stringify({ userId })).toString('base64');


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
        const { userId } = JSON.parse(Buffer.from(state, 'base64').toString());

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

        await db.saveIntegration(userId, 'github', {
            accessToken: tokenData.access_token,
            refreshToken: tokenData.refresh_token, // GitHub tokens might not have refresh tokens by default depending on app type
            expiresAt: tokenData.expires_in ? new Date(Date.now() + tokenData.expires_in * 1000).toISOString() : null,
            scope: tokenData.scope,
            grantedScopes: parseScopeList(tokenData.scope),
            workspaceName: userData.login, // Use username as workspace/account name
            workspaceId: userData.id.toString(),
        });

        logger.info('GitHub integration saved', { userId });


        res.redirect(`${FRONTEND_URL}/app/integrations?success=github_connected`);

    } catch (error) {
        logger.error('GitHub OAuth callback error:', error);
        const errorMessage = error.message || 'Unknown error';
        res.redirect(`${FRONTEND_URL}/app/integrations?error=oauth_failed&message=${encodeURIComponent(errorMessage)}`);
    }
});

// Check GitHub status
router.get('/github/status', async (req, res) => {
    const { userId } = req.query;


    if (!userId) {
        return res.status(400).json({ error: 'userId required' });
    }

    try {
        const integration = await db.getIntegration(userId, 'github');


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
    const { userId } = req.query;


    if (!userId) {
        return res.status(400).json({ error: 'userId required' });
    }

    try {
        await db.deleteIntegration(userId, 'github');

        res.json({ success: true });
    } catch (error) {
        logger.error('GitHub disconnect error:', error);
        res.status(500).json({ error: error.message });
    }
});

export default router;
