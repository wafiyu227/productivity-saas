# 🚀 Quick Start: Demo Mode

## Enable Demo Mode in 30 Seconds

### Local Development
```bash
cd backend
echo "USE_DEMO_MODE=true" >> .env.local
npm run dev
```

### Production (Vercel)
1. **Vercel Dashboard** → Your Project
2. **Settings** → **Environment Variables**
3. Add: `USE_DEMO_MODE = true`
4. **Redeploy** (push to main branch or manually redeploy)

## Test It

1. Go to Dashboard
2. Select any channel
3. Click "Generate Summary"
4. ✨ Instant synthetic summary!

## Disable Demo Mode

**Remove the environment variable:**
- Local: Delete `USE_DEMO_MODE=true` from `.env.local`
- Production: Remove from Vercel Environment Variables and redeploy

## What You Get

✅ **Instant** summaries (no API calls)
✅ **Real** database persistence
✅ **Working** UI/UX
✅ **Realistic** synthetic data
✅ **Zero** API quota used

## Troubleshoot

Still seeing 429 errors?
- Verify `USE_DEMO_MODE=true` is set
- Restart server (local) or redeploy (Vercel)
- Check backend logs for "Returning demo summary"

## More Info

📖 Full guide: [DEMO_MODE.md](docs/DEMO_MODE.md)
📋 Implementation details: [DEMO_MODE_IMPLEMENTATION.md](DEMO_MODE_IMPLEMENTATION.md)

---

**Need real AI summaries?**
- Upgrade Gemini: [aistudio.google.com](https://aistudio.google.com/app/apikey)
- Cost: ~$0.075 per summary
