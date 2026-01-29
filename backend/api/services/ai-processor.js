import dotenv from 'dotenv';
import logger from '../utils/logger.js';

dotenv.config();

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

class AIProcessor {
  async summarizeSlackMessages(messages, channelName) {
    if (!GROQ_API_KEY) {
      throw new Error('GROQ_API_KEY not configured');
    }

    // Use demo mode if needed (set USE_DEMO_MODE=true in environment)
    if (process.env.USE_DEMO_MODE === 'true') {
      return this.getDemoSummary(channelName);
    }

    const formattedMessages = messages
      .map(msg => `[${msg.user}]: ${msg.text}`)
      .join('\n');

    const userMessage = `Analyze these Slack messages from #${channelName} and provide a JSON response.

Messages:
${formattedMessages}

Provide ONLY a valid JSON response with this exact structure (no markdown, no extra text):
{
  "summary": "Brief 2-3 sentence summary of main discussions",
  "blockers": ["blocker1", "blocker2"],
  "keyTopics": ["topic1", "topic2", "topic3"]
}`;

    try {
      const response = await fetch(GROQ_API_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${GROQ_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: [
            {
              role: 'user',
              content: userMessage
            }
          ],
          temperature: 0.3,
          max_tokens: 500
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        logger.error('Groq API error response', { status: response.status, error: errorText });
        throw new Error(`Groq API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();

      if (!data.choices || !data.choices[0] || !data.choices[0].message) {
        throw new Error('Invalid response from Groq API');
      }

      const content = data.choices[0].message.content;

      // Extract JSON from response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        logger.error('Failed to extract JSON from Groq response', { content });
        throw new Error('Failed to parse AI response as JSON');
      }

      const result = JSON.parse(jsonMatch[0]);

      logger.info('Successfully processed messages with Groq AI', {
        channelName,
        messageCount: messages.length
      });

      return result;

    } catch (error) {
      logger.error('Groq AI processing failed', { error: error.message });
      throw error;
    }
  }

  getDemoSummary(channelName) {
    // Return a demo summary when API quota is exceeded
    const demoSummaries = {
      'example-channel': {
        summary: 'Team discussed Q1 roadmap priorities and upcoming feature releases. Focus areas include performance optimization and user experience improvements.',
        blockers: ['Missing database schema approval', 'Waiting on design review'],
        keyTopics: ['Q1 Planning', 'Performance', 'User Experience', 'Database Optimization']
      },
      'general': {
        summary: 'General discussion about team updates, announcements about company events, and casual conversation about weekend plans.',
        blockers: [],
        keyTopics: ['Team Updates', 'Announcements', 'Company Culture']
      }
    };

    const demo = demoSummaries[channelName] || {
      summary: `Team had a productive discussion in #${channelName}. Multiple action items were identified and assigned. Key takeaways include improved processes and better communication strategies.`,
      blockers: ['Resource constraints', 'Timeline delays'],
      keyTopics: ['Strategy', 'Action Items', 'Process Improvement', 'Communication']
    };

    logger.info('Returning demo summary for channel', { channelName });
    return demo;
  }

  async analyzeAsanaTasks(tasks, projectName) {
    if (!GROQ_API_KEY) {
      throw new Error('GROQ_API_KEY not configured');
    }

    const formattedTasks = tasks
      .map(task => {
        const status = task.completed ? 'COMPLETED' :
          (task.due_on && new Date(task.due_on) < new Date()) ? 'OVERDUE' : 'IN_PROGRESS';
        return `[${status}] ${task.name} (Due: ${task.due_on || 'No due date'})`;
      })
      .join('\n');

    const userMessage = `Analyze these Asana tasks from project "${projectName}".

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
      const response = await fetch(GROQ_API_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${GROQ_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: [
            {
              role: 'user',
              content: userMessage
            }
          ],
          temperature: 0.3,
          max_tokens: 500
        })
      });

      if (!response.ok) {
        throw new Error(`Groq API error: ${response.status}`);
      }

      const data = await response.json();
      const content = data.choices[0].message.content;
      const jsonMatch = content.match(/\{[\s\S]*\}/);

      if (!jsonMatch) {
        throw new Error('Failed to parse AI response');
      }

      return JSON.parse(jsonMatch[0]);

    } catch (error) {
      logger.error('Groq analysis failed', { error: error.message });
      throw error;
    }
  }
}

export default new AIProcessor();