import express from 'express';
import { db } from '../services/supabase-client.js';
import logger from '../utils/logger.js';

const router = express.Router();

// Get current user profile and teams
router.get('/me', async (req, res) => {
    const { userId } = req.query;

    if (!userId) {
        return res.status(400).json({ error: 'userId required' });
    }

    try {
        const profile = await db.getProfile(userId);
        const teams = await db.getUserTeams(userId);

        res.json({
            ...profile,
            teams
        });
    } catch (error) {
        logger.error('Get profile/me error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Update profile
router.put('/me', async (req, res) => {
    const { userId, ...profileData } = req.body;

    if (!userId) {
        return res.status(400).json({ error: 'userId required' });
    }

    try {
        const profile = await db.updateProfile(userId, profileData);
        res.json(profile);
    } catch (error) {
        logger.error('Update profile error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Switch current team
router.put('/current-team', async (req, res) => {
    const { userId, teamId } = req.body;

    if (!userId || !teamId) {
        return res.status(400).json({ error: 'userId and teamId required' });
    }

    try {
        // Verify user is a member of the team
        const userTeams = await db.getUserTeams(userId);
        const isMember = userTeams.some(t => t.team_id === teamId);

        if (!isMember) {
            return res.status(403).json({ error: 'User is not a member of this team' });
        }

        const profile = await db.updateProfile(userId, { current_team_id: teamId });
        res.json(profile);
    } catch (error) {
        logger.error('Switch team error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Legacy routes for backward compatibility (optional, but good for transition)
router.get('/profile', async (req, res) => {
    const { userId } = req.query;
    try {
        const profile = await db.getProfile(userId);
        res.json(profile || {});
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.put('/profile', async (req, res) => {
    const { userId, ...profileData } = req.body;
    try {
        const profile = await db.updateProfile(userId, profileData);
        res.json(profile);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

export default router;
