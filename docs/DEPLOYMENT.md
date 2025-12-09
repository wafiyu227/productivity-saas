# Deployment & Scaling Guide

Comprehensive guide for deploying your Productivity SaaS to production and scaling to thousands of users.

## Quick Deploy to Vercel

### One-Command Deploy

```bash
cd backend
vercel --prod
```

### Deploy with Custom Domain

```bash
vercel --prod --domain productivity.yourdomain.com
```

## Production Checklist

### Before Deployment

- [ ] All environment variables configured in Vercel
- [ ] Database schema applied in Supabase
- [ ] Slack app webhook URL updated
- [ ] SSL/HTTPS enabled (automatic with Vercel)
- [ ] Rate limiting configured
- [ ] Error tracking setup (optional: Sentry)
- [ ] Logging configured for production

### Security Configuration

```env
# Production environment variables
NODE_ENV=production
JWT_SECRET=<strong-random-32-char-minimum>
SUPABASE_SERVICE_ROLE_KEY=<keep-this-secret>
```

**Important**: Never commit `.env` to git. Use Vercel dashboard for secrets.

## Vercel Configuration Deep Dive

### vercel.json Explained

```json
{
  "version": 2,
  "builds": [
    {
      "src": "api/index.js",
      "use": "@vercel/node"
    }
  ],
  "routes": [
    {
      "src": "/health",
      "dest": "api/index.js"
    },
    {
      "src": "/api/(.*)",
      "dest": "api/index.js"
    }
  ],
  "functions": {
    "api/index.js": {
      "memory": 1024,          // MB of RAM (512-3008)
      "maxDuration": 10        // seconds (10 for Hobby, 900 for Pro)
    }
  }
}
```

### Optimizing Function Configuration

**Hobby Tier (Free)**
- Memory: 1024 MB
- Max Duration: 10 seconds
- Concurrent Executions: 1000
- Bandwidth: 100 GB/month

**Pro Tier ($20/month)**
- Memory: Up to 3008 MB
- Max Duration: 900 seconds (15 minutes)
- Concurrent Executions: Unlimited
- Bandwidth: 1 TB/month

## Scaling Strategy

### Phase 1: MVP (0-100 users) - FREE TIER

**Infrastructure:**
- Vercel Hobby (Free)
- Supabase Free Tier (500MB DB)
- Anthropic $5 credit

**Capacity:**
- ~1,000 API requests/day
- ~50 AI summaries/day
- ~10 active teams

**Monitoring:**
```bash
# Check Vercel logs
vercel logs --follow

# Monitor Supabase usage
# Dashboard → Database → Usage
```

### Phase 2: Growth (100-1,000 users)

**Upgrade to:**
- Vercel Pro ($20/month)
- Supabase Pro ($25/month) - 8GB DB
- Anthropic Pay-as-you-go

**Optimizations:**

1. **Implement Caching**
```javascript
// Add Redis or in-memory cache
import NodeCache from 'node-cache';
const cache = new NodeCache({ stdTTL: 600 }); // 10 min cache

// Cache channel info
async function getChannelInfoCached(channelId) {
  const cached = cache.get(channelId);
  if (cached) return cached;
  
  const info = await slackService.getChannelInfo(channelId);
  cache.set(channelId, info);
  return info;
}
```

2. **Database Indexing**
```sql
-- Add composite indexes for common queries
CREATE INDEX idx_summaries_team_date 
ON slack_summaries(team_id, created_at DESC);

CREATE INDEX idx_blockers_team 
ON slack_summaries USING GIN(blockers) 
WHERE blockers IS NOT NULL;
```

3. **Batch Processing**
```javascript
// Process multiple channels in parallel
async function batchSummarize(channelIds) {
  const results = await Promise.allSettled(
    channelIds.map(id => generateSummary(id))
  );
  return results.filter(r => r.status === 'fulfilled');
}
```

### Phase 3: Scale (1,000-10,000 users)

**Infrastructure:**
- Vercel Enterprise (custom pricing)
- Supabase Team ($599/month) - 100GB DB
- Anthropic with volume discounts

**Additional Services:**

1. **Message Queue (Optional)**
```bash
# Use Vercel Edge Functions + Upstash Redis
npm install @upstash/redis

# Queue long-running tasks
import { Redis } from '@upstash/redis';
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_URL,
  token: process.env.UPSTASH_REDIS_TOKEN
});

await redis.lpush('summary-queue', { channelId, teamId });
```

2. **Background Workers**
```javascript
// Separate worker function for processing queue
// Deploy as separate Vercel function with longer timeout

// api/workers/process-summaries.js
export default async function handler(req, res) {
  const items = await redis.lrange('summary-queue', 0, 9);
  
  for (const item of items) {
    await processSummary(JSON.parse(item));
    await redis.lpop('summary-queue');
  }
  
  res.json({ processed: items.length });
}
```

3. **CDN for Static Assets**
```javascript
// Store generated reports in Supabase Storage
import { supabase } from './supabase-client.js';

async function saveReportToCDN(report, teamId) {
  const { data, error } = await supabase.storage
    .from('reports')
    .upload(`${teamId}/${Date.now()}.json`, JSON.stringify(report));
  
  return data.path;
}
```

## Performance Optimization

### 1. Connection Pooling

```javascript
// Supabase automatically handles connection pooling
// But you can optimize queries:

// Bad: Multiple queries
const summaries = await db.getSummaries(teamId);
const blockers = await db.getBlockers(teamId);

// Good: Single query with join
const data = await supabase
  .from('slack_summaries')
  .select('*, blockers')
  .eq('team_id', teamId);
```

### 2. Lazy Loading

```javascript
// Don't fetch all data at once
// Implement pagination

app.get('/api/summaries', async (req, res) => {
  const { page = 1, limit = 20 } = req.query;
  const offset = (page - 1) * limit;
  
  const { data, error, count } = await supabase
    .from('slack_summaries')
    .select('*', { count: 'exact' })
    .range(offset, offset + limit - 1)
    .order('created_at', { ascending: false });
  
  res.json({
    data,
    pagination: {
      page,
      limit,
      total: count,
      pages: Math.ceil(count / limit)
    }
  });
});
```

### 3. Compression

Already enabled in `api/index.js`:
```javascript
import compression from 'compression';
app.use(compression()); // Reduces payload size by ~70%
```

## Monitoring & Observability

### 1. Setup Error Tracking (Optional)

```bash
npm install @sentry/node
```

```javascript
// api/index.js
import * as Sentry from '@sentry/node';

if (process.env.NODE_ENV === 'production') {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: 'production',
    tracesSampleRate: 0.1
  });
}

// Use in error handler
app.use(Sentry.Handlers.errorHandler());
```

### 2. Custom Metrics

```javascript
// Track API usage
import { db } from './services/supabase-client.js';

async function logAnalytics(eventType, data) {
  await db.supabaseAdmin
    .from('analytics_events')
    .insert({
      event_type: eventType,
      event_data: data,
      created_at: new Date().toISOString()
    });
}

// Use in routes
await logAnalytics('summary_generated', {
  channelId,
  messageCount: messages.length,
  processingTime: endTime - startTime
});
```

### 3. Health Monitoring

```javascript
// Enhanced health check
app.get('/health', async (req, res) => {
  const checks = {
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    database: 'unknown',
    slack: 'unknown'
  };

  // Check database
  try {
    await supabase.from('profiles').select('count');
    checks.database = 'healthy';
  } catch (err) {
    checks.database = 'unhealthy';
  }

  // Check Slack
  try {
    if (slackService.client) {
      await slackService.client.auth.test();
      checks.slack = 'healthy';
    }
  } catch (err) {
    checks.slack = 'unhealthy';
  }

  const status = Object.values(checks).every(v => 
    v !== 'unhealthy'
  ) ? 200 : 503;

  res.status(status).json(checks);
});
```

## Cost Optimization

### Current Cost Breakdown (1,000 users)

| Service | Free Tier | Pro Tier | Enterprise |
|---------|-----------|----------|------------|
| Vercel | $0 | $20/mo | Custom |
| Supabase | $0 (500MB) | $25/mo (8GB) | $599/mo (100GB) |
| Anthropic | $5 credit | ~$50/mo | ~$500/mo |
| **Total** | **$0-5** | **$95/mo** | **$1,100+/mo** |

### Reduce AI Costs

1. **Smart Caching**
```javascript
// Cache AI responses for identical inputs
const cacheKey = crypto
  .createHash('md5')
  .update(JSON.stringify(messages))
  .digest('hex');

const cached = await redis.get(cacheKey);
if (cached) return JSON.parse(cached);

const result = await aiProcessor.summarize(messages);
await redis.setex(cacheKey, 3600, JSON.stringify(result));
```

2. **Batch AI Requests**
```javascript
// Process multiple channels in one AI call
const prompt = channels.map(ch => 
  `Channel ${ch.name}:\n${ch.messages.join('\n')}`
).join('\n\n---\n\n');
```

3. **Use Cheaper Models When Possible**
```javascript
// Use Claude Haiku for simple tasks
const model = taskComplexity === 'high' 
  ? 'claude-sonnet-4-20250514'  // $3/million tokens
  : 'claude-haiku-3-20240307';   // $0.25/million tokens
```

## Disaster Recovery

### Database Backups

Supabase Pro includes:
- Daily automated backups
- 7-day retention
- Point-in-time recovery

### Manual Backup

```bash
# Export schema
pg_dump -h db.xxx.supabase.co -U postgres -s > schema.sql

# Export data
pg_dump -h db.xxx.supabase.co -U postgres -a > data.sql
```

### Incident Response

1. **Monitor Vercel Status**: [status.vercel.com](https://status.vercel.com)
2. **Check Supabase Status**: [status.supabase.com](https://status.supabase.com)
3. **Slack Incident Bot**:
```javascript
// Auto-notify team of issues
if (errorRate > threshold) {
  await slackService.postMessage(ADMIN_CHANNEL, 
    '🚨 High error rate detected! Check logs immediately.'
  );
}
```

## CI/CD Pipeline

### GitHub Actions (Optional)

```yaml
# .github/workflows/deploy.yml
name: Deploy to Vercel
on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: cd backend && npm ci
      
      - name: Run tests
        run: cd backend && npm test
      
      - name: Deploy to Vercel
        uses: amondnet/vercel-action@v20
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.ORG_ID }}
          vercel-project-id: ${{ secrets.PROJECT_ID }}
          vercel-args: '--prod'
```

## Going Global

### Multi-Region Deployment

Vercel Edge Network automatically distributes your API globally.

**Latency by Region:**
- US East: ~50ms
- US West: ~60ms
- Europe: ~80ms
- Asia: ~150ms

### Database Replication

For sub-50ms database access globally:

```javascript
// Use Supabase read replicas (Enterprise)
const replicaUrl = getClosestReplica(req.ip);
const client = createClient(replicaUrl, anonKey);
```

## Summary

**For MVP**: Use free tiers, deploy to Vercel in minutes

**For Growth**: Upgrade to Pro, implement caching, optimize queries

**For Scale**: Add message queues, background workers, monitoring

Your backend is now production-ready and can scale from 0 to 10,000+ users! 🚀