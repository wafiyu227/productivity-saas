import dotenv from 'dotenv';
dotenv.config();

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkMessages() {
  try {
    console.log('Connecting to Supabase...');
    console.log('URL:', process.env.SUPABASE_URL);
    
    // Check if table exists and get all messages
    const { data, error } = await supabase
      .from('messages')
      .select('id, from_email, to_email, subject, direction, team_id, user_id, created_at')
      .order('created_at', { ascending: false })
      .limit(10);
    
    if (error) {
      console.error('❌ Query error:', error);
      return;
    }
    
    console.log(`\n✅ Found ${data.length} messages:\n`);
    data.forEach((msg, idx) => {
      console.log(`${idx + 1}. FROM: ${msg.from_email}`);
      console.log(`   TO: ${msg.to_email}`);
      console.log(`   SUBJECT: ${msg.subject}`);
      console.log(`   DIRECTION: ${msg.direction}`);
      console.log(`   TEAM_ID: ${msg.team_id || '(null)'}`);
      console.log(`   USER_ID: ${msg.user_id || '(null)'}`);
      console.log(`   CREATED: ${msg.created_at}\n`);
    });

    // Check profiles
    console.log('\n\n=== PROFILES WITH TEAMS ===\n');
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, email, current_team_id')
      .not('current_team_id', 'is', null)
      .limit(5);
    
    if (profiles && profiles.length > 0) {
      profiles.forEach(p => {
        console.log(`EMAIL: ${p.email}`);
        console.log(`TEAM_ID: ${p.current_team_id}\n`);
      });
    } else {
      console.log('No profiles with teams found.');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkMessages();
