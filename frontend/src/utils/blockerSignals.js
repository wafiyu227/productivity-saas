const CALENDAR_BLOCKER_PATTERN = /(block(?:ed|er)?|risk|dependenc(?:y|ies)|delay(?:ed)?|stuck|urgent|waiting|escalat)/i;

export function createEmptyAsanaDeadlines() {
    return {
        overdue: { tasks: [] },
        dueToday: { tasks: [] }
    };
}

export function createEmptyGithubPulls() {
    return {
        pulls: [],
        meta: {}
    };
}

export function createEmptyCalendarSignals() {
    return {
        events: [],
        actionItems: []
    };
}

export function normalizeList(value) {
    if (Array.isArray(value)) return value;
    if (typeof value === 'string') {
        try {
            const parsed = JSON.parse(value);
            return Array.isArray(parsed) ? parsed : [];
        } catch {
            return [];
        }
    }
    return [];
}

export function extractSlackBlockers(summaries) {
    return (Array.isArray(summaries) ? summaries : []).flatMap((summary) => {
        const blockers = normalizeList(summary?.blockers);
        const blockerStatuses = normalizeList(summary?.blocker_status);

        return blockers
            .map((blocker, blockIndex) => {
                const title = typeof blocker === 'string' ? blocker.trim() : '';
                if (!title) return null;

                const status = blockerStatuses?.[blockIndex]?.status === 'resolved' ? 'resolved' : 'active';
                return {
                    id: `slack-${summary.id}-${blockIndex}`,
                    title,
                    source: `#${summary.channel_name || 'unknown'}`,
                    sourceType: 'slack',
                    createdAt: summary.created_at || new Date().toISOString(),
                    status,
                    priority: status === 'active' ? 'medium' : 'low',
                    description: `Blocker detected in #${summary.channel_name || 'unknown'}`,
                    channelId: summary.channel_id,
                    summaryId: summary.id,
                    blockIndex,
                    resolvedAt: blockerStatuses?.[blockIndex]?.resolved_at || null
                };
            })
            .filter(Boolean);
    });
}

export function extractAsanaBlockers(deadlines) {
    return extractProjectPlatformBlockers(deadlines, 'asana');
}

export function extractTrelloBlockers(deadlines) {
    return extractProjectPlatformBlockers(deadlines, 'trello');
}

export function extractProjectPlatformBlockers(deadlines, platform = 'asana') {
    const platformKey = String(platform || '').toLowerCase();
    const normalizedPlatform = ['asana', 'trello', 'jira'].includes(platformKey) ? platformKey : 'asana';
    const platformLabelMap = {
        asana: 'Asana',
        trello: 'Trello',
        jira: 'Jira'
    };
    const platformLabel = platformLabelMap[normalizedPlatform];
    const overdueTasks = normalizeList(deadlines?.overdue?.tasks);
    const dueTodayTasks = normalizeList(deadlines?.dueToday?.tasks);
    const byTask = new Map();

    overdueTasks.forEach((task) => {
        const taskId = task?.gid || task?.id;
        if (!taskId) return;

        const dueDate = task?.due_on ? new Date(task.due_on) : null;
        const dueTimestamp = dueDate && !Number.isNaN(dueDate.getTime()) ? dueDate.getTime() : Date.now();
        const daysOverdue = Math.max(1, Math.ceil((Date.now() - dueTimestamp) / (1000 * 60 * 60 * 24)));

        byTask.set(taskId, {
            id: `${normalizedPlatform}-${taskId}`,
            title: task?.name || `Overdue ${platformLabel} task`,
            source: task?.project?.name || platformLabel,
            sourceType: normalizedPlatform,
            createdAt: task?.due_on || new Date().toISOString(),
            status: 'active',
            priority: 'high',
            description: `Overdue by ${daysOverdue} day${daysOverdue === 1 ? '' : 's'} - Assigned to ${task?.assignee?.name || 'Unassigned'}`,
            asanaGid: normalizedPlatform === 'asana' ? taskId : null,
            externalUrl: task?.externalUrl || (normalizedPlatform === 'asana' ? `https://app.asana.com/0/0/${taskId}` : null),
            resolvedAt: null
        });
    });

    dueTodayTasks.forEach((task) => {
        const taskId = task?.gid || task?.id;
        if (!taskId || byTask.has(taskId)) return;

        byTask.set(taskId, {
            id: `${normalizedPlatform}-${taskId}`,
            title: task?.name || `${platformLabel} task due today`,
            source: task?.project?.name || platformLabel,
            sourceType: normalizedPlatform,
            createdAt: task?.due_on || new Date().toISOString(),
            status: 'active',
            priority: 'medium',
            description: `Due today - Assigned to ${task?.assignee?.name || 'Unassigned'}`,
            asanaGid: normalizedPlatform === 'asana' ? taskId : null,
            externalUrl: task?.externalUrl || (normalizedPlatform === 'asana' ? `https://app.asana.com/0/0/${taskId}` : null),
            resolvedAt: null
        });
    });

    return Array.from(byTask.values());
}

export function extractGithubBlockers(githubPulls, staleDays = 7) {
    const pulls = normalizeList(githubPulls?.pulls);
    const staleThreshold = Date.now() - staleDays * 24 * 60 * 60 * 1000;

    return pulls
        .map((pr) => {
            const updatedAt = pr?.updated_at ? new Date(pr.updated_at).getTime() : null;
            const inferredStale = Number.isFinite(updatedAt) ? updatedAt < staleThreshold : false;

            const reasons = [];
            if (pr?.needs_review || normalizeList(pr?.blocker_reasons).includes('needs_review')) {
                reasons.push('Needs review');
            }
            if (pr?.is_stale || normalizeList(pr?.blocker_reasons).includes('stale') || inferredStale) {
                reasons.push(`Stale (${staleDays}+ days)`);
            }
            if (!reasons.length) return null;

            const title = typeof pr?.title === 'string' ? pr.title.trim() : '';
            if (!title) return null;

            return {
                id: `github-pr-${pr.id || pr.number}`,
                title,
                source: pr?.repo || 'GitHub',
                sourceType: 'github',
                createdAt: pr?.updated_at || pr?.created_at || new Date().toISOString(),
                status: 'active',
                priority: reasons.some((reason) => reason.startsWith('Stale')) ? 'high' : 'medium',
                description: `${reasons.join(' - ')} - Author: ${pr?.user?.login || 'unknown'}`,
                githubPrNumber: pr?.number || null,
                externalUrl: pr?.html_url || null,
                resolvedAt: null
            };
        })
        .filter(Boolean);
}

export function extractCalendarBlockers(calendarSignals) {
    const events = normalizeList(calendarSignals?.events);
    const actionItems = normalizeList(calendarSignals?.actionItems);
    const eventLookup = new Map(events.map((event) => [event.id, event]));

    return actionItems
        .map((item, index) => {
            const text = typeof item?.text === 'string' ? item.text.trim() : '';
            if (!text || !CALENDAR_BLOCKER_PATTERN.test(text)) {
                return null;
            }

            const sourceEvent = eventLookup.get(item?.eventId) || null;
            const source = sourceEvent?.title || item?.source || 'Calendar';

            return {
                id: `calendar-${item?.eventId || 'unknown'}-${index}`,
                title: text,
                source,
                sourceType: 'calendar',
                createdAt: sourceEvent?.start || item?.eventDate || new Date().toISOString(),
                status: 'active',
                priority: 'medium',
                description: `Risk signal from meeting action items in "${source}"`,
                calendarEventId: item?.eventId || null,
                externalUrl: sourceEvent?.htmlLink || null,
                resolvedAt: null
            };
        })
        .filter(Boolean);
}

export function mergeBlockers(...lists) {
    const all = lists.flat().filter(Boolean);
    const byId = new Map();
    all.forEach((blocker) => {
        if (!blocker?.id) return;
        byId.set(blocker.id, blocker);
    });
    return Array.from(byId.values());
}

export function buildTopActiveBlockerData(blockers, maxItems = 8) {
    const counts = {};
    blockers.forEach((blocker) => {
        if (blocker?.status !== 'active') return;
        const rawTitle = typeof blocker?.title === 'string' ? blocker.title.trim() : '';
        if (!rawTitle) return;
        const prefixedTitle = blocker.sourceType === 'slack'
            ? rawTitle
            : `${capitalize(blocker.sourceType)}: ${rawTitle}`;
        counts[prefixedTitle] = (counts[prefixedTitle] || 0) + 1;
    });

    return Object.entries(counts)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, maxItems);
}

function capitalize(value) {
    if (!value || typeof value !== 'string') return 'Unknown';
    return value.charAt(0).toUpperCase() + value.slice(1);
}
