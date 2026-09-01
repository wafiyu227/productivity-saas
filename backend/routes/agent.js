import crypto from 'node:crypto';
import express from 'express';
import { db } from '../services/supabase-client.js';
import { createAgentStream } from '../services/agent-chat.js';
import {
  buildApprovalResolutionMessage,
  executeApprovalRequest,
  findApprovalRequestInMessageRows,
  patchApprovalRequestUiMessage
} from '../services/agent-approval-actions.js';
import { createSeededConversation, generateStarterCopy } from '../services/agent-seeds.js';
import { buildIntegrationCapabilitySummary } from '../services/integration-capabilities.js';
import logger from '../utils/logger.js';
import aiProcessor from '../services/ai-processor.js';

const router = express.Router();
const FRONTEND_URL = (process.env.FRONTEND_URL || 'https://teamaai.xyz').replace(/\/+$/, '');
const DEFAULT_CONVERSATION_TITLE = 'New chat';

function normalizeList(value) {
  return Array.isArray(value) ? value : [];
}

function truncateText(value, maxLength = 240) {
  const normalized = typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
  if (!normalized) return '';
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength - 3)}...`;
}

function extractKeywords(values = []) {
  const stopwords = new Set([
    'about', 'after', 'agenda', 'and', 'before', 'during', 'for', 'from', 'into',
    'meeting', 'next', 'the', 'this', 'that', 'with', 'your'
  ]);

  return [...new Set(
    values
      .flatMap((value) => String(value || '').toLowerCase().split(/[^a-z0-9]+/))
      .map((token) => token.trim())
      .filter((token) => token.length >= 3 && !stopwords.has(token))
  )];
}

function scoreAgainstKeywords(text, keywords = []) {
  const haystack = String(text || '').toLowerCase();
  if (!haystack || !keywords.length) return 0;
  return keywords.reduce((score, keyword) => score + (haystack.includes(keyword) ? 1 : 0), 0);
}

function formatAttendees(attendees = []) {
  return normalizeList(attendees)
    .map((attendee) => {
      if (typeof attendee === 'string') return attendee;
      return attendee?.name || attendee?.email || '';
    })
    .filter(Boolean)
    .slice(0, 8);
}

async function loadMeetingSeedContext(userId, meetingData, relatedContext = {}) {
  const attendeeNames = formatAttendees(meetingData?.attendees);
  const keywords = extractKeywords([
    meetingData?.title,
    meetingData?.description,
    ...attendeeNames
  ]);

  const summaries = await db.getSummaries(userId, 8).catch(() => []);
  const relevantSlackSummaries = (Array.isArray(summaries) ? summaries : [])
    .map((summary) => ({
      channel: summary?.channel_name || 'unknown',
      createdAt: summary?.created_at || null,
      summary: truncateText(summary?.summary, 260),
      score: scoreAgainstKeywords(summary?.summary, keywords)
    }))
    .filter((summary) => summary.summary)
    .sort((left, right) => {
      if (left.score !== right.score) {
        return right.score - left.score;
      }
      return new Date(right.createdAt || 0).getTime() - new Date(left.createdAt || 0).getTime();
    })
    .slice(0, 3);

  return {
    ...relatedContext,
    relevantSlackSummaries,
    attendees: attendeeNames
  };
}

function buildMeetingQuickActions(meetingData) {
  const title = meetingData?.title || 'this meeting';

  return [
    {
      label: 'Build Full Brief',
      prompt: `Build a full prep brief for "${title}" with background, risks, talking points, and what I should bring.`
    },
    {
      label: 'Surface Context',
      prompt: `Show me the most relevant context you found for "${title}" from my connected work sources, and explain why it matters.`
    },
    {
      label: 'Draft Talking Points',
      prompt: `Draft concise talking points and smart questions I can use in "${title}".`
    },
    {
      label: 'Prep Follow-Up',
      prompt: `Draft a post-meeting follow-up template for "${title}" with owners, decisions, and next steps.`
    }
  ];
}

function buildMeetingFallbackStarter(meetingData, seedContext = {}) {
  const lines = [];
  const attendeeCount = formatAttendees(meetingData?.attendees).length;
  const relatedTasks = normalizeList(seedContext?.relatedTasks).slice(0, 3);
  const relatedMessages = normalizeList(seedContext?.relatedMessages).slice(0, 2);
  const slackSummaries = normalizeList(seedContext?.relevantSlackSummaries).slice(0, 2);

  lines.push(`### Ready`);
  lines.push(`I started pulling together context for **${meetingData?.title || 'your meeting'}** so we can turn this into a focused prep chat.`);
  lines.push('');
  lines.push('### What I found');

  if (meetingData?.description) {
    lines.push(`- Calendar context: ${truncateText(meetingData.description, 180)}`);
  }
  if (attendeeCount > 0) {
    lines.push(`- Attendees: ${attendeeCount} participant${attendeeCount === 1 ? '' : 's'} on the invite.`);
  }
  relatedTasks.forEach((task) => {
    lines.push(`- Related task: ${truncateText(task, 140)}`);
  });
  relatedMessages.forEach((message) => {
    lines.push(`- Related note: ${truncateText(message, 140)}`);
  });
  slackSummaries.forEach((summary) => {
    lines.push(`- Slack context from #${summary.channel}: ${truncateText(summary.summary, 140)}`);
  });
  if (lines[lines.length - 1] === '### What I found') {
    lines.push('- I have the meeting details loaded and I can expand this with the context already attached to the conversation.');
  }

  lines.push('');
  lines.push('### Recommendation');
  lines.push('- Start with a full prep brief or have me surface the strongest context first, then we can turn it into talking points.');
  lines.push('');
  lines.push('Choose one of the next steps below and I’ll keep working from this context.');

  return lines.join('\n');
}

function buildMeetingStarterPrompt(meetingData, seedContext = {}, quickActions = []) {
  return [
    'Meeting seed context:',
    JSON.stringify({
      meeting: {
        title: meetingData?.title || '',
        start: meetingData?.start || null,
        end: meetingData?.end || null,
        description: truncateText(meetingData?.description, 500),
        attendees: formatAttendees(meetingData?.attendees)
      },
      relatedTasks: normalizeList(seedContext?.relatedTasks).slice(0, 5),
      relatedMessages: normalizeList(seedContext?.relatedMessages).map((item) => truncateText(item, 220)).slice(0, 3),
      relevantSlackSummaries: normalizeList(seedContext?.relevantSlackSummaries).slice(0, 3)
    }, null, 2),
    '',
    'Write the first assistant message for this chat.',
    'Requirements:',
    '- Sound proactive, like the assistant has already started working.',
    '- Be honest about what context is available and do not invent docs, emails, or notes.',
    '- Include short markdown sections.',
    '- Include one recommendation.',
    '- End by inviting the user to choose one of the provided next steps.',
    `Available next steps: ${quickActions.map((action) => action.label).join(', ')}.`
  ].join('\n');
}

function buildConversationContextPrompt(metadata = {}) {
  const actionType = metadata?.actionType || 'chat';

  if (actionType === 'meeting_prep') {
    const meeting = metadata?.meetingData || {};
    const context = metadata?.relatedContext || {};
    const startTime = meeting.start ? new Date(meeting.start).toLocaleString() : 'time unknown';
    const attendeeList = formatAttendees(meeting.attendees);

    const lines = [
      'This conversation is about preparing for an upcoming meeting.',
      '',
      '### Meeting Details',
      `- **Title**: ${meeting.title || 'Unknown'}`,
      `- **When**: ${startTime}`,
      attendeeList.length > 0 ? `- **Attendees**: ${attendeeList.join(', ')}` : null,
      meeting.description ? `- **Description**: ${meeting.description}` : null,
    ].filter(Boolean);

    if (context.relevantSlackSummaries?.length > 0) {
      lines.push('', '### Related Slack Context');
      context.relevantSlackSummaries.forEach(s => {
        lines.push(`- **#${s.channel}**: ${s.summary}`);
      });
    }

    lines.push('', 'The user expects you to help them prepare for this meeting by summarizing key topics, suggesting talking points, and recommending a meeting structure.');
    
    return lines.join('\n');
  }

  if (actionType === 'blocker_action') {
    const blocker = metadata?.blockerData || {};
    const context = metadata?.gatheredContext || {};
    
    const lines = [
      'This conversation is about a specific blocker that was assigned to you.',
      '',
      '### Blocker Context',
      `- **Title**: ${blocker.title || 'Unknown'}`,
      `- **Source**: ${blocker.source || 'Unknown'} (${blocker.sourceType || 'unknown'})`,
      `- **Priority**: ${blocker.priority || 'medium'}`,
      blocker.description ? `- **Description**: ${blocker.description}` : null,
      blocker.externalUrl ? `- **Link**: ${blocker.externalUrl}` : null,
    ].filter(Boolean);

    if (context.slackSummary?.summary) {
      lines.push('', '### Related Slack Context');
      lines.push(`- **Channel**: #${context.slackSummary.channel}`);
      lines.push(`- **Summary**: ${context.slackSummary.summary}`);
    }

    lines.push('', 'The user expects you to provide recommendations and help resolve this blocker. Be proactive and stay grounded in the provided context.');
    
    return lines.join('\n');
  }

  return '';
}

async function loadCapabilitySummaries(userId) {
  const platforms = ['slack', 'asana', 'jira', 'github', 'google_workspace'];
  const entries = await Promise.all(
    platforms.map(async (platform) => {
      const integration = await db.getIntegration(userId, platform).catch(() => null);
      return [platform, buildIntegrationCapabilitySummary(platform, integration)];
    })
  );

  return Object.fromEntries(entries.filter(([, summary]) => Boolean(summary)));
}

function createAssistantUiMessage(text) {
  return {
    id: crypto.randomUUID(),
    role: 'assistant',
    parts: [{ type: 'text', text }]
  };
}

function serializeConversation(conversation) {
  return {
    ...conversation,
    shareUrl: conversation?.is_shared && conversation?.share_token
      ? `${FRONTEND_URL}/shared/chat/${conversation.share_token}`
      : null
  };
}

function extractMessageText(message) {
  if (!message || typeof message !== 'object') {
    return '';
  }

  if (Array.isArray(message.parts)) {
    const joined = message.parts
      .filter((part) => part?.type === 'text' && typeof part.text === 'string')
      .map((part) => part.text.trim())
      .filter(Boolean)
      .join('\n\n')
      .trim();

    if (joined) return joined;
  }

  if (typeof message.content === 'string') {
    return message.content.trim();
  }

  return '';
}

function inferMessageKind(message) {
  if (!message || !Array.isArray(message.parts)) {
    return 'chat';
  }

  if (message.parts.some((part) => typeof part?.type === 'string' && part.type.startsWith('tool-'))) {
    return 'tool_result';
  }

  return 'chat';
}

function toStoredMessage(message) {
  return {
    id: message.id || crypto.randomUUID(),
    role: message.role || 'assistant',
    status: 'completed',
    messageKind: inferMessageKind(message),
    content: extractMessageText(message),
    metadata: {
      uiMessage: message,
      messageMetadata: message.metadata ?? null
    }
  };
}

function toUiMessage(row) {
  const storedMessage = row?.metadata?.uiMessage;

  if (storedMessage && typeof storedMessage === 'object') {
    return storedMessage;
  }

  return {
    id: row.client_message_id || row.id,
    role: row.role || 'assistant',
    metadata: row?.metadata?.messageMetadata || undefined,
    parts: row.content
      ? [{ type: 'text', text: row.content }]
      : []
  };
}

async function deriveConversationTitle(messages = []) {
  const firstUserMessage = messages.find((message) => message?.role === 'user');
  const text = extractMessageText(firstUserMessage)
    .replace(/\s+/g, ' ')
    .replace(/^["'`]+|["'`]+$/g, '')
    .trim();

  logger.info('deriveConversationTitle: extracted text', { text: text.substring(0, 50) + '...' });

  if (!text) return DEFAULT_CONVERSATION_TITLE;

  try {
    const aiTitle = await aiProcessor.generateConversationTitle(text);
    logger.info('deriveConversationTitle: AI result', { aiTitle });
    return aiTitle || (text.length > 60 ? `${text.slice(0, 57)}...` : text);
  } catch (error) {
    logger.error('Failed to generate AI title, falling back to truncation:', error);
    return text.length > 60 ? `${text.slice(0, 57)}...` : text;
  }
}

async function loadOwnedConversation(conversationId, userId) {
  const conversation = await db.getAgentConversation(conversationId, userId);

  if (!conversation || conversation.status === 'deleted') {
    const error = new Error('Conversation not found');
    error.status = 404;
    throw error;
  }

  return conversation;
}

router.get('/conversations', async (req, res) => {
  try {
    const { userId } = req.query;

    if (!userId) {
      return res.status(400).json({ error: 'userId required' });
    }

    const conversations = await db.listAgentConversations(userId, { limit: 100 });
    res.json({
      conversations: conversations.map(serializeConversation)
    });
  } catch (error) {
    logger.error('Failed to list agent conversations:', error);
    res.status(error.status || 500).json({ error: error.message });
  }
});

router.post('/conversations', express.json(), async (req, res) => {
  try {
    const { userId, title, conversationKind, metadata } = req.body || {};

    if (!userId) {
      return res.status(400).json({ error: 'userId required' });
    }

    const conversation = await db.createAgentConversation(userId, {
      title: title || DEFAULT_CONVERSATION_TITLE,
      titleSource: title ? 'user' : 'system',
      conversationKind: conversationKind || 'chat',
      metadata
    });

    res.status(201).json({
      conversation: serializeConversation(conversation),
      messages: []
    });
  } catch (error) {
    logger.error('Failed to create agent conversation:', error);
    res.status(error.status || 500).json({ error: error.message });
  }
});

router.get('/conversations/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { userId } = req.query;

    if (!userId) {
      return res.status(400).json({ error: 'userId required' });
    }

    const conversation = await loadOwnedConversation(id, userId);
    const storedMessages = await db.getAgentConversationMessages(id, userId, { limit: 500 });

    res.json({
      conversation: serializeConversation(conversation),
      messages: storedMessages.map(toUiMessage)
    });
  } catch (error) {
    logger.error('Failed to load agent conversation:', error);
    res.status(error.status || 500).json({ error: error.message });
  }
});

router.patch('/conversations/:id', express.json(), async (req, res) => {
  try {
    const { id } = req.params;
    const { userId, title } = req.body || {};

    if (!userId || !title) {
      return res.status(400).json({ error: 'userId and title required' });
    }

    await loadOwnedConversation(id, userId);
    const updatedConversation = await db.renameAgentConversation(id, userId, title);

    res.json({
      conversation: serializeConversation(updatedConversation)
    });
  } catch (error) {
    logger.error('Failed to rename agent conversation:', error);
    res.status(error.status || 500).json({ error: error.message });
  }
});

router.post('/conversations/:id/share', express.json(), async (req, res) => {
  try {
    const { id } = req.params;
    const { userId } = req.body || {};

    if (!userId) {
      return res.status(400).json({ error: 'userId required' });
    }

    const conversation = await loadOwnedConversation(id, userId);
    const shareToken = conversation.share_token || crypto.randomUUID();
    const updatedConversation = await db.updateAgentConversation(id, userId, {
      isShared: true,
      shareToken,
      sharedAt: conversation.shared_at || new Date().toISOString()
    });

    res.json({
      conversation: serializeConversation(updatedConversation)
    });
  } catch (error) {
    logger.error('Failed to share agent conversation:', error);
    res.status(error.status || 500).json({ error: error.message });
  }
});

router.delete('/conversations/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { userId } = req.query;

    if (!userId) {
      return res.status(400).json({ error: 'userId required' });
    }

    await loadOwnedConversation(id, userId);
    await db.softDeleteAgentConversation(id, userId);

    res.json({ success: true });
  } catch (error) {
    logger.error('Failed to delete agent conversation:', error);
    res.status(error.status || 500).json({ error: error.message });
  }
});

router.get('/shared/:shareToken', async (req, res) => {
  try {
    const { shareToken } = req.params;
    const conversation = await db.getAgentConversationByShareToken(shareToken);

    if (!conversation) {
      return res.status(404).json({ error: 'Shared conversation not found' });
    }

    const storedMessages = await db.getAgentConversationMessages(conversation.id, conversation.user_id, { limit: 500 });

    res.json({
      conversation: serializeConversation(conversation),
      messages: storedMessages.map(toUiMessage)
    });
  } catch (error) {
    logger.error('Failed to load shared agent conversation:', error);
    res.status(error.status || 500).json({ error: error.message });
  }
});

router.post('/chat', express.json(), async (req, res) => {
  try {
    const { conversationId, messages, userId } = req.body || {};

    if (!userId || !conversationId || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'userId, conversationId, and messages are required' });
    }

    let conversation;
    let actualConversationId = conversationId;

    if (conversationId === 'new') {
      logger.info('Creating new conversation on-the-fly for /chat request', { userId });
      conversation = await db.createAgentConversation(userId, {
        title: DEFAULT_CONVERSATION_TITLE,
        titleSource: 'system'
      });
      actualConversationId = conversation.id;
      logger.info('New conversation created', { conversationId: actualConversationId });
    } else {
      conversation = await loadOwnedConversation(conversationId, userId);
    }

    const capabilitySummaries = await loadCapabilitySummaries(userId);

    const existingRows = await db.getAgentConversationMessages(actualConversationId, userId, { limit: 500 });
    const existingIds = new Set(
      existingRows
        .map((row) => row.client_message_id)
        .filter(Boolean)
    );

    const unsavedIncomingMessages = messages.filter((message) => {
      const messageId = message?.id;
      return typeof messageId === 'string' && !existingIds.has(messageId);
    });

    if (unsavedIncomingMessages.length > 0) {
      await db.saveAgentMessages(
        actualConversationId,
        userId,
        unsavedIncomingMessages.map(toStoredMessage)
      );
    }

    // Auto-titling check
    if (
      conversation.title === DEFAULT_CONVERSATION_TITLE &&
      conversation.title_source === 'system'
    ) {
      logger.info('Triggering auto-title for conversation', { conversationId: actualConversationId });
      const nextTitle = await deriveConversationTitle(messages);
      logger.info('Generated title result', { nextTitle });
      if (nextTitle && nextTitle !== DEFAULT_CONVERSATION_TITLE) {
        await db.updateAgentConversation(actualConversationId, userId, {
          title: nextTitle,
          titleSource: 'generated'
        });
        logger.info('Database updated with new title', { conversationId: actualConversationId, nextTitle });
      }
    }

    const result = await createAgentStream(messages, {
      userId,
      capabilitySummaries,
      conversationContext: buildConversationContextPrompt(conversation?.metadata || {})
    });

    return result.pipeUIMessageStreamToResponse(res, {
      originalMessages: messages,
      generateMessageId: () => crypto.randomUUID(),
      onFinish: async ({ responseMessage }) => {
        if (!responseMessage) return;

        try {
          await db.saveAgentMessages(actualConversationId, userId, [toStoredMessage(responseMessage)]);
        } catch (saveError) {
          logger.error('Failed to save streamed agent response:', saveError);
        }
      }
    });
  } catch (error) {
    logger.error('Agent chat failed:', error);
    res.status(error.status || 500).json({ error: error.message });
  }
});

router.post('/approvals/:approvalId/approve', express.json(), async (req, res) => {
  try {
    const { approvalId } = req.params;
    const { userId, conversationId } = req.body || {};

    if (!approvalId || !userId || !conversationId) {
      return res.status(400).json({ error: 'approvalId, userId, and conversationId are required' });
    }

    await loadOwnedConversation(conversationId, userId);
    const rows = await db.getAgentConversationMessages(conversationId, userId, { limit: 500 });
    const located = findApprovalRequestInMessageRows(rows, approvalId);

    if (!located) {
      return res.status(404).json({ error: 'Approval request not found' });
    }

    if (located.request.status && located.request.status !== 'pending') {
      return res.status(409).json({ error: `Approval request is already ${located.request.status}` });
    }

    const executionResult = await executeApprovalRequest(userId, located.request);
    const nextUiMessage = patchApprovalRequestUiMessage(located.uiMessage, approvalId, {
      status: 'approved',
      approvedAt: new Date().toISOString(),
      executionResult
    });

    await db.updateAgentMessage(located.row.id, userId, {
      metadata: {
        ...located.row.metadata,
        uiMessage: nextUiMessage
      }
    });

    const assistantText = buildApprovalResolutionMessage(located.request, 'approved', executionResult);
    await db.saveAgentMessages(conversationId, userId, [{
      id: crypto.randomUUID(),
      clientMessageId: crypto.randomUUID(),
      role: 'assistant',
      status: 'completed',
      messageKind: 'approval_request',
      content: assistantText,
      metadata: {
        uiMessage: createAssistantUiMessage(assistantText)
      }
    }]);

    const refreshedRows = await db.getAgentConversationMessages(conversationId, userId, { limit: 500 });
    res.json({
      success: true,
      approvalId,
      status: 'approved',
      messages: refreshedRows.map(toUiMessage)
    });
  } catch (error) {
    logger.error('Failed to approve agent action:', error);
    res.status(error.status || 500).json({ error: error.message });
  }
});

router.post('/approvals/:approvalId/reject', express.json(), async (req, res) => {
  try {
    const { approvalId } = req.params;
    const { userId, conversationId } = req.body || {};

    if (!approvalId || !userId || !conversationId) {
      return res.status(400).json({ error: 'approvalId, userId, and conversationId are required' });
    }

    await loadOwnedConversation(conversationId, userId);
    const rows = await db.getAgentConversationMessages(conversationId, userId, { limit: 500 });
    const located = findApprovalRequestInMessageRows(rows, approvalId);

    if (!located) {
      return res.status(404).json({ error: 'Approval request not found' });
    }

    if (located.request.status && located.request.status !== 'pending') {
      return res.status(409).json({ error: `Approval request is already ${located.request.status}` });
    }

    const nextUiMessage = patchApprovalRequestUiMessage(located.uiMessage, approvalId, {
      status: 'rejected',
      rejectedAt: new Date().toISOString()
    });

    await db.updateAgentMessage(located.row.id, userId, {
      metadata: {
        ...located.row.metadata,
        uiMessage: nextUiMessage
      }
    });

    const assistantText = buildApprovalResolutionMessage(located.request, 'rejected');
    await db.saveAgentMessages(conversationId, userId, [{
      id: crypto.randomUUID(),
      clientMessageId: crypto.randomUUID(),
      role: 'assistant',
      status: 'completed',
      messageKind: 'approval_request',
      content: assistantText,
      metadata: {
        uiMessage: createAssistantUiMessage(assistantText)
      }
    }]);

    const refreshedRows = await db.getAgentConversationMessages(conversationId, userId, { limit: 500 });
    res.json({
      success: true,
      approvalId,
      status: 'rejected',
      messages: refreshedRows.map(toUiMessage)
    });
  } catch (error) {
    logger.error('Failed to reject agent action:', error);
    res.status(error.status || 500).json({ error: error.message });
  }
});

// Prepare for upcoming meeting
router.post('/prepare-meeting', express.json(), async (req, res) => {
  try {
    const { userId, meetingData, relatedContext } = req.body;

    if (!userId || !meetingData) {
      logger.warn('Missing required fields for prepare-meeting', { userId: !!userId, meetingData: !!meetingData });
      return res.status(400).json({ error: 'Missing required fields' });
    }

    logger.info('Preparing for meeting', { userId, meetingTitle: meetingData.title });

    // Validate meeting data structure
    if (!meetingData.title || typeof meetingData.title !== 'string') {
      logger.error('Invalid meeting data', { meetingData });
      return res.status(400).json({ error: 'Invalid meeting data - missing or invalid title' });
    }

    const seedContext = await loadMeetingSeedContext(userId, meetingData, relatedContext || {});
    const quickActions = buildMeetingQuickActions(meetingData);

    // Build a short static greeting — no separate GPT call
    const title = meetingData.title;
    const startTime = meetingData.start ? new Date(meetingData.start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'time unknown';
    const greeting = [
      `I've gathered the context for your meeting: **${title}** at ${startTime}.`,
      '',
      'Choose a "Next Step" below to build a brief, or tell me anything specific you want to focus on.'
    ].join('\n');

    const conversationTitle = `Meeting Prep: ${title}`;
    logger.debug('Creating seeded meeting conversation with context injection', { conversationTitle, userId });

    const conversation = await createSeededConversation({
      userId,
      title: conversationTitle,
      userPrompt: null, // No fake user message
      assistantText: greeting,
      quickActions,
      metadata: {
        actionType: 'meeting_prep',
        meetingData,
        relatedContext: seedContext,
        createdAt: new Date().toISOString()
      }
    });

    logger.info('Meeting prep conversation created successfully', { 
      meetingTitle: meetingData.title,
      conversationId: conversation.id,
      userId 
    });

    res.json({
      success: true,
      message: 'Meeting prep context prepared',
      conversationId: conversation.id,
      conversationUrl: `${FRONTEND_URL}/app/chat?conversation=${conversation.id}`
    });

  } catch (error) {
    logger.error('Prepare meeting error:', { error: error.message, stack: error.stack });
    res.status(error.status || 500).json({ error: error.message });
  }
});

function buildMeetingPrepPrompt(meeting, context = {}) {
  const { title, start, end, description, attendees } = meeting;
  const startTime = start ? new Date(start).toLocaleString() : 'time unknown';
  const endTime = end ? new Date(end).toLocaleString() : 'time unknown';
  const attendeeList = formatAttendees(attendees);
  
  let prompt = `I have an upcoming meeting and would like your help preparing for it:

**Meeting:** ${title}
**When:** ${startTime}${endTime !== 'time unknown' ? ` to ${endTime}` : ''}
${attendeeList.length > 0 ? `**Attendees:** ${attendeeList.join(', ')}` : ''}
${description ? `**Description:** ${description}` : ''}`;

  // Add related context if available
  if (context.relatedTasks && context.relatedTasks.length > 0) {
    prompt += `\n\n**Related Tasks:**\n${context.relatedTasks.slice(0, 5).map(t => `- ${t}`).join('\n')}`;
  }

  if (context.relatedMessages && context.relatedMessages.length > 0) {
    prompt += `\n\n**Relevant Messages:**\n${context.relatedMessages.slice(0, 3).map(m => `- ${m}`).join('\n')}`;
  }

  if (context.relevantSlackSummaries && context.relevantSlackSummaries.length > 0) {
    prompt += `\n\n**Relevant Slack Context:**\n${context.relevantSlackSummaries.slice(0, 3).map((summary) => `- #${summary.channel}: ${summary.summary}`).join('\n')}`;
  }

  prompt += `\n\nPlease help me prepare for this meeting by:
1. Summarizing the key topics that might be discussed
2. Suggesting important points to bring up
3. Recommending how to structure the meeting
4. Highlighting any action items I should prepare for
5. Suggesting a few concrete next-step options I can choose from in this chat

How can I best prepare for this meeting?`;

  return prompt;
}

export default router;
