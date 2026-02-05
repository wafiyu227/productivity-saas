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
import logger from './utils/logger.js';
import { db } from './services/supabase-client.js';

const app = express();
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
  max: 100
});
app.use('/api/', limiter);

app.use(express.json());

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
    name: 'Productivity SaaS API',
    version: '1.0.0',
    health: '/health',
    endpoints: {
      slack: '/api/slack',
      auth: '/api/auth',
      blockers: '/api/blockers',
      asana: '/api/asana',
      summaries: '/api/summaries'
    }
  });
});

// API Routes
app.use('/api/slack', slackRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/blockers', blockersRoutes);
app.use('/api/asana', asanaRoutes);

// Summaries endpoint
app.get('/api/summaries', async (req, res) => {
  try {
    const { userId } = req.query;

    if (!userId) {
      return res.status(400).json({ error: 'userId required' });
    }

    const integration = await db.getIntegration(userId, 'slack');

    if (!integration) {
      return res.json([]);
    }

    const summaries = await db.getSummaries(integration.team_id);

    res.json(summaries || []);
  } catch (error) {
    logger.error('Failed to fetch summaries:', error);
    res.status(500).json({ error: error.message });
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