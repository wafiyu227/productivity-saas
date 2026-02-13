import express from 'express';
import { db } from '../services/supabase-client.js';
import emailService from '../services/email-service.js';
import logger from '../utils/logger.js';

const router = express.Router();

// Get invitation details
router.get('/:token', async (req, res) => {
    const { token } = req.params;
    try {
        const { data, error } = await db.supabase
            .from('team_invitations')
            .select('*, teams(name)')
            .eq('token', token)
            .single();

        if (error || !data) {
            return res.status(404).json({ error: 'Invitation not found or expired' });
        }

        res.json(data);
    } catch (error) {
        logger.error('Get invitation error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Accept invitation
router.post('/:token/accept', async (req, res) => {
    const { token } = req.params;
    const { userId } = req.body;

    if (!userId) {
        return res.status(400).json({ error: 'userId required' });
    }

    try {
        const result = await db.acceptInvitation(token, userId);
        res.json(result);
    } catch (error) {
        logger.error('Accept invitation error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Cancel invitation
router.delete('/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const { error } = await db.supabase
            .from('team_invitations')
            .update({ status: 'cancelled' })
            .eq('id', id);

        if (error) throw error;
        res.json({ success: true });
    } catch (error) {
        logger.error('Cancel invitation error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Resend invitation
router.post('/:id/resend', async (req, res) => {
    const { id } = req.params;
    try {
        const { data: invitation, error: fetchError } = await db.supabase
            .from('team_invitations')
            .select('*')
            .eq('id', id)
            .single();

        if (fetchError || !invitation) {
            return res.status(404).json({ error: 'Invitation not found' });
        }

        const inviterProfile = await db.getProfile(invitation.invited_by);
        const inviterName = inviterProfile?.full_name || 'A teammate';

        await emailService.sendInvitation(invitation.email, invitation, inviterName);

        res.json({ success: true });
    } catch (error) {
        logger.error('Resend invitation error:', error);
        res.status(500).json({ error: error.message });
    }
});

export default router;
