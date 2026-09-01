import express from 'express';
import emailService from '../services/email-service.js';
import logger from '../utils/logger.js';

const router = express.Router();

router.post('/', express.json(), async (req, res) => {
    try {
        const { name, email, company, message } = req.body;

        if (!name || !email || !message) {
            return res.status(400).json({ error: 'Name, email, and message are required' });
        }

        logger.info('Received contact form submission', { name, email });

        const result = await emailService.sendContactMessage(name, email, company, message);

        if (!result.success) {
            return res.status(500).json({ error: result.error || 'Failed to send message' });
        }

        res.json({ success: true, message: 'Message sent successfully' });
    } catch (error) {
        logger.error('Contact form endpoint error:', error);
        res.status(500).json({ error: error.message });
    }
});

export default router;
