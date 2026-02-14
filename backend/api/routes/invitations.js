import express from 'express';
import { db } from '../services/supabase-client.js';
import emailService from '../services/email-service.js';
import logger from '../utils/logger.js';
import crypto from 'crypto';

const router = express.Router();

// Create invitation(s)
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
                // Check if already a member
                const { data: existingMember } = await db.supabase
                    .from('team_members')
                    .select('id')
                    .eq('team_id', teamId)
                    .eq('user_id', (
                        await db.supabase.from('profiles').select('id').eq('email', email).single()
                    )?.data?.id)
                    .single();

                if (existingMember) {
                    errors.push({ email, error: 'Already a team member' });
                    continue;
                }

                // Check if already invited (pending)
                const { data: existingInvite } = await db.supabase
                    .from('team_invitations')
                    .select('id')
                    .eq('team_id', teamId)
                    .eq('email', email)
                    .eq('status', 'pending')
                    .single();

                if (existingInvite) {
                    errors.push({ email, error: 'Invitation already sent' });
                    continue;
                }

                // Create invitation
                const token = crypto.randomBytes(32).toString('hex');
                const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

                const { data: invitation, error: inviteError } = await db.supabase
                    .from('team_invitations')
                    .insert({
                        team_id: teamId,
                        email: email.toLowerCase().trim(),
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
                    inviter.full_name || 'Your teammate'
                );

                invitations.push(invitation);
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

// Get invitation by token
router.get('/:token', async (req, res) => {
    try {
        const { token } = req.params;

        const { data: invitation, error } = await db.supabase
            .from('team_invitations')
            .select('*, teams(name), profiles:invited_by(full_name)')
            .eq('token', token)
            .single();

        if (error || !invitation) {
            return res.status(404).json({ error: 'Invitation not found' });
        }

        // Check if expired
        if (new Date(invitation.expires_at) < new Date()) {
            return res.status(410).json({ error: 'Invitation has expired' });
        }

        // Check if already accepted
        if (invitation.status === 'accepted') {
            return res.status(410).json({ error: 'Invitation already accepted' });
        }

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

        // Get invitation
        const { data: invitation, error: inviteError } = await db.supabase
            .from('team_invitations')
            .select('*')
            .eq('token', token)
            .eq('status', 'pending')
            .single();

        if (inviteError || !invitation) {
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
            return res.status(400).json({ error: 'Already a team member' });
        }

        // Add to team
        const { error: memberError } = await db.supabase
            .from('team_members')
            .insert({
                team_id: invitation.team_id,
                user_id: userId,
                role: invitation.role,
                status: 'active',
                invited_by: invitation.invited_by,
                joined_at: new Date().toISOString(),
                joined_via: 'invitation'
            });

        if (memberError) throw memberError;

        // Update invitation status
        await db.supabase
            .from('team_invitations')
            .update({
                status: 'accepted',
                accepted_at: new Date().toISOString()
            })
            .eq('id', invitation.id);

        // Update user's current team
        await db.updateProfile(userId, {
            current_team_id: invitation.team_id
        });

        // Send welcome email
        const { data: profile } = await db.supabase
            .from('profiles')
            .select('full_name')
            .eq('id', userId)
            .single();

        const { data: team } = await db.supabase
            .from('teams')
            .select('name')
            .eq('id', invitation.team_id)
            .single();

        await emailService.sendWelcomeEmail(
            invitation.email,
            profile?.full_name || 'there',
            team.name
        );

        res.json({
            success: true,
            teamId: invitation.team_id
        });
    } catch (error) {
        logger.error('Accept invitation error:', error);
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
            .select('*, profiles:invited_by(full_name)')
            .eq('team_id', teamId)
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

        // Get invitation
        const { data: invitation } = await db.supabase
            .from('team_invitations')
            .select('*, teams(name), profiles:invited_by(full_name)')
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

        // Send email again
        await emailService.sendTeamInvitation(
            invitation,
            invitation.teams.name,
            invitation.profiles.full_name || 'Your teammate'
        );

        res.json({ success: true });
    } catch (error) {
        logger.error('Resend invitation error:', error);
        res.status(500).json({ error: error.message });
    }
});

export default router;
