import { createClient } from '@supabase/supabase-client';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkMessages() {
  try {
    const { count, error } = await supabase
      .from('messages')
      .select('*', { count: 'exact', head: true });
    
    if (error) {
      console.error('❌ Error checking messages table:', error.message);
      if (error.message.includes('not found')) {
          console.log('⚠️ It looks like the "messages" table hasn\'t been created yet. Please run the SQL script.');
      }
    } else {
      console.log(`✅ Success! The "messages" table has ${count} records.`);
    }
  } catch (err) {
    console.error('Failed to connect:', err);
  }
}

checkMessages();
