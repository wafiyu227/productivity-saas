import { db } from './api/services/supabase-client.js';
import dotenv from 'dotenv';
dotenv.config();

async function testTeamCreation() {
    console.log('--- Testing Team Creation ---');

    // We need a real user ID from the database to test this properly
    // For this test, we'll try to get the first profile available
    const { data: profiles, error: profileError } = await db.supabase
        .from('profiles')
        .select('id')
        .limit(1);

    if (profileError || !profiles || profiles.length === 0) {
        console.error('Could not find a profile to test with:', profileError);
        return;
    }

    const testUserId = profiles[0].id;
    console.log('Using test user ID:', testUserId);

    const testTeamData = {
        name: 'Test Team ' + Date.now(),
        size_range: '2-10',
        description: 'Test description'
    };

    try {
        const team = await db.createTeam(testUserId, testTeamData);
        console.log('Test successful! Team created:', team.name, 'ID:', team.id);

        // Verify membership
        const { data: membership, error: memberError } = await db.supabase
            .from('team_members')
            .select('*')
            .eq('team_id', team.id)
            .eq('user_id', testUserId)
            .single();

        if (memberError) {
            console.error('Membership verification failed:', memberError);
        } else {
            console.log('✓ Membership verified');
        }

        // Verify profile update
        const profile = await db.getProfile(testUserId);
        if (profile.current_team_id === team.id) {
            console.log('✓ Profile current_team_id updated');
        } else {
            console.error('Profile update verification failed. Expected:', team.id, 'Got:', profile.current_team_id);
        }

    } catch (error) {
        console.error('Test failed with error:', error);
    }
}

testTeamCreation();
