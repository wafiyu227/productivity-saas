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
    const { data: result, error } = await supabase
      .from('slack_summaries')
      .insert(data)
      .select()
      .single();

    if (error) throw error;
    return result;
  },

  async deleteIntegration(userId, platform) {
    const { error } = await supabaseAdmin
      .from('integrations')
      .delete()
      .eq('user_id', userId)
      .eq('platform', platform);

    if (error) throw error;
    return true;
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

  // Add these methods to the db object

  async saveIntegration(userId, platform, tokens) {
    const { data, error } = await supabaseAdmin
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
    const { data, error } = await supabaseAdmin
      .from('integrations')
      .select('*')
      .eq('user_id', userId)
      .eq('platform', platform)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data;
  },

  async deleteIntegration(userId, platform) {
    const { error } = await supabaseAdmin
      .from('integrations')
      .delete()
      .eq('user_id', userId)
      .eq('platform', platform);

    if (error) throw error;
    return true;
  }
};