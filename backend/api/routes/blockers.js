const express = require('express');
const router = express.Router();
const supabase = require('../services/supabase-client');

// Middleware to verify user is authenticated
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'No token provided' });
    }

    // Verify token with Supabase
    supabase.auth.getSession().then(({ data: { session } }) => {
        if (!session || session.access_token !== token) {
            return res.status(403).json({ error: 'Invalid token' });
        }
        req.user = { id: session.user.id };
        next();
    }).catch(err => {
        console.error('Auth error:', err);
        res.status(403).json({ error: 'Unauthorized' });
    });
};

/**
 * POST /api/blockers/resolve
 * Marks a blocker as resolved and stores the resolution timestamp
 */
router.post('/resolve', authenticateToken, async (req, res) => {
    try {
        const { summaryId, blockIndex, resolvedAt } = req.body;
        const userId = req.user.id;

        // Validate required fields
        if (!summaryId || blockIndex === undefined || !resolvedAt) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: summaryId, blockIndex, resolvedAt'
            });
        }

        // Fetch the summary
        const { data: summary, error: fetchError } = await supabase
            .from('summaries')
            .select('*')
            .eq('id', summaryId)
            .eq('user_id', userId)
            .single();

        if (fetchError || !summary) {
            console.error('Fetch error:', fetchError);
            return res.status(404).json({
                success: false,
                error: 'Summary not found or access denied'
            });
        }

        // Get existing blocker_status or initialize as empty object
        let blockerStatus = summary.blocker_status || {};

        // If blockerStatus is a string (JSON stored as string), parse it
        if (typeof blockerStatus === 'string') {
            try {
                blockerStatus = JSON.parse(blockerStatus);
            } catch (e) {
                blockerStatus = {};
            }
        }

        // Update the specific blocker at blockIndex
        blockerStatus[blockIndex] = {
            status: 'resolved',
            resolved_at: resolvedAt
        };

        // Update the summary in database
        const { error: updateError } = await supabase
            .from('summaries')
            .update({
                blocker_status: blockerStatus,
                updated_at: new Date().toISOString()
            })
            .eq('id', summaryId)
            .eq('user_id', userId);

        if (updateError) {
            console.error('Update error:', updateError);
            return res.status(500).json({
                success: false,
                error: 'Failed to update blocker status'
            });
        }

        res.json({
            success: true,
            message: 'Blocker resolved successfully',
            blocker_status: blockerStatus
        });

    } catch (error) {
        console.error('Error in resolve blocker endpoint:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});

/**
 * GET /api/blockers/:summaryId
 * Fetch blocker resolution status for a specific summary
 */
router.get('/:summaryId', authenticateToken, async (req, res) => {
    try {
        const { summaryId } = req.params;
        const userId = req.user.id;

        const { data: summary, error } = await supabase
            .from('summaries')
            .select('id, blocker_status')
            .eq('id', summaryId)
            .eq('user_id', userId)
            .single();

        if (error || !summary) {
            return res.status(404).json({
                success: false,
                error: 'Summary not found'
            });
        }

        res.json({
            success: true,
            blocker_status: summary.blocker_status || {}
        });

    } catch (error) {
        console.error('Error fetching blocker status:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});

export default router;  // ✅ NEW (ES Modules)