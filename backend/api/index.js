import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import slackRoutes from './routes/slack.js';
import authRoutes from './routes/auth.js';
import contactRoutes from './routes/contact.js';
import blockersRoutes from './routes/blockers.js';
import asanaRoutes from './routes/asana.js';
import jiraRoutes from './routes/jira.js';

import googleCalendarRouter from './routes/google-calendar.js';
import githubRoutes from './routes/github.js';
import userRoutes from './routes/user.js';
import emailRoutes from './routes/email.js';
import workInsightsRoutes from './routes/work-insights.js';
import agentRoutes from './routes/agent.js';
import logger from './utils/logger.js';
import waitlistRoutes from './routes/waitlist.js';
import webhooksRoutes from './routes/webhooks.js';
import { db } from './services/supabase-client.js';

const app = express();
app.set('trust proxy', 1);
const PORT = process.env.PORT || 3000;


// Helmet must be early too
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  crossOriginOpenerPolicy: false
}));


// Secondary CORS middleware for extra safety
const corsOptions = {
  origin: true,  // Allow any origin
  credentials: false,  // Don't send credentials header with wildcard origin
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH', 'HEAD'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
  optionsSuccessStatus: 200,
  maxAge: 86400
};
app.use(cors(corsOptions));

// Preflight handling
app.options('*', cors(corsOptions));

app.use(compression());

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  // Skip rate limiting for webhooks
  skip: (req) => req.originalUrl.startsWith('/webhooks')
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
      jira: '/api/jira',

      summaries: '/api/summaries',
      agent: '/api/agent',
      workInsights: '/api/work-insights',
      googleCalendar: '/api/google-calendar',
      user: '/api/user',
      email: '/api/email',
      paddle: '/api/paddle',
      webhooks: '/webhooks',
      contact: '/api/contact'
    }
  });
});

// Import Paddle Routes
import paddleRoutes from './routes/paddle.js';

import debugInsertRoutes from './routes/debug-insert.js';

// API Routes
app.use('/api/slack', slackRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/blockers', blockersRoutes);
app.use('/api/asana', asanaRoutes);
app.use('/api/jira', jiraRoutes);

app.use('/api/google-calendar', googleCalendarRouter);
app.use('/api/github', githubRoutes);
app.use('/api/user', userRoutes);
app.use('/api/email', emailRoutes);
app.use('/api/work-insights', workInsightsRoutes);
app.use('/api/agent', agentRoutes);
app.use('/api/debug-insert', debugInsertRoutes);
app.use('/api/waitlist', waitlistRoutes);
app.use('/api/paddle', paddleRoutes);
app.use('/webhooks', webhooksRoutes);
app.use('/api/contact', contactRoutes);

// Summaries endpoint
app.get('/api/summaries', async (req, res) => {
  try {
    const { limit: requestedLimitStr, userId } = req.query;
    const requestedLimit = parseInt(requestedLimitStr, 10);
    const limit = Number.isFinite(requestedLimit) && requestedLimit > 0
      ? Math.min(requestedLimit, 500)
      : 100;

    if (!userId) {
      return res.status(400).json({ error: 'userId required' });
    }

    const summaries = await db.getSummaries(userId, limit);

    res.json(summaries || []);

  } catch (error) {
    logger.error('Failed to fetch summaries:', error);
    res.status(error.status || 500).json({ error: error.message });
  }
});

app.delete('/api/summaries/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { userId } = req.query;

    if (!id || !userId) {
      return res.status(400).json({ error: 'id and userId required' });
    }

    const { data: summary, error: summaryError } = await db.supabase
      .from('slack_summaries')
      .select('id, user_id')
      .eq('id', id)
      .single();

    if (summaryError || !summary) {
      return res.status(404).json({ error: 'Summary not found' });
    }

    if (summary.user_id !== userId) {
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
  logger.error('Unhandled server error:', {
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method
  });
  
  res.status(500).json({
    error: err.message || 'Internal Server Error',
    path: req.path
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
