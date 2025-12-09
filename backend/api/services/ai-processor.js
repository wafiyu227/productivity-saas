import dotenv from 'dotenv';
import logger from '../utils/logger.js';

dotenv.config();

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

class AIProcessor {
  async summarizeSlackMessages(messages, channelName) {
    if (!ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY not configured');
    }

    const formattedMessages = messages
      .map(msg => `[${msg.user}]: ${msg.text}`)
      .join('\n');

    const prompt = `Analyze these Slack messages from #${channelName}:

${formattedMessages}

Provide a JSON response with:
{
  "summary": "Brief 2-3 sentence summary",
  "blockers": ["blocker1", "blocker2"],
  "keyTopics": ["topic1", "topic2", "topic3"]
}`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    if (!response.ok) {
      throw new Error(`Claude API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.content[0].text;
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    
    if (!jsonMatch) {
      throw new Error('Failed to parse AI response');
    }

    return JSON.parse(jsonMatch[0]);
  }
}

export default new AIProcessor();