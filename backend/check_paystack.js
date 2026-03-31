import dotenv from 'dotenv';
import path from 'path';

// Load .env
dotenv.config();

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;
const PAYSTACK_BASE_URL = 'https://api.paystack.co';

async function checkPlans() {
    console.log('--- Paystack Plan Diagnostic ---');
    console.log('Secret Key (masked):', PAYSTACK_SECRET_KEY ? `${PAYSTACK_SECRET_KEY.substring(0, 8)}...` : 'MISSING');

    if (!PAYSTACK_SECRET_KEY) {
        console.error('Error: PAYSTACK_SECRET_KEY not found in .env');
        process.exit(1);
    }

    try {
        console.log('Fetching plans from Paystack...');
        const response = await fetch(`${PAYSTACK_BASE_URL}/plan`, {
            method: 'GET',
            headers: {
                Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
                'Content-Type': 'application/json'
            }
        });

        const data = await response.json();

        if (!response.ok) {
            console.error('Paystack API Error:', data.message || response.statusText);
            process.exit(1);
        }

        console.log(`Found ${data.data?.length || 0} plans:`);
        (data.data || []).forEach(plan => {
            console.log(`- Name: ${plan.name}, Code: ${plan.plan_code}, Amount: ${plan.amount / 100} ${plan.currency}, Status: ${plan.status}`);
        });

        const starterCode = process.env.PAYSTACK_STARTER_PLAN;
        const growthCode = process.env.PAYSTACK_GROWTH_PLAN;

        console.log('\nChecking your configured codes:');
        console.log(`- Starter (${starterCode}):`, data.data?.find(p => p.plan_code === starterCode) ? '✅ FOUND' : '❌ NOT FOUND');
        console.log(`- Growth (${growthCode}):`, data.data?.find(p => p.plan_code === growthCode) ? '✅ FOUND' : '❌ NOT FOUND');

    } catch (error) {
        console.error('Diagnostic Script Error:', error.message);
        process.exit(1);
    }
}

checkPlans();
