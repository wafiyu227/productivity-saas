import express from 'express';
import { db } from '../services/supabase-client.js';
import logger from '../utils/logger.js';

const router = express.Router();

// Get current user profile and teams
router.get('/me', async (req, res) => {
    const { userId } = req.query;

    if (!userId) {
        return res.status(400).json({ error: 'userId required' });
    }

    // Prevent browser/CDN from caching profile responses — stale data causes
    // incorrect new-vs-returning user detection in the OAuth callback flow
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.set('Pragma', 'no-cache');

    try {
        const profile = await db.getProfile(userId);

        if (!profile) {
            logger.warn('Profile not found for user:', userId);
            return res.status(404).json({ error: 'Profile not found', userId });
        }

        res.json(profile);
    } catch (error) {
        logger.error('Get profile/me error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Update profile
router.put('/me', async (req, res) => {
    const { userId, ...profileData } = req.body;

    if (!userId) {
        return res.status(400).json({ error: 'userId required' });
    }

    try {
        const profile = await db.updateProfile(userId, profileData);
        res.json(profile);
    } catch (error) {
        logger.error('Update profile error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Check if a user with a given email exists (used by Google OAuth signin flow)
router.get('/check-email', async (req, res) => {
    const { email } = req.query;

    if (!email) {
        return res.status(400).json({ error: 'email required' });
    }

    try {
        const profile = await db.getProfileByEmail(email);
        if (profile) {
            res.json({ exists: true, email, userId: profile.id });
        } else {
            res.status(404).json({ exists: false, email });
        }
    } catch (error) {
        logger.error('Check email error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Legacy routes for backward compatibility
router.get('/profile', async (req, res) => {
    const { userId } = req.query;
    try {
        const profile = await db.getProfile(userId);
        res.json(profile || {});
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.put('/profile', async (req, res) => {
    const { userId, ...profileData } = req.body;
    try {
        const profile = await db.updateProfile(userId, profileData);
        res.json(profile);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Proxy route for geo-location and weather to avoid CORS and rate limits in frontend
router.get('/personal-context', async (req, res) => {
    try {
        // 1. Prioritize Vercel Geo Headers (Fastest, most reliable in production)
        const vercelCity = req.headers['x-vercel-ip-city'];
        const vercelRegion = req.headers['x-vercel-ip-country-region'];
        const vercelLat = req.headers['x-vercel-ip-latitude'];
        const vercelLon = req.headers['x-vercel-ip-longitude'];

        let location = null;
        let weather = null;

        if (vercelCity && vercelLat && vercelLon) {
            location = {
                city: decodeURIComponent(vercelCity),
                region: vercelRegion,
                lat: vercelLat,
                lon: vercelLon
            };
            logger.info('Using Vercel Geo Headers:', location.city);
        } else {
            // 2. Fallback to ipapi.co (Local dev or non-Vercel environment)
            try {
                const clientIp = req.headers['x-forwarded-for']?.split(',')[0] || req.socket.remoteAddress;
                // Don't pass localhost IP to ipapi.co
                const locUrl = (clientIp && clientIp !== '::1' && clientIp !== '127.0.0.1') 
                    ? `https://ipapi.co/${clientIp}/json/` 
                    : 'https://ipapi.co/json/';
                
                const locRes = await fetch(locUrl);
                const locData = await locRes.json();
                
                if (!locData.error) {
                    location = {
                        city: locData.city,
                        region: locData.region,
                        lat: locData.latitude,
                        lon: locData.longitude
                    };
                }
            } catch (e) {
                logger.warn('Fallback location fetch failed:', e.message);
            }
        }

        // 3. Fetch weather from Open-Meteo if location is available
        if (location && location.lat && location.lon) {
            try {
                const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${location.lat}&longitude=${location.lon}&current_weather=true`;
                const weatherRes = await fetch(weatherUrl);
                const weatherData = await weatherRes.json();
                
                weather = {
                    temp: Math.round(weatherData?.current_weather?.temperature || 0),
                    code: weatherData?.current_weather?.weathercode || 0
                };
            } catch (e) {
                logger.warn('Weather fetch failed:', e.message);
            }
        }

        // Always return 200 even if location/weather are null to avoid frontend crashes
        res.json({ location, weather });
    } catch (error) {
        logger.error('Personal context proxy error:', error);
        res.status(200).json({ location: null, weather: null });
    }
});

export default router;