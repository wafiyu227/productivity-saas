import express from 'express';
import { db, supabase } from '../services/supabase-client.js';
import { createSeededConversation } from '../services/agent-seeds.js';
import logger from '../utils/logger.js';

const router = express.Router();
const FRONTEND_URL = (process.env.FRONTEND_URL || 'https://teamaai.xyz').replace(/\/+$/, '');

const SOURCE_LABELS = {
    slack: 'Slack',
    github: 'GitHub',
    jira: 'Jira',
    asana: 'Asana',
    calendar: 'Google Calendar'
};

function truncateText(value, maxLength = 220) {
    const normalized = typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
    if (!normalized) return '';
    if (normalized.length <= maxLength) return normalized;
    return `${normalized.slice(0, maxLength - 3)}...`;
}

function buildBlockerQuickActions(blocker) {
    const title = blocker?.title || 'this blocker';
    const sourceType = String(blocker?.sourceType || '').toLowerCase();

    if (sourceType === 'slack') {
        return [
            {
                label: 'Proceed With Fix',
                prompt: `Recommend the best next move for "${title}" and, if messaging is the right path, draft the message I should send.`
            },
            {
                label: 'Show Context',
                prompt: `Show me the source context behind "${title}" and explain why it is blocking progress.`
            },
            {
                label: 'Draft Response',
                prompt: `Draft a concise Slack response that would help unblock "${title}".`
            },
            {
                label: 'Try Another Path',
                prompt: `Give me two alternative ways to resolve "${title}" if the recommended path is not possible.`
            }
        ];
    }

    return [
        {
            label: 'Recommend Next Move',
            prompt: `Recommend the best next move for "${title}" and explain why it is the fastest way to resolve it.`
        },
        {
            label: 'Show Source Context',
            prompt: `Show me the most relevant context behind "${title}" and explain what is blocked.`
        },
        {
            label: 'Draft Update',
            prompt: `Draft the update, comment, or follow-up I should use to move "${title}" forward.`
        },
        {
            label: 'Alternative Options',
            prompt: `Give me two alternative ways to resolve "${title}" if the first recommendation is not feasible.`
        }
    ];
}

async function loadBlockerSeedContext(userId, blockerData) {
    const context = {
        sourceType: blockerData?.sourceType || 'unknown',
        source: blockerData?.source || 'Unknown source',
        priority: blockerData?.priority || 'medium',
        description: truncateText(blockerData?.description, 260),
        externalUrl: blockerData?.externalUrl || null
    };

    if (blockerData?.summaryId) {
        const { data } = await supabase
            .from('slack_summaries')
            .select('summary, channel_name, created_at')
            .eq('id', blockerData.summaryId)
            .eq('user_id', userId)
            .maybeSingle();

        if (data?.summary) {
            context.slackSummary = {
                channel: data.channel_name || 'unknown',
                summary: truncateText(data.summary, 320),
                createdAt: data.created_at || null
            };
        }
    }

    return context;
}

function buildBlockerStarterPrompt(blockerData, seedContext = {}, quickActions = []) {
    return [
        'Blocker seed context:',
        JSON.stringify({
            blocker: {
                title: blockerData?.title || '',
                source: blockerData?.source || '',
                sourceType: blockerData?.sourceType || '',
                priority: blockerData?.priority || '',
                description: truncateText(blockerData?.description, 500),
                externalUrl: blockerData?.externalUrl || null
            },
            gatheredContext: seedContext
        }, null, 2),
        '',
        'Write the first assistant message for this blocker-assignment chat.',
        'Requirements:',
        '- Sound proactive, like the agent has already reviewed the blocker context.',
        '- Recommend the best next move and explain it briefly.',
        '- Be honest about what context is available.',
        '- Use short markdown sections.',
        '- End by inviting the user to choose one of the provided next steps.',
        `Available next steps: ${quickActions.map((action) => action.label).join(', ')}.`
    ].join('\n');
}

function buildBlockerFallbackStarter(blockerData, seedContext = {}) {
    const lines = [];
    lines.push('### Ready');
    lines.push(`I’ve started reviewing **${blockerData?.title || 'this blocker'}** so we can decide the fastest path to resolution.`);
    lines.push('');
    lines.push('### What I found');
    lines.push(`- Source: ${blockerData?.source || 'Unknown source'} (${blockerData?.sourceType || 'unknown'})`);
    lines.push(`- Priority: ${blockerData?.priority || 'medium'}`);
    if (blockerData?.description) {
        lines.push(`- Current signal: ${truncateText(blockerData.description, 180)}`);
    }
    if (seedContext?.slackSummary?.summary) {
        lines.push(`- Slack context from #${seedContext.slackSummary.channel}: ${truncateText(seedContext.slackSummary.summary, 160)}`);
    }
    if (blockerData?.externalUrl) {
        lines.push('- Source link is attached to the blocker if you want to inspect the original item directly.');
    }
    lines.push('');
    lines.push('### Recommendation');
    lines.push('- Start with the recommended next move or ask me to show the source context first so we can choose the cleanest action path.');
    lines.push('');
    lines.push('Choose one of the next steps below and I’ll continue from there.');
    return lines.join('\n');
}

function buildBlockerActionPrompt(blocker) {
    return `I've detected a potential blocker from your connected tools that needs attention:

**Title:** ${blocker.title}
**Source:** ${blocker.source} (${blocker.sourceType})
**Priority:** ${blocker.priority}
**Description:** ${blocker.description}
${blocker.externalUrl ? `**Link:** ${blocker.externalUrl}` : ''}

Please review this and suggest what action should be taken. Suggest a few next-step options I can choose from in chat, and help me move it forward from there.`;
}

// Resolve a blocker
router.post('/resolve', express.json(), async (req, res) => {
    try {
        const { summaryId, blockIndex, userId, resolvedAt } = req.body;

        if (!summaryId || blockIndex === undefined || !userId) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        logger.info('Resolving blocker', { summaryId, blockIndex, userId });

        const { data: summary, error: fetchError } = await supabase
            .from('slack_summaries')
            .select('blocker_status, blockers')

            .eq('id', summaryId)
            .single();

        if (fetchError) {
            logger.error('Failed to fetch summary', { error: fetchError });
            return res.status(500).json({ error: 'Failed to fetch summary' });
        }

        // Initialize blocker_status if it doesn't exist
        let blockerStatus = summary.blocker_status || [];

        // Ensure array is large enough
        while (blockerStatus.length <= blockIndex) {
            blockerStatus.push({ status: 'active', resolved_at: null });
        }

        // Update specific blocker status
        blockerStatus[blockIndex] = {
            status: 'resolved',
            resolved_at: resolvedAt,
            resolved_by: userId
        };

        // Update in database
        const { error: updateError } = await supabase
            .from('slack_summaries')
            .update({ blocker_status: blockerStatus })
            .eq('id', summaryId);

        if (updateError) {
            logger.error('Failed to update blocker status', { error: updateError });
            return res.status(500).json({ error: 'Failed to update blocker status' });
        }

        logger.info('Blocker resolved successfully', { summaryId, blockIndex });

        res.json({
            success: true,
            message: 'Blocker resolved successfully'
        });

    } catch (error) {
        logger.error('Resolve blocker error:', { error: error.message });
        res.status(error.status || 500).json({ error: error.message });
    }
});

// Get blockers for a user
router.get('/', async (req, res) => {
    try {
        const { userId } = req.query;

        if (!userId) {
            return res.status(400).json({ error: 'userId required' });
        }

        // Get user's integration
        const integration = await db.getIntegration(userId, 'slack');

        if (!integration) {
            return res.json([]);
        }

        // Fetch summaries with blockers
        const { data: summaries, error } = await supabase
            .from('slack_summaries')
            .select('*')
            .eq('user_id', userId)
            .not('blockers', 'is', null)
            .order('created_at', { ascending: false });

        if (error) {
            logger.error('Failed to fetch blockers', { error });
            return res.status(500).json({ error: error.message });
        }

        res.json(summaries || []);

    } catch (error) {
        logger.error('Get blockers error:', { error: error.message });
        res.status(error.status || 500).json({ error: error.message });
    }
});

// Get AI-detected blockers with evidence (new endpoint)
router.get('/detected', async (req, res) => {
    try {
        const { userId } = req.query;

        if (!userId) {
            return res.status(400).json({ error: 'userId required' });
        }

        logger.info('Fetching detected blockers', { userId });

        // This endpoint will be called by the frontend with extracted blocker data
        // The frontend handles the extraction and AI detection
        // Backend just tracks resolution status
        res.json({
            success: true,
            message: 'Detected blockers endpoint ready'
        });

    } catch (error) {
        logger.error('Get detected blockers error:', { error: error.message });
        res.status(error.status || 500).json({ error: error.message });
    }
});

// Get all dismissed blocker IDs for a user
router.get('/dismissed', async (req, res) => {
    try {
        const { userId } = req.query;
        if (!userId) return res.status(400).json({ error: 'userId required' });

        const dismissedIds = await db.listDismissedBlockers(userId);
        res.json(dismissedIds);
    } catch (error) {
        logger.error('Get dismissed blockers error:', { error: error.message });
        res.status(500).json({ error: error.message });
    }
});

// Dismiss a blocker (persistently in DB)
router.post('/dismiss', express.json(), async (req, res) => {
    try {
        const { blockerId, userId } = req.body;

        if (!blockerId || !userId) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        logger.info('Dismissing blocker persistently', { blockerId, userId });

        await db.dismissBlocker(userId, blockerId);
        
        res.json({
            success: true,
            message: 'Blocker dismissed persistently'
        });

    } catch (error) {
        logger.error('Dismiss blocker error:', { error: error.message });
        res.status(error.status || 500).json({ error: error.message });
    }
});

// Assign blocker to agent for action
router.post('/assign-to-agent', express.json(), async (req, res) => {
    try {
        const { blockerId, userId, blockerData } = req.body;

        if (!blockerId || !userId || !blockerData) {
            logger.warn('Missing required fields for assign-to-agent', { blockerId, userId, blockerData: !!blockerData });
            return res.status(400).json({ error: 'Missing required fields' });
        }

        logger.info('Assigning blocker to agent', { blockerId, userId, blockerTitle: blockerData.title });

        // Validate blockerData structure
        if (!blockerData.title || typeof blockerData.title !== 'string') {
            logger.error('Invalid blocker data', { blockerData });
            return res.status(400).json({ error: 'Invalid blocker data - missing or invalid title' });
        }

        // Gather seed context (Slack summaries, etc.) for the system prompt
        const seedContext = await loadBlockerSeedContext(userId, blockerData);
        const quickActions = buildBlockerQuickActions(blockerData);

        // Build a short static greeting — no separate GPT call
        const sourceLabel = (SOURCE_LABELS[blockerData.sourceType] || blockerData.sourceType || 'your tools').toLowerCase();
        const priorityLabel = blockerData.priority || 'medium';
        const greeting = [
            `I've loaded the context for **${blockerData.title}** — a ${priorityLabel}-priority blocker from ${sourceLabel}.`,
            '',
            'I have all the details ready. Choose one of the options below or tell me how you\'d like to proceed.'
        ].join('\n');

        const conversationTitle = `Blocker: ${blockerData.title}`;

        logger.debug('Creating blocker conversation with context injection', { conversationTitle, userId });

        // If this is a Slack blocker, mark it as resolved in the database automatically
        if (blockerData.summaryId && blockerData.blockIndex !== undefined) {
            try {
                const { data: summary, error: fetchError } = await supabase
                    .from('slack_summaries')
                    .select('blocker_status')
                    .eq('id', blockerData.summaryId)
                    .single();

                if (!fetchError && summary) {
                    let blockerStatus = summary.blocker_status || [];
                    const blockIndex = blockerData.blockIndex;

                    // Ensure array is large enough
                    while (blockerStatus.length <= blockIndex) {
                        blockerStatus.push({ status: 'active', resolved_at: null });
                    }

                    // Update specific blocker status
                    blockerStatus[blockIndex] = {
                        status: 'resolved',
                        resolved_at: new Date().toISOString(),
                        resolved_by: userId,
                        assigned_to_agent: true
                    };

                    // Update in database
                    await supabase
                         .from('slack_summaries')
                        .update({ blocker_status: blockerStatus })
                        .eq('id', blockerData.summaryId);
                    
                    logger.info('Blocker marked as resolved during assignment', { 
                        summaryId: blockerData.summaryId, 
                        blockIndex 
                    });
                }
            } catch (resolveErr) {
                // Log but don't fail assignment if resolution fails
                logger.error('Failed to auto-resolve blocker during assignment:', resolveErr);
            }
        }

        const conversation = await createSeededConversation({
            userId,
            title: conversationTitle,
            assistantText: greeting,
            quickActions,
            metadata: {
                actionType: 'blocker_action',
                blockerData: {
                    id: blockerId,
                    title: blockerData.title,
                    source: blockerData.source || 'Unknown',
                    sourceType: blockerData.sourceType || 'unknown',
                    priority: blockerData.priority || 'medium',
                    description: truncateText(blockerData.description, 500),
                    externalUrl: blockerData.externalUrl || null,
                    summaryId: blockerData.summaryId || null
                },
                gatheredContext: seedContext,
                createdAt: new Date().toISOString()
            }
        });

        logger.info('Blocker assigned to agent successfully', { 
            blockerId, 
            conversationId: conversation.id,
            userId 
        });

        res.json({
            success: true,
            message: 'Blocker assigned to AI agent',
            conversationId: conversation.id,
            conversationUrl: `${FRONTEND_URL}/app/chat?conversation=${conversation.id}`
        });

    } catch (error) {
        logger.error('Assign blocker error:', { error: error.message, stack: error.stack });
        res.status(error.status || 500).json({ error: error.message });
    }
});

export default router;
