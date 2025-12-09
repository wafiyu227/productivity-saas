import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import logger from './utils/logger.js';
import slackRoutes from './routes/slack.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Security & middleware
app.use(helmet());
app.use(cors());
app.use(compression());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100
});
app.use('/api/', limiter);

// Body parsing
app.use('/api/slack/webhook', express.raw({ type: 'application/json' }));
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString()
  });
});

// Routes
app.use('/api/slack', slackRoutes);

// Root
app.get('/', (req, res) => {
  res.json({
    name: 'Productivity SaaS API',
    version: '1.0.0',
    health: '/health'
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Error handler
app.use((err, req, res, next) => {
  logger.error('Error:', err);
  res.status(500).json({ error: err.message });
});

// Start server (for local dev only)
if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    logger.info(`Server running on http://localhost:${PORT}`);
  });
}

// Export for Vercel
export default app;