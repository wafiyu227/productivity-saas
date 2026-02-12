import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase credentials in .env file');
}

export const supabase = createClient(supabaseUrl, supabaseKey);

export const db = {
  async saveSlackSummary(data) {
    // Ensure arrays are properly formatted for JSONB
    const summaryData = {
      channel_id: data.channel_id,
      channel_name: data.channel_name,
      team_id: data.team_id,
      summary: data.summary,
      blockers: Array.isArray(data.blockers) ? data.blockers : [],
      key_topics: Array.isArray(data.key_topics) ? data.key_topics : [],
      message_count: data.message_count || 0,
      time_period_start: data.time_period_start,
      time_period_end: data.time_period_end
    };

    console.log('Saving summary to database:', summaryData);

    const { data: result, error } = await supabase
      .from('slack_summaries')
      .insert([summaryData])
      .select()
      .single();

    if (error) {
      console.error('Supabase error saving summary:', error);
      throw error;
    }

    console.log('Summary saved successfully:', result);
    return result;
  },

  async getSummaries(teamId, limit = 10) {
    const { data, error } = await supabase
      .from('slack_summaries')
      .select('*')
      .eq('team_id', teamId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data || [];
  },

  async saveIntegration(userId, platform, tokens) {
    const { data, error } = await supabase
      .from('integrations')
      .upsert({
        user_id: userId,
        platform,
        access_token: tokens.accessToken,
        refresh_token: tokens.refreshToken,
        team_id: tokens.teamId,
        team_name: tokens.teamName,
        workspace_id: tokens.workspaceId,
        workspace_name: tokens.workspaceName,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id,platform',
        ignoreDuplicates: false
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async getIntegration(userId, platform) {
    const { data, error } = await supabase
      .from('integrations')
      .select('*')
      .eq('user_id', userId)
      .eq('platform', platform)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data;
  },

  async deleteIntegration(userId, platform) {
    const { error } = await supabase
      .from('integrations')
      .delete()
      .eq('user_id', userId)
      .eq('platform', platform);

    if (error) throw error;
    return true;
  },

  // User Profile Methods
  async getProfile(userId) {
    const { data, error } = await supabase
      .from('profiles')
      // Keep this focused on the profile record only to avoid
      // permission issues when joining against related tables.
      .select('*')
      .eq('id', userId)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data;
  },

  async upsertProfile(userId, profileData) {
    const { data, error } = await supabase
      .from('profiles')
      .upsert({
        id: userId,
        ...profileData,
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async updateProfile(userId, profileData) {
    const { data, error } = await supabase
      .from('profiles')
      .update({
        ...profileData,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId)
      .select();

    if (error) throw error;

    // If update returned no rows, try upsert (profile might not exist yet)
    if (!data || data.length === 0) {
      console.log(`Profile not found for update ${userId}, attempting upsert...`);
      return this.upsertProfile(userId, profileData);
    }

    return data[0];
  },

  // Team Methods
  async createTeam(userId, teamData) {
    // 1. Create Team
    const { data, error: teamError } = await supabase
      .from('teams')
      .insert({
        name: teamData.name,
        size_range: teamData.size_range
      })
      .select();

    if (teamError) {
      console.error('Supabase Create Team Error:', teamError);
      throw teamError;
    }

    const team = data?.[0];
    if (!team) {
      throw new Error('Failed to create team: No data returned. Check database permissions.');
    }

    // 2. Link User to Team
    const { error: profileError } = await supabase
      .from('profiles')
      .update({ team_id: team.id })
      .eq('id', userId);

    if (profileError) {
      console.error('Supabase Link User Error:', profileError);
      throw profileError;
    }

    return team;
  },

  async getTeamMembers(teamId) {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('team_id', teamId);

    if (error) throw error;
    return data;
  },

  // Invitation Methods
  async createInvitation(teamId, inviterId, email) {
    const token = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);

    const { data, error } = await supabase
      .from('team_invitations')
      .insert({
        team_id: teamId,
        invited_by: inviterId,
        email,
        token,
        status: 'pending'
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async getTeamInvitations(teamId) {
    const { data, error } = await supabase
      .from('team_invitations')
      .select('*')
      .eq('team_id', teamId)
      .eq('status', 'pending');

    if (error) throw error;
    return data;
  },

  async acceptInvitation(token, userId) {
    // 1. Verify invitation
    const { data: invitation, error: inviteError } = await supabase
      .from('team_invitations')
      .select('*')
      .eq('token', token)
      .eq('status', 'pending')
      .single();

    if (inviteError || !invitation) {
      throw new Error('Invalid or expired invitation');
    }

    // 2. Update invitation status
    const { error: updateError } = await supabase
      .from('team_invitations')
      .update({ status: 'accepted' })
      .eq('id', invitation.id);

    if (updateError) throw updateError;

    // 3. Add user to team
    const { error: profileError } = await supabase
      .from('profiles')
      .update({ team_id: invitation.team_id })
      .eq('id', userId);

    if (profileError) {
      throw profileError;
    }

    return { success: true, teamId: invitation.team_id };
  },

  async deleteUserAccount(userId) {
    // 1. Delete integrations
    await supabase.from('integrations').delete().eq('user_id', userId);

    // 2. Delete user settings
    await supabase.from('user_settings').delete().eq('user_id', userId);

    // 3. Delete profile
    await supabase.from('profiles').delete().eq('id', userId);

    // 4. Delete user from Supabase Auth
    // This requires the service role key which should be configured in process.env.SUPABASE_SERVICE_ROLE_KEY
    const { error } = await supabase.auth.admin.deleteUser(userId);
    if (error) throw error;

    return { success: true };
  }
};