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
    Sparkles,
    Zap,
    Target,
    Activity,
    ChevronRight,
    X
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../api/client';

function getStorageKey(userId) {
    return `teamaai_work_insights_hidden_${userId || 'anon'}_personal`;
}

function readHiddenInsightIds(userId) {
    if (!userId) return [];

    try {
        const raw = localStorage.getItem(getStorageKey(userId));
        const parsed = JSON.parse(raw || '[]');
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

function saveHiddenInsightIds(userId, insightIds) {
    if (!userId) return;
    localStorage.setItem(getStorageKey(userId), JSON.stringify(Array.from(new Set(insightIds))));
}

export default function WorkInsights() {
    const { user } = useAuth();
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
        connectedPlatformCount: 0
    });
    const [hiddenInsightIds, setHiddenInsightIds] = useState([]);
    const [editingInsight, setEditingInsight] = useState(null);
    const [draftStatus, setDraftStatus] = useState('');
    const [draftComment, setDraftComment] = useState('');
    const [applyingInsightId, setApplyingInsightId] = useState('');
    const [notice, setNotice] = useState('');

    useEffect(() => {
        setHiddenInsightIds(readHiddenInsightIds(user?.id));
    }, [user?.id]);

    useEffect(() => {
        if (user?.id) {
            loadInsights();
        }
    }, [user?.id]);

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
            const response = await api.getWorkInsights({ limit: 25 });
            setInsights(Array.isArray(response?.insights) ? response.insights : []);
            setSkippedDetections(Array.isArray(response?.skippedDetections) ? response.skippedDetections : []);
            setPrerequisites(response?.prerequisites || {
                slackConnected: false,
                jiraConnected: false,
                asanaConnected: false,
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
        saveHiddenInsightIds(user?.id, nextHidden);
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
            const result = await api.applyWorkInsight({
                platform: insight.platform,
                itemId: insight.itemId,
                desiredStatus,
                comment
            });

            const nextNotice = result.warning
                ? `${insight.ticketKey} updated with comment. ${result.warning}`
                : `${insight.ticketKey} status changed to ${result.appliedStatus || desiredStatus}.`;

            hideInsight(insight.id, nextNotice);
            setEditingInsight(null);
        } catch (applyError) {
            setNotice(applyError.message || 'Failed to apply update.');
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
            <div className="flex min-h-[60vh] items-center justify-center bg-black">
                <Loader2 className="h-10 w-10 animate-spin text-blue-500" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-black text-gray-100 selection:bg-blue-500/30">

            <div className="relative mx-auto max-w-7xl p-4 md:p-8">
                <div className="mb-10 flex flex-col gap-6 md:mb-12 md:flex-row md:items-start md:justify-between animate-in fade-in slide-in-from-bottom-4 duration-700">
                    <div>
                        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-[10px] font-bold uppercase tracking-widest text-gray-400">
                            Suggestions
                        </div>
                        <h1 className="text-4xl font-bold text-white tracking-tight md:text-5xl">Approvals</h1>
                        <p className="mt-4 max-w-3xl text-sm leading-relaxed text-gray-500 font-medium">
                            We've analyzed your team's conversations and projects to find ways you can save time. Approve these suggestions to update your project management tools.
                        </p>
                    </div>
                    <button
                        onClick={() => loadInsights(true)}
                        disabled={refreshing}
                        className="inline-flex items-center gap-3 rounded-2xl bg-white px-6 py-4 text-xs font-bold uppercase tracking-widest text-black hover:bg-gray-200 transition-all active:scale-95 disabled:opacity-60"
                    >
                        <RefreshCw size={18} className={refreshing ? 'animate-spin' : ''} />
                        Refresh
                    </button>
                </div>

                <div className="mb-10 grid gap-6 md:mb-12 md:grid-cols-4 animate-in fade-in slide-in-from-bottom-6 duration-700 delay-100">
                    <StatCard
                        label="Suggestions"
                        value={visibleInsights.length}
                        accent="gray"
                        icon={Target}
                    />
                    <StatCard
                        label="Matches"
                        value={visibleInsights.reduce((total, insight) => total + (insight.signals?.length || 0), 0)}
                        accent="gray"
                        icon={Activity}
                    />
                    <StatCard
                        label="Slack"
                        value={prerequisites.slackConnected ? 'Connected' : 'Disconnected'}
                        accent="gray"
                        icon={Zap}
                    />
                    <StatCard
                        label="Projects"
                        value={`${prerequisites.connectedPlatformCount || 0}/2`}
                        accent="gray"
                        icon={RefreshCw}
                    />
                </div>

                {notice && (
                    <div className="mb-10 rounded-2xl border border-white/10 bg-white/5 px-8 py-6 text-xs font-bold uppercase tracking-widest text-white animate-in fade-in slide-in-from-top-4 duration-500 flex items-center gap-4">
                        <div className="w-1.5 h-1.5 bg-white rounded-full"></div>
                        {notice}
                    </div>
                )}

                {error && (
                    <div className="mb-10 rounded-[2rem] border border-rose-500/20 bg-rose-500/10 px-8 py-6 text-xs font-black uppercase tracking-widest text-rose-400 animate-in fade-in slide-in-from-top-4 duration-500 flex items-center gap-4">
                        <div className="w-2 h-2 bg-rose-500 rounded-full animate-pulse"></div>
                        {error}
                    </div>
                )}

                {!prerequisites.slackConnected || !prerequisites.connectedPlatformCount ? (
                    <PrerequisiteState prerequisites={prerequisites} />
                ) : visibleInsights.length === 0 ? (
                    <EmptyState message={message} skippedDetections={skippedDetections} navigate={loadInsights} />
                ) : (
                    <div className="grid gap-6 xl:grid-cols-2 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-200">
                        {visibleInsights.map((insight) => (
                            <article
                                key={insight.id}
                                className="rounded-[2.5rem] border border-white/5 bg-[#09090b] p-8 shadow-2xl transition-all hover:border-white/10 group"
                            >
                                <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
                                    <div className="min-w-0 flex-1">
                                        <div className="mb-4 flex items-center gap-3">
                                            <span className="rounded-lg bg-white/5 border border-white/5 px-3 py-1 text-[9px] font-bold uppercase tracking-widest text-gray-500">
                                                {insight.platformLabel}
                                            </span>
                                            <span className="rounded-lg bg-white text-black px-3 py-1 text-[9px] font-bold uppercase tracking-widest">
                                                {insight.ticketKey}
                                            </span>
                                            <div className="flex items-center gap-2 px-3 py-1 rounded-lg bg-white/5 border border-white/10">
                                                <span className="text-[9px] font-bold uppercase tracking-widest text-gray-400">
                                                    Confidence {Math.round((insight.confidence || 0) * 100)}%
                                                </span>
                                            </div>
                                        </div>
                                        <h2 className="text-2xl font-bold text-white tracking-tight group-hover:text-gray-300 transition-colors uppercase">{insight.ticketName}</h2>
                                        <p className="mt-2 text-[10px] font-bold uppercase tracking-widest text-gray-700">
                                            {insight.projectName} • {formatDateTime(insight.sourceCreatedAt)}
                                        </p>
                                    </div>

                                    {insight.externalUrl && (
                                        <a
                                            href={insight.externalUrl}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="p-4 rounded-2xl bg-white/5 border border-white/5 text-gray-500 hover:text-white hover:bg-white/10 transition-all"
                                        >
                                            <ExternalLink size={20} />
                                        </a>
                                    )}
                                </div>

                                <div className="mb-8 rounded-2xl bg-white/[0.01] border border-white/5 p-6 transition-colors">
                                    <div className="flex flex-wrap items-center gap-6">
                                        <div className="flex flex-col gap-1">
                                            <span className="text-[9px] font-bold uppercase tracking-widest text-gray-700">From</span>
                                            <span className="text-xs font-bold text-white uppercase tracking-widest">{insight.currentStatus}</span>
                                        </div>
                                        <ArrowRight size={18} className="text-gray-800" />
                                        <div className="flex flex-col gap-1">
                                            <span className="text-[9px] font-bold uppercase tracking-widest text-white">To</span>
                                            <span className="text-xs font-bold text-white uppercase tracking-widest">{insight.suggestedStatus}</span>
                                        </div>
                                    </div>
                                </div>

                                <section className="mb-8">
                                    <p className="mb-4 text-[10px] font-bold uppercase tracking-widest text-gray-800">
                                        Evidence
                                    </p>
                                    <div className="flex flex-wrap gap-2">
                                        {insight.signals?.map((signal) => (
                                            <span
                                                key={`${insight.id}-${signal}`}
                                                className="rounded-lg bg-white/[0.02] border border-white/5 px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-gray-500"
                                            >
                                                {signal}
                                            </span>
                                        ))}
                                    </div>
                                </section>

                                <section className="mb-10">
                                    <p className="mb-4 text-[10px] font-bold uppercase tracking-widest text-gray-800">
                                        Context
                                    </p>
                                    <div className="space-y-3">
                                        {insight.evidence?.map((evidence, index) => (
                                            <div key={`${insight.id}-evidence-${index}`} className="rounded-2xl bg-white/[0.01] border border-white/5 p-5">
                                                <div className="mb-3 flex items-center gap-2 text-[9px] font-bold uppercase tracking-widest text-gray-700">
                                                    Source: {evidence.source}
                                                </div>
                                                <p className="text-[13px] leading-relaxed text-gray-500 font-medium font-serif italic">"{evidence.text}"</p>
                                            </div>
                                        ))}
                                    </div>
                                </section>

                                <div className="flex flex-wrap gap-4 pt-4 border-t border-white/5">
                                    <button
                                        onClick={() => handleAccept(insight)}
                                        disabled={applyingInsightId === insight.id}
                                        className="inline-flex items-center gap-3 rounded-2xl bg-white px-8 py-4 text-[10px] font-bold uppercase tracking-widest text-black hover:bg-gray-200 transition-all active:scale-95 disabled:opacity-60"
                                    >
                                        {applyingInsightId === insight.id ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={18} />}
                                        Approve
                                    </button>
                                    <button
                                        onClick={() => openEditModal(insight)}
                                        disabled={applyingInsightId === insight.id}
                                        className="inline-flex items-center gap-3 rounded-2xl bg-white/[0.05] border border-white/5 px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-white hover:bg-white/10 transition-all active:scale-95 disabled:opacity-60"
                                    >
                                        <PencilLine size={18} />
                                        Edit
                                    </button>
                                    <button
                                        onClick={() => hideInsight(insight.id, `${insight.ticketKey} dismissed.`)}
                                        disabled={applyingInsightId === insight.id}
                                        className="inline-flex items-center gap-3 rounded-2xl bg-white/[0.05] border border-white/5 px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-gray-700 hover:text-white hover:bg-white/10 transition-all ml-auto"
                                    >
                                        Dismiss
                                    </button>
                                </div>
                            </article>
                        ))}
                    </div>
                )}
            </div>

            {editingInsight && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xl p-4 animate-in fade-in duration-300">
                    <div className="w-full max-w-2xl rounded-3xl border border-white/10 bg-black p-10 shadow-2xl relative">
                        <button 
                            onClick={handleDismissEdit}
                            className="absolute top-8 right-8 p-3 bg-white/5 hover:bg-white/10 border border-white/5 rounded-2xl text-gray-700 hover:text-white transition-all"
                        >
                            <X size={24} />
                        </button>

                        <div className="mb-10">
                            <h2 className="text-3xl font-bold text-white tracking-tight leading-none uppercase mb-2">
                                {editingInsight.ticketKey}
                            </h2>
                            <p className="text-sm text-gray-700 font-bold uppercase tracking-widest">{editingInsight.ticketName}</p>
                        </div>

                        <div className="space-y-8">
                            <div className="space-y-3">
                                <label className="block text-[10px] font-bold text-gray-800 uppercase tracking-widest ml-1">New status</label>
                                <input
                                    value={draftStatus}
                                    onChange={(event) => setDraftStatus(event.target.value)}
                                    className="w-full rounded-2xl border border-white/5 bg-white/5 px-6 py-4 text-sm font-bold text-white uppercase tracking-widest outline-none transition focus:border-white/20"
                                    placeholder="STATUS"
                                />
                            </div>

                            <div className="space-y-3">
                                <label className="block text-[10px] font-bold text-gray-800 uppercase tracking-widest ml-1">Comment</label>
                                <textarea
                                    value={draftComment}
                                    onChange={(event) => setDraftComment(event.target.value)}
                                    rows={8}
                                    className="w-full rounded-3xl border border-white/5 bg-white/5 px-6 py-6 text-sm font-medium leading-relaxed text-gray-400 outline-none transition focus:border-white/20 placeholder-gray-800"
                                    placeholder="Add a comment..."
                                />
                            </div>
                        </div>

                        <div className="mt-10 flex flex-wrap gap-4">
                            <button
                                onClick={() => handleAccept(editingInsight, { desiredStatus: draftStatus, comment: draftComment })}
                                disabled={applyingInsightId === editingInsight.id}
                                className="inline-flex items-center gap-4 rounded-2xl bg-white px-10 py-5 text-xs font-bold uppercase tracking-widest text-black hover:bg-gray-200 transition-all active:scale-95 disabled:opacity-60"
                            >
                                {applyingInsightId === editingInsight.id ? <Loader2 size={18} className="animate-spin" /> : <CheckCircle2 size={18} />}
                                Approve
                            </button>
                            <button
                                onClick={handleDismissEdit}
                                disabled={applyingInsightId === editingInsight.id}
                                className="px-10 py-5 rounded-2xl bg-white/5 border border-white/10 text-xs font-bold uppercase tracking-widest text-gray-700 hover:text-white transition-all ml-auto"
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

function StatCard({ label, value, icon: Icon }) {
    return (
        <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-8 transition-all hover:bg-white/[0.04]">
            <div className="flex items-center justify-between mb-6">
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-700 leading-none">{label}</p>
                <Icon size={16} className="text-gray-800" />
            </div>
            <p className="text-4xl font-bold text-white tracking-tight leading-none">{value}</p>
        </div>
    );
}

function EmptyState({ message, skippedDetections = [], navigate }) {
    return (
        <div className="rounded-[3rem] border border-dashed border-white/10 p-20 text-center">
            <h2 className="text-3xl font-bold text-white uppercase tracking-tight leading-none mb-4">No suggestions yet</h2>
            <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-gray-700 font-medium">
                {message || 'We are looking for ways to improve your workflow. Check back later.'}
            </p>
            
            <button
                onClick={() => navigate(true)}
                className="mt-12 px-10 py-5 bg-white text-black text-[10px] font-bold uppercase tracking-widest rounded-2xl hover:bg-gray-200 transition-all"
            >
                Refresh
            </button>
        </div>
    );
}

function PrerequisiteState({ prerequisites }) {
    const cards = [
        {
            label: 'SLACK',
            connected: prerequisites.slackConnected,
            description: 'Connect Slack to receive team updates and summaries.',
            icon: MessageSquare
        },
        {
            label: 'JIRA',
            connected: prerequisites.jiraConnected,
            description: 'Connect Jira to track and update your technical tasks.',
            icon: Target
        },
        {
            label: 'ASANA',
            connected: prerequisites.asanaConnected,
            description: 'Connect Asana to manage your team projects and goals.',
            icon: Activity
        },
    ];

    return (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {cards.map((card) => (
                <div key={card.label} className="rounded-3xl border border-white/5 bg-white/[0.02] p-8 group">
                    <div className="mb-8 flex items-center justify-between">
                        <div className={`p-4 rounded-xl bg-white/5 border border-white/5 ${card.connected ? 'text-white' : 'text-gray-800'}`}>
                            <card.icon size={24} />
                        </div>
                        {card.connected ? (
                            <span className="text-[9px] font-bold uppercase tracking-widest text-white px-3 py-1 bg-white/5 border border-white/10 rounded-lg">Connected</span>
                        ) : (
                            <span className="text-[9px] font-bold uppercase tracking-widest text-gray-800 px-3 py-1 bg-white/[0.02] border border-white/5 rounded-lg">Required</span>
                        )}
                    </div>
                    <h2 className="text-xl font-bold text-white uppercase tracking-widest mb-4">{card.label}</h2>
                    <p className="mb-8 text-sm leading-relaxed text-gray-500 font-medium">{card.description}</p>
                </div>
            ))}
        </div>
    );
}

function formatDateTime(value) {
    if (!value) return 'UNKNOWN TIME';

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'UNKNOWN TIME';

    return date.toLocaleString([], {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit'
    }).toUpperCase();
}
