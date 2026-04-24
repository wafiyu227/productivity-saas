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

  async findAsanaTaskReferences(messages, asanaTasks) {
    if (!GROQ_API_KEY) {
      logger.warn('GROQ_API_KEY not configured, skipping AI task detection');
      return [];
    }

    const formattedMessages = messages
      .map(msg => `[MSG_ID: ${msg.id}] [${msg.channelName || 'unknown'}]: ${msg.text}`)
      .join('\n');

    const formattedTasks = asanaTasks
      .map(t => `- ID: ${t.gid || t.id} | Name: ${t.name}`)
      .join('\n');

    const userMessage = `Analyze these Slack messages and determine which of the provided Asana tasks are being specifically discussed or referenced in them. Match conversational references, exact task names, or IDs. Ignore generic discussion.
IMPORTANT: Do NOT match messages that are clearly discussing Jira issues (indicated by formatted keys like ENG-123, KAN-4, or PROJECT-123). Treat those as Jira discussions and DO NOT map them to the provided Asana tasks.

Slack Messages:
${formattedMessages}

Active Asana Tasks:
${formattedTasks}

Provide ONLY a valid JSON response containing an array of objects mapping the message ID to the recognized Asana task IDs.
Format Requirements:
[
  { "messageId": "...", "taskIds": ["...", "..."] }
]
If there are no matches, return an empty array [].`;

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
          temperature: 0.1,
          max_tokens: 500
        })
      });

      if (!response.ok) {
        throw new Error(`Groq API error on task ref extraction: ${response.status}`);
      }

      const data = await response.json();
      const content = data.choices[0].message.content;
      
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
         return []; 
      }
      return JSON.parse(jsonMatch[0]);
    } catch (error) {
      logger.error('Groq reference extraction failed', { error: error.message });
      return []; 
    }
  }

  async generateConversationTitle(messageText) {
    if (!GROQ_API_KEY) {
      logger.warn('GROQ_API_KEY is missing in environment, using simple truncation fallback for titles.');
      return messageText.slice(0, 40) + (messageText.length > 40 ? '...' : '');
    }

    const userMessage = `Generate a concise, clear, and descriptive title (3-5 words) for an AI chat conversation that begins with the message below. 

Message: """
${messageText}
"""

Provide ONLY the title string, no quotes, no periods, no explanation.`;

    try {
      logger.info('Attempting to generate AI title with Groq', { model: 'llama-3.1-8b-instant', textLength: messageText.length });
      
      const response = await fetch(GROQ_API_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${GROQ_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'llama-3.1-8b-instant',
          messages: [
            {
              role: 'user',
              content: userMessage
            }
          ],
          temperature: 0.5,
          max_tokens: 20
        })
      });

      if (!response.ok) {
        const errorBody = await response.text();
        logger.error('Groq API error during titling', { status: response.status, body: errorBody });
        throw new Error(`Groq API error: ${response.status}`);
      }

      const data = await response.json();
      const title = data.choices[0].message.content.trim().replace(/^["']|["']$/g, '');
      
      logger.info('Successfully generated AI title', { title });
      return title || 'New Conversation';
    } catch (error) {
      logger.error('Title generation failed, using fallback', { error: error.message });
      return messageText.slice(0, 40) + (messageText.length > 40 ? '...' : '');
    }
  }

  async extractBatchWorkInsightSignals(ticketGroups) {
    if (!GROQ_API_KEY) {
      logger.warn('GROQ_API_KEY not configured, cannot extract work signals via AI');
      return [];
    }

    if (!ticketGroups || ticketGroups.length === 0) return [];

    let formattedGroups = ticketGroups.map(group => {
      const messages = group.evidence.map(ev => `[${ev.source}]: ${ev.text}`).join('\n');
      const statuses = group.availableStatuses && group.availableStatuses.length > 0 
          ? group.availableStatuses.join(', ') 
          : 'Any';
      return `TicketID: ${group.ticketKey} (Current Status: ${group.currentStatus || 'Unknown'})\nAvailable Statuses: ${statuses}\nMessages:\n${messages}`;
    }).join('\n\n---\n\n');

    const userMessage = `Analyze the following Slack conversation groups for various work tickets.
For each TicketID, determine the current work signals and overall progress. 
The input may range from short, explicit list-style updates to lengthy, conversational "essay" style messages. 
You must analyze BOTH styles carefully. Even short, direct statements like "Fixed X" or "PR up for Y" are high-quality signals and should be captured as work progress.

Possible exact signals to identify (use these labels if applicable, or infer variations if appropriate):
"Started work", "Fix completed", "PR raised", "Code review", "Merged", "Deployed", "Blocked", "Testing", "Done"

You MUST pick a suggestedStatus that logically follows the progress indicated. 
CRITICAL: If 'Available Statuses' is provided for a ticket, you MUST select a suggestedStatus that EXACTLY matches one of those strings. If none perfectly fit, pick the closest logical match from the available list.

Conversations:
${formattedGroups}

Provide ONLY a valid JSON response matching this structure EXACTLY (no markdown wrappers):
[
  {
    "ticketKey": "ENG-231",
    "signals": ["Fix completed", "PR raised"],
    "suggestedStatus": "In Review",
    "confidence": 0.95
  }
]
Return an empty array if no clear signals can be confidently detected for any tickets.`;

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
          temperature: 0.1,
          max_tokens: 1500
        })
      });

      if (!response.ok) {
        throw new Error(`Groq API error on work signal extraction: ${response.status}`);
      }

      const data = await response.json();
      const content = data.choices[0].message.content;
      
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
         return []; 
      }
      return JSON.parse(jsonMatch[0]);
    } catch (error) {
      logger.error('Groq work signal extraction failed', { error: error.message });
      return []; 
    }
  }
}

export default new AIProcessor();