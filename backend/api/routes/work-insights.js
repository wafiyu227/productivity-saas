import express from 'express';
import asanaService from '../services/asana-service.js';
import jiraService from '../services/jira-service.js';
import slackService from '../services/slack-service.js';
import trelloService from '../services/trello-service.js';
import { db } from '../services/supabase-client.js';
import logger from '../utils/logger.js';
import { requireTeamMember } from '../utils/team-permissions.js';

const router = express.Router();

const DEFAULT_LIMIT = 12;
const MAX_LIMIT = 25;
const RAW_MESSAGE_LOOKBACK_HOURS = 72;
const MAX_CHANNELS_TO_SCAN = 25;
const CHANNEL_FETCH_BATCH_SIZE = 5;
const MAX_MESSAGES_PER_CHANNEL = 120;
const ISSUE_KEY_REGEX = /\b[A-Z][A-Z0-9]+-\d+\b/g;
const ASANA_TASK_URL_REGEX = /https?:\/\/app\.asana\.com\/0\/(?:\d+\/)?(\d+)/ig;
const ASANA_TASK_ID_REGEX = /\basana(?:\s+task)?[\s#:]+(\d{6,})\b/ig;
const TRELLO_CARD_URL_REGEX = /https?:\/\/trello\.com\/c\/([A-Za-z0-9]+)/ig;
const TRELLO_CARD_ID_REGEX = /\btrello(?:\s+card)?[\s#:]+([A-Za-z0-9]{6,})\b/ig;
const SIGNAL_RULES = [
    {
        id: 'blocked',
        label: 'Blocked',
        bucket: 'blocked',
        regex: /\b(blocked|stuck|waiting on|waiting for|dependency|dependencies|cannot proceed|can't proceed|need approval|awaiting|hold up)\b/i
    },
    {
        id: 'fix_completed',
        label: 'Fix completed',
        bucket: 'progress',
        regex: /\b(fixed|fix completed|bug fixed|patched|resolved the bug|resolved bug)\b/i
    },
    {
        id: 'pr_created',
        label: 'PR raised',
        bucket: 'review',
        regex: /\b(pr raised|raised pr|opened pr|created pr|pull request (?:raised|opened|created|up)|submitted pr)\b/i
    },
    {
        id: 'deployed_staging',
        label: 'Deployed to staging',
        bucket: 'qa',
        regex: /\b(deployed(?: to)? staging|staging deploy(?:ed)?|deployed\b.*\bstaging\b|\bstaging\b.*\bdeployed\b|ready for qa|qa ready|ready for testing|ready to test)\b/i
    },
    {
        id: 'done',
        label: 'Done',
        bucket: 'done',
        regex: /\b(done|completed|closed|released to production|live in production|deployed to production|shipped to production)\b/i
    },
    {
        id: 'progress',
        label: 'In Progress',
        bucket: 'progress',
        regex: /\b(started|working on|picked up|investigating|in progress|implementing|fixing)\b/i
    }
];

function isUnauthorizedError(error) {
    return error?.status === 401 || error?.status === 403 || /unauthorized|forbidden|expired/i.test(String(error?.message || ''));
}

async function persistJiraIntegration(userId, integration, teamId, tokens = {}) {
    const scope = integration?.scope || (teamId ? 'team' : 'personal');
    const effectiveTeamId = teamId || integration?.team_id || null;

    const payload = {
        accessToken: tokens.accessToken || integration?.access_token,
        refreshToken: tokens.refreshToken !== undefined ? tokens.refreshToken : integration?.refresh_token,
        expiresAt: tokens.expiresAt !== undefined ? tokens.expiresAt : integration?.expires_at,
        workspaceId: tokens.workspaceId !== undefined ? tokens.workspaceId : integration?.workspace_id,
        workspaceName: tokens.workspaceName !== undefined ? tokens.workspaceName : integration?.workspace_name
    };

    if (scope === 'team') {
        payload.teamId = effectiveTeamId;
    }

    await db.saveIntegration(userId, 'jira', payload, scope);
}

async function persistAsanaIntegration(userId, integration, teamId, tokens = {}) {
    const scope = integration?.scope || (teamId ? 'team' : 'personal');
    const effectiveTeamId = teamId || integration?.team_id || null;

    const payload = {
        accessToken: tokens.accessToken || integration?.access_token,
        refreshToken: tokens.refreshToken !== undefined ? tokens.refreshToken : integration?.refresh_token,
        expiresAt: tokens.expiresAt !== undefined ? tokens.expiresAt : integration?.expires_at,
        workspaceId: tokens.workspaceId !== undefined ? tokens.workspaceId : integration?.workspace_id,
        workspaceName: tokens.workspaceName !== undefined ? tokens.workspaceName : integration?.workspace_name
    };

    if (scope === 'team') {
        payload.teamId = effectiveTeamId;
    }

    await db.saveIntegration(userId, 'asana', payload, scope);
}

async function resolveJiraContext(userId, teamId) {
    const integration = await db.getIntegration(userId, 'jira', teamId);
    if (!integration) {
        const error = new Error('Jira not connected');
        error.status = 401;
        throw error;
    }

    let accessToken = integration.access_token;
    let refreshToken = integration.refresh_token;
    let workspace;

    const resolveWorkspace = async () => jiraService.resolveWorkspace(accessToken, integration.workspace_id);

    try {
        workspace = await resolveWorkspace();
    } catch (error) {
        if (isUnauthorizedError(error) && refreshToken) {
            const refreshed = await jiraService.refreshAccessToken(refreshToken);
            accessToken = refreshed.accessToken;
            refreshToken = refreshed.refreshToken;

            await persistJiraIntegration(userId, integration, teamId, {
                accessToken,
                refreshToken,
                expiresAt: Number.isFinite(refreshed.expiresIn)
                    ? new Date(Date.now() + refreshed.expiresIn * 1000).toISOString()
                    : integration.expires_at
            });

            workspace = await resolveWorkspace();
        } else {
            throw error;
        }
    }

    const workspaceChanged = workspace?.cloudId
        && (workspace.cloudId !== integration.workspace_id || workspace.name !== integration.workspace_name);

    if (workspaceChanged) {
        await persistJiraIntegration(userId, integration, teamId, {
            accessToken,
            refreshToken,
            workspaceId: workspace.cloudId,
            workspaceName: workspace.name
        });
    }

    return {
        platform: 'jira',
        label: 'Jira',
        integration,
        accessToken,
        cloudId: workspace?.cloudId || integration.workspace_id,
        baseUrl: workspace?.url || null
    };
}

async function resolveAsanaContext(userId, teamId) {
    const integration = await db.getIntegration(userId, 'asana', teamId);
    if (!integration) {
        const error = new Error('Asana not connected');
        error.status = 401;
        throw error;
    }

    let accessToken = integration.access_token;
    let refreshToken = integration.refresh_token;
    let workspaces;

    try {
        workspaces = await asanaService.getWorkspaces(accessToken);
    } catch (error) {
        if (isUnauthorizedError(error) && refreshToken) {
            const refreshed = await asanaService.refreshAccessToken(refreshToken);
            accessToken = refreshed.accessToken;
            refreshToken = refreshed.refreshToken;

            await persistAsanaIntegration(userId, integration, teamId, {
                accessToken,
                refreshToken,
                expiresAt: Number.isFinite(refreshed.expiresIn)
                    ? new Date(Date.now() + refreshed.expiresIn * 1000).toISOString()
                    : integration.expires_at
            });

            workspaces = await asanaService.getWorkspaces(accessToken);
        } else {
            throw error;
        }
    }

    const selectedWorkspace = (Array.isArray(workspaces) ? workspaces : []).find((workspace) => (
        String(workspace?.gid || '') === String(integration.workspace_id || '')
    )) || workspaces?.[0];

    if (!selectedWorkspace?.gid) {
        const error = new Error('Asana workspace not available');
        error.status = 404;
        throw error;
    }

    if (
        String(selectedWorkspace.gid) !== String(integration.workspace_id || '')
        || selectedWorkspace.name !== integration.workspace_name
    ) {
        await persistAsanaIntegration(userId, integration, teamId, {
            accessToken,
            refreshToken,
            workspaceId: selectedWorkspace.gid,
            workspaceName: selectedWorkspace.name
        });
    }

    return {
        platform: 'asana',
        label: 'Asana',
        integration,
        accessToken,
        workspaceId: String(selectedWorkspace.gid),
        workspaceName: selectedWorkspace.name || 'Asana'
    };
}

async function resolveTrelloContext(userId, teamId) {
    const integration = await db.getIntegration(userId, 'trello', teamId);
    if (!integration) {
        const error = new Error('Trello not connected');
        error.status = 401;
        throw error;
    }

    return {
        platform: 'trello',
        label: 'Trello',
        integration,
        accessToken: integration.access_token,
        memberId: integration.workspace_id || null
    };
}

function normalizeStatusName(value) {
    return String(value || '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();
}

function normalizeSearchText(value) {
    return String(value || '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function getStatusBucket(statusName) {
    const normalized = normalizeStatusName(statusName);

    if (!normalized) return 'todo';
    if (/(block|hold|paused|waiting)/.test(normalized)) return 'blocked';
    if (/(done|closed|resolved|complete|completed|shipped)/.test(normalized)) return 'done';
    if (/(qa|test|testing|staging|verification)/.test(normalized)) return 'qa';
    if (/(review|approve|approval)/.test(normalized)) return 'review';
    if (/(progress|doing|development|working)/.test(normalized)) return 'progress';
    return 'todo';
}

function getBucketRank(bucket) {
    const order = {
        todo: 0,
        progress: 1,
        review: 2,
        qa: 3,
        done: 4
    };

    return order[bucket] ?? 0;
}

function extractIssueKeys(value) {
    const matches = String(value || '').toUpperCase().match(ISSUE_KEY_REGEX);
    return Array.from(new Set(matches || []));
}

function collectRegexMatches(pattern, value, normalizer = (match) => match) {
    const matches = [];
    const text = String(value || '');
    const regex = new RegExp(pattern.source, pattern.flags);
    let current;

    while ((current = regex.exec(text)) !== null) {
        const candidate = normalizer(current[1] || current[0]);
        if (candidate) {
            matches.push(candidate);
        }
    }

    return Array.from(new Set(matches));
}

function extractAsanaTaskIds(value) {
    return Array.from(new Set([
        ...collectRegexMatches(ASANA_TASK_URL_REGEX, value, (match) => String(match || '').trim()),
        ...collectRegexMatches(ASANA_TASK_ID_REGEX, value, (match) => String(match || '').trim())
    ]));
}

function extractTrelloCardIds(value) {
    return Array.from(new Set([
        ...collectRegexMatches(TRELLO_CARD_URL_REGEX, value, (match) => String(match || '').trim()),
        ...collectRegexMatches(TRELLO_CARD_ID_REGEX, value, (match) => String(match || '').trim())
    ]));
}

function uniqueNonEmpty(values, limit = 4) {
    const seen = new Set();
    const result = [];

    values.forEach((value) => {
        const normalized = String(value || '').trim();
        if (!normalized) return;
        const key = normalized.toLowerCase();
        if (seen.has(key)) return;
        seen.add(key);
        if (result.length < limit) {
            result.push(normalized);
        }
    });

    return result;
}

function slackTimestampToIso(value) {
    const seconds = Number.parseFloat(String(value || ''));
    if (!Number.isFinite(seconds)) return null;
    return new Date(seconds * 1000).toISOString();
}

function buildMessageId(channelId, timestamp) {
    return `${channelId || 'unknown'}:${timestamp || 'unknown'}`;
}

async function ingestRecentSlackMessages(accessToken) {
    const channels = await slackService.listChannels(accessToken);
    const channelsToScan = (Array.isArray(channels) ? channels : []).slice(0, MAX_CHANNELS_TO_SCAN);
    const collected = [];

    for (let index = 0; index < channelsToScan.length; index += CHANNEL_FETCH_BATCH_SIZE) {
        const batch = channelsToScan.slice(index, index + CHANNEL_FETCH_BATCH_SIZE);
        const batchMessages = await Promise.all(
            batch.map(async (channel) => {
                try {
                    const messages = await slackService.getChannelMessages(
                        channel.id,
                        {
                            limit: MAX_MESSAGES_PER_CHANNEL,
                            oldest: Math.floor((Date.now() - RAW_MESSAGE_LOOKBACK_HOURS * 60 * 60 * 1000) / 1000).toString()
                        },
                        accessToken
                    );

                    return (Array.isArray(messages) ? messages : []).map((message) => ({
                        id: buildMessageId(channel.id, message.timestamp),
                        channelId: channel.id,
                        channelName: channel.name || 'unknown',
                        source: `#${channel.name || 'unknown'}`,
                        text: String(message.text || '').trim(),
                        timestamp: message.timestamp,
                        createdAt: slackTimestampToIso(message.timestamp),
                        issueKeys: extractIssueKeys(message.text),
                        asanaTaskIds: extractAsanaTaskIds(message.text),
                        trelloCardRefs: extractTrelloCardIds(message.text)
                    }));
                } catch (error) {
                    logger.warn('Failed to read Slack channel during work insight scan', {
                        channelId: channel.id,
                        channelName: channel.name,
                        error: error.message
                    });
                    return [];
                }
            })
        );

        batchMessages.flat().forEach((message) => {
            if (message.text) {
                collected.push(message);
            }
        });
    }

    return {
        channelsScanned: channelsToScan.length,
        messages: collected.sort((first, second) => new Date(first.createdAt || 0) - new Date(second.createdAt || 0))
    };
}

function buildUniqueNameEntries(items) {
    const counts = new Map();
    const itemsByName = new Map();

    (Array.isArray(items) ? items : []).forEach((item) => {
        const normalizedName = normalizeSearchText(item?.name);
        if (!normalizedName) return;
        if (normalizedName.length < 10 && normalizedName.split(' ').length < 2) return;

        counts.set(normalizedName, (counts.get(normalizedName) || 0) + 1);
        if (!itemsByName.has(normalizedName)) {
            itemsByName.set(normalizedName, item);
        }
    });

    return Array.from(itemsByName.entries())
        .filter(([normalizedName]) => counts.get(normalizedName) === 1)
        .map(([normalizedName, item]) => ({ normalizedName, item }))
        .sort((first, second) => second.normalizedName.length - first.normalizedName.length);
}

function matchItemsByName(text, nameEntries, limit = 3) {
    const haystack = ` ${normalizeSearchText(text)} `;
    const matches = [];
    const seen = new Set();

    (Array.isArray(nameEntries) ? nameEntries : []).forEach((entry) => {
        if (matches.length >= limit) return;
        if (!haystack.includes(` ${entry.normalizedName} `)) return;

        const itemId = String(entry?.item?.gid || entry?.item?.id || '');
        if (!itemId || seen.has(itemId)) return;

        seen.add(itemId);
        matches.push(entry.item);
    });

    return matches;
}

async function mapSlackTicketsToJiraIssues(ticketKeys, jiraContext) {
    const issuesByKey = new Map();
    const missingIssueKeys = [];

    await Promise.all(
        Array.from(ticketKeys).map(async (ticketKey) => {
            try {
                const issue = await jiraService.getIssueByKey(
                    jiraContext.accessToken,
                    jiraContext.cloudId,
                    ticketKey,
                    jiraContext.baseUrl
                );

                if (issue?.key) {
                    issuesByKey.set(String(issue.key).toUpperCase(), issue);
                }
            } catch (error) {
                if (error?.status === 404) {
                    missingIssueKeys.push(ticketKey);
                    return;
                }
                throw error;
            }
        })
    );

    return {
        issuesByKey,
        missingIssueKeys: uniqueNonEmpty(missingIssueKeys, 50)
    };
}

function detectSignals(evidenceItems) {
    const byId = new Map();

    evidenceItems.forEach((item) => {
        const text = String(item?.text || '').trim();
        if (!text) return;

        SIGNAL_RULES.forEach((rule) => {
            if (!rule.regex.test(text)) return;
            if (byId.has(rule.id)) return;

            byId.set(rule.id, {
                id: rule.id,
                label: rule.label,
                bucket: rule.bucket
            });
        });
    });

    return Array.from(byId.values());
}

function deriveSuggestedStatus(signals) {
    const buckets = new Set((Array.isArray(signals) ? signals : []).map((signal) => signal.bucket));

    if (buckets.has('blocked')) return 'Blocked';
    if (buckets.has('done')) return 'Done';
    if (buckets.has('qa')) return 'Ready for QA';
    if (buckets.has('review')) return 'In Review';
    if (buckets.has('progress')) return 'In Progress';
    return null;
}

function getSuggestedStatusCandidates(desiredStatus) {
    const desired = String(desiredStatus || '').trim();
    const bucket = getStatusBucket(desired);

    const candidatesByBucket = {
        blocked: [desired, 'Blocked', 'On Hold'],
        done: [desired, 'Done', 'Closed', 'Resolved'],
        qa: [desired, 'Ready for QA', 'QA', 'Testing', 'Ready for Testing', 'In Review', 'Review'],
        review: [desired, 'In Review', 'Review', 'Code Review', 'Ready for QA', 'QA'],
        progress: [desired, 'In Progress', 'Doing', 'Development', 'Active'],
        todo: [desired, 'To Do', 'Todo', 'Backlog', 'Open']
    };

    return uniqueNonEmpty(candidatesByBucket[bucket] || [desired], 12);
}

function shouldSuggestStatus(currentStatus, desiredStatus) {
    if (!desiredStatus) return false;

    const currentBucket = getStatusBucket(currentStatus);
    const desiredBucket = getStatusBucket(desiredStatus);

    if (desiredBucket === 'blocked') {
        return currentBucket !== 'blocked' && currentBucket !== 'done';
    }

    if (desiredBucket === 'done') {
        return currentBucket !== 'done';
    }

    if (currentBucket === 'done') {
        return false;
    }

    return getBucketRank(currentBucket) < getBucketRank(desiredBucket);
}

function calculateConfidence(group) {
    const signalCount = group.signals.length;
    const evidenceCount = group.evidence.length;
    const messageCount = group.messageIds.size;
    const channelCount = group.channelNames.size;

    const confidence = 0.44
        + signalCount * 0.12
        + Math.min(evidenceCount, 4) * 0.05
        + Math.min(messageCount, 4) * 0.05
        + Math.min(channelCount, 2) * 0.03;

    return Math.min(0.95, Number(confidence.toFixed(2)));
}

function trimText(value, maxLength = 180) {
    const text = String(value || '').trim();
    if (text.length <= maxLength) return text;
    return `${text.slice(0, maxLength).trimEnd()}...`;
}

function buildSuggestedComment(group, suggestedStatus) {
    const evidenceLines = group.evidence.slice(0, 3).map((item) => `- ${item.source}: ${trimText(item.text, 140)}`);
    const signalLabels = group.signals.map((signal) => signal.label);
    const targetLabel = group.ticketKey ? `${group.platformLabel} item ${group.ticketKey}` : `${group.platformLabel} work item`;

    return [
        `Teama detected Slack activity suggesting ${targetLabel} may be ready for ${suggestedStatus}.`,
        signalLabels.length > 0 ? `Signals: ${signalLabels.join(', ')}.` : null,
        evidenceLines.length > 0 ? 'Slack evidence:' : null,
        ...evidenceLines,
        `Suggested by Teama on ${new Date().toLocaleDateString('en-US')}.`
    ].filter(Boolean).join('\n');
}

function buildSkippedReason(group, suggestedStatus) {
    if (!suggestedStatus) {
        return 'Teama detected the work item, but there were not enough actionable signals to recommend a next status.';
    }

    const currentStatus = group.currentStatus || 'Unknown';
    return `${group.ticketKey} was detected from Slack, but ${group.platformLabel} is already at "${currentStatus}", so no approval is needed for "${suggestedStatus}".`;
}

function buildInsightOutcome(group) {
    const suggestedStatus = deriveSuggestedStatus(group.signals);
    if (!shouldSuggestStatus(group.currentStatus, suggestedStatus)) {
        return {
            insight: null,
            skipped: {
                platform: group.platform,
                platformLabel: group.platformLabel,
                itemId: group.itemId,
                ticketKey: group.ticketKey,
                ticketName: group.ticketName,
                currentStatus: group.currentStatus || 'Unknown',
                suggestedStatus: suggestedStatus || null,
                reason: buildSkippedReason(group, suggestedStatus)
            }
        };
    }

    return {
        insight: {
            id: `${group.platform}:${group.itemId}:${group.latestMessageId}`,
            platform: group.platform,
            platformLabel: group.platformLabel,
            itemId: group.itemId,
            ticketKey: group.ticketKey,
            ticketName: group.ticketName,
            projectName: group.projectName,
            currentStatus: group.currentStatus || 'Unknown',
            suggestedStatus,
            confidence: calculateConfidence(group),
            signals: group.signals.map((signal) => signal.label),
            evidence: group.evidence.slice(0, 3).map((item) => ({
                type: item.type,
                text: trimText(item.text),
                source: item.source
            })),
            sourceChannelName: group.latestChannelName,
            sourceCreatedAt: group.latestSourceAt,
            messageCount: group.messageIds.size,
            externalUrl: group.externalUrl || null,
            suggestedComment: buildSuggestedComment(group, suggestedStatus)
        },
        skipped: null
    };
}

function createPrerequisiteResponse(overrides = {}) {
    return {
        insights: [],
        generatedAt: new Date().toISOString(),
        prerequisites: {
            slackConnected: false,
            jiraConnected: false,
            asanaConnected: false,
            trelloConnected: false,
            connectedPlatformCount: 0,
            ...overrides
        }
    };
}

function scoreNamedTarget(names, desiredStatus) {
    const desiredNormalized = normalizeStatusName(desiredStatus);
    const desiredBucket = getStatusBucket(desiredStatus);
    const normalizedCandidates = (Array.isArray(names) ? names : [])
        .map((name) => normalizeStatusName(name))
        .filter(Boolean);

    if (normalizedCandidates.includes(desiredNormalized)) {
        return 100;
    }

    if (normalizedCandidates.some((value) => value.includes(desiredNormalized) || desiredNormalized.includes(value))) {
        return 70;
    }

    if (normalizedCandidates.some((value) => getStatusBucket(value) === desiredBucket)) {
        return 60;
    }

    return 0;
}

function findBestTransition(transitions, desiredStatus) {
    for (const candidateStatus of getSuggestedStatusCandidates(desiredStatus)) {
        const scored = (Array.isArray(transitions) ? transitions : [])
            .map((transition) => ({
                transition,
                score: scoreNamedTarget([transition?.name, transition?.to?.name], candidateStatus)
            }))
            .filter((entry) => entry.score > 0)
            .sort((first, second) => second.score - first.score);

        if (scored[0]?.transition) {
            return scored[0].transition;
        }
    }

    return null;
}

function findBestNamedTarget(items, desiredStatus, getName = (item) => item?.name) {
    const scored = (Array.isArray(items) ? items : [])
        .map((item) => ({
            item,
            score: scoreNamedTarget([getName(item)], desiredStatus)
        }))
        .filter((entry) => entry.score > 0)
        .sort((first, second) => second.score - first.score);

    return scored[0]?.item || null;
}

function buildEvidenceItem(message) {
    return {
        type: 'message',
        text: message.text,
        source: message.source,
        createdAt: message.createdAt,
        messageId: message.id
    };
}

function mergeSignals(existingSignals, incomingSignals) {
    const signalMap = new Map();

    [...(Array.isArray(existingSignals) ? existingSignals : []), ...(Array.isArray(incomingSignals) ? incomingSignals : [])]
        .forEach((signal) => {
            if (!signal?.id) return;
            signalMap.set(signal.id, signal);
        });

    return Array.from(signalMap.values());
}

function addGroupEvidence(grouped, groupKey, payload, message, signals) {
    const current = grouped.get(groupKey) || {
        ...payload,
        signals: [],
        evidence: [],
        messageIds: new Set(),
        channelNames: new Set(),
        latestSourceAt: message.createdAt || new Date().toISOString(),
        latestMessageId: message.id,
        latestChannelName: message.channelName || 'unknown'
    };

    current.signals = mergeSignals(current.signals, signals);

    if (!current.messageIds.has(message.id)) {
        current.evidence.push(buildEvidenceItem(message));
    }

    current.messageIds.add(message.id);
    current.channelNames.add(message.channelName || 'unknown');

    if (new Date(message.createdAt || 0) >= new Date(current.latestSourceAt || 0)) {
        current.latestSourceAt = message.createdAt || current.latestSourceAt;
        current.latestMessageId = message.id;
        current.latestChannelName = message.channelName || current.latestChannelName;
    }

    grouped.set(groupKey, current);
}

function buildAsanaDisplayKey(task) {
    if (task?.gid) {
        return `Task ${task.gid}`;
    }
    return 'Asana task';
}

function buildTrelloDisplayKey(card) {
    if (card?.shortLink) {
        return `Card ${card.shortLink}`;
    }
    if (card?.gid) {
        return `Card ${String(card.gid).slice(0, 8)}`;
    }
    return 'Trello card';
}

function getAsanaCurrentStatus(task) {
    return task?.sectionName || task?.section?.name || (task?.completed ? 'Done' : 'Open');
}

function getTrelloCurrentStatus(card) {
    return card?.list?.name || card?.status_name || (card?.completed ? 'Done' : 'Open');
}

async function buildJiraInsights(rawMessages, jiraContext) {
    const referencedIssueKeys = new Set(
        rawMessages.flatMap((message) => message.issueKeys || [])
    );

    if (referencedIssueKeys.size === 0) {
        return {
            insights: [],
            referencedIssueKeys,
            missingIssueKeys: []
        };
    }

    const { issuesByKey, missingIssueKeys } = await mapSlackTicketsToJiraIssues(referencedIssueKeys, jiraContext);
    const grouped = new Map();

    rawMessages.forEach((message) => {
        const signals = detectSignals([buildEvidenceItem(message)]);
        if (signals.length === 0) return;

        (message.issueKeys || []).forEach((ticketKey) => {
            const issue = issuesByKey.get(ticketKey);
            if (!issue) return;

            addGroupEvidence(grouped, `${ticketKey}`, {
                platform: 'jira',
                platformLabel: 'Jira',
                itemId: String(issue?.key || ticketKey),
                ticketKey: String(issue?.key || ticketKey).toUpperCase(),
                ticketName: issue?.name || issue?.summary || ticketKey,
                projectName: issue?.project?.name || 'Jira',
                currentStatus: issue?.status_name || 'Unknown',
                externalUrl: issue?.externalUrl || null
            }, message, signals);
        });
    });

    const outcomes = Array.from(grouped.values()).map(buildInsightOutcome);

    return {
        insights: outcomes.map((entry) => entry.insight).filter(Boolean),
        skippedDetections: outcomes.map((entry) => entry.skipped).filter(Boolean),
        referencedIssueKeys,
        missingIssueKeys
    };
}

async function buildAsanaInsights(rawMessages, asanaContext) {
    const tasks = await asanaService.getAllTasksFromProjects(asanaContext.accessToken, asanaContext.workspaceId);
    const tasksById = new Map(
        (Array.isArray(tasks) ? tasks : []).map((task) => [String(task?.gid || task?.id || ''), task])
    );
    const nameEntries = buildUniqueNameEntries(tasks);
    const missingTaskIds = new Set();
    const referencedTaskIds = new Set();
    const grouped = new Map();

    rawMessages.forEach((message) => {
        const signals = detectSignals([buildEvidenceItem(message)]);
        if (signals.length === 0) return;

        const matches = new Map();

        (message.asanaTaskIds || []).forEach((taskId) => {
            referencedTaskIds.add(taskId);
            const task = tasksById.get(String(taskId));
            if (task) {
                matches.set(String(task.gid || task.id), task);
            } else {
                missingTaskIds.add(String(taskId));
            }
        });

        matchItemsByName(message.text, nameEntries).forEach((task) => {
            const taskId = String(task?.gid || task?.id || '');
            if (!taskId) return;
            referencedTaskIds.add(taskId);
            matches.set(taskId, task);
        });

        matches.forEach((task, taskId) => {
            addGroupEvidence(grouped, taskId, {
                platform: 'asana',
                platformLabel: 'Asana',
                itemId: taskId,
                ticketKey: buildAsanaDisplayKey(task),
                ticketName: task?.name || 'Asana task',
                projectName: task?.project?.name || asanaContext.workspaceName || 'Asana',
                currentStatus: getAsanaCurrentStatus(task),
                externalUrl: task?.externalUrl || null
            }, message, signals);
        });
    });

    const outcomes = Array.from(grouped.values()).map(buildInsightOutcome);

    return {
        insights: outcomes.map((entry) => entry.insight).filter(Boolean),
        skippedDetections: outcomes.map((entry) => entry.skipped).filter(Boolean),
        referencedTaskIds: uniqueNonEmpty(Array.from(referencedTaskIds), 100),
        missingTaskIds: uniqueNonEmpty(Array.from(missingTaskIds), 100)
    };
}

async function buildTrelloInsights(rawMessages, trelloContext) {
    const cards = await trelloService.getAllCardsFromBoards(trelloContext.accessToken, trelloContext.memberId);
    const cardsById = new Map();
    const cardsByShortLink = new Map();

    (Array.isArray(cards) ? cards : []).forEach((card) => {
        const cardId = String(card?.gid || card?.id || '');
        if (cardId) {
            cardsById.set(cardId, card);
        }
        if (card?.shortLink) {
            cardsByShortLink.set(String(card.shortLink).toLowerCase(), card);
        }
    });

    const nameEntries = buildUniqueNameEntries(cards);
    const missingCardRefs = new Set();
    const referencedCardRefs = new Set();
    const grouped = new Map();

    rawMessages.forEach((message) => {
        const signals = detectSignals([buildEvidenceItem(message)]);
        if (signals.length === 0) return;

        const matches = new Map();

        (message.trelloCardRefs || []).forEach((ref) => {
            const normalizedRef = String(ref || '').trim();
            if (!normalizedRef) return;

            referencedCardRefs.add(normalizedRef);

            const card = cardsById.get(normalizedRef) || cardsByShortLink.get(normalizedRef.toLowerCase());
            if (card) {
                matches.set(String(card?.gid || card?.id || normalizedRef), card);
            } else {
                missingCardRefs.add(normalizedRef);
            }
        });

        matchItemsByName(message.text, nameEntries).forEach((card) => {
            const cardId = String(card?.gid || card?.id || '');
            if (!cardId) return;
            referencedCardRefs.add(card?.shortLink || cardId);
            matches.set(cardId, card);
        });

        matches.forEach((card, cardId) => {
            addGroupEvidence(grouped, cardId, {
                platform: 'trello',
                platformLabel: 'Trello',
                itemId: cardId,
                ticketKey: buildTrelloDisplayKey(card),
                ticketName: card?.name || 'Trello card',
                projectName: card?.project?.name || 'Trello',
                currentStatus: getTrelloCurrentStatus(card),
                externalUrl: card?.externalUrl || null
            }, message, signals);
        });
    });

    const outcomes = Array.from(grouped.values()).map(buildInsightOutcome);

    return {
        insights: outcomes.map((entry) => entry.insight).filter(Boolean),
        skippedDetections: outcomes.map((entry) => entry.skipped).filter(Boolean),
        referencedCardRefs: uniqueNonEmpty(Array.from(referencedCardRefs), 100),
        missingCardRefs: uniqueNonEmpty(Array.from(missingCardRefs), 100)
    };
}

router.get('/', async (req, res) => {
    try {
        const { userId, teamId } = req.query;
        const requestedLimit = Number.parseInt(req.query.limit, 10);
        const limit = Number.isFinite(requestedLimit) && requestedLimit > 0
            ? Math.min(requestedLimit, MAX_LIMIT)
            : DEFAULT_LIMIT;

        if (!userId) {
            return res.status(400).json({ error: 'userId required' });
        }

        if (teamId) {
            await requireTeamMember(teamId, userId);
        }

        const slackIntegration = await db.getIntegration(userId, 'slack', teamId);
        if (!slackIntegration) {
            return res.json({
                ...createPrerequisiteResponse(),
                message: 'Connect Slack to generate approval-ready work insights.'
            });
        }

        const prerequisites = {
            slackConnected: true,
            jiraConnected: false,
            asanaConnected: false,
            trelloConnected: false,
            connectedPlatformCount: 0
        };

        let jiraContext = null;
        let asanaContext = null;
        let trelloContext = null;

        try {
            jiraContext = await resolveJiraContext(userId, teamId);
            prerequisites.jiraConnected = true;
        } catch (error) {
            if (!isUnauthorizedError(error)) {
                logger.warn('Skipping Jira work insights for this request', {
                    userId,
                    teamId,
                    error: error.message
                });
            }
        }

        try {
            asanaContext = await resolveAsanaContext(userId, teamId);
            prerequisites.asanaConnected = true;
        } catch (error) {
            if (!isUnauthorizedError(error)) {
                logger.warn('Skipping Asana work insights for this request', {
                    userId,
                    teamId,
                    error: error.message
                });
            }
        }

        try {
            trelloContext = await resolveTrelloContext(userId, teamId);
            prerequisites.trelloConnected = true;
        } catch (error) {
            if (!isUnauthorizedError(error)) {
                logger.warn('Skipping Trello work insights for this request', {
                    userId,
                    teamId,
                    error: error.message
                });
            }
        }

        prerequisites.connectedPlatformCount = [
            prerequisites.jiraConnected,
            prerequisites.asanaConnected,
            prerequisites.trelloConnected
        ].filter(Boolean).length;

        if (prerequisites.connectedPlatformCount === 0) {
            return res.json({
                ...createPrerequisiteResponse(prerequisites),
                message: 'Connect Jira, Asana, or Trello so Teama can map Slack activity to real work items.'
            });
        }

        const { messages: rawMessages, channelsScanned } = await ingestRecentSlackMessages(slackIntegration.access_token);

        if (rawMessages.length === 0) {
            return res.json({
                ...createPrerequisiteResponse(prerequisites),
                message: 'No recent Slack messages were found in the current scan window. Share work updates in Slack and refresh.'
            });
        }

        const [
            jiraResult,
            asanaResult,
            trelloResult
        ] = await Promise.all([
            prerequisites.jiraConnected ? buildJiraInsights(rawMessages, jiraContext) : Promise.resolve({
                insights: [],
                skippedDetections: [],
                referencedIssueKeys: new Set(),
                missingIssueKeys: []
            }),
            prerequisites.asanaConnected ? buildAsanaInsights(rawMessages, asanaContext) : Promise.resolve({
                insights: [],
                skippedDetections: [],
                referencedTaskIds: [],
                missingTaskIds: []
            }),
            prerequisites.trelloConnected ? buildTrelloInsights(rawMessages, trelloContext) : Promise.resolve({
                insights: [],
                skippedDetections: [],
                referencedCardRefs: [],
                missingCardRefs: []
            })
        ]);

        const insights = [
            ...jiraResult.insights,
            ...asanaResult.insights,
            ...trelloResult.insights
        ]
            .sort((first, second) => {
                if ((second.confidence || 0) !== (first.confidence || 0)) {
                    return (second.confidence || 0) - (first.confidence || 0);
                }
                return new Date(second.sourceCreatedAt || 0) - new Date(first.sourceCreatedAt || 0);
            })
            .slice(0, limit);

        let message = null;
        const skippedDetections = [
            ...(jiraResult.skippedDetections || []),
            ...(asanaResult.skippedDetections || []),
            ...(trelloResult.skippedDetections || [])
        ];
        const jiraReferencedCount = jiraResult.referencedIssueKeys?.size || 0;
        const asanaReferencedCount = asanaResult.referencedTaskIds?.length || 0;
        const trelloReferencedCount = trelloResult.referencedCardRefs?.length || 0;
        const totalReferencedCount = jiraReferencedCount + asanaReferencedCount + trelloReferencedCount;

        if (insights.length === 0) {
            if (jiraReferencedCount > 0 && jiraResult.missingIssueKeys.length === jiraReferencedCount) {
                message = `Slack referenced ${jiraResult.missingIssueKeys.join(', ')}, but those Jira issues were not found yet. Create the Jira issue first, then Teama can suggest updates for it.`;
            } else if (skippedDetections.length > 0) {
                message = skippedDetections[0].reason;
            } else if (asanaResult.missingTaskIds.length > 0 && asanaReferencedCount === asanaResult.missingTaskIds.length) {
                message = `Slack referenced Asana task IDs ${asanaResult.missingTaskIds.join(', ')}, but Teama could not find those tasks in the connected workspace.`;
            } else if (trelloResult.missingCardRefs.length > 0 && trelloReferencedCount === trelloResult.missingCardRefs.length) {
                message = `Slack referenced Trello cards ${trelloResult.missingCardRefs.join(', ')}, but Teama could not find those cards in the connected boards.`;
            } else if (totalReferencedCount > 0) {
                message = 'Teama found Slack references to connected work items, but not enough actionable signals to suggest an update yet.';
            } else {
                message = 'No actionable Jira, Asana, or Trello references were found in recent Slack messages. Share links, IDs, or exact work item names in Slack and refresh.';
            }
        }

        return res.json({
            insights,
            generatedAt: new Date().toISOString(),
            lookbackHours: RAW_MESSAGE_LOOKBACK_HOURS,
            channelsScanned,
            missingIssueKeys: jiraResult.missingIssueKeys || [],
            missingAsanaTaskIds: asanaResult.missingTaskIds || [],
            missingTrelloCardRefs: trelloResult.missingCardRefs || [],
            skippedDetections,
            prerequisites,
            message
        });
    } catch (error) {
        logger.error('Failed to generate work insights:', error);
        return res.status(error.status || 500).json({ error: error.message });
    }
});

router.post('/apply', express.json(), async (req, res) => {
    const requestPlatform = req.body?.platform || 'jira';
    try {
        const {
            userId,
            teamId,
            platform = 'jira',
            itemId,
            ticketKey,
            desiredStatus,
            comment
        } = req.body || {};

        const resolvedItemId = String(itemId || ticketKey || '').trim();

        if (!userId || !resolvedItemId) {
            return res.status(400).json({ error: 'userId and an insight item identifier are required' });
        }

        if (teamId) {
            await requireTeamMember(teamId, userId);
        }

        if (platform === 'asana') {
            const asanaContext = await resolveAsanaContext(userId, teamId);
            const task = await asanaService.getTaskById(asanaContext.accessToken, resolvedItemId);
            const currentStatus = getAsanaCurrentStatus(task);

            let transitioned = false;
            let commentAdded = false;
            let warning = null;
            let appliedStatus = currentStatus || 'Unknown';

            if (desiredStatus && shouldSuggestStatus(currentStatus, desiredStatus)) {
                const desiredBucket = getStatusBucket(desiredStatus);

                if (desiredBucket === 'done' && !task?.completed) {
                    await asanaService.setTaskCompleted(asanaContext.accessToken, resolvedItemId, true);
                    transitioned = true;
                    appliedStatus = 'Done';
                } else if (task?.project?.gid) {
                    const sections = await asanaService.getSectionsForProject(asanaContext.accessToken, task.project.gid);
                    const matchedSection = findBestNamedTarget(sections, desiredStatus);

                    if (matchedSection?.gid || matchedSection?.id) {
                        await asanaService.moveTaskToSection(
                            asanaContext.accessToken,
                            resolvedItemId,
                            matchedSection.gid || matchedSection.id
                        );
                        transitioned = true;
                        appliedStatus = matchedSection.name || desiredStatus;
                    } else {
                        warning = `No Asana section matched "${desiredStatus}". Comment added without moving the task.`;
                    }
                } else {
                    warning = `Teama could not infer an Asana section for "${desiredStatus}". Comment added without moving the task.`;
                }
            }

            if (String(comment || '').trim()) {
                await asanaService.addCommentToTask(asanaContext.accessToken, resolvedItemId, comment.trim());
                commentAdded = true;
            }

            if (transitioned) {
                try {
                    const refreshedTask = await asanaService.getTaskById(asanaContext.accessToken, resolvedItemId);
                    appliedStatus = getAsanaCurrentStatus(refreshedTask) || appliedStatus;
                } catch (refreshError) {
                    logger.warn('Failed to refresh Asana task after applying insight', {
                        taskId: resolvedItemId,
                        error: refreshError.message
                    });
                }
            }

            return res.json({
                success: true,
                platform: 'asana',
                itemId: resolvedItemId,
                ticketKey: buildAsanaDisplayKey(task),
                transitioned,
                commentAdded,
                appliedStatus,
                warning,
                itemUrl: task?.externalUrl || null,
                issueUrl: task?.externalUrl || null
            });
        }

        if (platform === 'trello') {
            const trelloContext = await resolveTrelloContext(userId, teamId);
            const card = await trelloService.getCard(trelloContext.accessToken, resolvedItemId);
            const currentStatus = getTrelloCurrentStatus(card);

            let transitioned = false;
            let commentAdded = false;
            let warning = null;
            let appliedStatus = currentStatus || 'Unknown';

            if (desiredStatus && shouldSuggestStatus(currentStatus, desiredStatus)) {
                const lists = await trelloService.getListsForBoard(
                    trelloContext.accessToken,
                    card?.project?.gid || card?.project?.id
                );
                const matchedList = findBestNamedTarget(lists, desiredStatus);

                if (matchedList?.id || matchedList?.gid) {
                    await trelloService.moveCardToList(
                        trelloContext.accessToken,
                        resolvedItemId,
                        matchedList.id || matchedList.gid
                    );
                    transitioned = true;
                    appliedStatus = matchedList.name || desiredStatus;
                } else {
                    warning = `No Trello list matched "${desiredStatus}". Comment added without moving the card.`;
                }
            }

            if (String(comment || '').trim()) {
                await trelloService.addCommentToCard(trelloContext.accessToken, resolvedItemId, comment.trim());
                commentAdded = true;
            }

            if (transitioned) {
                try {
                    const refreshedCard = await trelloService.getCard(trelloContext.accessToken, resolvedItemId);
                    appliedStatus = getTrelloCurrentStatus(refreshedCard) || appliedStatus;
                } catch (refreshError) {
                    logger.warn('Failed to refresh Trello card after applying insight', {
                        cardId: resolvedItemId,
                        error: refreshError.message
                    });
                }
            }

            return res.json({
                success: true,
                platform: 'trello',
                itemId: resolvedItemId,
                ticketKey: buildTrelloDisplayKey(card),
                transitioned,
                commentAdded,
                appliedStatus,
                warning,
                itemUrl: card?.externalUrl || null,
                issueUrl: card?.externalUrl || null
            });
        }

        const jiraContext = await resolveJiraContext(userId, teamId);
        const issue = await jiraService.getIssueByKey(
            jiraContext.accessToken,
            jiraContext.cloudId,
            resolvedItemId,
            jiraContext.baseUrl
        );

        let transitioned = false;
        let warning = null;
        let appliedStatus = issue?.status_name || 'Unknown';

        if (desiredStatus && shouldSuggestStatus(issue?.status_name, desiredStatus)) {
            const transitions = await jiraService.getIssueTransitions(jiraContext.accessToken, jiraContext.cloudId, resolvedItemId);
            const matchedTransition = findBestTransition(transitions, desiredStatus);

            if (matchedTransition?.id) {
                await jiraService.transitionIssue(jiraContext.accessToken, jiraContext.cloudId, resolvedItemId, matchedTransition.id);
                transitioned = true;
                appliedStatus = matchedTransition?.to?.name || desiredStatus;
            } else {
                warning = `No Jira transition matched "${desiredStatus}". Comment added without changing status.`;
            }
        }

        let commentAdded = false;
        if (String(comment || '').trim()) {
            await jiraService.addComment(jiraContext.accessToken, jiraContext.cloudId, resolvedItemId, comment.trim());
            commentAdded = true;
        }

        if (transitioned) {
            try {
                const refreshedIssue = await jiraService.getIssueByKey(
                    jiraContext.accessToken,
                    jiraContext.cloudId,
                    resolvedItemId,
                    jiraContext.baseUrl
                );
                appliedStatus = refreshedIssue?.status_name || appliedStatus;
            } catch (refreshError) {
                logger.warn('Failed to refresh Jira issue after applying insight', {
                    ticketKey: resolvedItemId,
                    error: refreshError.message
                });
            }
        }

        return res.json({
            success: true,
            platform: 'jira',
            itemId: resolvedItemId,
            ticketKey: issue?.key || resolvedItemId,
            transitioned,
            commentAdded,
            appliedStatus,
            warning,
            itemUrl: issue?.externalUrl || null,
            issueUrl: issue?.externalUrl || null
        });
    } catch (error) {
        logger.error('Failed to apply work insight:', error);
        if (isUnauthorizedError(error)) {
            if (requestPlatform === 'jira') {
                return res.status(401).json({
                    error: 'Jira write access is missing or expired. Reconnect Jira with write permissions, then try again.'
                });
            }

            if (requestPlatform === 'trello') {
                return res.status(401).json({
                    error: 'Trello write access is missing or expired. Reconnect Trello with write permissions, then try again.'
                });
            }

            if (requestPlatform === 'asana') {
                return res.status(401).json({
                    error: 'Asana access is missing or expired. Reconnect Asana, then try again.'
                });
            }
        }
        return res.status(error.status || 500).json({ error: error.message });
    }
});

export default router;
