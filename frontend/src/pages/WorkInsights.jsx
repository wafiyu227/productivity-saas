import { useEffect, useMemo, useState } from 'react';
import {
    AlertTriangle,
    ArrowRight,
    CheckCircle2,
    CircleSlash,
    ExternalLink,
    Loader2,
    MessageSquare,
    PencilLine,
    RefreshCw,
    Sparkles
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../api/client';

function getStorageKey(userId, teamId) {
    return `teamaai_work_insights_hidden_${userId || 'anon'}_${teamId || 'personal'}`;
}

function readHiddenInsightIds(userId, teamId) {
    if (!userId) return [];

    try {
        const raw = localStorage.getItem(getStorageKey(userId, teamId));
        const parsed = JSON.parse(raw || '[]');
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

function saveHiddenInsightIds(userId, teamId, insightIds) {
    if (!userId) return;
    localStorage.setItem(getStorageKey(userId, teamId), JSON.stringify(Array.from(new Set(insightIds))));
}

export default function WorkInsights() {
    const { user, profile } = useAuth();
    const teamId = profile?.current_team_id;
    const [insights, setInsights] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState('');
    const [message, setMessage] = useState('');
    const [skippedDetections, setSkippedDetections] = useState([]);
    const [prerequisites, setPrerequisites] = useState({
        slackConnected: false,
        jiraConnected: false,
        asanaConnected: false,
        trelloConnected: false,
        connectedPlatformCount: 0
    });
    const [hiddenInsightIds, setHiddenInsightIds] = useState([]);
    const [editingInsight, setEditingInsight] = useState(null);
    const [draftStatus, setDraftStatus] = useState('');
    const [draftComment, setDraftComment] = useState('');
    const [applyingInsightId, setApplyingInsightId] = useState('');
    const [notice, setNotice] = useState('');

    useEffect(() => {
        setHiddenInsightIds(readHiddenInsightIds(user?.id, teamId));
    }, [user?.id, teamId]);

    useEffect(() => {
        if (user?.id) {
            loadInsights();
        }
    }, [user?.id, teamId]);

    const visibleInsights = useMemo(
        () => insights.filter((insight) => !hiddenInsightIds.includes(insight.id)),
        [insights, hiddenInsightIds]
    );

    async function loadInsights(isRefresh = false) {
        if (!user?.id) return;

        if (isRefresh) {
            setRefreshing(true);
        } else {
            setLoading(true);
        }

        setError('');

        try {
            const response = await api.getWorkInsights(teamId, { limit: 25 });
            setInsights(Array.isArray(response?.insights) ? response.insights : []);
            setSkippedDetections(Array.isArray(response?.skippedDetections) ? response.skippedDetections : []);
            setPrerequisites(response?.prerequisites || {
                slackConnected: false,
                jiraConnected: false,
                asanaConnected: false,
                trelloConnected: false,
                connectedPlatformCount: 0
            });
            setMessage(response?.message || '');
        } catch (fetchError) {
            setError(fetchError.message || 'Failed to load work insights.');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }

    function hideInsight(insightId, nextNotice = '') {
        const nextHidden = [...hiddenInsightIds, insightId];
        setHiddenInsightIds(nextHidden);
        saveHiddenInsightIds(user?.id, teamId, nextHidden);
        if (nextNotice) {
            setNotice(nextNotice);
        }
    }

    async function handleAccept(insight, overrides = {}) {
        const desiredStatus = overrides.desiredStatus || insight.suggestedStatus;
        const comment = overrides.comment || insight.suggestedComment;

        setApplyingInsightId(insight.id);
        setNotice('');

        try {
            const result = await api.applyWorkInsight(teamId, {
                platform: insight.platform,
                itemId: insight.itemId,
                desiredStatus,
                comment
            });

            const nextNotice = result.warning
                ? `${insight.ticketKey} updated with a comment. ${result.warning}`
                : `${insight.ticketKey} moved toward ${result.appliedStatus || desiredStatus}.`;

            hideInsight(insight.id, nextNotice);
            setEditingInsight(null);
        } catch (applyError) {
            setNotice(applyError.message || 'Failed to apply work insight.');
        } finally {
            setApplyingInsightId('');
        }
    }

    function openEditModal(insight) {
        setEditingInsight(insight);
        setDraftStatus(insight.suggestedStatus || '');
        setDraftComment(insight.suggestedComment || '');
    }

    function handleDismissEdit() {
        setEditingInsight(null);
        setDraftStatus('');
        setDraftComment('');
    }

    if (loading) {
        return (
            <div className="flex min-h-[60vh] items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50">
            <div className="mx-auto max-w-7xl p-4 md:p-8">
                <div className="mb-6 flex flex-col gap-4 md:mb-8 md:flex-row md:items-start md:justify-between">
                    <div>
                        <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-blue-700">
                            <Sparkles size={14} />
                            Slack to Work Tool Suggestions
                        </div>
                        <h1 className="text-2xl font-bold text-slate-900 md:text-4xl">Work Insights</h1>
                        <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-600 md:text-base">
                            Teama reviews recent raw Slack messages, maps them to connected Jira, Asana, or Trello work items, and suggests the next update for a human to approve.
                        </p>
                    </div>
                    <button
                        onClick={() => loadInsights(true)}
                        disabled={refreshing}
                        className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 disabled:opacity-60"
                    >
                        <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
                        Refresh
                    </button>
                </div>

                <div className="mb-6 grid gap-4 md:mb-8 md:grid-cols-4">
                    <StatCard
                        label="Visible Insights"
                        value={visibleInsights.length}
                        tone="blue"
                        description="Suggestions ready for review"
                    />
                    <StatCard
                        label="Detected Signals"
                        value={visibleInsights.reduce((total, insight) => total + (insight.signals?.length || 0), 0)}
                        tone="amber"
                        description="Slack activity cues matched to work items"
                    />
                    <StatCard
                        label="Slack"
                        value={prerequisites.slackConnected ? 'Connected' : 'Missing'}
                        tone={prerequisites.slackConnected ? 'green' : 'slate'}
                        description="Needed to read team work context"
                    />
                    <StatCard
                        label="Work Tools"
                        value={`${prerequisites.connectedPlatformCount || 0}/3`}
                        tone={(prerequisites.connectedPlatformCount || 0) > 0 ? 'green' : 'slate'}
                        description="Connected project systems Teama can update"
                    />
                </div>

                {notice && (
                    <div className="mb-6 rounded-2xl border border-blue-200 bg-blue-50 px-5 py-4 text-sm text-blue-900">
                        {notice}
                    </div>
                )}

                {error && (
                    <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-800">
                        {error}
                    </div>
                )}

                {!prerequisites.slackConnected || !prerequisites.connectedPlatformCount ? (
                    <PrerequisiteState prerequisites={prerequisites} />
                ) : visibleInsights.length === 0 ? (
                    <EmptyState message={message} skippedDetections={skippedDetections} />
                ) : (
                    <div className="grid gap-5 xl:grid-cols-2">
                        {visibleInsights.map((insight) => (
                            <article
                                key={insight.id}
                                className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition hover:shadow-md"
                            >
                                <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
                                    <div>
                                        <div className="mb-2 flex items-center gap-2">
                                            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-700">
                                                {insight.platformLabel}
                                            </span>
                                            <span className="rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white">
                                                {insight.ticketKey}
                                            </span>
                                            <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">
                                                Confidence {Math.round((insight.confidence || 0) * 100)}%
                                            </span>
                                        </div>
                                        <h2 className="text-xl font-semibold text-slate-900">{insight.ticketName}</h2>
                                        <p className="mt-1 text-sm text-slate-500">
                                            {insight.projectName} - {formatDateTime(insight.sourceCreatedAt)}
                                        </p>
                                    </div>

                                    {insight.externalUrl && (
                                        <a
                                            href={insight.externalUrl}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                                        >
                                            Open item
                                            <ExternalLink size={14} />
                                        </a>
                                    )}
                                </div>

                                <div className="mb-5 rounded-2xl bg-slate-50 p-4">
                                    <div className="flex flex-wrap items-center gap-2 text-sm font-medium text-slate-700">
                                        <span className="rounded-full bg-white px-3 py-1 text-slate-600">
                                            Current: {insight.currentStatus}
                                        </span>
                                        <ArrowRight size={14} className="text-slate-400" />
                                        <span className="rounded-full bg-emerald-100 px-3 py-1 text-emerald-800">
                                            Suggested: {insight.suggestedStatus}
                                        </span>
                                    </div>
                                </div>

                                <section className="mb-5">
                                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                                        Detected Signals
                                    </p>
                                    <div className="flex flex-wrap gap-2">
                                        {insight.signals?.map((signal) => (
                                            <span
                                                key={`${insight.id}-${signal}`}
                                                className="rounded-full bg-amber-50 px-3 py-1 text-sm font-medium text-amber-800"
                                            >
                                                {signal}
                                            </span>
                                        ))}
                                    </div>
                                </section>

                                <section className="mb-6">
                                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                                        Slack Evidence
                                    </p>
                                    <div className="space-y-3">
                                        {insight.evidence?.map((evidence, index) => (
                                            <div key={`${insight.id}-evidence-${index}`} className="rounded-2xl border border-slate-200 p-4">
                                                <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                                                    <MessageSquare size={12} />
                                                    {evidence.source}
                                                </div>
                                                <p className="text-sm leading-6 text-slate-700">{evidence.text}</p>
                                            </div>
                                        ))}
                                    </div>
                                </section>

                                <div className="flex flex-wrap gap-3">
                                    <button
                                        onClick={() => handleAccept(insight)}
                                        disabled={applyingInsightId === insight.id}
                                        className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
                                    >
                                        {applyingInsightId === insight.id ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                                        Accept
                                    </button>
                                    <button
                                        onClick={() => openEditModal(insight)}
                                        disabled={applyingInsightId === insight.id}
                                        className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:opacity-60"
                                    >
                                        <PencilLine size={16} />
                                        Edit
                                    </button>
                                    <button
                                        onClick={() => hideInsight(insight.id, `${insight.ticketKey} hidden on this device.`)}
                                        disabled={applyingInsightId === insight.id}
                                        className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 disabled:opacity-60"
                                    >
                                        <CircleSlash size={16} />
                                        Ignore
                                    </button>
                                </div>
                            </article>
                        ))}
                    </div>
                )}
            </div>

            {editingInsight && (
                <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/50 p-4">
                    <div className="w-full max-w-2xl rounded-3xl bg-white p-6 shadow-2xl">
                        <div className="mb-6 flex items-start justify-between gap-4">
                            <div>
                                <p className="text-sm font-semibold uppercase tracking-wide text-blue-700">
                                    Edit Suggestion
                                </p>
                                <h2 className="mt-1 text-2xl font-bold text-slate-900">
                                    {editingInsight.ticketKey} - {editingInsight.ticketName}
                                </h2>
                            </div>
                            <button
                                onClick={handleDismissEdit}
                                className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
                            >
                                Close
                            </button>
                        </div>

                        <div className="space-y-5">
                            <label className="block">
                                <span className="mb-2 block text-sm font-semibold text-slate-700">Desired Status</span>
                                <input
                                    value={draftStatus}
                                    onChange={(event) => setDraftStatus(event.target.value)}
                                    className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
                                    placeholder="Ready for QA"
                                />
                            </label>

                            <label className="block">
                                <span className="mb-2 block text-sm font-semibold text-slate-700">Comment to Apply</span>
                                <textarea
                                    value={draftComment}
                                    onChange={(event) => setDraftComment(event.target.value)}
                                    rows={10}
                                    className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm leading-6 text-slate-900 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
                                />
                            </label>
                        </div>

                        <div className="mt-6 flex flex-wrap gap-3">
                            <button
                                onClick={() => handleAccept(editingInsight, { desiredStatus: draftStatus, comment: draftComment })}
                                disabled={applyingInsightId === editingInsight.id}
                                className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
                            >
                                {applyingInsightId === editingInsight.id ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                                Apply Edited Suggestion
                            </button>
                            <button
                                onClick={handleDismissEdit}
                                disabled={applyingInsightId === editingInsight.id}
                                className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:opacity-60"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function StatCard({ label, value, tone, description }) {
    const tones = {
        blue: 'bg-blue-50 text-blue-800 border-blue-200',
        amber: 'bg-amber-50 text-amber-800 border-amber-200',
        green: 'bg-emerald-50 text-emerald-800 border-emerald-200',
        slate: 'bg-slate-50 text-slate-700 border-slate-200'
    };

    return (
        <div className={`rounded-3xl border p-5 ${tones[tone] || tones.slate}`}>
            <p className="text-xs font-semibold uppercase tracking-wide">{label}</p>
            <p className="mt-3 text-3xl font-bold">{value}</p>
            <p className="mt-2 text-sm opacity-80">{description}</p>
        </div>
    );
}

function EmptyState({ message, skippedDetections = [] }) {
    return (
        <div className="rounded-3xl border border-slate-200 bg-white p-12 text-center shadow-sm">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-slate-100">
                <Sparkles className="text-slate-500" size={28} />
            </div>
            <h2 className="text-2xl font-bold text-slate-900">No work insights ready right now</h2>
            <p className="mx-auto mt-3 max-w-2xl text-sm leading-7 text-slate-600 md:text-base">
                {message || 'Teama did not find recent raw Slack messages with actionable Jira, Asana, or Trello work references and strong enough signals to suggest an update.'}
            </p>
            {skippedDetections.length > 0 && (
                <div className="mx-auto mt-6 max-w-3xl rounded-2xl border border-amber-200 bg-amber-50 p-5 text-left">
                    <p className="text-xs font-semibold uppercase tracking-wide text-amber-800">
                        Detected But No Approval Needed
                    </p>
                    <p className="mt-2 text-sm leading-7 text-amber-900">
                        {skippedDetections[0].reason}
                    </p>
                </div>
            )}
        </div>
    );
}

function PrerequisiteState({ prerequisites }) {
    const cards = [
        {
            label: 'Slack',
            connected: prerequisites.slackConnected,
            description: 'Needed so Teama can read recent Slack messages and spot work updates.'
        },
        {
            label: 'Jira',
            connected: prerequisites.jiraConnected,
            description: 'Lets Teama map Slack ticket keys to Jira issues and suggest status transitions.'
        },
        {
            label: 'Asana',
            connected: prerequisites.asanaConnected,
            description: 'Lets Teama match Slack links, IDs, or exact task names to Asana tasks.'
        },
        {
            label: 'Trello',
            connected: prerequisites.trelloConnected,
            description: 'Lets Teama match Slack links, IDs, or exact card names to Trello cards.'
        }
    ];

    return (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {cards.map((card) => (
                <div key={card.label} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                    <div className="mb-3 flex items-center gap-3">
                        {card.connected ? (
                            <CheckCircle2 className="text-emerald-600" size={22} />
                        ) : (
                            <AlertTriangle className="text-amber-600" size={22} />
                        )}
                        <h2 className="text-xl font-semibold text-slate-900">{card.label}</h2>
                    </div>
                    <p className="mb-4 text-sm leading-7 text-slate-600">{card.description}</p>
                    <p className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ${
                        card.connected ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-800'
                    }`}>
                        {card.connected ? 'Connected' : 'Needs setup'}
                    </p>
                </div>
            ))}
        </div>
    );
}

function formatDateTime(value) {
    if (!value) return 'Unknown';

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Unknown';

    return date.toLocaleString([], {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit'
    });
}
