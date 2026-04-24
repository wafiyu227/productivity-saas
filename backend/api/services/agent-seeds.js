import crypto from 'node:crypto';
import { generateText } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { db } from './supabase-client.js';
import logger from '../utils/logger.js';

const openai = process.env.OPENAI_API_KEY
  ? createOpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

function normalizeText(value) {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
}

function createUiMessage(role, text, extraParts = []) {
  const parts = [];
  const normalizedText = typeof text === 'string' ? text.trim() : '';

  if (normalizedText) {
    parts.push({ type: 'text', text: normalizedText });
  }

  return {
    id: crypto.randomUUID(),
    role,
    parts: [...parts, ...extraParts]
  };
}

function createStoredMessage(role, text, extraParts = [], createdAt = new Date().toISOString()) {
  const uiMessage = createUiMessage(role, text, extraParts);

  return {
    id: crypto.randomUUID(),
    clientMessageId: uiMessage.id,
    role,
    status: 'completed',
    messageKind: 'chat',
    content: typeof text === 'string' ? text : '',
    createdAt,
    updatedAt: createdAt,
    metadata: {
      uiMessage
    }
  };
}

export function normalizeQuickActions(actions = []) {
  return (Array.isArray(actions) ? actions : [])
    .map((action) => ({
      label: normalizeText(action?.label),
      prompt: normalizeText(action?.prompt),
      description: normalizeText(action?.description)
    }))
    .filter((action) => action.label && action.prompt)
    .slice(0, 4);
}

export function buildQuickActionsPart(actions = []) {
  const normalized = normalizeQuickActions(actions);
  if (!normalized.length) return null;

  return {
    type: 'quick-actions',
    actions: normalized
  };
}

export async function generateStarterCopy({
  system,
  prompt,
  fallback
}) {
  if (!openai) {
    return normalizeText(fallback);
  }

  try {
    const result = await generateText({
      model: openai('gpt-4o'),
      system,
      prompt
    });

    const text = normalizeText(result?.text);
    return text || normalizeText(fallback);
  } catch (error) {
    logger.warn('Failed to generate seeded assistant copy, using fallback', {
      error: error.message
    });
    return normalizeText(fallback);
  }
}

export async function createSeededConversation({
  userId,
  title,
  metadata = {},
  userPrompt,
  assistantText,
  quickActions = [],
  conversationKind = 'chat'
}) {
  if (!userId) {
    throw new Error('userId required');
  }

  const conversation = await db.createAgentConversation(userId, {
    title,
    titleSource: 'system',
    conversationKind,
    metadata: {
      ...metadata,
      starterQuickActions: normalizeQuickActions(quickActions),
      seededAt: new Date().toISOString()
    }
  });

  const starterQuickActions = buildQuickActionsPart(quickActions);
  const createdBase = Date.now();
  const starterMessages = [];

  // Only include user message if userPrompt is provided (no fake user messages)
  if (userPrompt) {
    starterMessages.push(
      createStoredMessage('user', userPrompt, [], new Date(createdBase).toISOString())
    );
  }

  starterMessages.push(
    createStoredMessage(
      'assistant',
      assistantText,
      starterQuickActions ? [starterQuickActions] : [],
      new Date(createdBase + 1).toISOString()
    )
  );

  await db.saveAgentMessages(conversation.id, userId, starterMessages);
  return conversation;
}
