import { db } from './api/services/supabase-client.js';
import dotenv from 'dotenv';
dotenv.config();

async function verifySignupFlow() {
    console.log('--- Verifying Signup and Profile Flow ---');

    const testUserId = 'd51dd127-3546-4dc0-9d24-c443314d0663';
    const testEmail = `test-${Date.now()}@example.com`;
    console.log('Using test user ID:', testUserId);
    console.log('Using test email:', testEmail);

    try {
        // 1. Test upsert (Simulate frontend signUp behavior)
        console.log('Testing profile upsert (1st attempt)...');
        const { data: p1, error: e1 } = await db.supabase
            .from('profiles')
            .upsert({
                id: testUserId,
                full_name: 'Test Redirection',
                email: testEmail
            })
            .select();

        if (e1) throw e1;
        console.log('✓ First upsert successful');

        console.log('Testing profile upsert (2nd attempt - simulate 409 case)...');
        const { data: p2, error: e2 } = await db.supabase
            .from('profiles')
            .upsert({
                id: testUserId,
                full_name: 'Test Redirection Updated',
                email: testEmail
            })
            .select();

        if (e2) throw e2;
        console.log('✓ Second upsert successful (No 409 Conflict)');

        // 2. Test /me endpoint response for non-existent profile
        console.log('Testing /me endpoint for dummy ID...');
        const dummyId = 'deadbeef-0000-0000-0000-000000000000';
        const res = await fetch(`${process.env.API_BASE_URL || 'http://localhost:3000'}/api/user/me?userId=${dummyId}`);
        if (res.status === 404) {
            console.log('✓ /api/user/me returned 404 for missing profile');
        } else {
            console.log('✖ /api/user/me returned status:', res.status);
        }

        // Cleanup
        await db.supabase.from('profiles').delete().eq('id', testUserId);
        console.log('Cleanup successful');

    } catch (error) {
        console.error('Verification failed:', error);
    }
}

verifySignupFlow();
