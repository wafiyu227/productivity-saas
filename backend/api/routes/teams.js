import express from 'express';
import { db } from '../services/supabase-client.js';
import emailService from '../services/email-service.js';
import logger from '../utils/logger.js';

const router = express.Router();

// Get user's teams
router.get('/', async (req, res) => {
    const { userId } = req.query;
    if (!userId) return res.status(400).json({ error: 'userId required' });

    try {
        const teams = await db.getUserTeams(userId);
        res.json(teams);
    } catch (error) {
        logger.error('Get user teams error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Create team
router.post('/', async (req, res) => {
    const { userId, name, size_range, description } = req.body;
    if (!userId || !name) return res.status(400).json({ error: 'userId and name required' });

    try {
        const team = await db.createTeam(userId, { name, size_range, description });
        res.json(team);
    } catch (error) {
        logger.error('Create team error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get team details
router.get('/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const { data, error } = await db.supabase
            .from('teams')
            .select('*')
            .eq('id', id)
            .single();
        if (error) throw error;
        res.json(data);
    } catch (error) {
        logger.error('Get team error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get team members
router.get('/:id/members', async (req, res) => {
    const { id } = req.params;
    try {
        const members = await db.getTeamMembers(id);
        res.json(members);
    } catch (error) {
        logger.error('Get team members error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Invite member
router.post('/:id/invite', async (req, res) => {
    const { id: teamId } = req.params;
    const { userId, email, role } = req.body;

    if (!userId || !email) {
        return res.status(400).json({ error: 'userId and email required' });
    }

    try {
        const invitation = await db.createInvitation(teamId, userId, email);

        // Update role if specified (schema v2 supports role in invitations)
        if (role) {
            await db.supabase
                .from('team_invitations')
                .update({ role })
                .eq('id', invitation.id);
            invitation.role = role;
        }

        const inviterProfile = await db.getProfile(userId);
        const inviterName = inviterProfile?.full_name || 'A teammate';

        await emailService.sendInvitation(email, invitation, inviterName);

        res.json(invitation);
    } catch (error) {
        logger.error('Invite member error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Remove member
router.delete('/:id/members/:userId', async (req, res) => {
    const { id: teamId, userId: memberId } = req.params;
    const { userId: requesterId } = req.query; // Who is performing the delete

    try {
        // Only owner/admin should be able to delete (handled by RLS but we can check here too)
        const { error } = await db.supabase
            .from('team_members')
            .delete()
            .eq('team_id', teamId)
            .eq('user_id', memberId);

        if (error) throw error;
        res.json({ success: true });
    } catch (error) {
        logger.error('Remove member error:', error);
        res.status(500).json({ error: error.message });
    }
});

export default router;
