import {
    AlertTriangle,
    Calendar,
    CheckCircle,
    Clock,
    ExternalLink,
    Github,
    MessageSquare,
    Search,
    Target,
    Zap,
    ShieldAlert,
    ChevronRight,
    Filter,
    ArrowUpRight,
    X,
    PencilLine,
    Sparkles,
    CircleSlash
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../api/client';
import { assignBlockerToAgent } from '../utils/api-helpers';
import {
    createEmptyAsanaDeadlines,
    createEmptyCalendarSignals,
    createEmptyGithubPulls,
    extractProjectPlatformBlockers,
    extractCalendarBlockers,
    extractGithubBlockers,
    extractSlackBlockers,
    mergeBlockers
} from '../utils/blockerSignals';

const API_URL = import.meta.env.VITE_API_URL || 'https://api.teamaai.xyz';
const GITHUB_STALE_DAYS = 7;
const CALENDAR_BLOCKER_WINDOW_DAYS = 14;
const PROJECT_PLATFORM_PRIORITY = ['jira', 'asana'];
const PROJECT_PLATFORM_LABELS = {
    jira: 'Jira',
    asana: 'Asana'
};
const PROJECT_PLATFORM_DEADLINE_FETCHERS = {
    jira: () => api.getJiraDeadlines(),
    asana: () => api.getAsanaDeadlines()
};

const SOURCE_META = {
    slack: {
        label: 'Slack',
        icon: MessageSquare,
        chipClass: 'border-white/10 bg-white/5 text-white',
        activeClass: 'bg-white text-black',
        buttonClass: 'bg-white text-black hover:bg-gray-200',
        openLabel: 'Open Session'
    },
    asana: {
        label: 'Asana',
        icon: Target,
        chipClass: 'border-white/10 bg-white/5 text-white',
        activeClass: 'bg-white text-black',
        buttonClass: 'bg-white/5 border border-white/10 text-white hover:bg-white/10',
        openLabel: 'Open Task'
    },
    jira: {
        label: 'Jira',
        icon: Target,
        chipClass: 'border-white/10 bg-white/5 text-white',
        activeClass: 'bg-white text-black',
        buttonClass: 'bg-white/5 border border-white/10 text-white hover:bg-white/10',
        openLabel: 'Open Issue'
    },
    github: {
        label: 'GitHub',
        icon: Github,
        chipClass: 'border-white/10 bg-white/5 text-white',
        activeClass: 'bg-white text-black',
        buttonClass: 'bg-white/5 border border-white/10 text-white hover:bg-white/10',
        openLabel: 'Open PR'
    },
    calendar: {
        label: 'Calendar',
        icon: Calendar,
        chipClass: 'border-white/10 bg-white/5 text-white',
        activeClass: 'bg-white text-black',
        buttonClass: 'bg-white/5 border border-white/10 text-white hover:bg-white/10',
        openLabel: 'Open Event'
    }
};

function getStorageKey(userId) {
    return `teamaai_blockers_hidden_${userId || 'anon'}_personal`;
}

function readHiddenBlockerIds(userId) {
    if (!userId) return [];

    try {
        const raw = localStorage.getItem(getStorageKey(userId));
        const parsed = JSON.parse(raw || '[]');
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

function saveHiddenBlockerIds(userId, blockerIds) {
    if (!userId) return;
    localStorage.setItem(getStorageKey(userId), JSON.stringify(Array.from(new Set(blockerIds))));
}

export default function Blockers() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [blockers, setBlockers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('all');
    const [searchTerm, setSearchTerm] = useState('');
    const [activeProjectPlatform, setActiveProjectPlatform] = useState(null);
    const [projectPlatformNotice, setProjectPlatformNotice] = useState('');
    const [hiddenBlockerIds, setHiddenBlockerIds] = useState([]);
    const [editingBlocker, setEditingBlocker] = useState(null);
    const [assigningBlocker, setAssigningBlocker] = useState(null);
    const [notice, setNotice] = useState('');

    useEffect(() => {
        if (user?.id) {
            fetchDismissedIds();
        }
    }, [user?.id]);

    const fetchDismissedIds = async () => {
        try {
            const ids = await api.listDismissedBlockers();
            setHiddenBlockerIds(ids || []);
        } catch (err) {
            console.error('Failed to fetch dismissed ids:', err);
        }
    };

    useEffect(() => {
        if (user) {
            fetchBlockers();
        }
    }, [user]);

    const visibleBlockers = useMemo(
        () => blockers.filter((blocker) => !hiddenBlockerIds.includes(blocker.id)),
        [blockers, hiddenBlockerIds]
    );

    const getActiveProjectPlatforms = async () => {
        const statuses = await Promise.all(
            PROJECT_PLATFORM_PRIORITY.map(async (platform) => ({
                platform,
                status: await api.getIntegrationStatus(platform).catch(() => ({ connected: false }))
            }))
        );
        return statuses.filter((entry) => entry.status?.connected).map((entry) => entry.platform);
    };

    const fetchBlockers = async () => {
        try {
            setLoading(true);
            const connectedPlatforms = await getActiveProjectPlatforms();
            setActiveProjectPlatform(connectedPlatforms.length > 0 ? connectedPlatforms[0] : null);

            const projectDeadlinePromises = connectedPlatforms.map(platform => {
                const fetcher = PROJECT_PLATFORM_DEADLINE_FETCHERS[platform];
                return fetcher ? fetcher().then(res => ({platform, data: res})).catch(() => ({platform, data: createEmptyAsanaDeadlines()})) : Promise.resolve({platform, data: createEmptyAsanaDeadlines()});
            });

            const [summariesRes, deadlinesList, githubData, calendarData] = await Promise.all([
                fetch(`${API_URL}/api/summaries?userId=${user.id}`).then((response) => response.json()).catch(() => []),
                Promise.all(projectDeadlinePromises),
                api.getGithubPulls({ staleDays: GITHUB_STALE_DAYS, limit: 25 }).catch(() => createEmptyGithubPulls()),
                api.getGoogleCalendarActionItems(CALENDAR_BLOCKER_WINDOW_DAYS).catch(() => createEmptyCalendarSignals())
            ]);

            const summaries = Array.isArray(summariesRes) ? summariesRes : [];
            const normalizedGithub = githubData?.error ? createEmptyGithubPulls() : (githubData || createEmptyGithubPulls());
            const normalizedCalendar = (calendarData?.error || calendarData?.needsReauth) ? createEmptyCalendarSignals() : (calendarData || createEmptyCalendarSignals());

            let projectBlockers = [];
            for (const {platform, data} of deadlinesList) {
                const normalizedDeadlines = data?.error ? createEmptyAsanaDeadlines() : (data || createEmptyAsanaDeadlines());
                projectBlockers = projectBlockers.concat(extractProjectPlatformBlockers(normalizedDeadlines, platform));
            }

            const extracted = mergeBlockers(
                extractSlackBlockers(summaries),
                projectBlockers,
                extractGithubBlockers(normalizedGithub, GITHUB_STALE_DAYS),
                extractCalendarBlockers(normalizedCalendar)
            );

            setBlockers(sortBlockers(extracted));
            if (connectedPlatforms.length > 0) {
                setProjectPlatformNotice(`${connectedPlatforms.map(p => PROJECT_PLATFORM_LABELS[p]).join(' and ')} active.`);
            } else {
                setProjectPlatformNotice('');
            }
        } catch (error) {
            console.error('Failed to fetch blockers:', error);
            setBlockers([]);
        } finally {
            setLoading(false);
        }
    };

    async function hideBlocker(blockerId, nextNotice = '') {
        try {
            // Optimistic update
            const nextHidden = [...hiddenBlockerIds, blockerId];
            setHiddenBlockerIds(nextHidden);
            
            // Persistent update
            await api.dismissBlocker(blockerId);
            
            if (nextNotice) {
                setNotice(nextNotice);
            }
        } catch (err) {
            console.error('Failed to dismiss blocker:', err);
            // Rollback on error
            setHiddenBlockerIds(prev => prev.filter(id => id !== blockerId));
            setNotice('Failed to dismiss blocker. Please try again.');
        }
    }

    async function handleAssignToAgent(blocker) {
        setAssigningBlocker(blocker.id);
        setNotice('');

        try {
            console.log('handleAssignToAgent called with blocker:', blocker);
            
            // Validate blocker has required fields
            if (!blocker.id || !blocker.title) {
                throw new Error('Blocker missing required fields (id or title)');
            }

            // Call the helper function
            const result = await assignBlockerToAgent(blocker.id, user.id, blocker);
            
            // Hide blocker from list
            hideBlocker(blocker.id, `${blocker.title} assigned to AI agent. Opening AgentChat...`);
            setEditingBlocker(null);

            // Navigate to AgentChat with the conversation
            if (result.conversationId) {
                setTimeout(() => {
                    navigate(`/app/chat?conversation=${result.conversationId}`);
                }, 1000);
            }
        } catch (error) {
            console.error('Failed to assign blocker:', error);
            setNotice(`Failed to assign blocker to agent: ${error.message}`);
        } finally {
            setAssigningBlocker(null);
        }
    }

    async function handleResolveBlocker(blocker) {
        if (blocker.sourceType !== 'slack') return;

        setAssigningBlocker(blocker.id);
        setNotice('');

        try {
            const response = await fetch(`${API_URL}/api/blockers/resolve`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    summaryId: blocker.summaryId,
                    blockIndex: blocker.blockIndex,
                    userId: user.id,
                    resolvedAt: new Date().toISOString()
                })
            });

            if (!response.ok) {
                throw new Error('Failed to save resolution');
            }

            hideBlocker(blocker.id, `${blocker.title} marked as resolved.`);
            setEditingBlocker(null);
        } catch (error) {
            console.error('Failed to resolve blocker:', error);
            setNotice('Failed to resolve blocker. Please try again.');
        } finally {
            setAssigningBlocker(null);
        }
    }

    const filteredBlockers = visibleBlockers.filter((blocker) => {
        const matchesFilter = filter === 'all' || blocker.status === filter;
        const loweredSearch = searchTerm.toLowerCase();
        const matchesSearch = blocker.title.toLowerCase().includes(loweredSearch) ||
            blocker.source.toLowerCase().includes(loweredSearch) ||
            blocker.description.toLowerCase().includes(loweredSearch);
        return matchesFilter && matchesSearch;
    });

    const activeCount = visibleBlockers.filter((blocker) => blocker.status === 'active').length;
    const resolvedCount = visibleBlockers.filter((blocker) => blocker.status === 'resolved').length;

    const allCount = visibleBlockers.length;

    return (
        <div className="min-h-screen bg-black text-white selection:bg-red-500/30">
            {/* Background elements */}
            <div className="relative mx-auto max-w-7xl px-4 pb-20 pt-4 md:px-8 md:pt-8">
                {/* Header */}
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-8 mb-10 md:mb-16 animate-in fade-in slide-in-from-bottom-4 duration-700">
                    <div>
                        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-[10px] font-bold uppercase tracking-widest text-gray-400">
                            <Sparkles size={12} />
                            AI Detected
                        </div>
                        <h1 className="text-4xl font-bold text-white tracking-tight md:text-6xl uppercase">Blockers</h1>
                        <p className="mt-4 max-w-2xl text-base leading-relaxed text-gray-500 font-medium">
                            We have identified critical issues across all connected tools. Review and take action.
                        </p>
                    </div>

                    <div className="flex items-center gap-4">
                        <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/5 flex flex-col items-center min-w-[120px]">
                            <span className="text-[10px] font-bold text-gray-700 uppercase tracking-widest mb-2">Active</span>
                            <span className="text-3xl font-bold text-white">{activeCount}</span>
                        </div>
                        <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/5 flex flex-col items-center min-w-[120px]">
                            <span className="text-[10px] font-bold text-gray-700 uppercase tracking-widest mb-2">Resolved</span>
                            <span className="text-3xl font-bold text-white">{resolvedCount}</span>
                        </div>
                    </div>
                </div>

                {projectPlatformNotice && (
                    <div className="mb-10 rounded-2xl border border-white/10 bg-white/5 px-8 py-6 text-[11px] font-bold uppercase tracking-widest text-white animate-in fade-in flex items-center gap-4">
                        <div className="w-1.5 h-1.5 bg-white rounded-full"></div>
                        {projectPlatformNotice}
                    </div>
                )}

                {notice && (
                    <div className="mb-10 rounded-2xl border border-white/10 bg-green-500/10 px-8 py-6 text-[11px] font-bold uppercase tracking-widest text-green-300 animate-in fade-in flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="w-1.5 h-1.5 bg-green-300 rounded-full"></div>
                            {notice}
                        </div>
                        <button
                            onClick={() => setNotice('')}
                            className="hover:opacity-75 transition-opacity"
                        >
                            <X size={14} />
                        </button>
                    </div>
                )}

                {/* Filters and Controls */}
                <div className="rounded-3xl border border-white/5 bg-white/[0.02] p-8 mb-12 animate-in fade-in duration-700">
                    <div className="flex flex-col lg:flex-row gap-8 items-start lg:items-center justify-between">
                        <div className="flex flex-wrap gap-2">
                            <FilterButton 
                                active={filter === 'all'} 
                                onClick={() => setFilter('all')}
                                count={allCount}
                                label="All"
                                accent="white"
                            />
                            <FilterButton 
                                active={filter === 'active'} 
                                onClick={() => setFilter('active')}
                                count={activeCount}
                                label="Active"
                                accent="white"
                            />
                            <FilterButton 
                                active={filter === 'resolved'} 
                                onClick={() => setFilter('resolved')}
                                count={resolvedCount}
                                label="Resolved"
                                accent="white"
                            />
                        </div>

                        <div className="relative w-full lg:max-w-md">
                            <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-700" />
                            <input
                                type="text"
                                placeholder="Search blockers..."
                                value={searchTerm}
                                onChange={(event) => setSearchTerm(event.target.value)}
                                className="w-full pl-12 pr-6 py-4 bg-white/[0.01] border border-white/5 rounded-2xl text-[11px] font-bold uppercase tracking-widest text-white outline-none focus:bg-white/[0.03] focus:border-white/10 transition-all placeholder:text-gray-800"
                            />
                        </div>
                    </div>
                </div>

                {loading ? (
                    <div className="p-24 text-center">
                        <div className="w-10 h-10 border-4 border-white/5 border-t-white rounded-full animate-spin mx-auto mb-8" />
                        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-800">Loading blockers...</p>
                    </div>
                ) : filteredBlockers.length === 0 ? (
                    <div className="rounded-3xl border border-dashed border-white/10 p-24 text-center">
                        <h3 className="text-3xl font-bold text-white uppercase tracking-tight mb-4">
                            All Clear
                        </h3>
                        <p className="text-gray-700 font-bold uppercase tracking-widest text-xs max-w-md mx-auto leading-relaxed">
                            {filter === 'all' && searchTerm === ''
                                ? 'No blockers detected at the moment.'
                                : 'No blockers match your search.'}
                        </p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 gap-6 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-200">
                        {filteredBlockers.map((blocker) => (
                            <BlockerCard
                                key={blocker.id}
                                blocker={blocker}
                                onResolve={handleResolveBlocker}
                                onAssignToAgent={handleAssignToAgent}
                                isAssigning={assigningBlocker === blocker.id}
                                isEditing={editingBlocker?.id === blocker.id}
                                onEdit={() => setEditingBlocker(blocker)}
                                onEditClose={() => setEditingBlocker(null)}
                                onDismiss={() => hideBlocker(blocker.id, `${blocker.title} dismissed.`)}
                            />
                        ))}
                    </div>
                )}
            </div>

            {editingBlocker && (
                <BlockerActionModal
                    blocker={editingBlocker}
                    onClose={() => setEditingBlocker(null)}
                    onAssign={() => handleAssignToAgent(editingBlocker)}
                    onResolve={() => handleResolveBlocker(editingBlocker)}
                    isLoading={assigningBlocker === editingBlocker.id}
                />
            )}
        </div>
    );
}
function FilterButton({ active, onClick, count, label }) {
    return (
        <button
            onClick={onClick}
            className={`px-6 py-3 rounded-xl text-[11px] font-bold uppercase tracking-widest transition-all border ${active 
                ? 'bg-white text-black border-white' 
                : 'bg-transparent border-white/10 text-gray-500 hover:text-white hover:border-white/20'}`}
        >
            {label} ({count})
        </button>
    );
}

function SourceChip({ active, onClick, icon: Icon, label, count }) {
    return (
        <button
            onClick={onClick}
            className={`px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all border flex items-center gap-3 ${active 
                ? 'bg-white text-black border-white' 
                : 'bg-transparent border-white/5 text-gray-700 hover:text-white hover:border-white/10'}`}
        >
            {Icon && <Icon size={14} />}
            {label} {count !== undefined && `(${count})`}
        </button>
    );
}

function BlockerCard({ blocker, onResolve, onAssignToAgent, isAssigning, isEditing, onEdit, onEditClose, onDismiss }) {
    const priorityMeta = {
        high: { label: 'High Priority', icon: ShieldAlert, color: 'text-red-400' },
        medium: { label: 'Medium Priority', icon: AlertTriangle, color: 'text-yellow-400' },
        low: { label: 'Low Priority', icon: Clock, color: 'text-blue-400' }
    };

    const sourceMeta = SOURCE_META[blocker.sourceType] || SOURCE_META.slack;
    const SourceIcon = sourceMeta.icon;
    const priority = priorityMeta[blocker.priority] || priorityMeta.medium;
    const PriorityIcon = priority.icon;

    return (
        <div className="bg-white/[0.02] rounded-3xl border border-white/5 p-8 transition-all hover:bg-white/[0.03]">
            <div className="flex flex-col lg:flex-row items-start justify-between gap-8">
                <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-3 mb-6">
                        <div className="flex items-center gap-2 px-3 py-1 bg-white/5 border border-white/10 rounded-lg">
                           <div className={`w-1 h-1 rounded-full ${blocker.status === 'resolved' ? 'bg-white' : 'bg-gray-600'}`}></div>
                           <span className="text-[9px] font-bold uppercase tracking-widest text-white">{blocker.status === 'active' ? 'Active' : 'Resolved'}</span>
                        </div>
                        
                        <div className="flex items-center gap-2 px-3 py-1 bg-white/5 border border-white/10 rounded-lg">
                           <PriorityIcon size={12} className={priority.color} />
                           <span className="text-[9px] font-bold uppercase tracking-widest text-gray-400">{priority.label}</span>
                        </div>

                        <div className="flex items-center gap-2 px-3 py-1 bg-white/5 border border-white/10 rounded-lg">
                           <SourceIcon size={12} className="text-gray-500" />
                           <span className="text-[9px] font-bold uppercase tracking-widest text-gray-400">{sourceMeta.label}</span>
                        </div>
                    </div>

                    <h3 className="text-2xl font-bold text-white uppercase tracking-tight mb-4">
                        {blocker.title}
                    </h3>
                    
                    <p className="text-gray-500 text-sm font-medium leading-relaxed mb-8 max-w-4xl">
                        {blocker.description}
                    </p>

                    <div className="flex flex-wrap gap-8 pt-6 border-t border-white/5">
                        <div className="flex flex-col gap-1">
                            <span className="text-[9px] font-bold text-gray-800 uppercase tracking-widest">Found in</span>
                            <span className="text-xs font-bold text-gray-600 italic">
                                {blocker.source}
                            </span>
                        </div>
                        <div className="flex flex-col gap-1">
                             <span className="text-[9px] font-bold text-gray-800 uppercase tracking-widest">Found at</span>
                             <span className="text-xs font-bold text-gray-600">
                                {formatDateTime(blocker.createdAt).toUpperCase()}
                             </span>
                        </div>
                        {blocker.status === 'resolved' && blocker.resolvedAt && (
                            <div className="flex flex-col gap-1">
                                <span className="text-[9px] font-bold text-gray-800 uppercase tracking-widest">Resolved at</span>
                                <span className="text-xs font-bold text-white">
                                    {formatDateTime(blocker.resolvedAt).toUpperCase()}
                                </span>
                            </div>
                        )}
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                    {blocker.status === 'active' && (
                        <>
                            {blocker.sourceType === 'slack' && (
                                <button
                                    onClick={() => onResolve(blocker)}
                                    disabled={isAssigning}
                                    title="Mark as resolved"
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white/5 border border-white/10 text-green-400 text-[9px] font-bold uppercase tracking-widest rounded-lg hover:bg-green-500/15 hover:border-green-500/30 transition-all active:scale-95 disabled:opacity-40"
                                >
                                    <CheckCircle size={12} />
                                    {isAssigning ? '...' : 'Resolve'}
                                </button>
                            )}
                            
                            <button
                                onClick={() => onAssignToAgent(blocker)}
                                disabled={isAssigning}
                                title="Assign to AI agent"
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white text-black text-[9px] font-bold uppercase tracking-widest rounded-lg hover:bg-gray-200 transition-all active:scale-95 disabled:opacity-40"
                            >
                                <Zap size={12} />
                                {isAssigning ? '...' : 'Agent'}
                            </button>

                            {blocker.externalUrl && (
                                <a
                                    href={blocker.externalUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    title="View source"
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white/5 border border-white/10 text-gray-400 text-[9px] font-bold uppercase tracking-widest rounded-lg hover:bg-white/10 hover:text-white transition-all"
                                >
                                    <ExternalLink size={12} />
                                    Source
                                </a>
                            )}

                            <button
                                onClick={onDismiss}
                                title="Dismiss blocker"
                                className="inline-flex items-center justify-center p-1.5 bg-white/5 border border-white/10 text-gray-600 rounded-lg hover:bg-red-500/15 hover:border-red-500/30 hover:text-red-400 transition-all"
                            >
                                <CircleSlash size={12} />
                            </button>
                        </>
                    )}
                    
                    {blocker.status === 'resolved' && (
                        <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white/5 border border-white/10 text-gray-500 text-[9px] font-bold uppercase tracking-widest rounded-lg">
                            <CheckCircle size={12} />
                            Resolved
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

function BlockerActionModal({ blocker, onClose, onAssign, onResolve, isLoading }) {
    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
            onClick={onClose}
        >
            <div
                className="max-w-2xl w-full rounded-3xl border border-white/10 bg-black/95 p-8 shadow-2xl animate-in fade-in zoom-in-95 duration-300"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-start justify-between mb-6">
                    <h2 className="text-2xl font-bold text-white uppercase tracking-tight">
                        Take Action
                    </h2>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                <div className="mb-8">
                    <p className="text-gray-400 text-sm leading-relaxed mb-4">
                        {blocker.description}
                    </p>
                    <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                        <p className="text-gray-300 text-xs">
                            <span className="font-bold text-white">From:</span> {blocker.source}
                        </p>
                    </div>
                </div>

                <div className="flex flex-col gap-3">
                    {blocker.sourceType === 'slack' && (
                        <button
                            onClick={() => onResolve(blocker)}
                            disabled={isLoading}
                            className="w-full px-6 py-4 bg-green-500 text-black text-[11px] font-bold uppercase tracking-widest rounded-xl hover:bg-green-400 disabled:opacity-50 transition-all"
                        >
                            {isLoading ? 'Marking as Resolved...' : 'Mark as Resolved'}
                        </button>
                    )}
                    <button
                        onClick={() => onAssign(blocker)}
                        disabled={isLoading}
                        className="w-full px-6 py-4 bg-blue-500 text-white text-[11px] font-bold uppercase tracking-widest rounded-xl hover:bg-blue-400 disabled:opacity-50 transition-all"
                    >
                        {isLoading ? 'Assigning to Agent...' : 'Assign to AI Agent'}
                    </button>
                    <button
                        onClick={onClose}
                        className="w-full px-6 py-4 bg-white/5 border border-white/10 text-white text-[11px] font-bold uppercase tracking-widest rounded-xl hover:bg-white/10 transition-all"
                    >
                        Cancel
                    </button>
                </div>
            </div>
        </div>
    );
}

function formatDateTime(isoString) {
    const date = new Date(isoString);
    if (Number.isNaN(date.getTime())) return 'UNKNOWN';
    const formattedDate = date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
    const formattedTime = date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
    });
    return `${formattedDate} @ ${formattedTime}`;
}

function sortBlockers(list) {
    const priorityOrder = { high: 3, medium: 2, low: 1 };
    return [...(Array.isArray(list) ? list : [])].sort((left, right) => {
        if (left.status !== right.status) {
            return left.status === 'active' ? -1 : 1;
        }

        const leftPriority = priorityOrder[left.priority] || 0;
        const rightPriority = priorityOrder[right.priority] || 0;
        if (leftPriority !== rightPriority) {
            return rightPriority - leftPriority;
        }

        const leftTime = new Date(left.createdAt).getTime();
        const rightTime = new Date(right.createdAt).getTime();
        return rightTime - leftTime;
    });
}

