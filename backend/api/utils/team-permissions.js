import { db } from '../services/supabase-client.js';

const ADMIN_ROLES = new Set(['owner', 'admin']);

export async function getTeamMember(teamId, userId) {
    if (!teamId || !userId) return null;

    const { data, error } = await db.supabase
        .from('team_members')
        .select('id, team_id, user_id, role, status')
        .eq('team_id', teamId)
        .eq('user_id', userId)
        .eq('status', 'active')
        .maybeSingle();

    if (error && error.code !== 'PGRST116') {
        throw error;
    }

    return data || null;
}

export function isTeamAdmin(member) {
    return !!member && ADMIN_ROLES.has(member.role);
}

export async function requireTeamMember(teamId, userId) {
    const member = await getTeamMember(teamId, userId);
    if (!member) {
        const error = new Error('You are not a member of this team');
        error.status = 403;
        throw error;
    }
    return member;
}

export async function requireTeamAdmin(teamId, userId) {
    const member = await requireTeamMember(teamId, userId);
    if (!isTeamAdmin(member)) {
        const error = new Error('Only team owners and admins can perform this action');
        error.status = 403;
        throw error;
    }
    return member;
}
