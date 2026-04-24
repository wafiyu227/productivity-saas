// backend/routes/waitlist.js
// Complete waitlist API routes

import express from 'express';
import { db } from '../services/supabase-client.js';
import emailService from '../services/email-service.js';
import logger from '../utils/logger.js';
import { validateEmail, getBlockedEmailReason } from '../../utils/email-validator.js';

const router = express.Router();

// Join waitlist
router.post('/join', async (req, res) => {
  try {
    const { email, name, company, role, referralSource } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email required' });
    }

    const cleanEmail = email.toLowerCase().trim();

    // Validate email - block test/probe/temporary emails
    const validation = validateEmail(cleanEmail);
    if (!validation.valid) {
      logger.warn('Blocked signup attempt - invalid/test email', { 
        email: cleanEmail, 
        reason: validation.error 
      });
      return res.status(400).json({ error: validation.error });
    }

    // Check if already on waitlist
    const { data: existing } = await db.supabase
      .from('waitlist')
      .select('id, position, created_at')
      .eq('email', cleanEmail)
      .single();

    if (existing) {
      logger.info('Duplicate waitlist signup attempt', { email: cleanEmail });
      return res.status(200).json({
        message: 'Already on waitlist',
        position: existing.position,
        alreadyJoined: true
      });
    }

    // Add to waitlist
    const { data, error } = await db.supabase
      .from('waitlist')
      .insert({
        email: cleanEmail,
        name: name?.trim() || null,
        company: company?.trim() || null,
        role: role || null,
        referral_source: referralSource || null
      })
      .select()
      .single();

    if (error) {
      logger.error('Waitlist insert error:', error);
      throw error;
    }

    logger.info('✅ New waitlist signup', { 
      email: cleanEmail, 
      position: data.position,
      name: name || 'anonymous'
    });

    // Send welcome email (non-blocking)
    try {
      await emailService.sendWaitlistWelcome(
        cleanEmail, 
        name || 'there', 
        data.position
      );
      logger.info('Waitlist welcome email sent', { email: cleanEmail });
    } catch (emailError) {
      logger.error('Failed to send waitlist email (non-blocking):', emailError);
      // Don't fail the request if email fails
    }

    res.json({
      success: true,
      message: 'Successfully joined waitlist',
      position: data.position
    });
  } catch (error) {
    logger.error('Waitlist join error:', error);
    res.status(500).json({ 
      error: 'Failed to join waitlist. Please try again.' 
    });
  }
});

// Get total waitlist count (public)
router.get('/count', async (req, res) => {
  try {
    const { count, error } = await db.supabase
      .from('waitlist')
      .select('*', { count: 'exact', head: true });

    if (error) throw error;

    res.json({ count: count || 0 });
  } catch (error) {
    logger.error('Waitlist count error:', error);
    res.status(500).json({ error: 'Failed to get count' });
  }
});

// Get waitlist stats (admin only - requires authentication)
router.get('/stats', async (req, res) => {
  try {
    const { data, error } = await db.supabase
      .from('waitlist')
      .select('role, referral_source, created_at');

    if (error) throw error;

    // Calculate stats
    const stats = {
      total: data.length,
      byRole: {},
      bySource: {},
      last24h: 0,
      last7days: 0
    };

    const now = new Date();
    const day = 24 * 60 * 60 * 1000;

    data.forEach(entry => {
      // Count by role
      if (entry.role) {
        stats.byRole[entry.role] = (stats.byRole[entry.role] || 0) + 1;
      }

      // Count by source
      if (entry.referral_source) {
        stats.bySource[entry.referral_source] = (stats.bySource[entry.referral_source] || 0) + 1;
      }

      // Count recent signups
      const created = new Date(entry.created_at);
      if (now - created < day) stats.last24h++;
      if (now - created < day * 7) stats.last7days++;
    });

    res.json(stats);
  } catch (error) {
    logger.error('Waitlist stats error:', error);
    res.status(500).json({ error: 'Failed to get stats' });
  }
});

// Export waitlist (admin only)
router.get('/export', async (req, res) => {
  try {
    const { data, error } = await db.supabase
      .from('waitlist')
      .select('*')
      .order('position', { ascending: true });

    if (error) throw error;

    // Convert to CSV
    if (data.length === 0) {
      return res.json([]);
    }

    const headers = Object.keys(data[0]).join(',');
    const rows = data.map(row => 
      Object.values(row).map(val => 
        typeof val === 'string' && val.includes(',') ? `"${val}"` : val
      ).join(',')
    );

    const csv = [headers, ...rows].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=waitlist.csv');
    res.send(csv);
  } catch (error) {
    logger.error('Waitlist export error:', error);
    res.status(500).json({ error: 'Failed to export' });
  }
});

export default router;