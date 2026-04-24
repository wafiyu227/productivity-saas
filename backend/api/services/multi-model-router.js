/**
 * multi-model-router.js
 *
 * Centralised provider registry for the multi-model AI architecture.
 *
 * Assignment (follows the guide):
 *   Router / tiny tasks  → Cerebras  Llama-3.1-8B   (1M tok/day, ~2 600 tok/s)
 *   Long context reading  → Gemini    Flash 2.0       (1M ctx, 1 500 req/day)
 *   Drafting / planning   → Mistral   Large           (1B tok/month free)
 *   Overflow fallback     → OpenRouter free models    (~30 models, ~20 RPM each)
 *   Emergency fallback    → Groq      llama-3.3-70b   (existing key)
 */

import { createOpenAI } from '@ai-sdk/openai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import logger from '../utils/logger.js';

// ── Provider clients ────────────────────────────────────────────────────────

function buildCerebras() {
  if (!process.env.CEREBRAS_API_KEY) return null;
  return createOpenAI({
    apiKey: process.env.CEREBRAS_API_KEY,
    baseURL: 'https://api.cerebras.ai/v1',
  });
}

function buildMistral() {
  if (!process.env.MISTRAL_API_KEY) return null;
  return createOpenAI({
    apiKey: process.env.MISTRAL_API_KEY,
    baseURL: 'https://api.mistral.ai/v1',
  });
}

function buildGemini() {
  if (!process.env.GEMINI_API_KEY) return null;
  return createGoogleGenerativeAI({
    apiKey: process.env.GEMINI_API_KEY,
  });
}

function buildOpenRouter() {
  if (!process.env.OPENROUTER_API_KEY) return null;
  return createOpenAI({
    apiKey: process.env.OPENROUTER_API_KEY,
    baseURL: 'https://openrouter.ai/api/v1',
  });
}

function buildGroq() {
  if (!process.env.GROQ_API_KEY) return null;
  return createOpenAI({
    apiKey: process.env.GROQ_API_KEY,
    baseURL: 'https://api.groq.com/openai/v1',
  });
}

// Lazy-initialise once per process
let _cerebras, _mistral, _gemini, _openRouter, _groq;

function getCerebras()   { return _cerebras   ??= buildCerebras(); }
function getMistral()    { return _mistral    ??= buildMistral(); }
function getGemini()     { return _gemini     ??= buildGemini(); }
function getOpenRouter() { return _openRouter ??= buildOpenRouter(); }
function getGroq()       { return _groq       ??= buildGroq(); }

// ── Public model accessors ──────────────────────────────────────────────────

/**
 * Router model — fastest inference, tiny prompts (titles, routing decisions).
 * Falls back to Groq llama-3.1-8b-instant if Cerebras key is missing.
 */
export function getRouterModel() {
  const cerebras = getCerebras();
  if (cerebras) {
    logger.debug('[router] Using Cerebras llama-3.1-8b');
    return cerebras('llama-3.1-8b');
  }
  const groq = getGroq();
  if (groq) {
    logger.warn('[router] Cerebras key missing — falling back to Groq llama-3.1-8b-instant');
    return groq('llama-3.1-8b-instant');
  }
  throw new Error('No router model available. Set CEREBRAS_API_KEY or GROQ_API_KEY.');
}

/**
 * Long-context worker — Gemini Flash with 1 M token context window.
 * Falls back to Mistral, then Groq.
 */
export function getLongContextModel() {
  const gemini = getGemini();
  if (gemini) {
    logger.debug('[router] Using Gemini Flash 2.0');
    return gemini('gemini-2.0-flash');
  }
  const mistral = getMistral();
  if (mistral) {
    logger.warn('[router] Gemini key missing — falling back to Mistral');
    return mistral('mistral-large-latest');
  }
  const groq = getGroq();
  if (groq) {
    logger.warn('[router] Falling back to Groq llama-3.3-70b');
    return groq('llama-3.3-70b-versatile');
  }
  throw new Error('No long-context model available. Set GEMINI_API_KEY.');
}

/**
 * Worker model — Mistral Large for agent chat stream, drafting, planning.
 * Falls back to OpenRouter, then Groq.
 */
export function getWorkerModel() {
  const mistral = getMistral();
  if (mistral) {
    logger.debug('[router] Using Mistral Large');
    return mistral('mistral-large-latest');
  }
  const openRouter = getOpenRouter();
  if (openRouter) {
    logger.warn('[router] Mistral key missing — falling back to OpenRouter');
    return openRouter('meta-llama/llama-3.3-70b-instruct:free');
  }
  const groq = getGroq();
  if (groq) {
    logger.warn('[router] Falling back to Groq llama-3.3-70b');
    return groq('llama-3.3-70b-versatile');
  }
  throw new Error('No worker model available. Set MISTRAL_API_KEY or GROQ_API_KEY.');
}

/**
 * Overflow fallback model — OpenRouter free tier.
 * Used when primary providers hit rate limits.
 */
export function getFallbackModel() {
  const openRouter = getOpenRouter();
  if (openRouter) {
    logger.debug('[router] Using OpenRouter fallback');
    return openRouter('meta-llama/llama-3.3-70b-instruct:free');
  }
  const groq = getGroq();
  if (groq) {
    logger.warn('[router] OpenRouter key missing — using Groq as fallback');
    return groq('llama-3.3-70b-versatile');
  }
  throw new Error('No fallback model available. Set OPENROUTER_API_KEY or GROQ_API_KEY.');
}

// ── Plain-fetch helpers (for ai-processor which uses raw fetch, not AI SDK) ──

const CEREBRAS_URL  = 'https://api.cerebras.ai/v1/chat/completions';
const GEMINI_URL    = 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions';
const MISTRAL_URL   = 'https://api.mistral.ai/v1/chat/completions';
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const GROQ_URL      = 'https://api.groq.com/openai/v1/chat/completions';

/**
 * Generic OpenAI-compatible chat completion with automatic fallback.
 *
 * @param {object} opts
 * @param {'router'|'long_context'|'worker'|'fallback'} opts.role
 * @param {Array}  opts.messages
 * @param {number} [opts.temperature]
 * @param {number} [opts.maxTokens]
 * @returns {Promise<string>} The assistant message content string.
 */
export async function chatComplete({ role = 'worker', messages, temperature = 0.3, maxTokens = 500 }) {
  const chains = {
    router: [
      { url: CEREBRAS_URL,   key: process.env.CEREBRAS_API_KEY,   model: 'llama-3.1-8b' },
      { url: GROQ_URL,       key: process.env.GROQ_API_KEY,       model: 'llama-3.1-8b-instant' },
    ],
    long_context: [
      { url: GEMINI_URL,     key: process.env.GEMINI_API_KEY,     model: 'gemini-2.0-flash' },
      { url: MISTRAL_URL,    key: process.env.MISTRAL_API_KEY,    model: 'mistral-large-latest' },
      { url: GROQ_URL,       key: process.env.GROQ_API_KEY,       model: 'llama-3.3-70b-versatile' },
    ],
    worker: [
      { url: MISTRAL_URL,    key: process.env.MISTRAL_API_KEY,    model: 'mistral-large-latest' },
      { url: OPENROUTER_URL, key: process.env.OPENROUTER_API_KEY, model: 'meta-llama/llama-3.3-70b-instruct:free' },
      { url: GROQ_URL,       key: process.env.GROQ_API_KEY,       model: 'llama-3.3-70b-versatile' },
    ],
    fallback: [
      { url: OPENROUTER_URL, key: process.env.OPENROUTER_API_KEY, model: 'meta-llama/llama-3.3-70b-instruct:free' },
      { url: GROQ_URL,       key: process.env.GROQ_API_KEY,       model: 'llama-3.3-70b-versatile' },
    ],
  };

  const providers = (chains[role] || chains.worker).filter(p => Boolean(p.key));

  if (providers.length === 0) {
    throw new Error(`No API keys configured for role "${role}". Check your environment variables.`);
  }

  let lastError;

  for (const provider of providers) {
    try {
      logger.debug(`[multi-model] Trying ${provider.url} (${provider.model}) for role=${role}`);

      const response = await fetch(provider.url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${provider.key}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: provider.model,
          messages,
          temperature,
          max_tokens: maxTokens,
        }),
      });

      if (!response.ok) {
        const text = await response.text();
        // 429 = rate limit — try next provider
        if (response.status === 429) {
          logger.warn(`[multi-model] Rate limit hit on ${provider.model} — trying next provider`);
          lastError = new Error(`Rate limit: ${text}`);
          continue;
        }
        throw new Error(`${provider.model} error ${response.status}: ${text}`);
      }

      const data = await response.json();
      const content = data?.choices?.[0]?.message?.content;

      if (!content) throw new Error(`Empty response from ${provider.model}`);

      logger.debug(`[multi-model] Success with ${provider.model}`);
      return content;

    } catch (err) {
      lastError = err;
      // Only continue to next provider on rate-limit or network errors
      if (err.message?.includes('Rate limit') || err.message?.includes('fetch')) {
        logger.warn(`[multi-model] Provider ${provider.model} failed, trying next: ${err.message}`);
        continue;
      }
      // Re-throw hard errors
      throw err;
    }
  }

  throw lastError || new Error('All providers exhausted');
}
