import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { WebClient } from '@slack/web-api';
import slackRoutes from './routes/slack.js';
import authRoutes from './routes/auth.js';
import logger from './utils/logger.js';
import { db } from './services/supabase-client.js';
import emailService from './services/email-service.js';

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({
  origin: function (origin, callback) {
    const allowedOrigins = [
      'https://productivity-saas-frontend.vercel.app',
      'https://productivity-saas-tau.vercel.app',
      'http://localhost:3000',
      'http://localhost:5173'
    ];
    // Allow if origin is in the list or if it's a sub-deployment of our project
    if (!origin || allowedOrigins.indexOf(origin) !== -1 || origin.endsWith('.vercel.app')) {
      callback(null, true);
    } else {
      console.warn('CORS blocked origin:', origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(compression());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100
});
app.use('/api/', limiter);

// Body parsing
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString()
  });
});

// Root
app.get('/', (req, res) => {
  res.json({
    name: 'Productivity SaaS API',
    version: '1.0.0',
    health: '/health'
  });
});

// Routes
app.use('/api/slack', slackRoutes);
app.use('/api/auth', authRoutes);

// Direct OAuth callback handler at root level
app.get('/api/auth/slack/oauth/callback', async (req, res) => {
  const { code, state, error } = req.query;
  const SLACK_CLIENT_ID = process.env.SLACK_CLIENT_ID;
  const SLACK_CLIENT_SECRET = process.env.SLACK_CLIENT_SECRET;
  const API_BASE_URL = process.env.API_BASE_URL || 'https://productivity-saas-tau.vercel.app';
  const REDIRECT_URI = `${API_BASE_URL}/api/auth/slack/oauth/callback`;
  const FRONTEND_URL = process.env.FRONTEND_URL || 'https://productivity-saas-frontend.vercel.app';

  logger.info('=== DIRECT OAuth callback received ===');
  logger.info('Details', { hasCode: !!code, hasState: !!state, error, url: req.url });

  if (error) {
    logger.error('Slack OAuth error:', error);
    return res.redirect(`${FRONTEND_URL}/app?error=slack_auth_failed`);
  }

  if (!code || !state) {
    logger.error('Missing code or state', { code, state });
    return res.redirect(`${FRONTEND_URL}/app?error=missing_params`);
  }

  try {
    const { userId } = JSON.parse(Buffer.from(state, 'base64').toString());
    logger.info('Decoded userId:', { userId });

    const client = new WebClient();
    const result = await client.oauth.v2.access({
      client_id: SLACK_CLIENT_ID,
      client_secret: SLACK_CLIENT_SECRET,
      code,
      redirect_uri: REDIRECT_URI
    });

    logger.info('Token exchange result:', { ok: result.ok, error: result.error });

    if (!result.ok) {
      throw new Error(`Token exchange failed: ${result.error}`);
    }

    await db.saveIntegration(userId, 'slack', {
      accessToken: result.access_token,
      teamId: result.team.id,
      teamName: result.team.name,
      botUserId: result.bot_user_id
    });

    logger.info('Integration saved successfully');
    res.redirect(`${FRONTEND_URL}/app?success=slack_connected`);

  } catch (error) {
    logger.error('Callback error:', error);
    res.redirect(`${FRONTEND_URL}/app?error=oauth_failed`);
  }
});

// Debug endpoint to verify routing
app.get('/api/auth/slack/oauth/callback/debug', (req, res) => {
  res.json({
    message: 'OAuth callback route is reachable',
    query: req.query,
    headers: req.headers
  });
});

// Get summaries for a team
app.get('/api/summaries', async (req, res) => {
  try {
    const { userId, teamId } = req.query;

    logger.info('Summaries request received', { userId, teamId });

    if (!userId) {
      return res.status(400).json({ error: 'userId required', summaries: [] });
    }

    // Get user's Slack integration to find their team
    const integration = await db.getIntegration(userId, 'slack');

    if (!integration) {
      return res.status(401).json({ error: 'Slack not connected', summaries: [] });
    }

    // Fetch summaries for the user's team
    const summaries = await db.getSummaries(integration.team_id);

    logger.info('Summaries fetched successfully', { userId, count: summaries.length });

    res.json(summaries || []);
  } catch (error) {
    logger.error('Failed to fetch summaries:', { error: error.message });
    res.status(500).json({ error: error.message || 'Failed to fetch summaries' });
  }
});

// Send daily digest email
app.post('/api/email/daily-digest', async (req, res) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'userId required' });
    }

    // Get user info
    const { data: userData, error: userError } = await db.supabase.auth.admin.getUserById(userId);
    if (userError || !userData.user) {
      return res.status(400).json({ error: 'User not found' });
    }

    // Get user settings
    const { data: settings } = await db.supabase
      .from('user_settings')
      .select('*')
      .eq('user_id', userId)
      .single();

    // Check if daily digest is enabled
    if (!settings?.daily_digest) {
      return res.status(200).json({ message: 'Daily digest disabled for user' });
    }

    // Get user's integration
    const integration = await db.getIntegration(userId, 'slack');
    if (!integration) {
      return res.status(400).json({ error: 'Slack not connected' });
    }

    // Get today's summaries (last 24 hours)
    const { data: summaries } = await db.supabase
      .from('slack_summaries')
      .select('*')
      .eq('team_id', integration.team_id)
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .order('created_at', { ascending: false });

    // Send email
    const result = await emailService.sendDailyDigest(userData.user.email, summaries || []);

    if (result.success) {
      res.json({ success: true, message: 'Daily digest sent', messageId: result.messageId });
    } else {
      res.status(500).json({ error: result.error });
    }
  } catch (error) {
    logger.error('Failed to send daily digest:', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

// Debug endpoint to verify routing
app.get('/api/auth/slack/oauth/callback/debug', (req, res) => {
  res.json({
    message: 'OAuth callback route is reachable',
    query: req.query,
    headers: req.headers
  });
});

// Error handler for 404
app.use((req, res) => {
  logger.warn('404 - Route not found', { method: req.method, path: req.path, url: req.url });
  res.status(404).json({
    error: 'Not found',
    path: req.path,
    method: req.method,
    availableRoutes: [
      'GET /health',
      'GET /api/slack/channels',
      'POST /api/slack/webhook',
      'GET /api/auth/slack/connect',
      'GET /api/auth/slack/oauth/callback',
      'GET /api/auth/slack/status',
      'DELETE /api/auth/slack/disconnect',
      'POST /api/email/daily-digest'
    ]
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ error: err.message });
});

// Start server for local dev
if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

// Export for Vercel
export default app;