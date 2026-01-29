# 📖 User Guide: Demo Mode Features

## Overview

Your productivity SaaS now includes **Demo Mode** - a way to test all features without consuming Google Gemini API quota. This is perfect for:

- 🧪 Testing the UI while developing
- 📊 Running product demos
- 🎓 Training new team members
- 🚀 Demonstrating value before upgrading API plan

## Getting Started

### Step 1: Enable Demo Mode

Choose your environment:

#### **Local Development**
```bash
# 1. Navigate to backend directory
cd productivity-saas/backend

# 2. Create or edit .env.local
echo "USE_DEMO_MODE=true" >> .env.local

# 3. Restart your dev server
npm run dev
```

#### **Vercel Production**
```
1. Open your Vercel dashboard
2. Go to Settings → Environment Variables
3. Click "Add New"
4. Name: USE_DEMO_MODE
5. Value: true
6. Click "Save"
7. Redeploy (git push or manual redeploy)
```

### Step 2: Test Summary Generation

1. Open your app at `http://localhost:3000` (local) or your Vercel URL
2. Log in to your account
3. Go to **Dashboard**
4. Select a Slack channel from the dropdown
5. Click **"Generate Summary"**
6. ✨ A summary appears instantly!

### Step 3: Verify Database Persistence

The summaries are saved to your Supabase database just like with real API calls:

1. Go to **All Summaries** page
2. You should see the generated summaries listed
3. Search and filter work normally
4. Summaries persist even after page refresh

## Demo Summary Examples

Here's what you'll see when generating summaries in demo mode:

### #general Channel
```
Summary: "General discussion about team updates, announcements 
about company events, and casual conversation about weekend plans."

Blockers: (none)

Key Topics: Team Updates, Announcements, Company Culture
```

### #engineering Channel
```
Summary: "Team had a productive discussion in #engineering. 
Multiple action items were identified and assigned. Key takeaways 
include improved processes and better communication strategies."

Blockers: 
- Resource constraints
- Timeline delays

Key Topics: Strategy, Action Items, Process Improvement, Communication
```

### Any Other Channel
```
Summary: "[Similar realistic summary about the channel]"

Blockers: [2-3 typical blockers]

Key Topics: [4 relevant topics]
```

## How Demo Mode Works

### Without Demo Mode (Real API)
1. You select a channel
2. Backend fetches Slack messages
3. Backend calls Google Gemini API
4. Gemini generates summary (costs API quota)
5. Summary saves to database
6. Summary displays in UI

### With Demo Mode (Synthetic)
1. You select a channel
2. Backend fetches Slack messages
3. **Backend returns demo summary** (instant, no API)
4. Summary saves to database (same as real)
5. Summary displays in UI (identical experience)

The experience is identical - only the data source changes!

## Key Features Available in Demo Mode

| Feature | Works in Demo Mode? | Notes |
|---------|-------------------|-------|
| Summary Generation | ✅ Yes | Instant, realistic data |
| Channel Selection | ✅ Yes | Lists real Slack channels |
| Database Persistence | ✅ Yes | Summaries save normally |
| Blocker Detection | ✅ Yes | Included in synthetic data |
| Key Topics | ✅ Yes | Included in synthetic data |
| Search Summaries | ✅ Yes | Works on persisted data |
| Filter by Channel | ✅ Yes | Works on persisted data |
| Statistics | ✅ Yes | Calculated from real data |
| Export Summaries | ✅ Yes | Includes demo summaries |

## Important Notes

### ✅ What Still Works
- All Slack channels load normally
- All database operations work
- UI/UX is completely functional
- Summaries persist and can be searched
- Statistics and metrics calculate correctly
- Slack authentication still required
- All other features unaffected

### ⚠️ Demo Mode Limitations
- Summaries are synthetic (not AI-generated)
- Only a few predefined templates
- No real analysis of message content
- Can't analyze custom message patterns
- Not suitable for production use

### 🔄 When to Switch to Real API
You want to switch to real AI-powered summaries when:
- Deploying to production with real usage
- Analyzing real team communication patterns
- Need AI accuracy beyond templates
- Ready to use paid Gemini API tier

## Switching Between Modes

### Enable Demo Mode (Synthetic)
```bash
# Local: Add to .env.local
USE_DEMO_MODE=true

# Production: Add to Vercel Environment Variables
USE_DEMO_MODE = true
```

### Disable Demo Mode (Real API)
```bash
# Local: Remove from .env.local or set to false
USE_DEMO_MODE=false

# Production: Remove from Vercel or set to false
# Redeploy after changes
```

**Important:** When you disable demo mode, the backend will attempt to use Gemini API. Make sure:
1. `GEMINI_API_KEY` is set
2. Your API key has quota available (free tier is limited)
3. Your Gemini plan is active

## Troubleshooting

### "Still getting 429 errors in demo mode"
**Solution:** 
- Verify `USE_DEMO_MODE=true` is set
- Restart your local server or redeploy Vercel
- Check backend logs for "Returning demo summary" message
- If using Vercel, wait a few minutes for deployment to complete

### "Demo mode not working, still calling real API"
**Solution:**
- Environment variable might not be recognized
- Try restarting server completely
- Check that value is exactly `true` (not `"true"` as string in some cases)
- Verify in logs that demo mode is enabled

### "Summaries aren't saving"
**Solution:**
- Demo mode doesn't affect database - check Supabase connection
- Verify userId is being passed correctly
- Check browser console for API errors
- Make sure Supabase credentials are valid

### "I want to use real API but have quota limits"
**Options:**
1. **Use Paid Gemini Plan** (~$0.075/summary)
   - Visit [Google AI Studio](https://aistudio.google.com/app/apikey)
   - Enable billing
   - Update `GEMINI_API_KEY`

2. **Use Alternative AI Service**
   - Switch to Mistral API (better free tier)
   - Use Llama Cloud (LlamaIndex)
   - Deploy local open-source model

3. **Keep Using Demo Mode**
   - Perfect for development and testing
   - Works indefinitely

## Performance

### Demo Mode Performance
- Summary generation: **Instant** (<100ms)
- Database save: Same as real API
- UI responsiveness: No difference
- API quota used: **Zero**

### Real API Performance
- Summary generation: 2-5 seconds (depends on message count)
- Database save: Same timing
- UI responsiveness: No difference
- API quota used: 1 per summary

## Cost Comparison

| Scenario | Monthly Cost | Notes |
|----------|-------------|-------|
| **Demo Mode Only** | $0 | Unlimited synthetic summaries |
| **Gemini Free Tier** | $0 | ~1-5 summaries/day, then rate limited |
| **Gemini Paid Tier** | ~$2-5 | ~30-60 summaries/month at typical usage |
| **Premium Tier** | ~$10-20 | ~300 summaries/month |

## Best Practices

### For Development
1. Use demo mode locally - faster feedback loop
2. Test all features without API concerns
3. Focus on UI/UX improvements

### For Product Demos
1. Enable demo mode in production
2. Generate summaries for all channels
3. Shows working product without API issues
4. Looks identical to real implementation

### For Testing
1. Use demo mode for automated tests
2. No flaky API quota failures
3. Instant test execution
4. Predictable data for assertions

### For Production
1. Disable demo mode once ready to launch
2. Have paid Gemini API plan (or alternative)
3. Monitor API usage and costs
4. Have fallback strategy if quota exceeded

## Advanced

### Customizing Demo Summaries
Want to change the demo data? Edit `backend/api/services/ai-processor.js`:

```javascript
getDemoSummary(channelName) {
  const demoSummaries = {
    'my-channel': {
      summary: 'Your custom summary here...',
      blockers: ['Custom blocker 1'],
      keyTopics: ['Custom topic 1']
    },
    // Add more channels...
  };
  // ...
}
```

### Mixing Demo and Real API
Not currently supported, but could be added:
- Use demo mode for some channels, real API for others
- Cache demo data and occasionally call real API
- Progressive enhancement approach

Let us know if you need this feature!

## Getting Help

If you encounter issues:
1. Check [DEMO_MODE.md](docs/DEMO_MODE.md) for detailed documentation
2. Review [DEMO_MODE_IMPLEMENTATION.md](DEMO_MODE_IMPLEMENTATION.md) for technical details
3. Check backend logs for error messages
4. Verify environment variables are set correctly

## Next Steps

### Option A: Stay with Demo Mode
- Perfect for development and testing
- Use as long as you need
- Switch to real API whenever ready

### Option B: Upgrade to Gemini Paid
- Cost: ~$0.075 per summary
- Unlimited API access
- Real AI-powered summaries
- Setup: 2-3 minutes

### Option C: Switch AI Services
- Mistral API: Better free tier
- Llama Cloud: Generous limits
- Claude API: Different pricing
- Local models: Ollama, LM Studio

## Support

Questions about demo mode? Check:
- 📖 [Full Guide](docs/DEMO_MODE.md)
- 🚀 [Quick Start](DEMO_MODE_QUICKSTART.md)
- 📋 [Implementation Details](DEMO_MODE_IMPLEMENTATION.md)

---

**Happy testing! 🚀**

Demo mode makes it easy to build, test, and demo your productivity SaaS without API quota concerns.
