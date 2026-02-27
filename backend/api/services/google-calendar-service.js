import logger from '../utils/logger.js';

class GoogleCalendarService {
    constructor() {
        this.baseUrl = 'https://www.googleapis.com/calendar/v3';
    }

    /**
     * Refresh an expired access token using the refresh token
     */
    async refreshAccessToken(refreshToken) {
        const response = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: new URLSearchParams({
                client_id: process.env.GOOGLE_CLIENT_ID,
                client_secret: process.env.GOOGLE_CLIENT_SECRET,
                refresh_token: refreshToken,
                grant_type: 'refresh_token'
            })
        });

        if (!response.ok) {
            let errorData = null;
            try {
                errorData = await response.json();
            } catch {
                // Ignore JSON parse errors and fall back to a generic message below.
            }

            logger.error('Failed to refresh Google token:', {
                status: response.status,
                error: errorData
            });

            const error = new Error(
                errorData?.error_description ||
                errorData?.error ||
                'Failed to refresh Google access token'
            );
            error.status = response.status;
            error.code = errorData?.error;
            error.details = errorData;
            throw error;
        }

        const data = await response.json();
        return {
            accessToken: data.access_token,
            refreshToken: data.refresh_token,
            expiresIn: data.expires_in
        };
    }

    /**
     * Get upcoming calendar events
     */
    async getUpcomingEvents(accessToken, days = 7) {
        try {
            const now = new Date();
            const futureDate = new Date();
            futureDate.setDate(now.getDate() + days);

            const params = new URLSearchParams({
                timeMin: now.toISOString(),
                timeMax: futureDate.toISOString(),
                singleEvents: 'true',
                orderBy: 'startTime',
                maxResults: '50'
            });

            const response = await fetch(
                `${this.baseUrl}/calendars/primary/events?${params}`,
                {
                    headers: {
                        'Authorization': `Bearer ${accessToken}`
                    }
                }
            );

            if (!response.ok) {
                const error = await response.json();
                logger.error('Failed to fetch calendar events:', error);
                if (response.status === 401) {
                    throw new Error('Unauthorized');
                }
                throw new Error('Failed to fetch calendar events');
            }

            const data = await response.json();

            return data.items?.map(event => ({
                id: event.id,
                title: event.summary || 'No Title',
                description: event.description || '',
                start: event.start?.dateTime || event.start?.date,
                end: event.end?.dateTime || event.end?.date,
                isAllDay: !event.start?.dateTime,
                location: event.location || '',
                meetingLink: event.hangoutLink || event.conferenceData?.entryPoints?.[0]?.uri || '',
                attendees: event.attendees?.map(a => ({
                    email: a.email,
                    name: a.displayName || a.email.split('@')[0],
                    responseStatus: a.responseStatus,
                    organizer: a.organizer || false
                })) || [],
                organizer: event.organizer?.email || '',
                status: event.status,
                htmlLink: event.htmlLink
            })) || [];

        } catch (error) {
            logger.error('Error fetching upcoming events:', error);
            throw error;
        }
    }

    /**
     * Get a single event by ID
     */
    async getEventDetails(accessToken, eventId) {
        try {
            const response = await fetch(
                `${this.baseUrl}/calendars/primary/events/${eventId}`,
                {
                    headers: {
                        'Authorization': `Bearer ${accessToken}`
                    }
                }
            );

            if (!response.ok) {
                if (response.status === 401) {
                    throw new Error('Unauthorized');
                }
                throw new Error('Failed to fetch event details');
            }

            const event = await response.json();

            return {
                id: event.id,
                title: event.summary || 'No Title',
                description: event.description || '',
                start: event.start?.dateTime || event.start?.date,
                end: event.end?.dateTime || event.end?.date,
                isAllDay: !event.start?.dateTime,
                location: event.location || '',
                meetingLink: event.hangoutLink || event.conferenceData?.entryPoints?.[0]?.uri || '',
                attendees: event.attendees?.map(a => ({
                    email: a.email,
                    name: a.displayName || a.email.split('@')[0],
                    responseStatus: a.responseStatus
                })) || [],
                organizer: event.organizer?.email || '',
                htmlLink: event.htmlLink,
                created: event.created,
                updated: event.updated
            };

        } catch (error) {
            logger.error('Error fetching event details:', error);
            throw error;
        }
    }

    /**
     * Get schedule analytics - time spent in meetings
     */
    async getScheduleAnalytics(accessToken, days = 30) {
        try {
            const events = await this.getUpcomingEvents(accessToken, days);

            let totalMeetingMinutes = 0;
            let meetingsByDay = {};
            let meetingsByHour = Array(24).fill(0);

            events.forEach(event => {
                if (event.isAllDay) return; // Skip all-day events

                const start = new Date(event.start);
                const end = new Date(event.end);
                const durationMinutes = (end - start) / (1000 * 60);

                totalMeetingMinutes += durationMinutes;

                // Group by day
                const dayKey = start.toISOString().split('T')[0];
                meetingsByDay[dayKey] = (meetingsByDay[dayKey] || 0) + durationMinutes;

                // Group by hour
                const hour = start.getHours();
                meetingsByHour[hour]++;
            });

            const totalMeetings = events.filter(e => !e.isAllDay).length;
            const avgMeetingLength = totalMeetings > 0 ? Math.round(totalMeetingMinutes / totalMeetings) : 0;
            const totalHours = Math.round(totalMeetingMinutes / 60);

            // Find busiest day
            let busiestDay = null;
            let maxMinutes = 0;
            Object.entries(meetingsByDay).forEach(([day, minutes]) => {
                if (minutes > maxMinutes) {
                    maxMinutes = minutes;
                    busiestDay = day;
                }
            });

            // Find peak hours
            const peakHour = meetingsByHour.indexOf(Math.max(...meetingsByHour));

            return {
                totalMeetings,
                totalHours,
                avgMeetingLength,
                busiestDay,
                busiestDayHours: Math.round(maxMinutes / 60),
                peakHour: `${peakHour}:00 - ${peakHour + 1}:00`,
                meetingsPerDay: Object.entries(meetingsByDay).map(([date, minutes]) => ({
                    date,
                    hours: Math.round(minutes / 60 * 10) / 10,
                    count: events.filter(e => e.start?.startsWith(date)).length
                })),
                focusTimePercent: Math.round((1 - (totalMeetingMinutes / (days * 8 * 60))) * 100)
            };

        } catch (error) {
            logger.error('Error calculating schedule analytics:', error);
            throw error;
        }
    }

    /**
     * Extract action items from event descriptions
     */
    extractActionItems(events) {
        const actionItems = [];
        const actionPatterns = [
            /\[\s*\]\s*(.+)/gm,           // [ ] Todo item
            /TODO[:\s]+(.+)/gim,          // TODO: item
            /ACTION[:\s]+(.+)/gim,        // ACTION: item
            /- \[ \]\s*(.+)/gm,           // - [ ] Markdown checkbox
            /•\s*(.+)/gm                   // • Bullet point
        ];

        events.forEach(event => {
            if (!event.description) return;

            actionPatterns.forEach(pattern => {
                let match;
                while ((match = pattern.exec(event.description)) !== null) {
                    actionItems.push({
                        text: match[1].trim(),
                        source: event.title,
                        eventId: event.id,
                        eventDate: event.start
                    });
                }
            });
        });

        return actionItems;
    }

    /**
     * Get upcoming meetings with action items
     */
    async getMeetingsWithActionItems(accessToken, days = 7) {
        try {
            const events = await this.getUpcomingEvents(accessToken, days);
            const actionItems = this.extractActionItems(events);

            return {
                events,
                actionItems,
                totalEvents: events.length,
                totalActionItems: actionItems.length
            };

        } catch (error) {
            logger.error('Error getting meetings with action items:', error);
            throw error;
        }
    }
}

export const googleCalendarService = new GoogleCalendarService();
export default googleCalendarService;
