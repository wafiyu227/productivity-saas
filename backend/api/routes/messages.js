import express from 'express';
import { db } from '../services/supabase-client.js';
import emailService from '../services/email-service.js';
import logger from '../utils/logger.js';
import { requireTeamMember } from '../utils/team-permissions.js';

const router = express.Router();

/**
 * GET /api/messages
 * List recent messages for the user's team, grouped by thread
 */
router.get('/', async (req, res) => {
    try {
        const { userId, teamId } = req.query;

        if (!userId || !teamId) {
            return res.status(400).json({ error: 'userId and teamId are required' });
        }

        // Verify target user is the SaaS owner
        const profile = await db.getProfile(userId);
        if (profile?.email !== 'ibrahimwafiyudeen@gmail.com') {
            return res.status(403).json({ error: 'Only the SaaS owner can access the global inbox' });
        }

        // Fetch messages for the team, ordered by creation date
        const { data: messages, error } = await db.supabase
            .from('messages')
            .select('*')
            .eq('team_id', teamId)
            .order('created_at', { ascending: false });

        if (error) throw error;

        // Group by thread_id for simpler UI handling
        const threads = messages.reduce((acc, msg) => {
            const threadId = msg.thread_id;
            if (!acc[threadId]) {
                acc[threadId] = [];
            }
            acc[threadId].push(msg);
            return acc;
        }, {});

        // Convert to array of objects { threadId, lastMessageAt, messages }
        const result = Object.entries(threads).map(([threadId, msgs]) => ({
            threadId,
            subject: msgs[0].subject,
            lastMessageAt: msgs[0].created_at,
            messages: msgs.sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
        })).sort((a, b) => new Date(b.lastMessageAt) - new Date(a.lastMessageAt));

        res.json(result);
    } catch (error) {
        logger.error('Failed to fetch messages:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/messages/reply
 * Send a reply to a message and store it in the database
 */
router.post('/reply', async (req, res) => {
    try {
        const { userId, teamId, to, subject, html, originalMessageId, previousMessageIds } = req.body;

        if (!userId || !teamId || !to || !subject || !html || !originalMessageId) {
            return res.status(400).json({ error: 'Missing required parameters' });
        }

        // Verify target user is the SaaS owner
        const profile = await db.getProfile(userId);
        if (profile?.email !== 'ibrahimwafiyudeen@gmail.com') {
            return res.status(403).json({ error: 'Only the SaaS owner can reply to global messages' });
        }

        const result = await emailService.sendReply(
            to,
            subject,
            html,
            originalMessageId,
            previousMessageIds || []
        );

        res.json({ success: true, messageId: result.id });
    } catch (error) {
        logger.error('Failed to send reply:', error);
        res.status(500).json({ error: error.message });
    }
});

export default router;
