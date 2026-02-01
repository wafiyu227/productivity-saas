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
import logger from './utils/logger.js';
import { db } from './services/supabase-client.js';

const app = express();
const PORT = process.env.PORT || 3000;

// CORS - MUST be first
const allowedOrigins = [
  'https://productivity-saas-frontend.vercel.app',
  'http://localhost:5173',
  'http://localhost:3000'
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(null, true); // Allow all for now
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Handle preflight
app.options('*', cors());

// Other middleware
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

// Logging
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
app.use('/api/blockers', blockersRoutes);

// Get summaries endpoint
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

// 404 handler
app.use((req, res) => {
  logger.warn('404:', req.url);
  res.status(404).json({ error: 'Not found', path: req.url });
});

// Error handler
app.use((err, req, res, next) => {
  logger.error('Server error:', err);
  res.status(500).json({ error: err.message });
});

// Local dev
if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    logger.info(`Server running on http://localhost:${PORT}`);
  });
}

export default app;