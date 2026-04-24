import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import {
  ArrowUp,
  Ellipsis,
  Loader2,
  MessageSquarePlus,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Search,
  Share2,
  Square,
  Trash2,
  X,
  Bot,
  Paperclip,
  MessageSquare,
  MoreHorizontal,
  Pencil,
  Copy,
  Check
} from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../api/client';

const API_URL = import.meta.env.VITE_API_URL || 'https://api.teamaai.xyz';
const DEFAULT_CONVERSATION_TITLE = 'New chat';
const DESKTOP_SIDEBAR_STORAGE_KEY = 'teamaai-agent-sidebar-expanded';
const CONVERSATION_CACHE_PREFIX = 'teamaai-agent-conversations-v1-';
const CONVERSATION_CACHE_TTL_MS = 2 * 60 * 1000;

function getConversationCacheKey(userId) {
  return `${CONVERSATION_CACHE_PREFIX}${userId}`;
}

function loadConversationCache(userId) {
  try {
    const raw = sessionStorage.getItem(getConversationCacheKey(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;

    const cachedAt = Number(parsed.cachedAt || 0);
    if (!cachedAt || (Date.now() - cachedAt) > CONVERSATION_CACHE_TTL_MS) {
      sessionStorage.removeItem(getConversationCacheKey(userId));
      return null;
    }

    return Array.isArray(parsed.items) ? parsed.items : null;
  } catch {
    return null;
  }
}

function saveConversationCache(userId, items) {
  try {
    sessionStorage.setItem(
      getConversationCacheKey(userId),
      JSON.stringify({
        cachedAt: Date.now(),
        items: Array.isArray(items) ? items.slice(0, 100) : []
      })
    );
  } catch {
    // Ignore storage errors.
  }
}

function getMessageText(message) {
  if (Array.isArray(message?.parts)) {
    const text = message.parts
      .filter((part) => part?.type === 'text' && typeof part.text === 'string')
      .map((part) => part.text)
      .join('\n\n')
      .trim();
    if (text) return text;
  }
  return typeof message?.content === 'string' ? message.content.trim() : '';
}

function getRenderableParts(message) {
  if (!Array.isArray(message?.parts)) return [];
  return message.parts.filter((part) => part?.type && part.type !== 'text');
}

function resizeTextarea(element) {
  if (!element) return;
  element.style.height = '0px';
  element.style.height = `${Math.min(element.scrollHeight, 220)}px`;
}

function formatConversationTime(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const diffMinutes = Math.floor((Date.now() - date.getTime()) / 60000);
  if (diffMinutes < 1) return 'now';
  if (diffMinutes < 60) return `${diffMinutes}m`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d`;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function getGreeting(value = new Date()) {
  const hour = new Date(value).getHours();
  if (hour < 12) return 'morning';
  if (hour < 18) return 'afternoon';
  return 'evening';
}

function getDisplayName(profile, user) {
  const rawName = profile?.full_name || profile?.name
    || user?.user_metadata?.full_name || user?.user_metadata?.name
    || user?.email?.split('@')?.[0] || 'there';
  return String(rawName).replace(/\s+/g, ' ').trim();
}

function getFirstName(value) {
  const normalized = String(value || '').trim();
  if (!normalized) return 'there';
  return normalized.split(/\s+/)[0];
}

function matchesConversationSearch(conversation, query) {
  if (!query.trim()) return true;
  const haystack = [conversation?.title, conversation?.last_message_preview, conversation?.conversation_kind]
    .filter(Boolean).join(' ').toLowerCase();
  return haystack.includes(query.trim().toLowerCase());
}

function getConversationBucket(value) {
  if (!value) return 'Earlier';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Earlier';
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterdayStart = new Date(todayStart);
  yesterdayStart.setDate(todayStart.getDate() - 1);
  if (date >= todayStart) return 'Today';
  if (date >= yesterdayStart) return 'Yesterday';
  return 'Earlier';
}

function groupConversations(conversations) {
  const buckets = new Map([['Today', []], ['Yesterday', []], ['Earlier', []]]);
  conversations.forEach((conversation) => {
    const bucket = getConversationBucket(conversation.last_message_at || conversation.updated_at);
    buckets.get(bucket)?.push(conversation);
  });
  return Array.from(buckets.entries())
    .map(([label, items]) => ({ label, items }))
    .filter((section) => section.items.length > 0);
}

/* ── Inline Markdown-like renderer ─────────────────────────────── */
function renderTextContent(text) {
  if (!text) return null;

  const lines = text.split('\n');
  const elements = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Skip blank lines but add spacing
    if (!line.trim()) {
      elements.push(<div key={`gap-${i}`} className="h-2" />);
      i++;
      continue;
    }

    // Heading ###
    if (line.startsWith('### ')) {
      elements.push(
        <h3 key={i} className="text-white font-semibold text-sm mt-4 mb-1.5">
          {line.slice(4)}
        </h3>
      );
      i++;
      continue;
    }

    // Heading ##
    if (line.startsWith('## ')) {
      elements.push(
        <h2 key={i} className="text-white font-semibold text-base mt-5 mb-2">
          {line.slice(3)}
        </h2>
      );
      i++;
      continue;
    }

    // Heading #
    if (line.startsWith('# ')) {
      elements.push(
        <h1 key={i} className="text-white font-bold text-lg mt-5 mb-2">
          {line.slice(2)}
        </h1>
      );
      i++;
      continue;
    }

    // Code block
    if (line.startsWith('```')) {
      const lang = line.slice(3).trim();
      const codeLines = [];
      i++;
      while (i < lines.length && !lines[i].startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      i++; // consume closing ```
      elements.push(
        <div key={`code-${i}`} className="my-3 rounded-xl overflow-hidden border border-white/10">
          {lang && (
            <div className="flex items-center justify-between px-4 py-2 bg-white/5 border-b border-white/10">
              <span className="text-[11px] font-mono text-gray-500 uppercase tracking-widest">{lang}</span>
            </div>
          )}
          <pre className="p-4 overflow-x-auto text-[13px] font-mono leading-6 text-gray-300 bg-[#0d0d0d]">
            <code>{codeLines.join('\n')}</code>
          </pre>
        </div>
      );
      continue;
    }

    // Bulleted list
    if (line.match(/^[-*]\s/)) {
      const items = [];
      while (i < lines.length && lines[i].match(/^[-*]\s/)) {
        items.push(lines[i].slice(2));
        i++;
      }
      elements.push(
        <ul key={`ul-${i}`} className="my-2 space-y-1.5 pl-1">
          {items.map((item, idx) => (
            <li key={idx} className="flex items-start gap-2.5 text-[15px] leading-6 text-gray-200">
              <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-gray-500" />
              <span>{renderInline(item)}</span>
            </li>
          ))}
        </ul>
      );
      continue;
    }

    // Numbered list
    if (line.match(/^\d+\.\s/)) {
      const items = [];
      while (i < lines.length && lines[i].match(/^\d+\.\s/)) {
        const match = lines[i].match(/^(\d+)\.\s(.+)/);
        items.push({ num: match[1], text: match[2] });
        i++;
      }
      elements.push(
        <ol key={`ol-${i}`} className="my-2 space-y-1.5 pl-1">
          {items.map((item, idx) => (
            <li key={idx} className="flex items-start gap-3 text-[15px] leading-6 text-gray-200">
              <span className="shrink-0 text-gray-500 font-mono text-[13px] mt-[1px]">{item.num}.</span>
              <span>{renderInline(item.text)}</span>
            </li>
          ))}
        </ol>
      );
      continue;
    }

    // Blockquote
    if (line.startsWith('> ')) {
      elements.push(
        <blockquote key={i} className="my-2 border-l-2 border-white/20 pl-4 text-gray-400 italic text-[15px] leading-6">
          {line.slice(2)}
        </blockquote>
      );
      i++;
      continue;
    }

    // Normal paragraph
    elements.push(
      <p key={i} className="text-[15px] leading-7 text-gray-200 mb-0.5">
        {renderInline(line)}
      </p>
    );
    i++;
  }

  return elements;
}

function renderInline(text) {
  // Handle **bold**, *italic*, `code`
  const parts = [];
  const regex = /(\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`)/g;
  let last = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > last) parts.push(text.slice(last, match.index));
    if (match[2]) parts.push(<strong key={match.index} className="text-white font-semibold">{match[2]}</strong>);
    else if (match[3]) parts.push(<em key={match.index} className="text-gray-300 italic">{match[3]}</em>);
    else if (match[4]) parts.push(<code key={match.index} className="px-1.5 py-0.5 rounded-md bg-white/10 text-gray-200 font-mono text-[13px]">{match[4]}</code>);
    last = match.index + match[0].length;
  }

  if (last < text.length) parts.push(text.slice(last));
  return parts.length > 0 ? parts : text;
}

/* ── Notification Banner ────────────────────────────────────────── */
function NotificationBanner({ tone, message, onDismiss }) {
  if (!message) return null;
  const toneClass = tone === 'error'
    ? 'border-rose-500/20 bg-rose-500/10 text-rose-400'
    : 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400';
  return (
    <div className={`mx-auto mb-4 flex w-full max-w-3xl items-center justify-between gap-4 rounded-xl border px-4 py-3 text-xs font-medium animate-in fade-in slide-in-from-top-2 duration-300 ${toneClass}`}>
      <div className="flex items-center gap-2">
        <div className={`w-1.5 h-1.5 rounded-full ${tone === 'error' ? 'bg-rose-500' : 'bg-emerald-500'}`} />
        {message}
      </div>
      <button type="button" onClick={onDismiss} className="rounded-lg p-1 text-current/50 hover:text-current transition">
        <X size={14} />
      </button>
    </div>
  );
}

/* ── Sidebar Conversation Item ──────────────────────────────────── */
function ConversationListItem({ conversation, isActive, menuOpen, onSelect, onToggleMenu, onRename, onShare, onDelete }) {
  const displayTime = formatConversationTime(conversation.last_message_at || conversation.updated_at);

  return (
    <button
      type="button"
      onClick={() => onSelect(conversation.id)}
      className={`group relative w-full rounded-xl px-3 py-2.5 text-left transition-all duration-150 ${
        isActive ? 'bg-white/10 text-white' : 'text-gray-400 hover:bg-white/5 hover:text-gray-200'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="truncate text-[13px] font-medium leading-5 flex-1 min-w-0">
          {conversation.title || DEFAULT_CONVERSATION_TITLE}
        </p>
        <div className="flex shrink-0 items-center gap-1.5 mt-0.5">
          <span className="text-[11px] text-gray-500">{displayTime}</span>
          <div className="relative">
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onToggleMenu(conversation.id); }}
              className={`rounded-md p-1 transition-all ${
                menuOpen ? 'bg-white/10 text-white opacity-100' : 'text-gray-500 hover:text-white opacity-0 group-hover:opacity-100'
              }`}
            >
              <MoreHorizontal size={13} />
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-8 z-[60] w-44 rounded-xl border border-white/10 bg-[#111] p-1.5 shadow-2xl">
                <button type="button" onClick={(e) => { e.stopPropagation(); onRename(conversation); }}
                  className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-[12px] text-gray-400 hover:bg-white/5 hover:text-white transition-colors">
                  <Pencil size={12} /> Rename
                </button>
                <button type="button" onClick={(e) => { e.stopPropagation(); onShare(conversation.id); }}
                  className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-[12px] text-gray-400 hover:bg-white/5 hover:text-white transition-colors">
                  <Share2 size={12} /> Share
                </button>
                <div className="my-1 h-px bg-white/5 mx-2" />
                <button type="button" onClick={(e) => { e.stopPropagation(); onDelete(conversation.id); }}
                  className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-[12px] text-rose-400/70 hover:bg-rose-500/10 hover:text-rose-400 transition-colors">
                  <Trash2 size={12} /> Delete
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

    </button>
  );
}

/* ── Sidebar Panel ──────────────────────────────────────────────── */
function AgentSidebarPanel({
  conversationsReady, conversationsLoading, conversationSections, searchQuery, onSearchChange,
  activeConversationId, menuConversationId, creatingConversation, onCloseMobile,
  onCreateConversation, onSelectConversation, onToggleMenu, onRenameConversation,
  onShareConversation, onDeleteConversation, onLoadConversations
}) {
  return (
    <div className="flex h-full flex-col bg-[#0a0a0a]">
      {/* Header */}
      <div className="px-4 pt-5 pb-3">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 rounded-lg bg-white flex items-center justify-center">
              <Bot size={13} className="text-black" />
            </div>
            <span className="text-[13px] font-semibold text-white">Teama AI</span>
          </div>
          {onCloseMobile && (
            <button type="button" onClick={onCloseMobile} className="p-1.5 text-gray-500 hover:text-white rounded-lg transition lg:hidden">
              <X size={16} />
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={onCreateConversation}
          disabled={creatingConversation}
          className="flex w-full items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-[13px] font-medium text-gray-300 hover:bg-white/10 hover:text-white transition-all active:scale-[0.98] disabled:opacity-50"
        >
          {creatingConversation ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
          New conversation
        </button>

        <div className="relative mt-3">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600" />
          <input
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={conversationsReady ? 'Search conversations...' : 'Load recent chats first'}
            disabled={!conversationsReady}
            className="w-full rounded-xl bg-white/[0.03] border border-white/5 py-2.5 pl-9 pr-8 text-[13px] text-white outline-none placeholder:text-gray-600 focus:bg-white/[0.06] focus:border-white/10 transition-all"
          />
          {searchQuery && (
            <button type="button" onClick={() => onSearchChange('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-gray-500 hover:text-white">
              <X size={11} />
            </button>
          )}
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto px-2 pb-4 custom-scrollbar">
        {!conversationsReady ? (
          <div className="px-3 py-8">
            <p className="text-center text-[11px] font-medium text-gray-500">
              Recent chats are paused to save API usage.
            </p>
            <button
              type="button"
              onClick={onLoadConversations}
              disabled={conversationsLoading}
              className="mt-4 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-[12px] font-semibold text-gray-200 transition hover:bg-white/10 disabled:opacity-50"
            >
              {conversationsLoading ? 'Loading...' : 'Load recent chats'}
            </button>
          </div>
        ) : conversationsLoading ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <Loader2 className="h-4 w-4 animate-spin text-gray-600" />
            <span className="text-[12px] text-gray-600">Loading...</span>
          </div>
        ) : conversationSections.length === 0 ? (
          <div className="px-3 py-8 text-center">
            <p className="text-[12px] text-gray-600">{searchQuery ? 'No matches found' : 'No conversations yet'}</p>
          </div>
        ) : (
          <div className="space-y-5">
            {conversationSections.map((section) => (
              <div key={section.label}>
                <p className="px-3 pb-1.5 text-[11px] font-medium text-gray-600 uppercase tracking-wider">
                  {section.label}
                </p>
                <div>
                  {section.items.map((conversation) => (
                    <ConversationListItem
                      key={conversation.id}
                      conversation={conversation}
                      isActive={conversation.id === activeConversationId}
                      menuOpen={menuConversationId === conversation.id}
                      onSelect={onSelectConversation}
                      onToggleMenu={onToggleMenu}
                      onRename={onRenameConversation}
                      onShare={onShareConversation}
                      onDelete={onDeleteConversation}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Tool Card ──────────────────────────────────────────────────── */
function QuickActionCard({ part, onSelect, disabled }) {
  const actions = Array.isArray(part?.actions) ? part.actions : [];

  if (!actions.length) return null;

  return (
    <div className="mt-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
      <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.2em] text-gray-500">
        Suggested Actions
      </p>
      <div className="flex flex-wrap gap-2.5">
        {actions.map((action, index) => (
          <button
            key={`${action.label}-${index}`}
            type="button"
            onClick={() => onSelect?.(action.prompt)}
            disabled={disabled}
            className="rounded-xl border border-white/5 bg-white/[0.03] px-4 py-2.5 text-left text-[13px] font-medium text-gray-300 transition-all hover:bg-white/[0.08] hover:text-white hover:border-white/10 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50"
            title={action.description || action.prompt}
          >
            {action.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function BlockerContextBanner({ blocker }) {
  if (!blocker) return null;
  const sourceType = blocker.sourceType || 'unknown';
  const priority = blocker.priority || 'medium';
  
  return (
    <div className="mx-auto mt-4 w-full max-w-3xl px-4 animate-in fade-in slide-in-from-top-4 duration-700">
      <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-6">
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-gray-400">
             <div className="w-1 h-1 rounded-full bg-red-500 animate-pulse"></div>
             Blocker Detected
          </div>
          <div className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-gray-400">
            {sourceType}
          </div>
          <div className={`rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest ${
            priority === 'high' ? 'text-red-400' : priority === 'medium' ? 'text-yellow-400' : 'text-blue-400'
          }`}>
            {priority} priority
          </div>
        </div>
        <h3 className="text-xl font-bold text-white uppercase tracking-tight">{blocker.title}</h3>
        {blocker.description && (
          <p className="mt-2 text-sm text-gray-500 line-clamp-2">{blocker.description}</p>
        )}
      </div>
    </div>
  );
}

function MeetingContextBanner({ meeting }) {
  if (!meeting) return null;
  const startTime = meeting.start ? new Date(meeting.start).toLocaleString([], { 
    weekday: 'short', 
    month: 'short', 
    day: 'numeric', 
    hour: '2-digit', 
    minute: '2-digit' 
  }) : 'Time unknown';

  return (
    <div className="mx-auto mt-4 w-full max-w-3xl px-4 animate-in fade-in slide-in-from-top-4 duration-700">
      <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-6">
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-gray-400">
             <div className="w-1 h-1 rounded-full bg-blue-500"></div>
             Meeting Prep
          </div>
          <div className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-gray-400">
            {startTime}
          </div>
        </div>
        <h3 className="text-xl font-bold text-white uppercase tracking-tight">{meeting.title}</h3>
        {meeting.description && (
          <p className="mt-2 text-sm text-gray-500 line-clamp-1">{meeting.description}</p>
        )}
      </div>
    </div>
  );
}

function extractApprovalRequest(part) {
  const output = part?.output;
  if (!output || output.kind !== 'approval_request' || !output.approvalId) {
    return null;
  }
  return output;
}

function ApprovalRequestCard({ request, busy, onApprove, onReject }) {
  const isPending = request?.status === 'pending';
  const actionTone = request?.status === 'approved'
    ? 'border-emerald-500/20 bg-emerald-500/10'
    : request?.status === 'rejected'
      ? 'border-rose-500/20 bg-rose-500/10'
      : 'border-amber-500/20 bg-amber-500/10';

  return (
    <div className={`mt-4 rounded-2xl border p-4 ${actionTone}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-widest text-gray-500">
            Approval Required
          </p>
          <h4 className="mt-1 text-sm font-semibold text-white">
            {request?.title || 'Proposed action'}
          </h4>
          {request?.summary && (
            <p className="mt-2 text-sm leading-6 text-gray-300">
              {request.summary}
            </p>
          )}
          {request?.description && (
            <p className="mt-2 text-[13px] leading-5 text-gray-400">
              {request.description}
            </p>
          )}
          {request?.executionResult?.summary && (
            <p className="mt-3 text-[13px] leading-5 text-emerald-300">
              {request.executionResult.summary}
            </p>
          )}
          {request?.executionResult?.link && (
            <a
              href={request.executionResult.link}
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-flex text-[12px] text-emerald-300 hover:text-emerald-200"
            >
              Open result
            </a>
          )}
        </div>

        <div className="rounded-full border border-white/10 px-3 py-1 text-[10px] font-medium uppercase tracking-widest text-gray-300">
          {request?.status || 'pending'}
        </div>
      </div>

      {isPending && (
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => onApprove?.(request.approvalId)}
            disabled={busy}
            className="rounded-xl bg-white px-4 py-2 text-[12px] font-medium text-black transition hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? 'Working...' : 'Approve'}
          </button>
          <button
            type="button"
            onClick={() => onReject?.(request.approvalId)}
            disabled={busy}
            className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-[12px] font-medium text-gray-200 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Reject
          </button>
        </div>
      )}
    </div>
  );
}

/* ── Message Bubble ─────────────────────────────────────────────── */
function MessageBubble({ message, onQuickAction, quickActionDisabled }) {
  const isUser = message.role === 'user';
  const textContent = getMessageText(message);
  const renderableParts = getRenderableParts(message);
  const quickActionParts = renderableParts.filter((part) => part?.type === 'quick-actions');
  const approvalParts = renderableParts
    .filter((part) => typeof part?.type === 'string' && part.type.startsWith('tool-'))
    .map((part) => ({ part, request: extractApprovalRequest(part) }))
    .filter((entry) => Boolean(entry.request));
  const hasSupplementaryContent = quickActionParts.length > 0
    || approvalParts.length > 0;
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard?.writeText(textContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (isUser) {
    return (
      <div className="flex w-full justify-end gap-3 group animate-in fade-in slide-in-from-bottom-1 duration-300">
        <div className="max-w-[75%] md:max-w-[65%]">
          <div className="rounded-2xl rounded-tr-sm bg-white/10 border border-white/10 px-4 py-3">
            <p className="text-[15px] leading-7 text-gray-100 whitespace-pre-wrap">
              {textContent || <span className="italic text-gray-500">Empty message</span>}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex w-full justify-start gap-3 group animate-in fade-in slide-in-from-bottom-1 duration-300">
      {/* Avatar */}
      <div className="shrink-0 mt-0.5 w-7 h-7 rounded-full bg-white flex items-center justify-center">
        <Bot size={14} className="text-black" />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 max-w-[85%] md:max-w-[80%]">
        <div className="prose-like text-gray-200">
          {renderTextContent(textContent) || (
            hasSupplementaryContent
              ? null
              : <p className="text-[15px] leading-7 text-gray-500 italic">Thinking...</p>
          )}
        </div>

        {quickActionParts.length > 0 && (
          <div>
            {quickActionParts.map((part, index) => (
              <QuickActionCard
                key={`${message.id}-quick-${index}`}
                part={part}
                onSelect={onQuickAction?.call}
                disabled={quickActionDisabled}
              />
            ))}
          </div>
        )}

        {approvalParts.length > 0 && (
          <div>
            {approvalParts.map(({ request }, index) => (
              <ApprovalRequestCard
                key={`${message.id}-approval-${index}`}
                request={request}
                busy={quickActionDisabled}
                onApprove={onQuickAction?.approve}
                onReject={onQuickAction?.reject}
              />
            ))}
          </div>
        )}

        {/* Copy action */}
        {textContent && (
          <div className="mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              type="button"
              onClick={handleCopy}
              className="flex items-center gap-1.5 text-[12px] text-gray-600 hover:text-gray-400 transition-colors"
            >
              {copied ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Typing Indicator ───────────────────────────────────────────── */
function TypingIndicator() {
  return (
    <div className="flex w-full justify-start gap-3">
      <div className="shrink-0 mt-0.5 w-7 h-7 rounded-full bg-white flex items-center justify-center">
        <Bot size={14} className="text-black" />
      </div>
      <div className="flex items-center gap-1 px-4 py-3 rounded-2xl rounded-tl-sm bg-white/[0.04] border border-white/8">
        {[0, 1, 2].map(i => (
          <span
            key={i}
            className="w-1.5 h-1.5 rounded-full bg-gray-500 animate-bounce"
            style={{ animationDelay: `${i * 150}ms` }}
          />
        ))}
      </div>
    </div>
  );
}

/* ── Composer ───────────────────────────────────────────────────── */
function ChatComposer({ input, isStreaming, canChat, onInputChange, onSubmit, onStop, textareaRef }) {
  return (
    <div className="relative w-full">
      <div className={`relative rounded-2xl border bg-[#111] transition-all duration-200 ${
        canChat ? 'border-white/10 focus-within:border-white/20' : 'border-white/5 opacity-60'
      }`}>
        <textarea
          ref={textareaRef}
          value={input}
          onChange={onInputChange}
          rows={1}
          disabled={!canChat || isStreaming}
          placeholder={canChat ? 'Message Teama AI...' : 'Sign in to start chatting...'}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              if (input.trim()) onSubmit(e);
            }
          }}
          className="w-full resize-none bg-transparent px-5 pt-4 pb-14 text-[15px] leading-relaxed text-white outline-none placeholder:text-gray-600 min-h-[56px] max-h-[220px] custom-scrollbar"
        />

        <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button type="button" className="p-2 text-gray-600 hover:text-gray-400 rounded-lg transition-colors disabled:opacity-30" disabled={!canChat}>
              <Paperclip size={16} />
            </button>
          </div>

          <div className="flex items-center gap-2">
            {isStreaming && (
              <span className="text-[12px] text-gray-600">Generating...</span>
            )}
            {isStreaming ? (
              <button
                type="button"
                onClick={onStop}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/10 border border-white/10 text-[13px] font-medium text-white hover:bg-white/15 transition-all"
              >
                <Square size={12} fill="currentColor" /> Stop
              </button>
            ) : (
              <button
                type="button"
                onClick={onSubmit}
                disabled={!input.trim() || !canChat}
                className="w-8 h-8 rounded-xl bg-white flex items-center justify-center text-black hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed transition-all active:scale-95"
              >
                <ArrowUp size={16} strokeWidth={2.5} />
              </button>
            )}
          </div>
        </div>
      </div>
      <p className="mt-2 text-center text-[11px] text-gray-700">
        Teama AI can make mistakes. Verify important information.
      </p>
    </div>
  );
}

/* ── Empty State / Welcome ──────────────────────────────────────── */
function WelcomeScreen({ firstName, input, isStreaming, canChat, onInputChange, onSubmit, onStop, textareaRef, onSeedClick }) {
  const seeds = ['Summarize today', 'Check blockers', 'Prepare for meetings', 'What\'s pending?'];
  const greeting = getGreeting();

  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 py-12">
      <div className="w-full max-w-2xl">
        {/* Greeting */}
        <div className="text-center mb-10">
          <div className="w-12 h-12 rounded-2xl bg-white flex items-center justify-center mx-auto mb-5">
            <Bot size={22} className="text-black" />
          </div>
          <h1 className="text-3xl font-semibold text-white tracking-tight mb-2">
            Good {greeting}, {firstName}
          </h1>
          <p className="text-gray-500 text-[15px]">How can I help you today?</p>
        </div>

        {/* Composer */}
        <ChatComposer
          input={input}
          isStreaming={isStreaming}
          canChat={canChat}
          onInputChange={onInputChange}
          onSubmit={onSubmit}
          onStop={onStop}
          textareaRef={textareaRef}
        />

        {/* Seed prompts */}
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          {seeds.map(seed => (
            <button
              key={seed}
              onClick={() => onSeedClick(seed)}
              className="px-4 py-2 rounded-xl bg-white/5 border border-white/8 text-[13px] text-gray-400 hover:bg-white/10 hover:text-gray-200 hover:border-white/15 transition-all"
            >
              {seed}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── Chat Pane ──────────────────────────────────────────────────── */
function ChatPane({
  conversation, initialMessages, userId, displayName,
  notice, errorMessage, onDismissNotice, onDismissError,
  onCreateConversation, onToggleSidebar, sidebarExpanded, isDesktop, onRefresh, onResolveApproval, onActionError
}) {
  const [input, setInput] = useState('');
  const textareaRef = useRef(null);
  const endRef = useRef(null);
  const scrollRef = useRef(null);
  const prevStatusRef = useRef('ready');
  const canChat = Boolean(userId);
  const firstName = getFirstName(displayName);
  const conversationId = conversation?.id || '';

  const { messages, sendMessage, status, stop, error } = useChat({
    id: conversation.id,
    messages: initialMessages,
    transport: new DefaultChatTransport({
      api: `${API_URL}/api/agent/chat`,
      body: () => ({ userId, conversationId: conversation.id })
    })
  });

  const isStreaming = status === 'submitted' || status === 'streaming';
  const visibleMessages = messages.filter((message) => {
    if (message?.role === 'user') return true;

    const text = getMessageText(message);
    if (text) return true;

    const parts = getRenderableParts(message);
    const hasQuickActions = parts.some((part) => part?.type === 'quick-actions');
    const hasApprovals = parts.some((part) => (
      typeof part?.type === 'string'
      && part.type.startsWith('tool-')
      && Boolean(extractApprovalRequest(part))
    ));

    return hasQuickActions || hasApprovals;
  });
  const showEmpty = visibleMessages.length === 0;

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, status]);

  useEffect(() => {
    if (prevStatusRef.current !== 'ready' && status === 'ready') onRefresh();
    prevStatusRef.current = status;
  }, [status, onRefresh]);

  useEffect(() => { resizeTextarea(textareaRef.current); }, [input]);

  const submitText = useCallback(async (text) => {
    const nextText = String(text || '').trim();
    if (!nextText || isStreaming || !canChat) return;

    setInput('');
    resizeTextarea(textareaRef.current);
    await sendMessage({ text: nextText }, { body: { conversationId: conversation.id, userId } });
  }, [canChat, isStreaming, sendMessage, conversation.id, userId]);

  const handleSubmit = (e) => {
    e?.preventDefault?.();
    submitText(input);
  };

  const handleApprovalDecision = useCallback(async (approvalId, decision) => {
    if (!approvalId || !conversationId || conversationId === 'new') return;

    try {
      if (decision === 'approve') {
        await api.approveAgentAction(conversationId, approvalId);
        onDismissError?.();
        onDismissNotice?.();
      } else {
        await api.rejectAgentAction(conversationId, approvalId);
      }

      await onResolveApproval?.(
        decision === 'approve' ? 'Action approved.' : 'Action rejected.',
        { keepSelection: true, conversationId }
      );
    } catch (err) {
      onDismissNotice?.();
      onDismissError?.();
      console.error(`Failed to ${decision} agent action:`, err);
      onActionError?.(err.message || `Failed to ${decision} action.`);
    }
  }, [conversationId, onActionError, onDismissError, onDismissNotice, onResolveApproval]);

  const quickActionHandlers = {
    approve: (approvalId) => handleApprovalDecision(approvalId, 'approve'),
    reject: (approvalId) => handleApprovalDecision(approvalId, 'reject'),
    call: submitText
  };

  const messageNodes = [];
  for (const message of visibleMessages) {
    messageNodes.push(
      <MessageBubble
        key={message.id}
        message={message}
        onQuickAction={quickActionHandlers}
        quickActionDisabled={!canChat || isStreaming}
      />
    );
  }

  return (
    <section className="flex h-full flex-col bg-black">
      {/* Header */}
      <header className="shrink-0 border-b border-white/5 bg-black/80 backdrop-blur-xl px-4 py-3 z-20">
        <div className="mx-auto flex w-full max-w-4xl items-center gap-3">
          <button
            type="button"
            onClick={onToggleSidebar}
            className="p-2 rounded-xl text-gray-500 hover:text-white hover:bg-white/5 transition-all"
          >
            {isDesktop && sidebarExpanded ? <PanelLeftClose size={18} /> : <PanelLeftOpen size={18} />}
          </button>

          <div className="flex-1 min-w-0 flex items-center gap-3">
            <MessageSquare size={15} className="text-gray-600 shrink-0" />
            <h1 className="truncate text-[14px] font-medium text-gray-200">
              {conversation.title || DEFAULT_CONVERSATION_TITLE}
            </h1>
          </div>

          <button
            type="button"
            onClick={onCreateConversation}
            className="p-2 rounded-xl text-gray-500 hover:text-white hover:bg-white/5 transition-all"
            title="New conversation"
          >
            <MessageSquarePlus size={17} />
          </button>

          <button className="p-2 text-gray-500 hover:text-white hover:bg-white/5 rounded-xl transition-all" title="Share">
            <Share2 size={17} />
          </button>
        </div>
      </header>

      {/* Notifications */}
      {(notice || errorMessage || error) && (
        <div className="px-4 pt-3">
          <NotificationBanner tone="success" message={notice} onDismiss={onDismissNotice} />
          <NotificationBanner tone="error" message={errorMessage || error?.message} onDismiss={errorMessage ? onDismissError : () => {}} />
        </div>
      )}

      {/* Body */}
      {showEmpty ? (
        <WelcomeScreen
          firstName={firstName}
          input={input}
          isStreaming={isStreaming}
          canChat={canChat}
          onInputChange={(e) => setInput(e.target.value)}
          onSubmit={handleSubmit}
          onStop={() => stop()}
          textareaRef={textareaRef}
          onSeedClick={setInput}
        />
      ) : (
        <>
          <div ref={scrollRef} className="flex-1 overflow-y-auto custom-scrollbar">
            {conversation.metadata?.actionType === 'blocker_action' && (
              <BlockerContextBanner blocker={conversation.metadata.blockerData} />
            )}
            {conversation.metadata?.actionType === 'meeting_prep' && (
              <MeetingContextBanner meeting={conversation.metadata.meetingData} />
            )}
            <div className="mx-auto w-full max-w-3xl px-4 py-8 space-y-6">
              {messageNodes}
              {isStreaming && <TypingIndicator />}
              <div ref={endRef} className="h-2" />
            </div>
          </div>

          {/* Composer bar */}
          <div className="shrink-0 border-t border-white/5 bg-black/80 backdrop-blur-xl px-4 py-4">
            <div className="mx-auto w-full max-w-3xl">
              <ChatComposer
                input={input}
                isStreaming={isStreaming}
                canChat={canChat}
                onInputChange={(e) => setInput(e.target.value)}
                onSubmit={handleSubmit}
                onStop={() => stop()}
                textareaRef={textareaRef}
              />
            </div>
          </div>
        </>
      )}
    </section>
  );
}

/* ── Root ───────────────────────────────────────────────────────── */
export default function AgentChat() {
  const { user, profile, loading: userLoading } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [conversations, setConversations] = useState([]);
  const [conversationsLoading, setConversationsLoading] = useState(false);
  const [conversationsReady, setConversationsReady] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailNonce, setDetailNonce] = useState(0);
  const [activeConversationId, setActiveConversationId] = useState('new');
  const [loadedConversationId, setLoadedConversationId] = useState('new');
  const [activeMessages, setActiveMessages] = useState([]);
  const [notice, setNotice] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [menuConversationId, setMenuConversationId] = useState('');
  const [creatingConversation, setCreatingConversation] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isDesktop, setIsDesktop] = useState(() =>
    typeof window === 'undefined' ? true : window.matchMedia('(min-width: 1024px)').matches
  );
  const [desktopSidebarExpanded, setDesktopSidebarExpanded] = useState(() => {
    if (typeof window === 'undefined') return true;
    const v = window.localStorage.getItem(DESKTOP_SIDEBAR_STORAGE_KEY);
    return v === null ? true : v === 'true';
  });
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const initializedEmptyRef = useRef(false);
  const lastConversationsRefreshRef = useRef(0);

  const activeConversation = useMemo(() => {
    if (activeConversationId === 'new') return { id: 'new', title: DEFAULT_CONVERSATION_TITLE };
    return conversations.find(c => c.id === activeConversationId) || null;
  }, [conversations, activeConversationId]);

  const requestedConversationId = searchParams.get('conversation') || '';
  const filteredConversations = useMemo(
    () => conversations.filter(c => matchesConversationSearch(c, searchQuery)),
    [conversations, searchQuery]
  );
  const conversationSections = useMemo(() => groupConversations(filteredConversations), [filteredConversations]);
  const displayName = useMemo(() => getDisplayName(profile, user), [profile, user]);
  const activeConversationIdRef = useRef(activeConversationId);
  activeConversationIdRef.current = activeConversationId;

  const refreshConversations = useCallback(async ({ keepSelection = true } = {}) => {
    if (!user?.id) return false;
    setConversationsLoading(true);
    setErrorMessage('');
    try {
      console.log('[AgentChat] refreshConversations: start', { keepSelection, activeId: activeConversationIdRef.current });
      const data = await api.listAgentConversations();
      const nextConversations = data.conversations || [];
      console.log('[AgentChat] refreshConversations: fetched', { count: nextConversations.length });
      
      setConversations(nextConversations);
      
      const currentActiveId = activeConversationIdRef.current;
      const exists = nextConversations.some(c => c.id === currentActiveId);
      
      // If we are on 'new' and a conversation was just created (it will be the first in nextConversations),
      // or if our current selection is gone, we should jump to the most recent one.
      const shouldSwitchToFirst = (!keepSelection) || 
                                 (!exists && currentActiveId !== 'new') ||
                                 (currentActiveId === 'new' && nextConversations.length > 0);

      if (shouldSwitchToFirst) {
        console.log('[AgentChat] refreshConversations: jumping to first conversation', { 
          reason: !exists ? 'id_not_found' : 'transition_from_new',
          targetId: nextConversations[0]?.id 
        });
        setActiveConversationId(nextConversations[0]?.id || 'new');
      }
      setConversationsReady(true);
      return true;
    } catch (err) {
      console.error('[AgentChat] refreshConversations: error', err);
      setErrorMessage(err.message || 'Failed to load conversations.');
      return false;
    } finally {
      setConversationsLoading(false);
    }
  }, [user?.id]);

  const refreshConversationDetail = useCallback(async ({ keepSelection = true, conversationId = null } = {}) => {
    if (conversationId && conversationId !== activeConversationIdRef.current) {
      setActiveConversationId(conversationId);
    }

    await refreshConversations({ keepSelection });
    setDetailNonce((value) => value + 1);
  }, [refreshConversations]);

  const triggerConversationLoad = useCallback(async ({ keepSelection = true, force = false } = {}) => {
    if (!user?.id) return;
    if (conversationsLoading) return;
    if (!force && conversationsReady) return;
    await refreshConversations({ keepSelection });
  }, [conversationsLoading, conversationsReady, refreshConversations, user?.id]);

  useEffect(() => {
    if (!user?.id) {
      setConversations([]);
      setConversationsReady(false);
      return;
    }

    const cached = loadConversationCache(user.id);
    if (cached && cached.length > 0) {
      setConversations(cached);
      setConversationsReady(true);
      return;
    }

    setConversations([]);
    setConversationsReady(false);
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id || !conversationsReady) return;
    saveConversationCache(user.id, conversations);
  }, [conversations, conversationsReady, user?.id]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(min-width: 1024px)');
    const handle = (e) => { setIsDesktop(e.matches); if (e.matches) setMobileSidebarOpen(false); };
    handle(mq);
    mq.addEventListener?.('change', handle);
    return () => mq.removeEventListener?.('change', handle);
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(DESKTOP_SIDEBAR_STORAGE_KEY, desktopSidebarExpanded ? 'true' : 'false');
    }
  }, [desktopSidebarExpanded]);

  useEffect(() => {
    if (!notice && !errorMessage) return;
    const t = window.setTimeout(() => { setNotice(''); setErrorMessage(''); }, 4500);
    return () => window.clearTimeout(t);
  }, [notice, errorMessage]);

  useEffect(() => {
    if (!requestedConversationId || requestedConversationId === 'new' || !user?.id) return;
    if (conversationsReady || conversationsLoading) return;
    void triggerConversationLoad({ keepSelection: false, force: true });
  }, [
    conversationsLoading,
    conversationsReady,
    requestedConversationId,
    triggerConversationLoad,
    user?.id
  ]);

  const handleCreateConversation = useCallback(async () => {
    if (!user?.id || creatingConversation) return;

    setCreatingConversation(true);
    setErrorMessage('');
    try {
      const data = await api.createAgentConversation();
      const newConvo = data.conversation;
      
      // Update local list manually to avoid a full fetch delay
      setConversations(prev => [newConvo, ...prev]);
      setConversationsReady(true);
      setActiveConversationId(newConvo.id);
      setActiveMessages([]);
      setLoadedConversationId(newConvo.id);
      setSearchQuery('');
      setMenuConversationId('');
      
      if (!isDesktop) setMobileSidebarOpen(false);
    } catch (err) {
      setErrorMessage(err.message || 'Failed to create new conversation.');
    } finally {
      setCreatingConversation(false);
    }
  }, [user?.id, creatingConversation, isDesktop]);

  useEffect(() => {
    if (!requestedConversationId || conversations.length === 0) return;
    const c = conversations.find(c => c.id === requestedConversationId);
    if (c && c.id !== activeConversationId) setActiveConversationId(c.id);
  }, [activeConversationId, conversations, requestedConversationId]);

  const prevSyncedIdRef = useRef(activeConversationId);
  useEffect(() => {
    if (activeConversationId === prevSyncedIdRef.current) return;
    prevSyncedIdRef.current = activeConversationId;
    const cur = searchParams.get('conversation') || '';
    if (!activeConversationId || activeConversationId === 'new') {
      if (cur) { const p = new URLSearchParams(searchParams); p.delete('conversation'); setSearchParams(p, { replace: true }); }
      return;
    }
    if (cur !== activeConversationId) {
      const p = new URLSearchParams(searchParams);
      p.set('conversation', activeConversationId);
      setSearchParams(p, { replace: true });
    }
  }, [activeConversationId, searchParams, setSearchParams]);

  useEffect(() => {
    let cancelled = false;
    async function loadDetail() {
      if (!activeConversationId || activeConversationId === 'new' || !user?.id) {
        if (!cancelled) { setActiveMessages([]); setLoadedConversationId(activeConversationId === 'new' ? 'new' : ''); }
        return;
      }
      setDetailLoading(true);
      setMenuConversationId('');
      try {
        const data = await api.getAgentConversation(activeConversationId);
        if (!cancelled) { setActiveMessages(data.messages || []); setLoadedConversationId(activeConversationId); }
      } catch (err) {
        if (!cancelled) setErrorMessage(err.message || 'Failed to load conversation.');
      } finally {
        if (!cancelled) setDetailLoading(false);
      }
    }
    loadDetail();
    return () => { cancelled = true; };
  }, [activeConversationId, user?.id, detailNonce]);

  const handleSelectConversation = useCallback(async (id) => {
    if (!conversationsReady && !conversationsLoading) {
      await triggerConversationLoad({ keepSelection: true, force: true });
    }
    setActiveConversationId(id);
    setMenuConversationId('');
    if (!isDesktop) setMobileSidebarOpen(false);
  }, [conversationsLoading, conversationsReady, isDesktop, triggerConversationLoad]);

  const renameConversation = async (conversation) => {
    const title = window.prompt('Rename conversation', conversation.title || DEFAULT_CONVERSATION_TITLE);
    if (!title?.trim()) return;
    try {
      const data = await api.renameAgentConversation(conversation.id, title.trim());
      const updated = data.conversation;
      setConversations(c => c.map(item => item.id === updated.id ? updated : item));
      setNotice('Conversation renamed.');
    } catch (err) {
      setErrorMessage(err.message || 'Failed to rename.');
    } finally { setMenuConversationId(''); }
  };

  const shareConversation = async (id) => {
    try {
      const data = await api.shareAgentConversation(id);
      const updated = data.conversation;
      setConversations(c => c.map(item => item.id === updated.id ? updated : item));
      if (updated.shareUrl && navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(updated.shareUrl);
        setNotice('Link copied to clipboard.');
      } else if (updated.shareUrl) {
        setNotice(`Share link: ${updated.shareUrl}`);
      }
    } catch (err) {
      setErrorMessage(err.message || 'Failed to share.');
    } finally { setMenuConversationId(''); }
  };

  const deleteConversation = async (id) => {
    if (!window.confirm('Delete this conversation?')) { setMenuConversationId(''); return; }
    try {
      await api.deleteAgentConversation(id);
      const next = conversations.filter(c => c.id !== id);
      setConversations(next);
      setNotice('Conversation deleted.');
      if (activeConversationId === id) {
        setActiveConversationId(next[0]?.id || 'new');
        setActiveMessages([]);
        setLoadedConversationId(next[0]?.id || 'new');
      }
      if (next.length === 0) initializedEmptyRef.current = false;
    } catch (err) {
      setErrorMessage(err.message || 'Failed to delete.');
    } finally { setMenuConversationId(''); }
  };

  const handleToggleSidebar = useCallback(() => {
    const shouldOpen = isDesktop ? !desktopSidebarExpanded : !mobileSidebarOpen;
    if (shouldOpen && !conversationsReady && !conversationsLoading) {
      void triggerConversationLoad({ keepSelection: false, force: true });
    }

    if (isDesktop) { setDesktopSidebarExpanded(v => !v); return; }
    setMobileSidebarOpen(v => !v);
  }, [
    conversationsLoading,
    conversationsReady,
    desktopSidebarExpanded,
    isDesktop,
    mobileSidebarOpen,
    triggerConversationLoad
  ]);

  const handleChatRefresh = useCallback(async () => {
    if (activeConversationId === 'new') {
      await refreshConversations({ keepSelection: false });
      return;
    }
    if (!conversationsReady) return;
    const now = Date.now();
    if ((now - lastConversationsRefreshRef.current) < 90000) return;
    lastConversationsRefreshRef.current = now;
    await refreshConversations({ keepSelection: true });
  }, [activeConversationId, conversationsReady, refreshConversations]);

  if (userLoading) {
    return (
      <div className="flex min-h-[calc(100vh-56px)] items-center justify-center bg-black">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 rounded-full border-2 border-white/10 border-t-white animate-spin" />
          <p className="text-[12px] text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative bg-black text-white" style={{ height: 'calc(100vh - 56px)' }}>
      <div className="flex h-full">
        {/* Desktop sidebar */}
        {isDesktop && desktopSidebarExpanded && (
          <aside className="hidden lg:flex lg:flex-col w-[260px] shrink-0 border-r border-white/5 animate-in slide-in-from-left duration-300">
            <AgentSidebarPanel
              conversationsReady={conversationsReady}
              conversationsLoading={conversationsLoading}
              conversationSections={conversationSections}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              activeConversationId={activeConversationId}
              menuConversationId={menuConversationId}
              creatingConversation={creatingConversation}
              onCloseMobile={null}
              onCreateConversation={handleCreateConversation}
              onSelectConversation={handleSelectConversation}
              onToggleMenu={(id) => setMenuConversationId(c => c === id ? '' : id)}
              onRenameConversation={renameConversation}
              onShareConversation={shareConversation}
              onDeleteConversation={deleteConversation}
              onLoadConversations={() => triggerConversationLoad({ keepSelection: false, force: true })}
            />
          </aside>
        )}

        {/* Mobile sidebar overlay */}
        {mobileSidebarOpen && (
          <div className="fixed inset-0 z-[100] lg:hidden">
            <button
              type="button"
              onClick={() => setMobileSidebarOpen(false)}
              className="absolute inset-0 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200"
            />
            <aside className="absolute left-0 top-0 h-full w-[260px] max-w-[85vw] border-r border-white/10 bg-[#0a0a0a] shadow-2xl animate-in slide-in-from-left duration-300">
              <AgentSidebarPanel
                conversationsReady={conversationsReady}
                conversationsLoading={conversationsLoading}
                conversationSections={conversationSections}
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                activeConversationId={activeConversationId}
                menuConversationId={menuConversationId}
                creatingConversation={creatingConversation}
                onCloseMobile={() => setMobileSidebarOpen(false)}
                onCreateConversation={handleCreateConversation}
                onSelectConversation={handleSelectConversation}
                onToggleMenu={(id) => setMenuConversationId(c => c === id ? '' : id)}
                onRenameConversation={renameConversation}
                onShareConversation={shareConversation}
                onDeleteConversation={deleteConversation}
                onLoadConversations={() => triggerConversationLoad({ keepSelection: false, force: true })}
              />
            </aside>
          </div>
        )}

        {/* Main chat area */}
        <div className="min-w-0 flex-1 overflow-hidden">
          {detailLoading || !activeConversation || loadedConversationId !== activeConversationId ? (
            <div className="flex h-full items-center justify-center">
              <div className="w-6 h-6 rounded-full border-2 border-white/10 border-t-white animate-spin" />
            </div>
          ) : (
            <ChatPane
              key={`${activeConversation.id}:${detailNonce}`}
              conversation={activeConversation}
              initialMessages={activeMessages}
              userId={user?.id}
              displayName={displayName}
              notice={notice}
              errorMessage={errorMessage}
              onDismissNotice={() => setNotice('')}
              onDismissError={() => setErrorMessage('')}
              onCreateConversation={handleCreateConversation}
              onToggleSidebar={handleToggleSidebar}
              sidebarExpanded={desktopSidebarExpanded}
              isDesktop={isDesktop}
              onRefresh={handleChatRefresh}
              onResolveApproval={async (nextNotice, options = {}) => {
                setNotice(nextNotice || '');
                await refreshConversationDetail(options);
              }}
              onActionError={(message) => setErrorMessage(message)}
            />
          )}
        </div>
      </div>
    </div>
  );
}
