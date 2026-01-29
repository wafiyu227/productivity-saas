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

const app = express();
const PORT = process.env.PORT || 3000;

// CORS - allow both origins
const allowedOrigins = [
  'https://productivity-saas-frontend.vercel.app',
  'http://localhost:5173',
  'http://localhost:3000'
];

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like Postman, curl)
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      logger.warn('CORS blocked origin:', origin);
      callback(null, true); // Allow anyway for now
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Middleware
app.use(helmet({ contentSecurityPolicy: false }));
app.use(compression());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100
});
app.use('/api/', limiter);

// Body parsing
app.use(express.json());

// Request logger
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.url}`, {
    origin: req.headers.origin
  });
  next();
});

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

// Get summaries endpoint
app.get('/api/summaries', async (req, res) => {
  try {
    const { userId } = req.query;

    if (!userId) {
      return res.status(400).json({ error: 'userId required' });
    }

    // Get user's Slack integration
    const integration = await db.getIntegration(userId, 'slack');

    if (!integration) {
      return res.json([]); // Return empty array if not connected
    }

    // Fetch summaries
    const summaries = await db.getSummaries(integration.team_id);

    res.json(summaries || []);
  } catch (error) {
    logger.error('Failed to fetch summaries:', error);
    res.status(500).json({ error: error.message });
  }
});

// 404 handler (only one!)
app.use((req, res) => {
  logger.warn('404 - Route not found:', req.url);
  res.status(404).json({
    error: 'Not found',
    path: req.url
  });
});

// Error handler
app.use((err, req, res, next) => {
  logger.error('Server error:', err);
  res.status(500).json({ error: err.message });
});

// Start server for local dev
if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    logger.info(`Server running on http://localhost:${PORT}`);
  });
}

// Export for Vercel
export default app;