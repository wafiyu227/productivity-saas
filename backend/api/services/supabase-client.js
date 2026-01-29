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
    return data;
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
  }
};