function asArray(value) {
    return Array.isArray(value) ? value : [];
}

function uniqueNonEmptyStrings(values, limit = 6) {
    return Array.from(
        new Set(
            asArray(values)
                .filter((value) => typeof value === 'string')
                .map((value) => value.trim())
                .filter(Boolean)
        )
    ).slice(0, limit);
}

function normalizeDate(value) {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return date;
}

function toTaskTitle(task, fallback = 'Untitled task') {
    const name = typeof task?.name === 'string' ? task.name.trim() : '';
    return name || fallback;
}

export function buildProjectInsightsFromTasks(tasks, health = {}, options = {}) {
    const list = asArray(tasks);
    const platformLabel = options.platformLabel || 'Project platform';
    const projectName = options.projectName || 'Project';

    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const soonLimit = new Date(todayStart);
    soonLimit.setDate(soonLimit.getDate() + 3);

    const overdue = [];
    const dueSoon = [];
    const unassigned = [];

    list.forEach((task) => {
        const completed = Boolean(task?.completed);
        const assigneeName = task?.assignee?.name;
        const dueDate = normalizeDate(task?.due_on || task?.due_at);

        if (!completed && !assigneeName) {
            unassigned.push(task);
        }

        if (completed || !dueDate) return;
        if (dueDate < todayStart) {
            overdue.push(task);
            return;
        }
        if (dueDate <= soonLimit) {
            dueSoon.push(task);
        }
    });

    const blockers = [];
    if (overdue.length > 0) blockers.push(`${overdue.length} task${overdue.length === 1 ? '' : 's'} are overdue`);
    if (dueSoon.length > 0) blockers.push(`${dueSoon.length} task${dueSoon.length === 1 ? '' : 's'} are due within 3 days`);
    if (unassigned.length > 0) blockers.push(`${unassigned.length} task${unassigned.length === 1 ? '' : 's'} have no assignee`);
    if (blockers.length === 0) blockers.push('No urgent risk signals detected from fetched tasks');

    const overdueHighlight = overdue.slice(0, 5).map((task) => toTaskTitle(task, 'Overdue task'));

    const recommendations = [];
    if (overdue.length > 0) recommendations.push('Prioritize overdue tasks first and assign owners for immediate follow-up');
    if (dueSoon.length > 0) recommendations.push('Review near-term due tasks in your next standup to prevent slippage');
    if (unassigned.length > 0) recommendations.push('Assign owners to unassigned tasks to improve accountability');
    if (recommendations.length === 0) recommendations.push('Maintain current execution pace and continue weekly risk reviews');

    const completionRate = Number.isFinite(health?.completionRate) ? health.completionRate : 0;
    const summary = [
        `${platformLabel} insights for "${projectName}" based on ${list.length} fetched task${list.length === 1 ? '' : 's'}.`,
        `${health?.completed || 0}/${health?.total || list.length} completed (${completionRate}%).`,
        `${overdue.length} overdue, ${dueSoon.length} due soon, ${unassigned.length} unassigned.`
    ].join(' ');

    return {
        summary,
        blockers: uniqueNonEmptyStrings(blockers, 6),
        overdueHighlight: uniqueNonEmptyStrings(overdueHighlight, 6),
        recommendations: uniqueNonEmptyStrings(recommendations, 6),
        evidence: {
            platform: platformLabel,
            projectName,
            taskCount: list.length,
            completedCount: health?.completed || 0,
            overdueCount: overdue.length,
            dueSoonCount: dueSoon.length,
            unassignedCount: unassigned.length
        }
    };
}

export function mergeProjectInsights(baseInsights, aiInsights) {
    const base = baseInsights || {
        summary: '',
        blockers: [],
        overdueHighlight: [],
        recommendations: [],
        evidence: null
    };

    if (!aiInsights) {
        return base;
    }

    const aiObject = typeof aiInsights === 'string'
        ? { summary: aiInsights }
        : (typeof aiInsights === 'object' ? aiInsights : {});

    const aiSummary = typeof aiObject.summary === 'string' ? aiObject.summary.trim() : '';
    const evidenceNote = base?.evidence?.taskCount
        ? `Based on ${base.evidence.taskCount} fetched tasks.`
        : '';

    const summary = aiSummary
        ? `${aiSummary}${evidenceNote ? ` ${evidenceNote}` : ''}`
        : base.summary;

    return {
        summary,
        blockers: uniqueNonEmptyStrings([
            ...asArray(aiObject.blockers),
            ...asArray(base.blockers)
        ], 8),
        overdueHighlight: uniqueNonEmptyStrings([
            ...asArray(aiObject.overdueHighlight),
            ...asArray(base.overdueHighlight)
        ], 8),
        recommendations: uniqueNonEmptyStrings([
            ...asArray(aiObject.recommendations),
            ...asArray(base.recommendations)
        ], 8),
        evidence: base.evidence
    };
}
