import express from 'express';
import { db } from '../services/supabase-client.js';
import logger from '../utils/logger.js';

const router = express.Router();

// Resolve a blocker
router.post('/resolve', express.json(), async (req, res) => {
    try {
        const { summaryId, blockIndex, userId, resolvedAt } = req.body;

        if (!summaryId || blockIndex === undefined || !userId) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        logger.info('Resolving blocker', { summaryId, blockIndex, userId });

        // Get current summary
        const { data: summary, error: fetchError } = await db.supabaseAdmin
            .from('slack_summaries')
            .select('blocker_status, blockers')
            .eq('id', summaryId)
            .single();

        if (fetchError) {
            logger.error('Failed to fetch summary', { error: fetchError });
            return res.status(500).json({ error: 'Failed to fetch summary' });
        }

        // Initialize blocker_status if it doesn't exist
        let blockerStatus = summary.blocker_status || [];

        // Ensure array is large enough
        while (blockerStatus.length <= blockIndex) {
            blockerStatus.push({ status: 'active', resolved_at: null });
        }

        // Update specific blocker status
        blockerStatus[blockIndex] = {
            status: 'resolved',
            resolved_at: resolvedAt,
            resolved_by: userId
        };

        // Update in database
        const { error: updateError } = await db.supabaseAdmin
            .from('slack_summaries')
            .update({ blocker_status: blockerStatus })
            .eq('id', summaryId);

        if (updateError) {
            logger.error('Failed to update blocker status', { error: updateError });
            return res.status(500).json({ error: 'Failed to update blocker status' });
        }

        logger.info('Blocker resolved successfully', { summaryId, blockIndex });

        res.json({
            success: true,
            message: 'Blocker resolved successfully'
        });

    } catch (error) {
        logger.error('Resolve blocker error:', { error: error.message });
        res.status(500).json({ error: error.message });
    }
});

// Get blockers for a user
router.get('/', async (req, res) => {
    try {
        const { userId } = req.query;

        if (!userId) {
            return res.status(400).json({ error: 'userId required' });
        }

        // Get user's integration
        const integration = await db.getIntegration(userId, 'slack');

        if (!integration) {
            return res.json([]);
        }

        // Fetch summaries with blockers
        const { data: summaries, error } = await db.supabaseAdmin
            .from('slack_summaries')
            .select('*')
            .eq('team_id', integration.team_id)
            .not('blockers', 'is', null)
            .order('created_at', { ascending: false });

        if (error) {
            logger.error('Failed to fetch blockers', { error });
            return res.status(500).json({ error: error.message });
        }

        res.json(summaries || []);

    } catch (error) {
        logger.error('Get blockers error:', { error: error.message });
        res.status(500).json({ error: error.message });
    }
});

export default router;