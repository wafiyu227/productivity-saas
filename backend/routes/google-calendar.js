import express from 'express';
import googleCalendarService from '../services/google-calendar-service.js';
import { db } from '../services/supabase-client.js';
import { createSeededConversation } from '../services/agent-seeds.js';
import logger from '../utils/logger.js';

const router = express.Router();

async function disconnectInvalidGoogleIntegration(userId, integration) {
    try {
        await db.deleteIntegration(userId, 'google_workspace');
    } catch (disconnectError) {
        logger.warn('Failed to auto-disconnect invalid Google integration', {
            userId,
            error: disconnectError.message
        });
    }
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
        workspaceName: integration.workspace_name
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

/**
 * Proactively refresh token if near expiration
 */
async function proactiveTokenRefresh(userId, integration) {
    if (!integration || !integration.refresh_token) {
        return integration;
    }

    if (!isTokenNearExpiration(integration.expires_at)) {
        return integration;
    }

    try {
        logger.info('Proactively refreshing Google token (near expiration)', { userId });
        const newTokens = await googleCalendarService.refreshAccessToken(integration.refresh_token);

        const updatedIntegration = {
            ...integration,
            ...buildGoogleTokenUpdate(integration, newTokens)
        };

        await db.saveIntegration(
            userId,
            'google_workspace',
            buildGoogleTokenUpdate(integration, newTokens)
        );

        return updatedIntegration;
    } catch (refreshError) {
        const isInvalidGrant = refreshError?.code === 'invalid_grant';
        
        if (isInvalidGrant) {
            logger.warn('Refresh token invalid, disconnecting integration', { userId });
            await disconnectInvalidGoogleIntegration(userId, integration);
            return null;
        }

        logger.warn('Proactive token refresh failed, will retry on API call', {
            userId,
            error: refreshError.message
        });
        return integration;
    }
}

// Helper to handle token refresh on error and proactive refresh
async function handleServiceCall(userId, serviceCall) {
    let integration = await db.getIntegration(userId, 'google_workspace');

    if (!integration) {
        const error = new Error('Google Workspace not connected');
        error.status = 401;
        throw error;
    }

    if (integration.metadata?.disabled_tools?.includes('google_calendar')) {
        const error = new Error('Google Calendar access has been disabled');
        error.status = 401;
        throw error;
    }

    // Proactively refresh token if near expiration
    const refreshedIntegration = await proactiveTokenRefresh(userId, integration);
    if (refreshedIntegration === null) {
        const error = new Error('Google Calendar authorization expired. Please reconnect from Integrations.');
        error.status = 401;
        error.needsReauth = true;
        throw error;
    }
    integration = refreshedIntegration || integration;

    try {
        return await serviceCall(integration.access_token);
    } catch (error) {
        if (error.message === 'Unauthorized' || error.status === 401) {
            logger.info('Google access token expired, refreshing...', { userId });

            if (!integration.refresh_token) {
                await disconnectInvalidGoogleIntegration(userId, integration);
                const err = new Error('Session expired. Please reconnect Google Calendar.');
                err.needsReauth = true;
                err.status = 401;
                throw err;
            }

            try {
                const newTokens = await googleCalendarService.refreshAccessToken(integration.refresh_token);

                // Update DB with new token
                await db.saveIntegration(
                    userId,
                    'google_workspace',
                    buildGoogleTokenUpdate(integration, newTokens)
                );

                // Retry call with new token
                return await serviceCall(newTokens.accessToken);
            } catch (refreshError) {
                logger.error('Token refresh failed:', refreshError);
                const isInvalidGrant = refreshError?.code === 'invalid_grant';
                if (isInvalidGrant) {
                    await disconnectInvalidGoogleIntegration(userId, integration);
                }

                const err = new Error(
                    isInvalidGrant
                        ? 'Google authorization expired. Please reconnect.'
                        : 'Authentication failed. Please reconnect.'
                );
                err.needsReauth = true;
                err.status = 401;
                err.code = refreshError?.code;
                throw err;
            }
        }
        throw error;
    }
}

// Get upcoming events
router.get('/events', async (req, res) => {
    try {
        const { userId, days } = req.query;

        if (!userId) {
            return res.status(400).json({ error: 'userId required' });
        }

        const events = await handleServiceCall(userId, (accessToken) =>
            googleCalendarService.getUpcomingEvents(accessToken, days ? parseInt(days) : 7)
        );

        res.json({ events });
    } catch (error) {
        logger.error('Failed to get calendar events:', error);
        res.status(error.status || 500).json({
            error: error.message,
            needsReauth: error.needsReauth
        });
    }
});

// Get single event details
router.get('/events/:eventId', async (req, res) => {
    try {
        const { userId } = req.query;
        const { eventId } = req.params;

        if (!userId) {
            return res.status(400).json({ error: 'userId required' });
        }

        const event = await handleServiceCall(userId, (accessToken) =>
            googleCalendarService.getEventDetails(accessToken, eventId)
        );

        res.json(event);
    } catch (error) {
        logger.error('Failed to get event details:', error);
        res.status(error.status || 500).json({
            error: error.message,
            needsReauth: error.needsReauth
        });
    }
});

// Get schedule analytics
router.get('/analytics', async (req, res) => {
    try {
        const { userId, days } = req.query;

        if (!userId) {
            return res.status(400).json({ error: 'userId required' });
        }

        const analytics = await handleServiceCall(userId, (accessToken) =>
            googleCalendarService.getScheduleAnalytics(accessToken, days ? parseInt(days) : 30)
        );


        res.json(analytics);
    } catch (error) {
        logger.error('Failed to get calendar analytics:', error);
        res.status(error.status || 500).json({
            error: error.message,
            needsReauth: error.needsReauth
        });
    }
});

// Get action items from meetings
router.get('/action-items', async (req, res) => {
    try {
        const { userId, days } = req.query;

        if (!userId) {
            return res.status(400).json({ error: 'userId required' });
        }

        const data = await handleServiceCall(userId, (accessToken) =>
            googleCalendarService.getMeetingsWithActionItems(accessToken, days ? parseInt(days) : 7)
        );

        res.json(data);
    } catch (error) {
        logger.error('Failed to get action items:', error);
        res.status(error.status || 500).json({
            error: error.message,
            needsReauth: error.needsReauth
        });
    }
});

// Assign a task to the agent
router.post('/tasks/assign', express.json(), async (req, res) => {
    try {
        const { userId, task } = req.body;
        const FRONTEND_URL = (process.env.FRONTEND_URL || 'https://teamaai.xyz').replace(/\/+$/, '');

        if (!userId || !task) {
            return res.status(400).json({ error: 'userId and task required' });
        }

        logger.info('Assigning task to agent', { userId, taskTitle: task.text });

        // Standardized greeting based on task source
        const greeting = `I've added this ${task.sourceType === 'google_tasks' ? 'Google Task' : 'meeting action item'} to our focus:

**Task:** ${task.text}
**Source:** ${task.source}
${task.due ? `**Due:** ${new Date(task.due).toLocaleDateString()}` : ''}
${task.notes ? `**Notes:** ${task.notes}` : ''}

How would you like to move this forward? I can help you draft updates, research dependencies, or suggest a plan of action.`;

        const quickActions = [
            {
                label: 'Suggest Next Steps',
                prompt: `What are the best next steps to complete the task: "${task.text}"?`
            },
            {
                label: 'Draft Update',
                prompt: `Draft a concise update or message I can use regarding: "${task.text}".`
            },
            {
                label: 'Show Context',
                prompt: `Tell me more about the context of "${task.text}" based on my calendar and notes.`
            }
        ];

        const conversation = await createSeededConversation({
            userId,
            title: `Task: ${task.text.slice(0, 40)}${task.text.length > 40 ? '...' : ''}`,
            assistantText: greeting,
            quickActions,
            metadata: {
                actionType: 'task_assignment',
                taskData: task,
                createdAt: new Date().toISOString()
            }
        });

        res.json({
            success: true,
            conversationId: conversation.id,
            conversationUrl: `${FRONTEND_URL}/app/chat?conversation=${conversation.id}`
        });

    } catch (error) {
        logger.error('Failed to assign task to agent:', error);
        res.status(error.status || 500).json({ error: error.message });
    }
});

export default router;
