import dotenv from 'dotenv';
import logger from '../utils/logger.js';

dotenv.config();

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent';

class AIProcessor {
  async summarizeSlackMessages(messages, channelName) {
    if (!GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY not configured');
    }

    const formattedMessages = messages
      .map(msg => `[${msg.user}]: ${msg.text}`)
      .join('\n');

    const prompt = `Analyze these Slack messages from #${channelName} and provide a JSON response.

Messages:
${formattedMessages}

Provide ONLY a valid JSON response with this exact structure (no markdown, no extra text):
{
  "summary": "Brief 2-3 sentence summary of main discussions",
  "blockers": ["blocker1", "blocker2"],
  "keyTopics": ["topic1", "topic2", "topic3"]
}`;

    try {
      const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: prompt
            }]
          }]
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();

      if (!data.candidates || !data.candidates[0] || !data.candidates[0].content) {
        throw new Error('Invalid response from Gemini API');
      }

      const content = data.candidates[0].content.parts[0].text;

      // Extract JSON from response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('Failed to parse AI response as JSON');
      }

      const result = JSON.parse(jsonMatch[0]);

      logger.info('Successfully processed messages with Gemini AI', {
        channelName,
        messageCount: messages.length
      });

      return result;

    } catch (error) {
      logger.error('Gemini AI processing failed', { error: error.message });
      throw error;
    }
  }

  async analyzeAsanaTasks(tasks, projectName) {
    if (!GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY not configured');
    }

    const formattedTasks = tasks
      .map(task => {
        const status = task.completed ? 'COMPLETED' :
          (task.due_on && new Date(task.due_on) < new Date()) ? 'OVERDUE' : 'IN_PROGRESS';
        return `[${status}] ${task.name} (Due: ${task.due_on || 'No due date'})`;
      })
      .join('\n');

    const prompt = `Analyze these Asana tasks from project "${projectName}".

Tasks:
${formattedTasks}

Provide ONLY a valid JSON response (no markdown):
{
  "summary": "Project health summary in 2-3 sentences",
  "blockers": ["blocker1", "blocker2"],
  "overdueHighlight": ["task1", "task2"],
  "recommendations": ["rec1", "rec2"]
}`;

    try {
      const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: prompt
            }]
          }]
        })
      });

      if (!response.ok) {
        throw new Error(`Gemini API error: ${response.status}`);
      }

      const data = await response.json();
      const content = data.candidates[0].content.parts[0].text;
      const jsonMatch = content.match(/\{[\s\S]*\}/);

      if (!jsonMatch) {
        throw new Error('Failed to parse AI response');
      }

      return JSON.parse(jsonMatch[0]);

    } catch (error) {
      logger.error('Gemini analysis failed', { error: error.message });
      throw error;
    }
  }
}

export default new AIProcessor();