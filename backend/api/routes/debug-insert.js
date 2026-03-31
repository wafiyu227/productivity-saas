import express from 'express';
import { db } from '../services/supabase-client.js';
import logger from '../utils/logger.js';

const router = express.Router();

/**
 * Debug endpoint to test message insertion
 * GET /api/debug-insert?from=test@example.com&to=team@mail.teamaai.xyz&subject=Test
 */
router.get('/', async (req, res) => {
    try {
        logger.info('===== DEBUG INSERT TEST =====');
        
        // Get the owner profile
        const { data: profile } = await db.supabase
            .from('profiles')
            .select('id, current_team_id, email')
            .eq('email', 'ibrahimwafiyudeen@gmail.com')
            .maybeSingle();

        logger.info('Profile lookup result:', { profile });

        if (!profile) {
            return res.json({ error: 'Profile not found' });
        }

        const teamId = profile.current_team_id;
        const userId = profile.id;

        // Test data
        const testMessage = {
            thread_id: `test_${Date.now()}`,
            message_id: `msg_test_${Date.now()}`,
            from_email: req.query.from || 'test@example.com',
            to_email: req.query.to || 'team@mail.teamaai.xyz',
            subject: req.query.subject || 'Test Message',
            body_text: 'This is a test message',
            body_html: '<p>This is a test message</p>',
            direction: 'inbound',
            team_id: teamId,
            user_id: userId,
            metadata: { 
                test: true,
                received_at: new Date().toISOString()
            }
        };

        logger.info('Attempting to insert:', testMessage);

        // Try to insert
        const { data: insertedData, error: dbError } = await db.supabase
            .from('messages')
            .insert([testMessage])
            .select();

        if (dbError) {
            logger.error('❌ Insert error:', {
                code: dbError.code,
                message: dbError.message,
                details: dbError.details,
                hint: dbError.hint,
                status: dbError.status
            });

            return res.json({
                success: false,
                error: dbError.message,
                code: dbError.code,
                details: dbError.details,
                hint: dbError.hint
            });
        }

        logger.info('✅ Insert successful:', insertedData);
        res.json({
            success: true,
            data: insertedData,
            teamId,
            userId
        });

    } catch (error) {
        logger.error('Uncaught error:', error);
        res.json({
            error: error.message,
            stack: error.stack
        });
    }
});

export default router;
