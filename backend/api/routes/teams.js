import crypto from 'crypto';
import express from 'express';
import emailService from '../services/email-service.js';
import { db } from '../services/supabase-client.js';
import logger from '../utils/logger.js';
import { getSeatLimit, getSummaryLimit } from '../utils/plan-limits.js';
import { getTeamMember, requireTeamAdmin, requireTeamMember } from '../utils/team-permissions.js';

const router = express.Router();
const INVITE_EXPIRY_DAYS = 7;

const normalizeEmail = (email = '') => email.trim().toLowerCase();

const isExpired = (value) => new Date(value) < new Date();

async function refreshExpiredInvitations(teamId) {
    const nowIso = new Date().toISOString();
    const { data: expiredPending, error: pendingError } = await db.supabase
        .from('team_invitations')
        .select('id')
        .eq('team_id', teamId)
        .eq('status', 'pending')
        .lt('expires_at', nowIso);

    if (pendingError) throw pendingError;

    if (expiredPending?.length) {
        const { error: updateError } = await db.supabase
            .from('team_invitations')
            .update({ status: 'expired' })
            .in('id', expiredPending.map((row) => row.id));

        if (updateError) throw updateError;
    }
}

function buildInviteUpdate(userId, role = 'member') {
    return {
        token: crypto.randomBytes(24).toString('hex'),
        status: 'pending',
        invited_by: userId,
        role,
        accepted_at: null,
        expires_at: new Date(Date.now() + INVITE_EXPIRY_DAYS * 24 * 60 * 60 * 1000).toISOString()
    };
}

async function getTeamPlanAndName(teamId) {
    const { data: team, error } = await db.supabase
        .from('teams')
        .select('name, plan')
        .eq('id', teamId)
        .single();

    if (error || !team) {
        const teamError = new Error('Team not found');
        teamError.status = 404;
        throw teamError;
    }

    return {
        name: team.name,
        plan: team.plan || 'free'
    };
}

async function getSeatUsage(teamId) {
    const members = await db.getTeamMembers(teamId);
    const activeMembers = (members || []).filter((member) => member.status === 'active' || !member.status);

    const { count: pendingInvites, error } = await db.supabase
        .from('team_invitations')
        .select('id', { count: 'exact', head: true })
        .eq('team_id', teamId)
        .eq('status', 'pending');

    if (error) throw error;

    return {
        activeMembers,
        pendingInvites: pendingInvites || 0,
        currentSeats: activeMembers.length + (pendingInvites || 0)
    };
}

async function getInviterName(userId) {
    const profile = await db.getProfile(userId);
    return profile?.full_name || 'A teammate';
}

async function setFallbackCurrentTeam(userId, removedTeamId) {
    const { data: memberships, error: membershipError } = await db.supabase
        .from('team_members')
        .select('team_id')
        .eq('user_id', userId)
        .eq('status', 'active')
        .neq('team_id', removedTeamId)
        .order('joined_at', { ascending: false })
        .limit(1);

    if (membershipError) throw membershipError;

    const nextTeamId = memberships?.[0]?.team_id || null;

    const { error: profileError } = await db.supabase
        .from('profiles')
        .update({
            current_team_id: nextTeamId,
            team_id: nextTeamId,
            updated_at: new Date().toISOString()
        })
        .eq('id', userId);

    if (profileError) throw profileError;
}

async function getLatestInvite(teamId, email) {
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

async function isAlreadyActiveMember(teamId, email) {
    const members = await db.getTeamMembers(teamId);
    return (members || []).some((member) => {
        const memberEmail = normalizeEmail(member?.profiles?.email || member?.email || '');
        return memberEmail === email && (member.status === 'active' || !member.status);
    });
}

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
    const { id: teamId } = req.params;
    const { userId } = req.query;

    if (!userId) return res.status(400).json({ error: 'userId required' });

    try {
        const membership = await requireTeamMember(teamId, userId);

        const { data, error } = await db.supabase
            .from('teams')
            .select('*')
            .eq('id', teamId)
            .single();

        if (error || !data) {
            return res.status(404).json({ error: 'Team not found' });
        }

        const monthYear = new Date().toISOString().slice(0, 7);
        const plan = data.plan || 'free';
        const usageCount = await db.getTeamSummaryUsage(teamId, monthYear);
        const summaryLimit = getSummaryLimit(plan);
        const seatLimit = getSeatLimit(plan);

        res.json({
            ...data,
            usageCount,
            usageMonth: monthYear,
            summaryLimit,
            isSummaryUnlimited: summaryLimit === null,
            seatLimit,
            currentUserRole: membership.role
        });
    } catch (error) {
        logger.error('Get team error:', error);
        res.status(error.status || 500).json({ error: error.message });
    }
});

// Get team members
router.get('/:id/members', async (req, res) => {
    const { id: teamId } = req.params;
    const { userId } = req.query;

    if (!userId) return res.status(400).json({ error: 'userId required' });

    try {
        await requireTeamMember(teamId, userId);
        const members = await db.getTeamMembers(teamId);
        res.json(members);
    } catch (error) {
        logger.error('Get team members error:', error);
        res.status(error.status || 500).json({ error: error.message });
    }
});

// Get team invitations (member-readable, admin-manageable)
router.get('/:id/invitations', async (req, res) => {
    const { id: teamId } = req.params;
    const { userId } = req.query;

    if (!userId) return res.status(400).json({ error: 'userId required' });

    try {
        await requireTeamMember(teamId, userId);
        await refreshExpiredInvitations(teamId);

        const { data: invitations, error } = await db.supabase
            .from('team_invitations')
            .select('*')
            .eq('team_id', teamId)
            .in('status', ['pending', 'expired', 'cancelled'])
            .order('created_at', { ascending: false });

        if (error) throw error;
        res.json(invitations || []);
    } catch (error) {
        logger.error('Get team invitations error:', error);
        res.status(error.status || 500).json({ error: error.message });
    }
});

// Invite one member (admin-only)
router.post('/:id/invite', async (req, res) => {
    const { id: teamId } = req.params;
    const { userId, email, role = 'member' } = req.body;

    if (!userId || !email) {
        return res.status(400).json({ error: 'userId and email required' });
    }

    if (!['member', 'admin'].includes(role)) {
        return res.status(400).json({ error: "role must be either 'member' or 'admin'" });
    }

    try {
        await requireTeamAdmin(teamId, userId);
        await refreshExpiredInvitations(teamId);

        const cleanEmail = normalizeEmail(email);
        const alreadyMember = await isAlreadyActiveMember(teamId, cleanEmail);
        if (alreadyMember) {
            return res.status(409).json({
                error: 'User is already an active team member',
                code: 'ALREADY_MEMBER'
            });
        }

        const latestInvite = await getLatestInvite(teamId, cleanEmail);
        if (latestInvite?.status === 'pending' && !isExpired(latestInvite.expires_at)) {
            return res.status(409).json({
                error: 'An active invitation already exists for this email',
                code: 'DUPLICATE_PENDING_INVITE',
                invitation: latestInvite
            });
        }

        const { name: teamName, plan } = await getTeamPlanAndName(teamId);
        const { currentSeats } = await getSeatUsage(teamId);
        const maxSeats = getSeatLimit(plan);

        if (currentSeats >= maxSeats) {
            return res.status(403).json({
                error: `Team size limit reached (${maxSeats} members for ${plan} plan). Please upgrade.`,
                code: 'PLAN_LIMIT_REACHED',
                currentPlan: plan
            });
        }

        let invitation;
        if (latestInvite && ['expired', 'cancelled'].includes(latestInvite.status)) {
            const { data, error } = await db.supabase
                .from('team_invitations')
                .update(buildInviteUpdate(userId, role))
                .eq('id', latestInvite.id)
                .select()
                .single();

            if (error) throw error;
            invitation = data;
        } else {
            const { data, error } = await db.supabase
                .from('team_invitations')
                .insert({
                    team_id: teamId,
                    email: cleanEmail,
                    ...buildInviteUpdate(userId, role)
                })
                .select()
                .single();

            if (error) throw error;
            invitation = data;
        }

        const inviterName = await getInviterName(userId);
        await emailService.sendTeamInvitation(invitation, teamName, inviterName);

        res.json(invitation);
    } catch (error) {
        logger.error('Invite member error:', error);
        res.status(error.status || 500).json({ error: error.message });
    }
});

// Update member role (owner-only)
router.patch('/:id/members/:userId/role', async (req, res) => {
    const { id: teamId, userId: memberId } = req.params;
    const { requesterId, role } = req.body;

    if (!requesterId || !role) {
        return res.status(400).json({ error: 'requesterId and role required' });
    }

    if (!['member', 'admin'].includes(role)) {
        return res.status(400).json({ error: "role must be either 'member' or 'admin'" });
    }

    try {
        const requester = await requireTeamAdmin(teamId, requesterId);
        if (requester.role !== 'owner') {
            return res.status(403).json({ error: 'Only team owner can change member roles' });
        }

        const { data: targetMember, error: targetError } = await db.supabase
            .from('team_members')
            .select('id, role, status')
            .eq('team_id', teamId)
            .eq('user_id', memberId)
            .eq('status', 'active')
            .single();

        if (targetError || !targetMember) {
            return res.status(404).json({ error: 'Team member not found' });
        }

        if (targetMember.role === 'owner') {
            return res.status(400).json({ error: 'Owner role cannot be changed from this endpoint' });
        }

        const { error } = await db.supabase
            .from('team_members')
            .update({ role })
            .eq('id', targetMember.id);

        if (error) throw error;
        res.json({ success: true });
    } catch (error) {
        logger.error('Update member role error:', error);
        res.status(error.status || 500).json({ error: error.message });
    }
});

// Remove member (admin-only)
router.delete('/:id/members/:userId', async (req, res) => {
    const { id: teamId, userId: memberId } = req.params;
    const { userId: requesterId } = req.query;

    if (!requesterId) return res.status(400).json({ error: 'requester userId required' });

    try {
        const requester = await requireTeamAdmin(teamId, requesterId);

        const { data: targetMember, error: targetError } = await db.supabase
            .from('team_members')
            .select('id, role, user_id, status')
            .eq('team_id', teamId)
            .eq('user_id', memberId)
            .eq('status', 'active')
            .single();

        if (targetError || !targetMember) {
            return res.status(404).json({ error: 'Team member not found' });
        }

        if (memberId === requesterId) {
            return res.status(400).json({ error: 'Use leave endpoint to remove yourself' });
        }

        if (targetMember.role === 'owner' && requester.role !== 'owner') {
            return res.status(403).json({ error: 'Only owner can remove another owner' });
        }

        if (targetMember.role === 'owner') {
            const { count: ownerCount, error: ownerCountError } = await db.supabase
                .from('team_members')
                .select('id', { count: 'exact', head: true })
                .eq('team_id', teamId)
                .eq('status', 'active')
                .eq('role', 'owner');

            if (ownerCountError) throw ownerCountError;
            if ((ownerCount || 0) <= 1) {
                return res.status(400).json({ error: 'Cannot remove the last owner from the team' });
            }
        }

        const { error } = await db.supabase
            .from('team_members')
            .delete()
            .eq('id', targetMember.id);

        if (error) throw error;

        await setFallbackCurrentTeam(memberId, teamId);
        res.json({ success: true });
    } catch (error) {
        logger.error('Remove member error:', error);
        res.status(error.status || 500).json({ error: error.message });
    }
});

// Leave team
router.post('/:id/leave', async (req, res) => {
    const { id: teamId } = req.params;
    const { userId } = req.body;

    if (!userId) return res.status(400).json({ error: 'userId required' });

    try {
        const membership = await requireTeamMember(teamId, userId);

        if (membership.role === 'owner') {
            const { count: ownerCount, error: ownerCountError } = await db.supabase
                .from('team_members')
                .select('id', { count: 'exact', head: true })
                .eq('team_id', teamId)
                .eq('status', 'active')
                .eq('role', 'owner');

            if (ownerCountError) throw ownerCountError;
            if ((ownerCount || 0) <= 1) {
                return res.status(400).json({
                    error: 'You are the only owner. Promote another member to owner before leaving.'
                });
            }
        }

        const { error } = await db.supabase
            .from('team_members')
            .delete()
            .eq('id', membership.id);

        if (error) throw error;

        await setFallbackCurrentTeam(userId, teamId);
        res.json({ success: true });
    } catch (error) {
        logger.error('Leave team error:', error);
        res.status(error.status || 500).json({ error: error.message });
    }
});

// Get current user's team role
router.get('/:id/me', async (req, res) => {
    const { id: teamId } = req.params;
    const { userId } = req.query;

    if (!userId) return res.status(400).json({ error: 'userId required' });

    try {
        const member = await getTeamMember(teamId, userId);
        if (!member) return res.status(404).json({ error: 'Membership not found' });
        res.json({
            role: member.role,
            canManage: member.role === 'owner' || member.role === 'admin'
        });
    } catch (error) {
        logger.error('Get team role error:', error);
        res.status(error.status || 500).json({ error: error.message });
    }
});

export default router;
