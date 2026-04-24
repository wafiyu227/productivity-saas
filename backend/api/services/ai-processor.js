import dotenv from 'dotenv';
import logger from '../utils/logger.js';
import { chatComplete } from './multi-model-router.js';

dotenv.config();

class AIProcessor {
  /**
   * Summarise Slack messages for a channel.
   * Uses Gemini Flash (long-context worker) — 1M token ctx, 1,500 req/day free.
   */
  async summarizeSlackMessages(messages, channelName) {
    // Demo mode shortcut
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
      const content = await chatComplete({
        role: 'long_context', // Gemini Flash → Mistral → Groq
        messages: [{ role: 'user', content: userMessage }],
        temperature: 0.3,
        maxTokens: 500,
      });

      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        logger.error('Failed to extract JSON from summarize response', { content });
        throw new Error('Failed to parse AI response as JSON');
      }

      const result = JSON.parse(jsonMatch[0]);
      logger.info('Successfully summarized Slack messages', { channelName, messageCount: messages.length });
      return result;
    } catch (error) {
      logger.error('Slack summarization failed', { error: error.message });
      throw error;
    }
  }

  getDemoSummary(channelName) {
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
      summary: `Team had a productive discussion in #${channelName}. Multiple action items were identified and assigned.`,
      blockers: ['Resource constraints', 'Timeline delays'],
      keyTopics: ['Strategy', 'Action Items', 'Process Improvement', 'Communication']
    };

    logger.info('Returning demo summary for channel', { channelName });
    return demo;
  }

  /**
   * Analyse Asana tasks for a project.
   * Uses Gemini Flash (long-context worker) — handles moderate-length task lists cheaply.
   */
  async analyzeAsanaTasks(tasks, projectName) {
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
      const content = await chatComplete({
        role: 'long_context', // Gemini Flash → Mistral → Groq
        messages: [{ role: 'user', content: userMessage }],
        temperature: 0.3,
        maxTokens: 500,
      });

      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('Failed to parse AI response');
      return JSON.parse(jsonMatch[0]);
    } catch (error) {
      logger.error('Asana task analysis failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Find Asana task references in Slack messages.
   * Uses Gemini Flash (long-context worker) — needs to read full message threads.
   */
  async findAsanaTaskReferences(messages, asanaTasks) {
    if (!process.env.GEMINI_API_KEY && !process.env.GROQ_API_KEY) {
      logger.warn('No AI API key configured, skipping task detection');
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
      const content = await chatComplete({
        role: 'long_context', // Gemini Flash → Mistral → Groq
        messages: [{ role: 'user', content: userMessage }],
        temperature: 0.1,
        maxTokens: 500,
      });

      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (!jsonMatch) return [];
      return JSON.parse(jsonMatch[0]);
    } catch (error) {
      logger.error('Asana task reference extraction failed', { error: error.message });
      return [];
    }
  }

  /**
   * Generate a short conversation title.
   * Uses Cerebras (router model) — tiny prompt, pure speed, ~2,600 tok/s.
   */
  async generateConversationTitle(messageText) {
    if (!process.env.CEREBRAS_API_KEY && !process.env.GROQ_API_KEY) {
      logger.warn('No AI key for title generation, using truncation fallback');
      return messageText.slice(0, 40) + (messageText.length > 40 ? '...' : '');
    }

    const userMessage = `Generate a concise, clear, and descriptive title (3-5 words) for an AI chat conversation that begins with the message below.

Message: """
${messageText}
"""

Provide ONLY the title string, no quotes, no periods, no explanation.`;

    try {
      logger.info('Generating conversation title via Cerebras router');

      const content = await chatComplete({
        role: 'router', // Cerebras 8B → Groq 8B fallback
        messages: [{ role: 'user', content: userMessage }],
        temperature: 0.5,
        maxTokens: 20,
      });

      const title = content.trim().replace(/^["']|["']$/g, '');
      logger.info('Successfully generated title', { title });
      return title || 'New Conversation';
    } catch (error) {
      logger.error('Title generation failed, using fallback', { error: error.message });
      return messageText.slice(0, 40) + (messageText.length > 40 ? '...' : '');
    }
  }

  /**
   * Extract work-signal insights from Slack ticket groups.
   * Uses Mistral Large (worker) — complex reasoning + structured output, 1B tok/month free.
   */
  async extractBatchWorkInsightSignals(ticketGroups) {
    if (!process.env.MISTRAL_API_KEY && !process.env.GROQ_API_KEY) {
      logger.warn('No AI key configured, cannot extract work signals');
      return [];
    }

    if (!ticketGroups || ticketGroups.length === 0) return [];

    const formattedGroups = ticketGroups.map(group => {
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
      const content = await chatComplete({
        role: 'worker', // Mistral Large → OpenRouter → Groq
        messages: [{ role: 'user', content: userMessage }],
        temperature: 0.1,
        maxTokens: 1500,
      });

      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (!jsonMatch) return [];
      return JSON.parse(jsonMatch[0]);
    } catch (error) {
      logger.error('Work signal extraction failed', { error: error.message });
      return [];
    }
  }
}

export default new AIProcessor();