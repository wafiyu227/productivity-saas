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
  supabase,
  async saveSlackSummary(data) {
    const summaryData = {
      user_id: data.user_id,
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

    const { data: result, error } = await supabase
      .from('slack_summaries')
      .insert([summaryData])
      .select()
      .single();

    if (error) {
      console.error('Supabase error saving summary:', error);
      throw error;
    }

    return result;
  },

  async getSummaries(teamId, userId = null, limit = 10) {
    let query = supabase
      .from('slack_summaries')
      .select('*');

    if (teamId) {
      query = query.eq('team_id', teamId);
    } else if (userId) {
      query = query.eq('user_id', userId);
    }

    const { data, error } = await query
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data || [];
  },

  // FIXED: saveIntegration with proper conflict resolution
  async saveIntegration(userId, platform, tokens, scope = 'team') {
    if (!tokens?.accessToken) {
      throw new Error('saveIntegration requires accessToken');
    }

    const integrationData = {
      user_id: userId,
      platform,
      scope,
      access_token: tokens.accessToken,
      updated_at: new Date().toISOString()
    };

    // Preserve existing values unless the caller explicitly provides a field.
    if (tokens.refreshToken !== undefined) integrationData.refresh_token = tokens.refreshToken;
    if (tokens.expiresAt !== undefined) integrationData.expires_at = tokens.expiresAt;
    if (tokens.workspaceId !== undefined) integrationData.workspace_id = tokens.workspaceId;
    if (tokens.workspaceName !== undefined) integrationData.workspace_name = tokens.workspaceName;
    if (tokens.teamIdExternal !== undefined) integrationData.team_id_external = tokens.teamIdExternal;
    if (tokens.teamName !== undefined) integrationData.team_name = tokens.teamName;

    // Add team_id only for team-scoped integrations
    if (scope === 'team' && tokens.teamId !== undefined) {
      integrationData.team_id = tokens.teamId;
    }

    console.log('Saving integration:', integrationData);

    // Use the composite unique constraint: (user_id, platform, scope)
    const { data, error } = await supabase
      .from('integrations')
      .upsert(integrationData, {
        onConflict: 'user_id,platform,scope',
        ignoreDuplicates: false
      })
      .select()
      .single();

    if (error) {
      console.error('Integration save error:', error);
      throw error;
    }

    return data;
  },

  // FIXED: getIntegration with correct logic
  async getIntegration(userId, platform, teamId = null) {
    let query = supabase
      .from('integrations')
      .select('*')
      .eq('platform', platform);

    // If teamId is provided, get team integration
    if (teamId) {
      query = query.eq('team_id', teamId).eq('scope', 'team');
    } else {
      // No teamId: try to get team integration for user's current team OR personal
      // First try team scope for this user
      const teamQuery = await supabase
        .from('integrations')
        .select('*, team_members!inner(user_id)')
        .eq('platform', platform)
        .eq('scope', 'team')
        .eq('team_members.user_id', userId)
        .maybeSingle();

      if (teamQuery.data) {
        return teamQuery.data;
      }

      // Fallback to personal scope
      query = query.eq('user_id', userId).eq('scope', 'personal');
    }

    const { data, error } = await query.maybeSingle();

    if (error && error.code !== 'PGRST116') {
      console.error('Get integration error:', error);
      throw error;
    }

    return data;
  },

  async deleteIntegration(userId, platform, teamId = null) {
    let query = supabase
      .from('integrations')
      .delete()
      .eq('platform', platform);

    if (teamId) {
      query = query.eq('team_id', teamId);
    } else {
      query = query.eq('user_id', userId);
    }

    const { error } = await query;

    if (error) throw error;
    return true;
  },

  // User Profile Methods
  async getProfile(userId) {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data;
  },

  async getUserTeams(userId) {
    const { data, error } = await supabase
      .from('team_members')
      .select('*, teams(*)')
      .eq('user_id', userId)
      .eq('status', 'active');

    if (error) throw error;
    return data || [];
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

    if (!data || data.length === 0) {
      return this.upsertProfile(userId, profileData);
    }

    return data[0];
  },

  // Team Methods
  // ✅ UPDATED createTeam METHOD
  // Replace this method in backend/services/supabase-client.js

  async createTeam(userId, teamData) {
    console.log('Starting team creation for user:', userId);

    // 1. Create Team
    const { data: teams, error: teamError } = await supabase
      .from('teams')
      .insert({
        name: teamData.name,
        size_range: teamData.size_range,
        description: teamData.description,
        created_by: userId
      })
      .select();

    if (teamError) {
      console.error('Supabase Create Team Error:', teamError);
      throw teamError;
    }

    const team = teams?.[0];
    if (!team) {
      console.error('No team data returned after insert. Data:', teams);
      throw new Error('Failed to create team: No data returned. This might be due to RLS policies.');
    }

    console.log('✓ Team created:', team.id);

    // 2. Link User to Team (via team_members junction table)
    const { error: memberError } = await supabase
      .from('team_members')
      .insert({
        team_id: team.id,
        user_id: userId,
        role: 'owner',
        status: 'active',
        joined_via: 'creator'
      });

    if (memberError) {
      console.error('Supabase Link Member Error:', memberError);
      throw memberError;
    }

    console.log('✓ User linked to team as owner');

    // 3. Update current_team_id and legacy team_id in profile
    const { error: profileError } = await supabase
      .from('profiles')
      .update({
        current_team_id: team.id,
        team_id: team.id, // Keep legacy field in sync
        onboarding_step: 'connect-tools',
        updated_at: new Date().toISOString()
      })
      .eq('id', userId);

    if (profileError) {
      console.error('Failed to update profile with team info:', profileError);
      // Don't throw - team and membership are created successfully
    } else {
      console.log('✓ Profile updated with team info');
    }

    return team;
  },

  async getTeamMembers(teamId) {
    const { data, error } = await supabase
      .from('team_members')
      .select('*, profiles!user_id(*)')
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
    const { data: invitation, error: inviteError } = await supabase
      .from('team_invitations')
      .select('*')
      .eq('token', token)
      .eq('status', 'pending')
      .single();

    if (inviteError || !invitation) {
      throw new Error('Invalid or expired invitation');
    }

    const { error: updateError } = await supabase
      .from('team_invitations')
      .update({
        status: 'accepted',
        accepted_at: new Date().toISOString()
      })
      .eq('id', invitation.id);

    if (updateError) throw updateError;

    const { error: memberError } = await supabase
      .from('team_members')
      .insert({
        team_id: invitation.team_id,
        user_id: userId,
        role: invitation.role || 'member',
        status: 'active',
        invited_by: invitation.invited_by,
        joined_at: new Date().toISOString()
      });

    if (memberError && memberError.code !== '23505') {
      throw memberError;
    }

    await this.updateProfile(userId, { current_team_id: invitation.team_id });

    return { success: true, teamId: invitation.team_id };
  },

  async deleteUserAccount(userId) {
    await supabase.from('integrations').delete().eq('user_id', userId);
    await supabase.from('user_settings').delete().eq('user_id', userId);
    await supabase.from('profiles').delete().eq('id', userId);

    const { error } = await supabase.auth.admin.deleteUser(userId);
    if (error) throw error;

    return { success: true };
  },

  async deleteSummary(summaryId, userId) {
    // Delete the summary. We check userId to ensure the user has permission.
    // In slack_summaries table, we have user_id.
    const { error } = await supabase
      .from('slack_summaries')
      .delete()
      .eq('id', summaryId)
      .eq('user_id', userId);

    if (error) throw error;
    return { success: true };
  },

  // Billing & Usage Methods
  async getTeamBillingInfo(teamId) {
    const { data, error } = await supabase
      .from('teams')
      .select('plan, subscription_status')
      .eq('id', teamId)
      .single();

    if (error) throw error;
    return data;
  },

  async getTeamSummaryUsage(teamId, monthYear) {
    const { data, error } = await supabase
      .from('team_usage')
      .select('summary_count')
      .eq('team_id', teamId)
      .eq('month_year', monthYear)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') {
      // Graceful fallback if billing migration has not been applied yet.
      if (error.code === '42P01') {
        return 0;
      }
      throw error;
    }
    return data?.summary_count || 0;
  },

  async incrementSummaryUsage(teamId, monthYear) {
    // Basic increment logic. (In high-concurrency, an RPC is safer).
    const current = await this.getTeamSummaryUsage(teamId, monthYear);
    const { error } = await supabase
      .from('team_usage')
      .upsert(
        { team_id: teamId, month_year: monthYear, summary_count: current + 1 },
        { onConflict: 'team_id,month_year' }
      );

    if (error) {
      if (error.code === '42P01') {
        return;
      }
      throw error;
    }
  }
};
