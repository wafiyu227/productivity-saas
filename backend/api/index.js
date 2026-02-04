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
import asanaRoutes from './routes/asana.js';

const app = express();
const PORT = process.env.PORT || 3000;

// Single CORS setup - let vercel.json handle headers
app.use(cors({
  origin: true,
  credentials: true
}));

app.use(helmet({ contentSecurityPolicy: false }));
app.use(compression());

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100
});
app.use('/api/', limiter);

app.use(express.json());

app.use((req, res, next) => {
  logger.info(`${req.method} ${req.url}`);
  next();
});

app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString()
  });
});

app.get('/', (req, res) => {
  res.json({
    name: 'Productivity SaaS API',
    version: '1.0.0',
    health: '/health'
  });
});

app.use('/api/slack', slackRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/blockers', blockersRoutes);

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

app.use('/api/asana', asanaRoutes);

app.use((req, res) => {
  logger.warn('404:', req.url);
  res.status(404).json({ error: 'Not found', path: req.url });
});

app.use((err, req, res, next) => {
  logger.error('Server error:', err);
  res.status(500).json({ error: err.message });
});

if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    logger.info(`Server running on http://localhost:${PORT}`);
  });
}

export default app;