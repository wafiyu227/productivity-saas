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

        if (!profile) {
            logger.warn('Profile not found for user:', userId);
            return res.status(404).json({ error: 'Profile not found', userId });
        }

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

// ✅ NEW: Check if a user exists by email (for OAuth signin validation)
router.get('/check-email', async (req, res) => {
    const { email } = req.query;

    if (!email) {
        return res.status(400).json({ error: 'email required' });
    }

    try {
        const { data, error } = await db.supabase
            .from('profiles')
            .select('id, email, full_name')
            .eq('email', email.toLowerCase())
            .single();

        if (error) {
            if (error.code === 'PGRST116') {
                // User not found
                return res.status(404).json({ exists: false, email });
            }
            throw error;
        }

        res.json({ exists: true, email, userId: data?.id });
    } catch (error) {
        logger.error('Check email error:', error);
        res.status(500).json({ error: error.message });
    }
});

export default router;
