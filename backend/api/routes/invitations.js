import crypto from 'crypto';
import express from 'express';
import emailService from '../services/email-service.js';
import { db } from '../services/supabase-client.js';
import logger from '../utils/logger.js';
import { getSeatLimit } from '../utils/plan-limits.js';
import { requireTeamAdmin } from '../utils/team-permissions.js';

const router = express.Router();
const INVITE_EXPIRY_DAYS = 7;

const normalizeEmail = (email = '') => email.trim().toLowerCase();

const isInvitationExpired = (invitation) => {
    if (!invitation?.expires_at) return false;
    return new Date(invitation.expires_at) < new Date();
};

const buildInviteRefreshPayload = ({ invitedBy, role }) => ({
    token: crypto.randomBytes(24).toString('hex'),
    status: 'pending',
    invited_by: invitedBy,
    role: role || 'member',
    expires_at: new Date(Date.now() + INVITE_EXPIRY_DAYS * 24 * 60 * 60 * 1000).toISOString(),
    accepted_at: null
});

async function refreshExpiredInvitations(teamId) {
    const nowIso = new Date().toISOString();

    const { data: expiredPending, error: findError } = await db.supabase
        .from('team_invitations')
        .select('id')
        .eq('team_id', teamId)
        .eq('status', 'pending')
        .lt('expires_at', nowIso);

    if (findError) throw findError;
    if (!expiredPending?.length) return 0;

    const { error: updateError } = await db.supabase
        .from('team_invitations')
        .update({ status: 'expired' })
        .in('id', expiredPending.map((invitation) => invitation.id));

    if (updateError) throw updateError;
    return expiredPending.length;
}

async function getTeamSeatContext(teamId) {
    const { data: team, error } = await db.supabase
        .from('teams')
        .select('plan, name')
        .eq('id', teamId)
        .single();

    if (error || !team) {
        const notFound = new Error('Team not found');
        notFound.status = 404;
        throw notFound;
    }

    const plan = team.plan || 'free';
    const maxSeats = getSeatLimit(plan);
    const members = await db.getTeamMembers(teamId);
    const activeMembers = (members || []).filter((member) => member.status === 'active' || !member.status);

    const { count: pendingInviteCount, error: inviteCountError } = await db.supabase
        .from('team_invitations')
        .select('id', { count: 'exact', head: true })
        .eq('team_id', teamId)
        .eq('status', 'pending');

    if (inviteCountError) throw inviteCountError;

    return {
        teamName: team.name,
        plan,
        maxSeats,
        activeMembers,
        currentSeats: activeMembers.length + (pendingInviteCount || 0)
    };
}

async function getInviterName(userId) {
    const { data: inviter, error } = await db.supabase
        .from('profiles')
        .select('full_name')
        .eq('id', userId)
        .maybeSingle();

    if (error && error.code !== 'PGRST116') throw error;
    return inviter?.full_name || 'Your teammate';
}

async function getExistingInvite(teamId, email) {
    const { data, error } = await db.supabase
        .from('team_invitations')
        .select('*')
        .eq('team_id', teamId)
        .eq('email', email)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

    if (error && error.code !== 'PGRST116') throw error;
    return data || null;
}

async function createInvite(teamId, email, invitedBy, role) {
    const payload = {
        team_id: teamId,
        email,
        ...buildInviteRefreshPayload({ invitedBy, role })
    };

    const { data, error } = await db.supabase
        .from('team_invitations')
        .insert(payload)
        .select()
        .single();

    if (error) throw error;
    return data;
}

async function refreshInvite(invitationId, invitedBy, role) {
    const { data, error } = await db.supabase
        .from('team_invitations')
        .update(buildInviteRefreshPayload({ invitedBy, role }))
        .eq('id', invitationId)
        .select()
        .single();

    if (error) throw error;
    return data;
}

async function ensureUserNotAlreadyMember(teamId, cleanEmail) {
    const members = await db.getTeamMembers(teamId);
    const alreadyMember = (members || []).some((member) => {
        const memberEmail = normalizeEmail(member?.profiles?.email || member?.email || '');
        return memberEmail && memberEmail === cleanEmail && (member.status === 'active' || !member.status);
    });

    return !alreadyMember;
}

// Get invitation by token (join page)
router.get('/:token', async (req, res) => {
    try {
        const { token } = req.params;
        logger.info('Fetching invitation by token', { token: `${token.substring(0, 10)}...` });

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

        if (error || !invitation) {
            return res.status(404).json({ error: 'Invitation not found' });
        }

        if (invitation.status === 'accepted') {
            return res.status(410).json({ error: 'Invitation already accepted' });
        }

        if (invitation.status === 'cancelled') {
            return res.status(410).json({ error: 'Invitation has been cancelled' });
        }

        if (invitation.status === 'expired' || isInvitationExpired(invitation)) {
            if (invitation.status === 'pending') {
                await db.supabase
                    .from('team_invitations')
                    .update({ status: 'expired' })
                    .eq('id', invitation.id);
            }

            return res.status(410).json({ error: 'Invitation has expired' });
        }

        let inviterName = null;
        if (invitation.invited_by) {
            const { data: inviter } = await db.supabase
                .from('profiles')
                .select('full_name')
                .eq('id', invitation.invited_by)
                .maybeSingle();
            inviterName = inviter?.full_name || null;
        }

        res.json({
            ...invitation,
            inviter_name: inviterName
        });
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

        const { data: invitation, error: inviteError } = await db.supabase
            .from('team_invitations')
            .select('*')
            .eq('token', token)
            .eq('status', 'pending')
            .single();

        if (inviteError || !invitation) {
            return res.status(404).json({ error: 'Invalid or expired invitation' });
        }

        if (isInvitationExpired(invitation)) {
            await db.supabase
                .from('team_invitations')
                .update({ status: 'expired' })
                .eq('id', invitation.id);
            return res.status(410).json({ error: 'Invitation has expired' });
        }

        const { data: profile, error: profileError } = await db.supabase
            .from('profiles')
            .select('email, full_name')
            .eq('id', userId)
            .single();

        if (profileError || !profile) {
            return res.status(400).json({ error: 'User profile not found' });
        }

        if (normalizeEmail(profile.email) !== normalizeEmail(invitation.email)) {
            return res.status(403).json({ error: 'This invitation is for a different email address' });
        }

        const { data: existingMember } = await db.supabase
            .from('team_members')
            .select('id, status')
            .eq('team_id', invitation.team_id)
            .eq('user_id', userId)
            .maybeSingle();

        if (existingMember && (existingMember.status === 'active' || !existingMember.status)) {
            return res.status(400).json({ error: 'Already a team member' });
        }

        const { plan, maxSeats } = await getTeamSeatContext(invitation.team_id);
        const members = await db.getTeamMembers(invitation.team_id);
        const activeMembers = (members || []).filter((member) => member.status === 'active' || !member.status);

        if (activeMembers.length >= maxSeats) {
            return res.status(403).json({
                error: `Team size limit reached (${maxSeats} members for ${plan} plan). Please upgrade.`,
                code: 'PLAN_LIMIT_REACHED',
                currentPlan: plan
            });
        }

        if (existingMember) {
            const { error: reactivateError } = await db.supabase
                .from('team_members')
                .update({
                    status: 'active',
                    role: invitation.role || 'member',
                    invited_by: invitation.invited_by,
                    joined_at: new Date().toISOString(),
                    joined_via: 'invitation'
                })
                .eq('id', existingMember.id);

            if (reactivateError) throw reactivateError;
        } else {
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

            if (memberError) throw memberError;
        }

        await db.supabase
            .from('team_invitations')
            .update({
                status: 'accepted',
                accepted_at: new Date().toISOString()
            })
            .eq('id', invitation.id);

        await db.supabase
            .from('profiles')
            .update({
                current_team_id: invitation.team_id,
                team_id: invitation.team_id,
                updated_at: new Date().toISOString()
            })
            .eq('id', userId);

        try {
            const { data: team } = await db.supabase
                .from('teams')
                .select('name')
                .eq('id', invitation.team_id)
                .single();

            if (team?.name) {
                await emailService.sendWelcomeEmail(
                    profile.email || invitation.email,
                    profile.full_name || 'there',
                    team.name
                );
            }
        } catch (emailError) {
            logger.error('Failed to send welcome email (non-blocking):', emailError);
        }

        res.json({ success: true, teamId: invitation.team_id });
    } catch (error) {
        logger.error('Accept invitation error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Create invitations (bulk)
router.post('/', async (req, res) => {
    try {
        const { teamId, emails, invitedBy, role = 'member' } = req.body;

        if (!teamId || !Array.isArray(emails) || emails.length === 0) {
            return res.status(400).json({ error: 'teamId and emails array required' });
        }

        if (!invitedBy) {
            return res.status(400).json({ error: 'invitedBy (userId) required' });
        }

        if (!['member', 'admin'].includes(role)) {
            return res.status(400).json({ error: "role must be either 'member' or 'admin'" });
        }

        await requireTeamAdmin(teamId, invitedBy);

        await refreshExpiredInvitations(teamId);

        const {
            teamName,
            plan,
            maxSeats,
            currentSeats
        } = await getTeamSeatContext(teamId);

        let remainingSeats = maxSeats - currentSeats;
        const inviterName = await getInviterName(invitedBy);

        const invitations = [];
        const resent = [];
        const errors = [];
        const uniqueEmails = [...new Set(emails.map(normalizeEmail).filter(Boolean))];

        for (const cleanEmail of uniqueEmails) {
            try {
                const canInvite = await ensureUserNotAlreadyMember(teamId, cleanEmail);
                if (!canInvite) {
                    errors.push({ email: cleanEmail, error: 'User is already an active team member' });
                    continue;
                }

                const existingInvite = await getExistingInvite(teamId, cleanEmail);
                if (existingInvite?.status === 'pending' && !isInvitationExpired(existingInvite)) {
                    await emailService.sendTeamInvitation(existingInvite, teamName, inviterName);
                    resent.push(existingInvite);
                    continue;
                }

                if (remainingSeats <= 0) {
                    errors.push({
                        email: cleanEmail,
                        error: `Team size limit reached (${maxSeats} members for ${plan} plan).`
                    });
                    continue;
                }

                let invitation;
                if (existingInvite && ['expired', 'cancelled'].includes(existingInvite.status)) {
                    invitation = await refreshInvite(existingInvite.id, invitedBy, role);
                } else {
                    invitation = await createInvite(teamId, cleanEmail, invitedBy, role);
                }

                await emailService.sendTeamInvitation(invitation, teamName, inviterName);
                invitations.push(invitation);
                remainingSeats -= 1;
            } catch (inviteError) {
                logger.error('Failed to create invitation:', inviteError);
                errors.push({ email: cleanEmail, error: inviteError.message });
            }
        }

        res.json({
            success: true,
            invitations,
            resent,
            errors: errors.length > 0 ? errors : undefined
        });
    } catch (error) {
        logger.error('Invitations creation error:', error);
        const status = error.status || 500;
        res.status(status).json({ error: error.message });
    }
});

// Get team invitations (admin-only)
router.get('/team/:teamId', async (req, res) => {
    try {
        const { teamId } = req.params;
        const { userId, status } = req.query;

        if (!userId) {
            return res.status(400).json({ error: 'userId required' });
        }

        await requireTeamAdmin(teamId, userId);
        await refreshExpiredInvitations(teamId);

        const statuses = typeof status === 'string' && status.trim()
            ? status.split(',').map((value) => value.trim()).filter(Boolean)
            : ['pending', 'expired', 'cancelled'];

        const { data: invitations, error } = await db.supabase
            .from('team_invitations')
            .select('*')
            .eq('team_id', teamId)
            .in('status', statuses)
            .order('created_at', { ascending: false });

        if (error) throw error;

        res.json(invitations || []);
    } catch (error) {
        logger.error('Get team invitations error:', error);
        res.status(error.status || 500).json({ error: error.message });
    }
});

// Cancel invitation (admin-only)
router.delete('/:invitationId', async (req, res) => {
    try {
        const { invitationId } = req.params;
        const { userId } = req.query;

        if (!userId) {
            return res.status(400).json({ error: 'userId required' });
        }

        const { data: invitation, error: invitationError } = await db.supabase
            .from('team_invitations')
            .select('id, team_id, status')
            .eq('id', invitationId)
            .single();

        if (invitationError || !invitation) {
            return res.status(404).json({ error: 'Invitation not found' });
        }

        await requireTeamAdmin(invitation.team_id, userId);

        if (invitation.status === 'accepted') {
            return res.status(400).json({ error: 'Accepted invitations cannot be cancelled' });
        }

        const { error } = await db.supabase
            .from('team_invitations')
            .update({ status: 'cancelled' })
            .eq('id', invitationId);

        if (error) throw error;
        res.json({ success: true });
    } catch (error) {
        logger.error('Cancel invitation error:', error);
        res.status(error.status || 500).json({ error: error.message });
    }
});

// Resend invitation (admin-only)
router.post('/:invitationId/resend', async (req, res) => {
    try {
        const { invitationId } = req.params;
        const { userId } = req.query;

        if (!userId) {
            return res.status(400).json({ error: 'userId required' });
        }

        const { data: invitation, error: invitationError } = await db.supabase
            .from('team_invitations')
            .select(`
                *,
                teams (
                    id,
                    name
                )
            `)
            .eq('id', invitationId)
            .single();

        if (invitationError || !invitation) {
            return res.status(404).json({ error: 'Invitation not found' });
        }

        await requireTeamAdmin(invitation.team_id, userId);

        if (invitation.status === 'accepted') {
            return res.status(400).json({ error: 'Accepted invitation cannot be resent' });
        }

        const refreshedInvitation = await refreshInvite(
            invitation.id,
            userId,
            invitation.role || 'member'
        );

        const inviterName = await getInviterName(userId);

        await emailService.sendTeamInvitation(
            refreshedInvitation,
            invitation.teams?.name || 'Your team',
            inviterName
        );

        res.json({ success: true, invitation: refreshedInvitation });
    } catch (error) {
        logger.error('Resend invitation error:', error);
        res.status(error.status || 500).json({ error: error.message });
    }
});

export default router;
