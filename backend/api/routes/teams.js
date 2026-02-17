// UPDATED: backend/routes/teams.js
// Replace your teams.js with this version

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

    logger.info('Fetching team details:', { teamId: id });

    try {
        const { data, error } = await db.supabase
            .from('teams')
            .select('*')
            .eq('id', id)
            .single();

        if (error) {
            logger.error('Supabase error fetching team:', {
                code: error.code,
                message: error.message,
                details: error.details,
                hint: error.hint,
                teamId: id
            });

            // If it's an RLS error, log it clearly
            if (error.code === '42501' || error.code === 'PGRST301') {
                logger.error('RLS POLICY BLOCKING ACCESS - User cannot view this team');
                return res.status(403).json({
                    error: 'Access denied - you are not a member of this team',
                    code: 'RLS_POLICY_VIOLATION'
                });
            }

            throw error;
        }

        if (!data) {
            logger.warn('Team not found:', { teamId: id });
            return res.status(404).json({ error: 'Team not found' });
        }

        logger.info('Team fetched successfully:', { teamId: id, teamName: data.name });
        res.json(data);
    } catch (error) {
        logger.error('Get team error:', {
            message: error.message,
            stack: error.stack,
            teamId: id
        });
        res.status(500).json({ error: error.message });
    }
});

// Get team members
router.get('/:id/members', async (req, res) => {
    const { id } = req.params;

    logger.info('Fetching team members:', { teamId: id });

    try {
        const members = await db.getTeamMembers(id);
        logger.info('Team members fetched:', { teamId: id, count: members.length });
        res.json(members);
    } catch (error) {
        logger.error('Get team members error:', error);
        res.status(500).json({ error: error.message });
    }
});

// ✅ NEW: Get team invitations
router.get('/:id/invitations', async (req, res) => {
    const { id: teamId } = req.params;
    const { userId } = req.query;

    logger.info('Fetching team invitations:', { teamId, userId });

    if (!userId) {
        return res.status(400).json({ error: 'userId required' });
    }

    try {
        // Verify user is a member of the team (and preferably admin/owner)
        const { data: member } = await db.supabase
            .from('team_members')
            .select('role')
            .eq('team_id', teamId)
            .eq('user_id', userId)
            .single();

        if (!member) {
            logger.warn('User not a team member:', { teamId, userId });
            return res.status(403).json({ error: 'Not a team member' });
        }

        // Get invitations (check if table exists first)
        const { data: invitations, error } = await db.supabase
            .from('team_invitations')
            .select('*')
            .eq('team_id', teamId)
            .eq('status', 'pending') // ✅ Added filter
            .order('created_at', { ascending: false });

        if (error) {
            // If table doesn't exist yet, return empty array
            if (error.code === '42P01') {
                logger.warn('team_invitations table does not exist yet');
                return res.json([]);
            }
            throw error;
        }

        logger.info('Team invitations fetched:', { teamId, count: invitations?.length || 0 });
        res.json(invitations || []);
    } catch (error) {
        logger.error('Get team invitations error:', {
            message: error.message,
            teamId,
            userId
        });
        res.status(500).json({ error: error.message });
    }
});

// FIXED: backend/routes/teams.js - Invite endpoint
// Replace your invite endpoint with this

// Invite member
router.post('/:id/invite', async (req, res) => {
    const { id: teamId } = req.params;
    const { userId, email, role } = req.body;

    if (!userId || !email) {
        return res.status(400).json({ error: 'userId and email required' });
    }

    try {
        // Get team info FIRST (needed for email)
        const { data: team } = await db.supabase
            .from('teams')
            .select('name')
            .eq('id', teamId)
            .single();

        if (!team) {
            return res.status(404).json({ error: 'Team not found' });
        }

        // Create invitation
        const invitation = await db.createInvitation(teamId, userId, email);

        // Update role if specified
        if (role) {
            await db.supabase
                .from('team_invitations')
                .update({ role })
                .eq('id', invitation.id);
            invitation.role = role;
        }

        // Get inviter profile
        const inviterProfile = await db.getProfile(userId);
        const inviterName = inviterProfile?.full_name || 'A teammate';

        // ✅ FIX: Call correct method with correct parameters
        await emailService.sendTeamInvitation(
            invitation,        // First parameter: invitation object
            team.name,         // Second parameter: team name
            inviterName        // Third parameter: inviter name
        );

        logger.info('Invitation sent successfully', {
            email,
            teamId,
            teamName: team.name
        });

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