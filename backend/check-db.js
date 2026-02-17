import { db } from './api/services/supabase-client.js';
import dotenv from 'dotenv';
dotenv.config();

async function checkDatabase() {
    console.log('--- Checking Database Schema ---');

    try {
        // Check for tables in the public schema
        const { data: tables, error: tableError } = await db.supabase
            .rpc('get_tables'); // This might not exist, fallback to query if it fails

        if (tableError) {
            console.log('RPC get_tables failed (expected if not defined). Trying direct query...');
            // Fallback: try to select from information_schema via a trick or just check known tables
            const knownTables = ['profiles', 'teams', 'team_members', 'team_invitations'];

            for (const table of knownTables) {
                const { error } = await db.supabase.from(table).select('count', { count: 'exact', head: true });
                if (error) {
                    console.log(`✖ Table ${table}: Error - ${error.message} (${error.code})`);
                } else {
                    console.log(`✓ Table ${table}: Accessible`);
                }
            }
        } else {
            console.log('Tables found:', tables);
        }

    } catch (error) {
        console.error('Check failed:', error);
    }
}

checkDatabase();
