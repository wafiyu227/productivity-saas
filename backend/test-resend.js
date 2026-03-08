// TEST SCRIPT: backend/test-resend.js
// Run this to test if your Resend API key works

import 'dotenv/config';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

async function testResend() {
    console.log('🧪 Testing Resend Email Service...\n');

    // Check API key exists
    if (!process.env.RESEND_API_KEY) {
        console.error('❌ RESEND_API_KEY not found in environment variables!');
        console.log('Set it with: export RESEND_API_KEY="re_your_key_here"');
        process.exit(1);
    }

    console.log('✅ API Key found:', process.env.RESEND_API_KEY.substring(0, 10) + '...\n');

    try {
        console.log('📧 Sending test email...');

        const { data, error } = await resend.emails.send({
            from: 'Teama AI <noreply@mail.teamaai.xyz>', // ✅ Custom verified domain
            to: ['ibrahimwafiyudeen@gmail.com'], // ❌ REPLACE WITH YOUR EMAIL!
            subject: 'Test Email from Teama AI',
            html: `
        <h1>🎉 Success!</h1>
        <p>If you're reading this, your Resend integration is working!</p>
        <p><strong>Next steps:</strong></p>
        <ul>
          <li>Update teams.js with the fixed invite method</li>
          <li>Update email-service.js to use onboarding@resend.dev</li>
          <li>Deploy to Vercel</li>
          <li>Test team invitation</li>
        </ul>
        <p>Email sent at: ${new Date().toLocaleString()}</p>
      `
        });

        if (error) {
            console.error('❌ Resend Error:', error);
            console.log('\nCommon fixes:');
            console.log('1. Invalid API key → Get new one from https://resend.com/api-keys');
            console.log('2. Domain not verified → Use onboarding@resend.dev for testing');
            console.log('3. Rate limit → Wait a few minutes and try again');
            process.exit(1);
        }

        console.log('✅ Email sent successfully!');
        console.log('📬 Message ID:', data.id);
        console.log('\n✨ Check your inbox (and spam folder)!');
        console.log('If you received it, your setup is working!\n');

    } catch (error) {
        console.error('❌ Unexpected error:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

testResend();