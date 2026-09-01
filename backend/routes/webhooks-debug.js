import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import logger from '../utils/logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const logsDir = path.join(__dirname, '../webhook-logs');

// Create logs directory if it doesn't exist
if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
}

const router = express.Router();

/**
 * Resend Inbound Email Webhook with detailed payload logging
 * URL: https://api.teamaai.xyz/webhooks/resend
 */
router.post('/resend', async (req, res) => {
    try {
        const timestamp = new Date().toISOString();
        const logFile = path.join(logsDir, `resend-${Date.now()}.json`);
        
        // Log the entire raw request
        const logData = {
            timestamp,
            method: req.method,
            url: req.url,
            headers: req.headers,
            body: req.body,
            rawBody: req.rawBody?.toString() || null
        };
        
        fs.writeFileSync(logFile, JSON.stringify(logData, null, 2));
        logger.info(`📝 Webhook payload logged to ${logFile}`);
        
        const payload = req.body;
        
        logger.info('====== RESEND WEBHOOK RECEIVED ======');
        logger.info('Payload structure:', {
            has_from: !!payload.from,
            has_to: !!payload.to,
            has_subject: !!payload.subject,
            has_text: !!payload.text,
            has_html: !!payload.html,
            has_message_id: !!payload.message_id,
            has_headers: !!payload.headers,
            to_type: Array.isArray(payload.to) ? 'array' : typeof payload.to,
            to_value: payload.to
        });
        
        res.status(200).json({ received: true });
    } catch (error) {
        logger.error('Webhook error:', error);
        res.status(500).json({ error: "Webhook error" });
    }
});

export default router;
