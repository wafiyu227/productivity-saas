import express from 'express';
import googleCalendarService from '../services/google-calendar-service.js';
import { db } from '../services/supabase-client.js';
import logger from '../utils/logger.js';

const router = express.Router();

// Helper to get fresh access token
async function getValidAccessToken(integration, userId) {
    // Check if token is expired or close to expiring (within 5 mins)
    // Note: Google tokens effectively expire in 1 hour. We could store expiration time.
    // For simplicity, we'll try to use the current token, and if it fails with 401,
    // the service layer catches it, so we can handle refresh there or here.
    // Better approach: calculate expiration if we stored it, or just try-catch-refresh.

    // As per service implementation: service throws 'Unauthorized' on 401.
    return integration.access_token;
}

// Helper to handle token refresh on error
async function handleServiceCall(userId, teamId, serviceCall) {
    const integration = await db.getIntegration(userId, 'google_calendar', teamId);

    if (!integration) {
        const error = new Error('Google Calendar not connected');
        error.status = 401;
        throw error;
    }

    try {
        return await serviceCall(integration.access_token);
    } catch (error) {
        if (error.message === 'Unauthorized' || error.status === 401) {
            logger.info('Google access token expired, refreshing...', { userId });

            if (!integration.refresh_token) {
                const err = new Error('Session expired. Please reconnect Google Calendar.');
                err.needsReauth = true;
                err.status = 401;
                throw err;
            }

            try {
                const newTokens = await googleCalendarService.refreshAccessToken(integration.refresh_token);

                // Update DB with new token
                await db.saveIntegration(userId, 'google_calendar', {
                    ...integration,
                    accessToken: newTokens.accessToken,
                    expiresIn: newTokens.expiresIn
                });

                // Retry call with new token
                return await serviceCall(newTokens.accessToken);
            } catch (refreshError) {
                logger.error('Token refresh failed:', refreshError);
                const err = new Error('Authentication failed. Please reconnect.');
                err.needsReauth = true;
                err.status = 401;
                throw err;
            }
        }
        throw error;
    }
}

// Get upcoming events
router.get('/events', async (req, res) => {
    try {
        const { userId, teamId, days } = req.query;

        if (!userId) {
            return res.status(400).json({ error: 'userId required' });
        }

        const events = await handleServiceCall(userId, teamId, (accessToken) =>
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
        const { userId, teamId } = req.query;
        const { eventId } = req.params;

        if (!userId) {
            return res.status(400).json({ error: 'userId required' });
        }

        const event = await handleServiceCall(userId, teamId, (accessToken) =>
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
        const { userId, teamId, days } = req.query;

        if (!userId) {
            return res.status(400).json({ error: 'userId required' });
        }

        const analytics = await handleServiceCall(userId, teamId, (accessToken) =>
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
        const { userId, teamId, days } = req.query;

        if (!userId) {
            return res.status(400).json({ error: 'userId required' });
        }

        const data = await handleServiceCall(userId, teamId, (accessToken) =>
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

export default router;
