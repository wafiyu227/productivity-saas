import {
    AlertTriangle,
    Calendar,
    CheckCircle,
    Clock,
    ExternalLink,
    Github,
    MessageSquare,
    Search,
    Target
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../api/client';
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
const PROJECT_PLATFORM_PRIORITY = ['jira', 'asana', 'trello'];
const PROJECT_PLATFORM_LABELS = {
    jira: 'Jira',
    asana: 'Asana',
    trello: 'Trello'
};
const PROJECT_PLATFORM_DEADLINE_FETCHERS = {
    jira: (teamId) => api.getJiraDeadlines(teamId),
    asana: (teamId) => api.getAsanaDeadlines(teamId),
    trello: (teamId) => api.getTrelloDeadlines(teamId)
};

const SOURCE_META = {
    slack: {
        label: 'Slack',
        icon: MessageSquare,
        chipClass: 'bg-purple-100 text-purple-700',
        activeClass: 'bg-purple-600 text-white',
        buttonClass: 'bg-blue-600 hover:bg-blue-700',
        openLabel: 'Open Source'
    },
    asana: {
        label: 'Asana',
        icon: Target,
        chipClass: 'bg-orange-100 text-orange-700',
        activeClass: 'bg-orange-600 text-white',
        buttonClass: 'bg-orange-600 hover:bg-orange-700',
        openLabel: 'Open Task'
    },
    jira: {
        label: 'Jira',
        icon: Target,
        chipClass: 'bg-blue-100 text-blue-700',
        activeClass: 'bg-blue-600 text-white',
        buttonClass: 'bg-blue-600 hover:bg-blue-700',
        openLabel: 'Open Issue'
    },
    trello: {
        label: 'Trello',
        icon: Target,
        chipClass: 'bg-sky-100 text-sky-700',
        activeClass: 'bg-sky-600 text-white',
        buttonClass: 'bg-sky-600 hover:bg-sky-700',
        openLabel: 'Open Card'
    },
    github: {
        label: 'GitHub',
        icon: Github,
        chipClass: 'bg-slate-100 text-slate-700',
        activeClass: 'bg-slate-700 text-white',
        buttonClass: 'bg-slate-700 hover:bg-slate-800',
        openLabel: 'Open PR'
    },
    calendar: {
        label: 'Calendar',
        icon: Calendar,
        chipClass: 'bg-blue-100 text-blue-700',
        activeClass: 'bg-blue-600 text-white',
        buttonClass: 'bg-blue-600 hover:bg-blue-700',
        openLabel: 'Open Event'
    }
};

export default function Blockers() {
    const { user, profile } = useAuth();
    const [blockers, setBlockers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('all');
    const [sourceFilter, setSourceFilter] = useState('all');
    const [searchTerm, setSearchTerm] = useState('');
    const [resolving, setResolving] = useState(null);
    const [activeProjectPlatform, setActiveProjectPlatform] = useState(null);
    const [projectPlatformNotice, setProjectPlatformNotice] = useState('');
    const currentMembership = profile?.teams?.find((membership) => membership.team_id === profile?.current_team_id);
    const canManageBlockers = !profile?.current_team_id || ['owner', 'admin'].includes(currentMembership?.role);

    useEffect(() => {
        if (user && profile) {
            fetchBlockers();
        }
    }, [user, profile?.current_team_id]);

    const getActiveProjectPlatform = async (teamId) => {
        const statuses = await Promise.all(
            PROJECT_PLATFORM_PRIORITY.map(async (platform) => ({
                platform,
                status: await api.getIntegrationStatus(platform, teamId)
            }))
        );

        const connected = statuses
            .filter((entry) => entry.status?.connected)
            .map((entry) => entry.platform);

        return connected.length > 0 ? connected[0] : null;
    };

    const fetchBlockers = async () => {
        try {
            setLoading(true);
            const teamId = profile?.current_team_id;
            const connectedProjectPlatform = await getActiveProjectPlatform(teamId);
            setActiveProjectPlatform(connectedProjectPlatform);

            const projectDeadlineFetcher = PROJECT_PLATFORM_DEADLINE_FETCHERS[connectedProjectPlatform];
            const projectDeadlinePromise = projectDeadlineFetcher
                ? projectDeadlineFetcher(teamId).catch(() => createEmptyAsanaDeadlines())
                : Promise.resolve(createEmptyAsanaDeadlines());

            const [summariesRes, projectDeadlineData, githubData, calendarData] = await Promise.all([
                fetch(`${API_URL}/api/summaries?userId=${user.id}${teamId ? `&teamId=${teamId}` : ''}`)
                    .then((response) => response.json())
                    .catch(() => []),
                projectDeadlinePromise,
                api.getGithubPulls(teamId, { staleDays: GITHUB_STALE_DAYS, limit: 25 }).catch(() => createEmptyGithubPulls()),
                api.getGoogleCalendarActionItems(teamId, CALENDAR_BLOCKER_WINDOW_DAYS).catch(() => createEmptyCalendarSignals())
            ]);

            const summaries = Array.isArray(summariesRes) ? summariesRes : [];
            const normalizedProjectDeadlines = projectDeadlineData?.error ? createEmptyAsanaDeadlines() : (projectDeadlineData || createEmptyAsanaDeadlines());
            const normalizedGithub = githubData?.error ? createEmptyGithubPulls() : (githubData || createEmptyGithubPulls());
            const normalizedCalendar = (calendarData?.error || calendarData?.needsReauth)
                ? createEmptyCalendarSignals()
                : (calendarData || createEmptyCalendarSignals());

            const extracted = mergeBlockers(
                extractSlackBlockers(summaries),
                projectDeadlineFetcher ? extractProjectPlatformBlockers(normalizedProjectDeadlines, connectedProjectPlatform) : [],
                extractGithubBlockers(normalizedGithub, GITHUB_STALE_DAYS),
                extractCalendarBlockers(normalizedCalendar)
            );

            setBlockers(sortBlockers(extracted));
            if (connectedProjectPlatform && !projectDeadlineFetcher) {
                setProjectPlatformNotice(`${PROJECT_PLATFORM_LABELS[connectedProjectPlatform]} is connected as your project platform. Blockers extraction for this platform will appear after its endpoint rollout.`);
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

    const resolveBlocker = async (blockerId) => {
        if (!canManageBlockers) return;
        const blocker = blockers.find((item) => item.id === blockerId);
        if (!blocker || blocker.sourceType !== 'slack') return;

        setResolving(blockerId);

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

            setBlockers((previous) => sortBlockers(
                previous.map((entry) => (
                    entry.id === blockerId
                        ? { ...entry, status: 'resolved', resolvedAt: new Date().toISOString(), priority: 'low' }
                        : entry
                ))
            ));
        } catch (error) {
            console.error('Failed to resolve blocker:', error);
            alert('Failed to resolve blocker. Please try again.');
        } finally {
            setResolving(null);
        }
    };

    const filteredBlockers = blockers.filter((blocker) => {
        const matchesFilter = filter === 'all' || blocker.status === filter;
        const matchesSource = sourceFilter === 'all' || blocker.sourceType === sourceFilter;
        const loweredSearch = searchTerm.toLowerCase();
        const matchesSearch = blocker.title.toLowerCase().includes(loweredSearch) ||
            blocker.source.toLowerCase().includes(loweredSearch) ||
            blocker.description.toLowerCase().includes(loweredSearch);
        return matchesFilter && matchesSource && matchesSearch;
    });

    const activeCount = blockers.filter((blocker) => blocker.status === 'active').length;
    const resolvedCount = blockers.filter((blocker) => blocker.status === 'resolved').length;
    const sourceCounts = useMemo(() => blockers.reduce((acc, blocker) => {
        acc[blocker.sourceType] = (acc[blocker.sourceType] || 0) + 1;
        return acc;
    }, {}), [blockers]);

    const allCountForCurrentSource = sourceFilter === 'all'
        ? blockers.length
        : (sourceCounts[sourceFilter] || 0);

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 to-red-50">
            <div className="p-4 md:p-8">
                <div className="max-w-6xl mx-auto">
                    <div className="mb-6 md:mb-8">
                        <h1 className="text-2xl md:text-4xl font-bold text-gray-900 mb-2">
                            Team Blockers
                        </h1>
                        <p className="text-base md:text-lg text-gray-600">
                            Track and resolve blockers across Slack, project platforms, GitHub, and Calendar
                        </p>
                        {activeProjectPlatform && (
                            <p className="mt-2 text-sm text-gray-600">
                                Active project platform: <span className="font-semibold">{PROJECT_PLATFORM_LABELS[activeProjectPlatform]}</span>
                            </p>
                        )}
                        {projectPlatformNotice && (
                            <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">
                                {projectPlatformNotice}
                            </div>
                        )}
                        {!canManageBlockers && (
                            <p className="mt-3 text-sm text-gray-600">
                                Resolution controls are read-only for members.
                            </p>
                        )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 md:gap-6 mb-6 md:mb-8">
                        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-gray-600 mb-1">Active Blockers</p>
                                    <p className="text-3xl font-bold text-red-600">{activeCount}</p>
                                </div>
                                <div className="p-3 bg-red-50 rounded-xl">
                                    <AlertTriangle className="text-red-600" size={24} />
                                </div>
                            </div>
                        </div>

                        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-gray-600 mb-1">Resolved Blockers</p>
                                    <p className="text-3xl font-bold text-green-600">{resolvedCount}</p>
                                </div>
                                <div className="p-3 bg-green-50 rounded-xl">
                                    <CheckCircle className="text-green-600" size={24} />
                                </div>
                            </div>
                        </div>

                        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-gray-600 mb-1">Resolution Rate</p>
                                    <p className="text-3xl font-bold text-blue-600">
                                        {blockers.length > 0 ? Math.round((resolvedCount / blockers.length) * 100) : 0}%
                                    </p>
                                </div>
                                <div className="p-3 bg-blue-50 rounded-xl">
                                    <Clock className="text-blue-600" size={24} />
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
                        <div className="flex flex-col md:flex-row gap-4 items-stretch md:items-center justify-between mb-4">
                            <div className="flex flex-wrap gap-2">
                                <button
                                    onClick={() => setFilter('all')}
                                    className={`px-4 py-2 rounded-lg font-medium transition-all ${filter === 'all'
                                        ? 'bg-blue-600 text-white'
                                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                        }`}
                                >
                                    All ({allCountForCurrentSource})
                                </button>
                                <button
                                    onClick={() => setFilter('active')}
                                    className={`px-4 py-2 rounded-lg font-medium transition-all ${filter === 'active'
                                        ? 'bg-red-600 text-white'
                                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                        }`}
                                >
                                    Active ({activeCount})
                                </button>
                                <button
                                    onClick={() => setFilter('resolved')}
                                    className={`px-4 py-2 rounded-lg font-medium transition-all ${filter === 'resolved'
                                        ? 'bg-green-600 text-white'
                                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                        }`}
                                >
                                    Resolved ({resolvedCount})
                                </button>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                <button
                                    onClick={() => setSourceFilter('all')}
                                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${sourceFilter === 'all'
                                        ? 'bg-gray-800 text-white'
                                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                        }`}
                                >
                                    All Sources
                                </button>
                                {Object.entries(SOURCE_META).map(([sourceKey, meta]) => {
                                    const SourceIcon = meta.icon;
                                    return (
                                        <button
                                            key={sourceKey}
                                            onClick={() => setSourceFilter(sourceKey)}
                                            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-1.5 ${sourceFilter === sourceKey
                                                ? meta.activeClass
                                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                                }`}
                                        >
                                            <SourceIcon size={14} />
                                            {meta.label} ({sourceCounts[sourceKey] || 0})
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        <div className="relative">
                            <Search size={20} className="absolute left-3 top-3 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Search blockers by title, source, or description..."
                                value={searchTerm}
                                onChange={(event) => setSearchTerm(event.target.value)}
                                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>
                    </div>

                    {loading ? (
                        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center">
                            <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4" />
                            <p className="text-gray-600">Loading blockers...</p>
                        </div>
                    ) : filteredBlockers.length === 0 ? (
                        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center">
                            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                <CheckCircle className="text-green-600" size={40} />
                            </div>
                            <h3 className="text-2xl font-bold text-gray-900 mb-2">
                                No blockers found
                            </h3>
                            <p className="text-gray-600">
                                {filter === 'all' && searchTerm === ''
                                    ? 'Connect integrations and generate data to surface blockers.'
                                    : 'No matching blockers found for your filters.'}
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {filteredBlockers.map((blocker) => (
                                <BlockerCard
                                    key={blocker.id}
                                    blocker={blocker}
                                    onResolve={resolveBlocker}
                                    isResolving={resolving === blocker.id}
                                    canResolve={canManageBlockers}
                                />
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

function BlockerCard({ blocker, onResolve, isResolving, canResolve }) {
    const priorityColors = {
        high: 'border-red-500 bg-red-50',
        medium: 'border-yellow-500 bg-yellow-50',
        low: 'border-blue-500 bg-blue-50'
    };

    const statusColors = {
        active: 'bg-red-100 text-red-700',
        resolved: 'bg-green-100 text-green-700'
    };

    const sourceMeta = SOURCE_META[blocker.sourceType] || SOURCE_META.slack;
    const SourceIcon = sourceMeta.icon;

    return (
        <div className={`bg-white rounded-2xl shadow-sm border-l-4 p-4 md:p-6 hover:shadow-md transition-shadow ${priorityColors[blocker.priority] || priorityColors.medium}`}>
            <div className="flex flex-col sm:flex-row items-start justify-between gap-3 mb-4">
                <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-2">
                        <h3 className="text-base sm:text-xl font-bold text-gray-900">
                            {blocker.title}
                        </h3>
                        <span className={`px-3 py-1 text-xs font-semibold rounded-full ${statusColors[blocker.status] || statusColors.active}`}>
                            {(blocker.status || 'active').toUpperCase()}
                        </span>
                        <span className="px-3 py-1 bg-gray-100 text-gray-700 text-xs font-semibold rounded-full">
                            {(blocker.priority || 'medium').toUpperCase()}
                        </span>
                    </div>
                    <p className="text-gray-700 mb-4">{blocker.description}</p>
                    <div className="flex flex-col gap-3 text-sm text-gray-600">
                        <div className="flex items-center gap-6">
                            <span className="flex items-center gap-2">
                                <SourceIcon size={16} className="text-gray-700" />
                                <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${sourceMeta.chipClass}`}>
                                    {sourceMeta.label}
                                </span>
                                {blocker.source}
                            </span>
                        </div>
                        <div className="flex flex-col gap-2">
                            <span className="flex items-center gap-2">
                                <Clock size={16} />
                                <span className="font-medium">Created:</span> {formatDateTime(blocker.createdAt)}
                            </span>
                            {blocker.status === 'resolved' && blocker.resolvedAt && (
                                <span className="flex items-center gap-2 text-green-700">
                                    <CheckCircle size={16} />
                                    <span className="font-medium">Resolved:</span> {formatDateTime(blocker.resolvedAt)}
                                </span>
                            )}
                        </div>
                    </div>
                </div>
                {canResolve && blocker.status === 'active' && blocker.sourceType === 'slack' && (
                    <button
                        onClick={() => onResolve(blocker.id)}
                        disabled={isResolving}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                        {isResolving ? (
                            <>
                                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                Resolving...
                            </>
                        ) : (
                            'Resolve'
                        )}
                    </button>
                )}
                {blocker.status === 'active' && blocker.sourceType !== 'slack' && blocker.externalUrl && (
                    <a
                        href={blocker.externalUrl}
                        target="_blank"
                        rel="noreferrer"
                        className={`px-4 py-2 text-white rounded-lg transition whitespace-nowrap flex items-center gap-2 ${sourceMeta.buttonClass}`}
                    >
                        <ExternalLink size={16} />
                        {sourceMeta.openLabel}
                    </a>
                )}
                {blocker.status === 'resolved' && (
                    <div className="px-4 py-2 bg-green-100 text-green-700 rounded-lg font-medium whitespace-nowrap">
                        Resolved
                    </div>
                )}
            </div>
        </div>
    );
}

function formatDateTime(isoString) {
    const date = new Date(isoString);
    if (Number.isNaN(date.getTime())) return 'Unknown';
    const formattedDate = date.toLocaleDateString('en-US', {
        weekday: 'short',
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
    const formattedTime = date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
    });
    return `${formattedDate} at ${formattedTime}`;
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
