import express from 'express';
import logger from '../utils/logger.js';
import { db } from '../services/supabase-client.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const logsDir = path.join(__dirname, '../../webhook-logs');

// Create logs directory if it doesn't exist
if (!fs.existsSync(logsDir)) {
    try {
        fs.mkdirSync(logsDir, { recursive: true });
    } catch (e) {
        // Directory might already exist
    }
}

const router = express.Router();

/**
 * Resend Inbound Email Webhook
 * URL: https://api.teamaai.xyz/webhooks/resend
 */
router.post('/resend', async (req, res) => {
    try {
        const payload = req.body;
        const timestamp = new Date().toISOString();
        
        // Save raw payload to file for debugging
        try {
            const logFile = path.join(logsDir, `resend-webhook-${Date.now()}_${Math.random().toString(36).substring(7)}.json`);
            fs.writeFileSync(logFile, JSON.stringify({
                timestamp,
                payload,
                headers: req.headers
            }, null, 2));
            logger.info(`📝 Full payload logged to ${logFile}`);
        } catch (fileErr) {
            logger.warn('Could not save payload to file:', fileErr.message);
        }
        
        logger.info('====== RESEND WEBHOOK RECEIVED ======');
        logger.info('RAW PAYLOAD:', JSON.stringify(payload, null, 2));
        logger.info('Checking Supabase credentials...');
        logger.info('SUPABASE_URL exists:', !!process.env.SUPABASE_URL);
        logger.info('SUPABASE_SERVICE_ROLE_KEY exists:', !!process.env.SUPABASE_SERVICE_ROLE_KEY);
        logger.info('Using key type:', process.env.SUPABASE_SERVICE_ROLE_KEY ? 'SERVICE_ROLE' : 'ANON');
        
        // Resend sends a specific format for inbound emails
        // https://resend.com/docs/dashboard/webhooks/inbound-emails
        const from = payload.from;
        const to = Array.isArray(payload.to) ? payload.to[0] : payload.to;
        const subject = payload.subject;
        const text = payload.text;
        const html = payload.html;
        
        // Extract Message-ID for threading - try multiple possible locations
        let messageId = payload.message_id || payload.headers?.['Message-ID'] || payload.headers?.['message-id'] || null;
        if (!messageId) {
            messageId = `inb_${Date.now()}_${Math.random().toString(36).substring(7)}`;
            logger.warn('No Message-ID found in payload, generating one:', messageId);
        }
        
        logger.info('Extracted fields:', { from, to, subject, messageId, text_length: text?.length, html_length: html?.length });

        // Find the team associated with this email
        // For the main platform email (team@mail.teamaai.xyz), look for the owner or any admin
        let profile = null;
        let lookupEmail = to;
        
        if (to === 'team@mail.teamaai.xyz') {
            // Try to find any profile with a team (owner/admin)
            // First, try environment variable for owner email
            const ownerEmail = process.env.INBOX_OWNER_EMAIL || 'ibrahimwafiyudeen@gmail.com';
            
            const { data } = await db.supabase
                .from('profiles')
                .select('id, current_team_id, email')
                .eq('email', ownerEmail)
                .maybeSingle();
            
            profile = data;
            
            if (!profile) {
                logger.warn(`Profile not found for owner email: ${ownerEmail}. Trying to find any team member...`);
                // Fallback: Find any profile with a current_team_id
                const { data: anyProfile } = await db.supabase
                    .from('profiles')
                    .select('id, current_team_id, email')
                    .not('current_team_id', 'is', null)
                    .limit(1)
                    .maybeSingle();
                
                if (anyProfile) {
                    profile = anyProfile;
                    logger.info(`Found fallback profile: ${anyProfile.email}`);
                }
            }
        } else {
            // For other addresses, look up the recipient's profile
            const { data } = await db.supabase
                .from('profiles')
                .select('id, current_team_id, email')
                .eq('email', to)
                .maybeSingle();
            profile = data;
        }

        const teamId = profile?.current_team_id;
        const userId = profile?.id;

        if (!profile) {
            logger.warn(`No profile found for inbox email. from=${from}, to=${to}. Message will be stored without team/user context.`);
        } else {
            logger.info(`Profile found: userId=${userId}, teamId=${teamId}, profileEmail=${profile.email}`);
        }

        // Validate required fields
        if (!from) {
            logger.error('❌ Missing required field: from_email');
            return res.status(200).json({ received: true, error: 'Missing from_email' });
        }
        
        if (!to) {
            logger.error('❌ Missing required field: to_email');
            return res.status(200).json({ received: true, error: 'Missing to_email' });
        }
        
        if (!messageId) {
            logger.error('❌ Missing required field: messageId');
            return res.status(200).json({ received: true, error: 'Missing messageId' });
        }

        // Save to database
        const messageData = {
            thread_id: messageId,
            message_id: messageId,
            from_email: from,
            to_email: to,
            subject: subject || '(No Subject)',
            body_text: text,
            body_html: html,
            direction: 'inbound',
            team_id: teamId,
            user_id: userId,
            metadata: { 
                raw_headers: payload.headers,
                received_at: new Date().toISOString()
            }
        };

        logger.info('Attempting to insert message with data:', {
            thread_id: messageData.thread_id,
            message_id: messageData.message_id,
            from: messageData.from_email,
            to: messageData.to_email,
            subject: messageData.subject,
            team_id: messageData.team_id,
            user_id: messageData.user_id
        });

        const { data: insertedData, error: dbError } = await db.supabase
            .from('messages')
            .insert([messageData])
            .select();

        if (dbError) {
            logger.error('❌ Failed to store inbound email in database:', {
                error: dbError,
                code: dbError.code,
                message: dbError.message,
                details: dbError.details,
                hint: dbError.hint,
                from, to, messageId, teamId, userId
            });
            // We still return 200 to Resend to acknowledge receipt
        } else {
            logger.info('✅ Inbound email stored successfully in database', {
                insertedId: insertedData?.[0]?.id,
                messageId, from, to, teamId, userId
            });
        }

        res.status(200).json({ received: true });
    } catch (error) {
        logger.error('❌ UNCAUGHT ERROR in Resend webhook:', {
            message: error.message,
            stack: error.stack,
            name: error.name
        });
        res.status(500).json({ error: "Webhook error" });
    }
});

export default router;
