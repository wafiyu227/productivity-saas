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

  async getSummaries(teamId, limit = 10) {
    const { data, error } = await supabase
      .from('slack_summaries')
      .select('*')
      .eq('team_id', teamId)
      .order('created_at', { ascending: false })
      .limit(limit);
    
    if (error) throw error;
    return data;
  }
};