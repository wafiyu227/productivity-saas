import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import slackRoutes from './routes/slack.js';
import authRoutes from './routes/auth.js';
import blockersRoutes from './routes/blockers.js';
import asanaRoutes from './routes/asana.js';
import googleCalendarRouter from './routes/google-calendar.js';
import githubRoutes from './routes/github.js';
import userRoutes from './routes/user.js';
import teamsRoutes from './routes/teams.js';
import invitationsRoutes from './routes/invitations.js';
import emailRoutes from './routes/email.js';
import logger from './utils/logger.js';
import waitlistRoutes from './routes/waitlist.js';
import { db } from './services/supabase-client.js';
import { requireTeamAdmin, requireTeamMember } from './utils/team-permissions.js';

const app = express();
// Trust proxy is required for Vercel/proxied environments to get correct client IP
app.set('trust proxy', 1);
const PORT = process.env.PORT || 3000;

// IMPORTANT: CORS must be FIRST, before any other middleware
app.use(cors({
  origin: true, // Allow all origins in production
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  optionsSuccessStatus: 200
}));

// Handle preflight
app.options('*', cors());

app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginResourcePolicy: false
}));

app.use(compression());

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  // Skip rate limiting for Paystack webhooks
  skip: (req) => req.originalUrl === '/api/paystack/webhook'
});
app.use('/api/', limiter);

app.use(express.json({
  verify: (req, res, buf) => {
    req.rawBody = buf;
  }
}));

// Logging middleware
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.url}`);
  next();
});

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString()
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    name: 'Teama AI API',
    version: '1.0.0',
    health: '/health',
    endpoints: {
      slack: '/api/slack',
      auth: '/api/auth',
      blockers: '/api/blockers',
      asana: '/api/asana',
      summaries: '/api/summaries',
      googleCalendar: '/api/google-calendar',
      user: '/api/user',
      teams: '/api/teams',
      invitations: '/api/invitations',
      email: '/api/email',
      paystack: '/api/paystack'
    }
  });
});

// Import Paystack Routes
import paystackRoutes from './routes/paystack.js';

// API Routes
app.use('/api/slack', slackRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/blockers', blockersRoutes);
app.use('/api/asana', asanaRoutes);
app.use('/api/google-calendar', googleCalendarRouter);
app.use('/api/github', githubRoutes);
app.use('/api/user', userRoutes);
app.use('/api/teams', teamsRoutes);
app.use('/api/invitations', invitationsRoutes);
app.use('/api/email', emailRoutes);
app.use('/api/waitlist', waitlistRoutes);
app.use('/api/paystack', paystackRoutes);

// Summaries endpoint
app.get('/api/summaries', async (req, res) => {
  try {
    const { userId, teamId } = req.query;
    const requestedLimit = Number.parseInt(req.query.limit, 10);
    const limit = Number.isFinite(requestedLimit) && requestedLimit > 0
      ? Math.min(requestedLimit, 500)
      : 100;

    if (!userId) {
      return res.status(400).json({ error: 'userId required' });
    }

    if (teamId) {
      await requireTeamMember(teamId, userId);
      const teamSummaries = await db.getSummaries(teamId, null, limit);
      return res.json(teamSummaries || []);
    }

    // Personal fallback for legacy users without team context.
    const integration = await db.getIntegration(userId, 'slack', null);
    if (!integration) return res.json([]);

    const summaries = await db.getSummaries(integration?.team_id, userId, limit);

    res.json(summaries || []);
  } catch (error) {
    logger.error('Failed to fetch summaries:', error);
    res.status(error.status || 500).json({ error: error.message });
  }
});

app.delete('/api/summaries/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { userId } = req.query; // Or req.body if moving to POST/PUT style, but DELETE usually uses query params or headers

    if (!id || !userId) {
      return res.status(400).json({ error: 'id and userId required' });
    }

    const { data: summary, error: summaryError } = await db.supabase
      .from('slack_summaries')
      .select('id, user_id, team_id')
      .eq('id', id)
      .single();

    if (summaryError || !summary) {
      return res.status(404).json({ error: 'Summary not found' });
    }

    if (summary.team_id) {
      await requireTeamAdmin(summary.team_id, userId);
    } else if (summary.user_id !== userId) {
      return res.status(403).json({ error: 'Not authorized to delete this summary' });
    }

    const { error: deleteError } = await db.supabase
      .from('slack_summaries')
      .delete()
      .eq('id', id);

    if (deleteError) throw deleteError;

    res.json({ success: true });
  } catch (error) {
    logger.error('Failed to delete summary:', error);
    res.status(error.status || 500).json({ error: error.message });
  }
});

// 404 handler - MUST return JSON, not HTML
app.use((req, res) => {
  logger.warn('404:', req.url);
  res.status(404).json({
    error: 'Not found',
    path: req.url,
    message: 'This endpoint does not exist'
  });
});

// Error handler - MUST return JSON
app.use((err, req, res, next) => {
  logger.error('Server error:', err);
  res.status(500).json({
    error: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
});

// For local development only
if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    logger.info(`Server running on http://localhost:${PORT}`);
  });
}

// CRITICAL: Export for Vercel serverless
export default app;
