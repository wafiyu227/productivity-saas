# Demo Mode Guide

## Overview
The productivity SaaS platform now includes a **Demo Mode** that allows you to test the summary generation feature without consuming Gemini API quota. This is useful when you hit the free tier limits or want to test the UI without API costs.

## Problem
Google's Gemini API free tier has very restrictive rate limits (approximately 0 requests/minute after the initial threshold). You may see a `429 RESOURCE_EXHAUSTED` error when trying to generate summaries.

## Solution: Demo Mode

### Enabling Demo Mode

#### Option 1: Local Development
1. Create a `.env.local` file in the `backend/` directory (if it doesn't exist)
2. Add the following environment variable:
   ```env
   USE_DEMO_MODE=true
   ```
3. Restart your backend server
4. Summary generation will now return synthetic but realistic data

#### Option 2: Vercel Production
1. Go to your Vercel project dashboard
2. Navigate to **Settings** → **Environment Variables**
3. Add a new environment variable:
   - **Name**: `USE_DEMO_MODE`
   - **Value**: `true`
4. Redeploy your backend (via git push or manual redeploy)

### What Demo Mode Provides
When enabled, the system returns realistic-looking summaries with:
- **Summary**: 2-3 sentence overview of channel discussion
- **Blockers**: List of identified blockers/impediments
- **Key Topics**: Main topics discussed in the channel

**Note**: Demo data is synthetic and contextual (varies by channel name). For true AI-powered summaries, disable demo mode and ensure your Gemini API quota is available.

## Alternative Solutions

### Option A: Upgrade to Gemini Paid Plan
- Cost: ~$0.075 per summary generation
- Benefit: Unlimited API access
- Setup: Add a Gemini API key with a billing account

### Option B: Switch to Alternative AI Service
The codebase can be adapted to use other AI services:
- **Mistral AI**: Better free tier limits
- **Llama Cloud (LlamaIndex)**: More generous free tier
- **Claude API**: Different pricing model
- **Open source models**: Use locally or via Hugging Face

## How It Works

The `ai-processor.js` service checks the `USE_DEMO_MODE` environment variable:

```javascript
async summarizeSlackMessages(messages, channelName) {
  if (process.env.USE_DEMO_MODE === 'true') {
    return this.getDemoSummary(channelName);
  }
  
  // Otherwise, calls real Gemini API...
}
```

If enabled, it returns a pre-configured summary matching the channel name. Unknown channels get a generic but plausible summary.

## Testing Demo Mode

1. Navigate to your Dashboard
2. Select a channel from the dropdown
3. Click "Generate Summary"
4. You should see a summary appear instantly (no API call made)

## Disable Demo Mode

To go back to real API calls:
1. Remove the `USE_DEMO_MODE=true` environment variable
2. Restart your server (local) or redeploy (Vercel)
3. Ensure `GEMINI_API_KEY` is configured and has quota available

## Troubleshooting

**Q: Demo mode isn't working**
A: Ensure you've restarted your server or redeployed on Vercel after adding the environment variable.

**Q: Still getting 429 errors**
A: Check that `USE_DEMO_MODE=true` is set. If using Vercel, verify the environment variable is set in your Project Settings.

**Q: Want to upgrade to paid Gemini API**
A: Visit [Google AI Studio](https://aistudio.google.com/app/apikey) to enable billing and upgrade your API key.
