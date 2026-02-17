// COMPLETE: backend/routes/invitations.js
// This is a complete, working invitations route file

import express from 'express';
import { db } from '../services/supabase-client.js';
import emailService from '../services/email-service.js';
import logger from '../utils/logger.js';
import crypto from 'crypto';

const router = express.Router();

// Get invitation by token (for join page)
router.get('/:token', async (req, res) => {
    try {
        const { token } = req.params;

        logger.info('Fetching invitation by token', { token: token.substring(0, 10) + '...' });

        const { data: invitation, error } = await db.supabase
            .from('team_invitations')
            .select(`
        *,
        teams (
          id,
          name,
          description
        )
      `)
            .eq('token', token)
            .single();

        if (error) {
            logger.error('Error fetching invitation:', error);
            return res.status(404).json({ error: 'Invitation not found' });
        }

        if (!invitation) {
            logger.warn('Invitation not found', { token: token.substring(0, 10) + '...' });
            return res.status(404).json({ error: 'Invitation not found' });
        }

        // Check if expired
        if (new Date(invitation.expires_at) < new Date()) {
            logger.warn('Invitation expired', { token: token.substring(0, 10) + '...' });

            // Update status to expired
            await db.supabase
                .from('team_invitations')
                .update({ status: 'expired' })
                .eq('id', invitation.id);

            return res.status(410).json({ error: 'Invitation has expired' });
        }

        // Check if already accepted
        if (invitation.status === 'accepted') {
            logger.warn('Invitation already accepted', { token: token.substring(0, 10) + '...' });
            return res.status(410).json({ error: 'Invitation already accepted' });
        }

        // Check if cancelled
        if (invitation.status === 'cancelled') {
            logger.warn('Invitation cancelled', { token: token.substring(0, 10) + '...' });
            return res.status(410).json({ error: 'Invitation has been cancelled' });
        }

        logger.info('Invitation found successfully', {
            email: invitation.email,
            teamName: invitation.teams?.name
        });

        res.json(invitation);
    } catch (error) {
        logger.error('Get invitation error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Accept invitation
router.post('/:token/accept', async (req, res) => {
    try {
        const { token } = req.params;
        const { userId } = req.body;

        if (!userId) {
            return res.status(400).json({ error: 'userId required' });
        }

        logger.info('Accepting invitation', {
            token: token.substring(0, 10) + '...',
            userId
        });

        // Get invitation
        const { data: invitation, error: inviteError } = await db.supabase
            .from('team_invitations')
            .select('*')
            .eq('token', token)
            .eq('status', 'pending')
            .single();

        if (inviteError || !invitation) {
            logger.error('Invitation not found or not pending:', inviteError);
            return res.status(404).json({ error: 'Invalid or expired invitation' });
        }

        // Check expiry
        if (new Date(invitation.expires_at) < new Date()) {
            await db.supabase
                .from('team_invitations')
                .update({ status: 'expired' })
                .eq('id', invitation.id);

            return res.status(410).json({ error: 'Invitation has expired' });
        }

        // Check if already a member
        const { data: existingMember } = await db.supabase
            .from('team_members')
            .select('id')
            .eq('team_id', invitation.team_id)
            .eq('user_id', userId)
            .single();

        if (existingMember) {
            logger.warn('User already a team member', { userId, teamId: invitation.team_id });
            return res.status(400).json({ error: 'Already a team member' });
        }

        // Add to team
        const { error: memberError } = await db.supabase
            .from('team_members')
            .insert({
                team_id: invitation.team_id,
                user_id: userId,
                role: invitation.role || 'member',
                status: 'active',
                invited_by: invitation.invited_by,
                joined_at: new Date().toISOString(),
                joined_via: 'invitation'
            });

        if (memberError) {
            logger.error('Error adding team member:', memberError);
            throw memberError;
        }

        // Update invitation status
        await db.supabase
            .from('team_invitations')
            .update({
                status: 'accepted',
                accepted_at: new Date().toISOString()
            })
            .eq('id', invitation.id);

        // Update user's current team
        await db.supabase
            .from('profiles')
            .update({
                current_team_id: invitation.team_id,
                updated_at: new Date().toISOString()
            })
            .eq('id', userId);

        logger.info('✅ Invitation accepted successfully', {
            userId,
            teamId: invitation.team_id,
            email: invitation.email
        });

        // Send welcome email (optional - don't block on this)
        try {
            const { data: profile } = await db.supabase
                .from('profiles')
                .select('full_name, email')
                .eq('id', userId)
                .single();

            const { data: team } = await db.supabase
                .from('teams')
                .select('name')
                .eq('id', invitation.team_id)
                .single();

            if (profile && team) {
                await emailService.sendWelcomeEmail(
                    profile.email || invitation.email,
                    profile.full_name || 'there',
                    team.name
                );
            }
        } catch (emailError) {
            logger.error('Failed to send welcome email (non-blocking):', emailError);
        }

        res.json({
            success: true,
            teamId: invitation.team_id
        });
    } catch (error) {
        logger.error('Accept invitation error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Create invitation(s) - bulk invite
router.post('/', async (req, res) => {
    try {
        const { teamId, emails, invitedBy, role = 'member' } = req.body;

        if (!teamId || !emails || !Array.isArray(emails) || emails.length === 0) {
            return res.status(400).json({ error: 'teamId and emails array required' });
        }

        if (!invitedBy) {
            return res.status(400).json({ error: 'invitedBy (userId) required' });
        }

        // Verify inviter has permission
        const { data: member } = await db.supabase
            .from('team_members')
            .select('role')
            .eq('team_id', teamId)
            .eq('user_id', invitedBy)
            .single();

        if (!member || !['owner', 'admin'].includes(member.role)) {
            return res.status(403).json({ error: 'Only team owners and admins can invite members' });
        }

        // Get team info
        const { data: team } = await db.supabase
            .from('teams')
            .select('name')
            .eq('id', teamId)
            .single();

        if (!team) {
            return res.status(404).json({ error: 'Team not found' });
        }

        // Get inviter info
        const { data: inviter } = await db.supabase
            .from('profiles')
            .select('full_name')
            .eq('id', invitedBy)
            .single();

        const invitations = [];
        const errors = [];

        for (const email of emails) {
            try {
                const cleanEmail = email.toLowerCase().trim();

                // Check if already invited (pending)
                const { data: existingInvite } = await db.supabase
                    .from('team_invitations')
                    .select('id')
                    .eq('team_id', teamId)
                    .eq('email', cleanEmail)
                    .eq('status', 'pending')
                    .single();

                if (existingInvite) {
                    errors.push({ email: cleanEmail, error: 'Invitation already sent' });
                    continue;
                }

                // Create invitation
                const token = crypto.randomBytes(16).toString('hex');
                const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

                const { data: invitation, error: inviteError } = await db.supabase
                    .from('team_invitations')
                    .insert({
                        team_id: teamId,
                        email: cleanEmail,
                        invited_by: invitedBy,
                        role,
                        token,
                        expires_at: expiresAt.toISOString(),
                        status: 'pending'
                    })
                    .select()
                    .single();

                if (inviteError) throw inviteError;

                // Send invitation email
                await emailService.sendTeamInvitation(
                    invitation,
                    team.name,
                    inviter?.full_name || 'Your teammate'
                );

                invitations.push(invitation);
                logger.info('Invitation created and sent', { email: cleanEmail, teamName: team.name });
            } catch (error) {
                logger.error('Failed to create invitation:', error);
                errors.push({ email, error: error.message });
            }
        }

        res.json({
            success: true,
            invitations,
            errors: errors.length > 0 ? errors : undefined
        });
    } catch (error) {
        logger.error('Invitations creation error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get team invitations
router.get('/team/:teamId', async (req, res) => {
    try {
        const { teamId } = req.params;
        const { userId } = req.query;

        if (!userId) {
            return res.status(400).json({ error: 'userId required' });
        }

        // Verify user is admin
        const { data: member } = await db.supabase
            .from('team_members')
            .select('role')
            .eq('team_id', teamId)
            .eq('user_id', userId)
            .single();

        if (!member || !['owner', 'admin'].includes(member.role)) {
            return res.status(403).json({ error: 'Unauthorized' });
        }

        const { data: invitations, error } = await db.supabase
            .from('team_invitations')
            .select('*')
            .eq('team_id', teamId)
            .eq('status', 'pending')
            .order('created_at', { ascending: false });

        if (error) throw error;

        res.json(invitations || []);
    } catch (error) {
        logger.error('Get team invitations error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Cancel invitation
router.delete('/:invitationId', async (req, res) => {
    try {
        const { invitationId } = req.params;
        const { userId } = req.query;

        if (!userId) {
            return res.status(400).json({ error: 'userId required' });
        }

        // Get invitation
        const { data: invitation } = await db.supabase
            .from('team_invitations')
            .select('team_id')
            .eq('id', invitationId)
            .single();

        if (!invitation) {
            return res.status(404).json({ error: 'Invitation not found' });
        }

        // Verify user is admin
        const { data: member } = await db.supabase
            .from('team_members')
            .select('role')
            .eq('team_id', invitation.team_id)
            .eq('user_id', userId)
            .single();

        if (!member || !['owner', 'admin'].includes(member.role)) {
            return res.status(403).json({ error: 'Unauthorized' });
        }

        // Update status to cancelled
        const { error } = await db.supabase
            .from('team_invitations')
            .update({ status: 'cancelled' })
            .eq('id', invitationId);

        if (error) throw error;

        res.json({ success: true });
    } catch (error) {
        logger.error('Cancel invitation error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Resend invitation
router.post('/:invitationId/resend', async (req, res) => {
    try {
        const { invitationId } = req.params;
        const { userId } = req.query;

        if (!userId) {
            return res.status(400).json({ error: 'userId required' });
        }

        // Get invitation with team info
        const { data: invitation } = await db.supabase
            .from('team_invitations')
            .select(`
        *,
        teams (
          name
        )
      `)
            .eq('id', invitationId)
            .single();

        if (!invitation) {
            return res.status(404).json({ error: 'Invitation not found' });
        }

        // Verify user is admin
        const { data: member } = await db.supabase
            .from('team_members')
            .select('role')
            .eq('team_id', invitation.team_id)
            .eq('user_id', userId)
            .single();

        if (!member || !['owner', 'admin'].includes(member.role)) {
            return res.status(403).json({ error: 'Unauthorized' });
        }

        // Get inviter info
        const { data: inviter } = await db.supabase
            .from('profiles')
            .select('full_name')
            .eq('id', invitation.invited_by)
            .single();

        // Send email again
        await emailService.sendTeamInvitation(
            invitation,
            invitation.teams.name,
            inviter?.full_name || 'Your teammate'
        );

        logger.info('Invitation resent', { email: invitation.email });

        res.json({ success: true });
    } catch (error) {
        logger.error('Resend invitation error:', error);
        res.status(500).json({ error: error.message });
    }
});

export default router;