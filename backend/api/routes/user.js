import express from 'express';
import { db } from '../services/supabase-client.js';
import emailService from '../services/email-service.js';
import logger from '../utils/logger.js';

const router = express.Router();

// Get Profile
router.get('/profile', async (req, res) => {
    const { userId } = req.query;

    if (!userId) {
        return res.status(400).json({ error: 'userId required' });
    }

    try {
        const profile = await db.getProfile(userId);
        res.json(profile || {});
    } catch (error) {
        logger.error('Get profile error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Update Profile
router.put('/profile', async (req, res) => {
    const { userId, ...profileData } = req.body;

    if (!userId) {
        return res.status(400).json({ error: 'userId required' });
    }

    try {
        // Use update to be safe, though upsert is usually fine here too
        const profile = await db.updateProfile(userId, profileData);
        res.json(profile);
    } catch (error) {
        logger.error('Update profile error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Create Team
router.post('/team', async (req, res) => {
    const { userId, name, size_range } = req.body;

    if (!userId || !name) {
        return res.status(400).json({ error: 'userId and name required' });
    }

    try {
        // Create team and link user
        // Note: db.createTeam needs to handle the transaction or sequence
        // For now assuming db.createTeam implementation from previous step
        const teamData = { name, size_range };

        // 1. Create Team and Link User
        // distinct db.createTeam handles both team creation and user linking
        const team = await db.createTeam(userId, teamData);

        res.json(team);
    } catch (error) {
        console.error('Create team error:', {
            message: error.message,
            code: error.code,
            details: error.details,
            hint: error.hint
        });
        res.status(500).json({
            error: error.message,
            code: error.code
        });
    }
});

// Get Team Members
router.get('/team/members', async (req, res) => {
    const { teamId } = req.query;

    if (!teamId) {
        return res.status(400).json({ error: 'teamId required' });
    }

    try {
        const members = await db.getTeamMembers(teamId);
        res.json(members);
    } catch (error) {
        logger.error('Get team members error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Invite Member
router.post('/team/invite', async (req, res) => {
    const { userId, teamId, email } = req.body;

    if (!userId || !teamId || !email) {
        return res.status(400).json({ error: 'userId, teamId, and email required' });
    }

    try {
        const invitation = await db.createInvitation(teamId, userId, email);

        // TODO: Send email via emailService
        // await emailService.sendInvitation(email, invitation);

        res.json(invitation);
    } catch (error) {
        logger.error('Invite member error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get Pending Invitations
router.get('/team/invitations', async (req, res) => {
    const { teamId } = req.query;

    if (!teamId) {
        return res.status(400).json({ error: 'teamId required' });
    }

    try {
        const invitations = await db.getTeamInvitations(teamId);
        res.json(invitations);
    } catch (error) {
        logger.error('Get invitations error:', error);
        res.status(500).json({ error: error.message });
    }
});

export default router;
