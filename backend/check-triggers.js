import { db } from './api/services/supabase-client.js';
import dotenv from 'dotenv';
dotenv.config();

async function checkTriggers() {
    console.log('--- Checking for Triggers ---');

    try {
        // Query to find triggers
        const { data, error } = await db.supabase.rpc('get_triggers_info'); // Might not exist

        if (error) {
            console.log('Trying manual trigger check via query...');
            const { data: triggerData, error: queryError } = await db.supabase.from('pg_trigger').select('tgname').limit(1);
            // This usually fails due to permissions, but let's see.
            if (queryError) console.log('Cannot access pg_trigger directly:', queryError.message);
        } else {
            console.log('Triggers:', data);
        }

        // Just check if a profile already exists for a dummy ID to see if we get 409
        const dummyId = '00000000-0000-0000-0000-000000000000';
        console.log('Testing insert into profiles...');
        const { error: insertError } = await db.supabase.from('profiles').insert({ id: dummyId, full_name: 'Test' });
        if (insertError) {
            console.log('Insert error (expected if permissions/constraints fail):', insertError.message, insertError.code);
        } else {
            console.log('Insert successful, cleaning up...');
            await db.supabase.from('profiles').delete().eq('id', dummyId);
        }

    } catch (error) {
        console.error('Check failed:', error);
    }
}

checkTriggers();
