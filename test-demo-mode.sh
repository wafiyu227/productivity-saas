#!/bin/bash
# Test script for demo mode

# This script tests the summary generation endpoint with demo mode enabled
# Make sure you have:
# 1. Backend running locally (npm run dev)
# 2. Demo mode enabled (USE_DEMO_MODE=true in .env.local or environment)
# 3. A valid userId from your authentication

# Configure these for testing:
BACKEND_URL="http://localhost:3000"
USER_ID="YOUR_USER_ID_HERE"  # Replace with actual user ID from authentication
CHANNEL_ID="C1234567890"      # Any channel ID (won't be validated in demo mode)

echo "🧪 Testing Summary Generation with Demo Mode..."
echo "=================================="
echo "Backend URL: $BACKEND_URL"
echo "User ID: $USER_ID"
echo "Channel ID: $CHANNEL_ID"
echo ""

# Test 1: Health check
echo "✅ Test 1: Health Check"
curl -s "$BACKEND_URL/health" && echo -e "\n"

# Test 2: Get channels (requires auth)
echo "✅ Test 2: Get Channels"
curl -s "$BACKEND_URL/api/slack/channels?userId=$USER_ID" | jq . && echo ""

# Test 3: Generate summary (with demo mode)
echo "✅ Test 3: Generate Summary (Demo Mode)"
curl -s -X POST "$BACKEND_URL/api/slack/summarize" \
  -H "Content-Type: application/json" \
  -d "{
    \"channelId\": \"$CHANNEL_ID\",
    \"userId\": \"$USER_ID\",
    \"hours\": 24
  }" | jq . && echo ""

echo "=================================="
echo "✨ Tests complete!"
echo ""
echo "Expected results:"
echo "- Test 1: { \"status\": \"ok\" }"
echo "- Test 2: { \"channels\": [...], \"teamId\": \"...\", \"teamName\": \"...\" }"
echo "- Test 3: { \"summary\": \"...\", \"blockers\": [...], \"keyTopics\": [...] }"
