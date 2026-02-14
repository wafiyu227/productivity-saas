# 🚀 Teama AI - AI-Powered Team Assistant

A scalable SaaS MVP that integrates with Slack and Asana to provide intelligent summaries, detect blockers, and visualize team productivity—built entirely on free-tier tools.

## ✨ Features

- **🤖 AI Summarization**: Claude AI generates concise summaries of Slack conversations
- **🚧 Blocker Detection**: Automatically identifies team blockers and bottlenecks
- **📊 Analytics Dashboard**: Visual insights into team productivity
- **🔔 Real-time Webhooks**: Instant updates from Slack and Asana
- **🔒 Secure Authentication**: JWT-based auth with Supabase
- **📈 Scalable Architecture**: From 0 to 10,000+ users on free/low-cost tiers

## 🏗️ Tech Stack

### Backend
- **Runtime**: Node.js 18+ with Express
- **Database**: Supabase (PostgreSQL)
- **AI**: Anthropic Claude Sonnet 4
- **Deployment**: Vercel Serverless Functions
- **Integrations**: Slack Web API, Asana API

### Frontend (Coming Soon)
- **Framework**: React 18 + Vite
- **Styling**: Tailwind CSS
- **Charts**: Recharts
- **State**: React Hooks + Context

## 📁 Project Structure

```
productivity-saas-mvp/
├── backend/                    # Node.js API
│   ├── api/
│   │   ├── index.js           # Express server
│   │   ├── routes/            # API endpoints
│   │   ├── services/          # Business logic
│   │   ├── middleware/        # Auth, validation
│   │   └── utils/             # Helpers, logger
│   ├── tests/                 # Jest tests
│   ├── package.json
│   └── vercel.json            # Deployment config
│
├── database/
│   └── schema.sql             # Supabase schema
│
├── docs/
│   ├── SETUP.md              # Setup instructions
│   └── DEPLOYMENT.md         # Deployment guide
│
└── README.md                 # This file
```

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- Supabase account
- Slack workspace
- Anthropic API key

### 1. Clone Repository
```bash
git clone https://github.com/yourusername/productivity-saas.git
cd productivity-saas/backend
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Configure Environment
```bash
cp .env.example .env
# Edit .env with your credentials
```

### 4. Setup Database
1. Create Supabase project
2. Run `database/schema.sql` in SQL Editor
3. Copy API keys to `.env`

### 5. Configure Slack
1. Create Slack App at [api.slack.com/apps](https://api.slack.com/apps)
2. Add bot scopes: `channels:history`, `channels:read`, `chat:write`
3. Install to workspace
4. Copy tokens to `.env`

### 6. Demo Mode (Optional)
If you're using the free tier of Gemini API and hit quota limits, enable demo mode:

**Local Development:**
```bash
# Create .env.local in backend/ directory
echo "USE_DEMO_MODE=true" >> .env.local
```

**Production (Vercel):**
1. Go to Project Settings → Environment Variables
2. Add `USE_DEMO_MODE = true`
3. Redeploy

This enables realistic synthetic summaries without API calls. See [DEMO_MODE.md](docs/DEMO_MODE.md) for more details.

### 7. Run Locally
```bash
npm run dev
# Server starts at http://localhost:3000
```

### 8. Test API
```bash
# Health check
curl http://localhost:3000/health

# List channels
curl http://localhost:3000/api/slack/channels

# Generate summary
curl -X POST http://localhost:3000/api/slack/summarize \
  -H "Content-Type: application/json" \
  -d '{"channelId": "C1234567890", "hours": 24}'
```

## 📚 Documentation

- **[Setup Guide](docs/SETUP.md)** - Complete setup instructions
- **[Deployment Guide](docs/DEPLOYMENT.md)** - Deploy to production + scaling
- **[Demo Mode Guide](docs/DEMO_MODE.md)** - Using demo mode for testing without API quota
- **[API Documentation](docs/API.md)** - API endpoints reference

## 🔑 Key API Endpoints

### Slack Integration

```bash
# Generate channel summary
POST /api/slack/summarize
{
  "channelId": "C1234567890",
  "hours": 24,
  "teamId": "T1234567890"
}

# List available channels
GET /api/slack/channels

# Get channel messages
GET /api/slack/channel/:channelId/messages?hours=24

# Post message to channel
POST /api/slack/message
{
  "channelId": "C1234567890",
  "text": "Hello team!"
}
```

### Webhooks

```bash
# Slack events webhook
POST /api/slack/webhook
# Automatically configured by Slack
```

## 🎯 Example Use Cases

### Daily Standup Summary
```javascript
// Auto-generate standup summary every morning
const summary = await fetch('http://localhost:3000/api/slack/summarize', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    channelId: 'C_TEAM_CHANNEL',
    hours: 24
  })
});

// Returns:
{
  "summary": "Team discussed Q4 roadmap and API performance issues...",
  "blockers": ["Database migration pending", "API rate limits"],
  "keyTopics": ["performance", "deployment", "security"],
  "actionItems": ["Schedule DB migration", "Review rate limit config"]
}
```

### Blocker Detection
```javascript
// Monitor for blockers across all channels
const blockers = await db.getBlockers(teamId, 7); // Last 7 days

// Slack: ["API rate limiting", "Database migration"]
// Asana: ["Design review pending", "QA environment down"]
```

### Team Health Report
```javascript
// Weekly productivity report
const report = await aiProcessor.generateProductivityReport({
  slack: { channelCount: 5, messageCount: 247, discussions: [...] },
  asana: { totalTasks: 45, completedTasks: 12, overdueTasks: 3 }
});

// Returns productivity score (1-10) with recommendations
```

## 🧪 Testing

```bash
# Run all tests
npm test

# Run with coverage
npm test -- --coverage

# Watch mode
npm run test:watch
```

## 🚢 Deployment

### Deploy to Vercel (1 minute)

```bash
# Install Vercel CLI
npm install -g vercel

# Deploy
cd backend
vercel --prod
```

### Set Environment Variables

In Vercel Dashboard → Settings → Environment Variables:
```
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_ANON_KEY=eyJhbGc...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...
SLACK_BOT_TOKEN=xoxb-...
SLACK_SIGNING_SECRET=...
ANTHROPIC_API_KEY=sk-ant-...
JWT_SECRET=your-secret-key
```

### Update Slack Webhook URL

Slack App → Event Subscriptions → Request URL:
```
https://your-app.vercel.app/api/slack/webhook
```

**That's it!** Your API is now live globally. 🌍

## 💰 Cost Breakdown

| Service | Free Tier | Pro Tier | Enterprise |
|---------|-----------|----------|------------|
| **Vercel** | 100GB/month | $20/mo | Custom |
| **Supabase** | 500MB DB | $25/mo | $599/mo |
| **Anthropic** | $5 credit | Pay-as-you-go | Volume pricing |
| **Slack** | Free | Free | Free |
| **Total** | **$0-5** | **$45+** | **$650+** |

### Free Tier Capacity
- **API Requests**: ~10,000/day
- **AI Summaries**: ~50/day
- **Teams**: 10-20 active teams
- **Users**: 50-100 concurrent users

Perfect for MVP and early growth! 📈

## 🔐 Security

- ✅ Webhook signature verification
- ✅ JWT authentication
- ✅ Row-level security (Supabase RLS)
- ✅ Rate limiting (100 req/15min)
- ✅ Helmet.js security headers
- ✅ Environment variables for secrets
- ✅ HTTPS enforced (Vercel)

## 📊 Monitoring

```bash
# View production logs
vercel logs --follow

# Health check
curl https://your-app.vercel.app/health

# Database metrics
# Supabase Dashboard → Database → Usage
```

## 🤝 Contributing

1. Fork the repository
2. Create feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open Pull Request

## 📝 License

MIT License - see [LICENSE](LICENSE) file for details

## 🙋 Support

- **Issues**: [GitHub Issues](https://github.com/yourusername/productivity-saas/issues)
- **Discussions**: [GitHub Discussions](https://github.com/yourusername/productivity-saas/discussions)
- **Email**: support@yourapp.com

## 🗺️ Roadmap

- [x] Slack integration with AI summaries
- [x] Blocker detection
- [x] Webhook support
- [ ] Asana integration
- [ ] Frontend dashboard
- [ ] User authentication
- [ ] Email notifications
- [ ] Scheduled automated summaries
- [ ] Multi-team support
- [ ] Analytics & insights
- [ ] Mobile app

## ⭐ Show Your Support

Give a ⭐️ if this project helped you!

---

**Built with ❤️ using Claude AI, Slack, and Supabase**

Ready to boost your team's productivity? Deploy now and start getting AI-powered insights in minutes! 🚀