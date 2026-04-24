import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Activity,
    AlertCircle,
    ArrowRight,
    Bot,
    Clock,
    MessageSquare,
    RefreshCw,
    Sparkles,
    Target,
    TrendingUp,
    Zap,
    Calendar,
    ChevronRight,
    Signal,
    Users,
    Layers,
    Lightbulb,
    MapPin,
    Sun,
    CloudRain,
    Cloud,
    Moon
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../api/client';
import { prepareMeeting } from '../utils/api-helpers';
import {
    createEmptyCalendarSignals,
    createEmptyGithubPulls,
    extractCalendarBlockers,
    extractGithubBlockers,
    extractProjectPlatformBlockers,
    extractSlackBlockers,
    mergeBlockers
} from '../utils/blockerSignals';

const API_URL = import.meta.env.VITE_API_URL || 'https://api.teamaai.xyz';
const PROJECT_PLATFORM_PRIORITY = ['jira', 'asana'];
const PROJECT_PLATFORM_LABELS = {
    jira: 'Jira',
    asana: 'Asana'
};
const PROJECT_PLATFORM_EXTRACTORS = {
    jira: {
        fetchProjects: () => api.getJiraProjects(),
        fetchDeadlines: () => api.getJiraDeadlines()
    },
    asana: {
        fetchProjects: () => api.getAsanaProjects(),
        fetchDeadlines: () => api.getAsanaDeadlines()
    }
};
const PROMPT_SUGGESTIONS = [
    'What needs attention today?',
    'Summarize Slack activity',
    'Prepare for my next meeting'
];
const DASHBOARD_CACHE_PREFIX = 'teamaai-dashboard-cache-v1-';
const DASHBOARD_CACHE_TTL_MS = 5 * 60 * 1000;

function getDashboardCacheKey(userId) {
    return `${DASHBOARD_CACHE_PREFIX}${userId}`;
}

function loadDashboardCache(userId) {
    try {
        const raw = sessionStorage.getItem(getDashboardCacheKey(userId));
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object') return null;

        const cachedAt = Number(parsed.cachedAt || 0);
        if (!cachedAt || (Date.now() - cachedAt) > DASHBOARD_CACHE_TTL_MS) {
            sessionStorage.removeItem(getDashboardCacheKey(userId));
            return null;
        }

        return parsed.payload || null;
    } catch {
        return null;
    }
}

function saveDashboardCache(userId, payload) {
    try {
        sessionStorage.setItem(
            getDashboardCacheKey(userId),
            JSON.stringify({
                cachedAt: Date.now(),
                payload
            })
        );
    } catch {
        // Ignore storage errors.
    }
}

function buildMeetingKeywords(meeting = {}) {
    return String(meeting?.title || '')
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .map((keyword) => keyword.trim())
        .filter((keyword) => keyword.length >= 3)
        .slice(0, 6);
}

export default function Dashboard() {
    const { user, profile } = useAuth();
    const navigate = useNavigate();
    const [channels, setChannels] = useState([]);
    const [summaries, setSummaries] = useState([]);
    const [workInsightsPreview, setWorkInsightsPreview] = useState([]);
    const [workInsightsMessage, setWorkInsightsMessage] = useState('Load workspace data to fetch the latest insights.');
    const [activities, setActivities] = useState([]);
    const [agentConversations, setAgentConversations] = useState([]);
    const [notice, setNotice] = useState(null);
    const [blockerStats, setBlockerStats] = useState({ active: 0, resolved: 0, total: 0 });
    const [refreshing, setRefreshing] = useState(false);
    const [hasLoadedData, setHasLoadedData] = useState(false);
    const [projectStats, setProjectStats] = useState({
        connected: false,
        platform: null,
        projects: 0,
        atRisk: 0,
        extractorReady: false
    });
    const [projectDeadlineSignals, setProjectDeadlineSignals] = useState(null);
    const [githubSignals, setGithubSignals] = useState(createEmptyGithubPulls());
    const [calendarSignals, setCalendarSignals] = useState(createEmptyCalendarSignals());
    const [preparingMeetingId, setPreparingMeetingId] = useState(null);
    const [dismissedBlockerIds, setDismissedBlockerIds] = useState([]);
    const [personalContext, setPersonalContext] = useState({
        greeting: 'Welcome back.',
        timeString: '',
        location: null,
        weather: null,
        loaded: false
    });

    useEffect(() => {
        if (!user) return;

        const handleNotice = () => {
            const params = new URLSearchParams(window.location.search);
            const success = params.get('success');
            const error = params.get('error');

            if (success === 'slack_connected') {
                setNotice({
                    tone: 'success',
                    message: 'Slack connected successfully.'
                });
                window.history.replaceState({}, '', '/app/dashboard');
            } else if (error) {
                setNotice({
                    tone: 'error',
                    message: `Connection failed: ${error.replace(/_/g, ' ').toUpperCase()}`
                });
                window.history.replaceState({}, '', '/app/dashboard');
            }
        };

        handleNotice();

        const cachedDashboard = loadDashboardCache(user.id);
        if (cachedDashboard && !hasLoadedData) {
            setChannels(Array.isArray(cachedDashboard.channels) ? cachedDashboard.channels : []);
            setSummaries(Array.isArray(cachedDashboard.summaries) ? cachedDashboard.summaries : []);
            setWorkInsightsPreview(Array.isArray(cachedDashboard.workInsightsPreview) ? cachedDashboard.workInsightsPreview : []);
            setWorkInsightsMessage(cachedDashboard.workInsightsMessage || '');
            setBlockerStats(cachedDashboard.blockerStats || { active: 0, resolved: 0, total: 0 });
            setProjectStats(cachedDashboard.projectStats || {
                connected: false,
                platform: null,
                projects: 0,
                atRisk: 0,
                extractorReady: false
            });
            setProjectDeadlineSignals(cachedDashboard.projectDeadlineSignals || null);
            setGithubSignals(cachedDashboard.githubSignals || createEmptyGithubPulls());
            setCalendarSignals(cachedDashboard.calendarSignals || createEmptyCalendarSignals());
            setDismissedBlockerIds(Array.isArray(cachedDashboard.dismissedBlockerIds) ? cachedDashboard.dismissedBlockerIds : []);
            if (cachedDashboard.personalContext) {
                setPersonalContext((prev) => ({
                    ...prev,
                    ...cachedDashboard.personalContext
                }));
            }
            setHasLoadedData(true);
        }

        // Update time every minute
        const timer = setInterval(updateTime, 60000);
        updateTime();

        return () => clearInterval(timer);
    }, [user, profile]);

    useEffect(() => {
        if (!user?.id || !hasLoadedData) return;

        saveDashboardCache(user.id, {
            channels: Array.isArray(channels) ? channels.slice(0, 30) : [],
            summaries: Array.isArray(summaries) ? summaries.slice(0, 20) : [],
            workInsightsPreview: Array.isArray(workInsightsPreview) ? workInsightsPreview.slice(0, 10) : [],
            workInsightsMessage,
            blockerStats,
            projectStats,
            projectDeadlineSignals,
            githubSignals,
            calendarSignals,
            dismissedBlockerIds: Array.isArray(dismissedBlockerIds) ? dismissedBlockerIds : [],
            personalContext
        });
    }, [
        user?.id,
        hasLoadedData,
        channels,
        summaries,
        workInsightsPreview,
        workInsightsMessage,
        blockerStats,
        projectStats,
        projectDeadlineSignals,
        githubSignals,
        calendarSignals,
        dismissedBlockerIds,
        personalContext
    ]);

    const updateTime = () => {
        const now = new Date();
        const hours = now.getHours();
        
        let greeting = 'Welcome back.';
        if (hours < 12) greeting = 'Good morning';
        else if (hours < 17) greeting = 'Good afternoon';
        else greeting = 'Good evening';

        const firstName = profile?.full_name?.split(' ')[0] || user?.email?.split('@')[0] || '';
        const finalGreeting = firstName ? `${greeting}, ${firstName}.` : `${greeting}.`;

        const timeString = now.toLocaleTimeString(undefined, { 
            hour: '2-digit', 
            minute: '2-digit',
            hour12: true 
        }).toUpperCase();

        const dateString = now.toLocaleDateString(undefined, {
            weekday: 'short',
            month: 'short',
            day: 'numeric'
        }).toUpperCase();

        setPersonalContext(prev => ({
            ...prev,
            greeting: finalGreeting,
            timeString: `${dateString} • ${timeString}`
        }));
    };

    const loadPersonalContext = async () => {
        try {
            // Fetch location and weather via our internal backend proxy to avoid CORS/429 errors
            const res = await fetch(`${API_URL}/api/user/personal-context?userId=${user.id}`);
            if (!res.ok) throw new Error('Proxy context fetch failed');
            const data = await res.json();
            
            setPersonalContext(prev => ({
                ...prev,
                location: data.location,
                weather: data.weather,
                loaded: true
            }));
        } catch (err) {
            console.error('Failed to load personal context:', err);
            setPersonalContext(prev => ({ ...prev, loaded: true }));
        }
    };

    const loadAllData = async () => {
        if (!user) return;
        // Load dismissed blockers first to ensure counts are correct
        const dismissed = await api.listDismissedBlockers();
        setDismissedBlockerIds(dismissed || []);

        await Promise.all([
            loadChannels(),
            loadSummaries(),
            loadWorkInsights(),
            loadBlockerStats(dismissed || []),
            loadProjectStats(),
            loadGithubSignals(),
            loadCalendarSignals()
        ]);
    };

    const getActiveProjectPlatforms = async () => {
        const statuses = await Promise.all(
            PROJECT_PLATFORM_PRIORITY.map(async (platform) => ({
                platform,
                status: await api.getIntegrationStatus(platform).catch(() => ({ connected: false }))
            }))
        );

        return statuses
            .filter((entry) => entry.status?.connected)
            .map((entry) => entry.platform);
    };

    const loadChannels = async () => {
        try {
            const data = await api.getChannels();
            setChannels(Array.isArray(data?.channels) ? data.channels : []);
        } catch (err) {
            setChannels([]);
        }
    };

    const loadSummaries = async () => {
        try {
            const data = await api.getSummaries();
            setSummaries(Array.isArray(data) ? data : []);
        } catch (err) {
            setSummaries([]);
        }
    };

    const loadWorkInsights = async () => {
        try {
            const data = await api.getWorkInsights({ limit: 6 });
            const allInsights = Array.isArray(data?.insights) ? data.insights : [];
            
            // Filter dismissed insights like we do on the Insights page
            let hiddenIds = [];
            try {
                const storageKey = `teamaai_work_insights_hidden_${user?.id || 'anon'}_personal`;
                const raw = localStorage.getItem(storageKey);
                hiddenIds = JSON.parse(raw || '[]');
                if (!Array.isArray(hiddenIds)) hiddenIds = [];
            } catch (e) {
                hiddenIds = [];
            }

            const visibleInsights = allInsights.filter(insight => !hiddenIds.includes(insight.id));
            setWorkInsightsPreview(visibleInsights);
            setWorkInsightsMessage(data?.message || '');
        } catch (err) {
            setWorkInsightsPreview([]);
        }
    };

    const loadAgentConversations = async () => {
        // Removed as per request to keep dashboard minimal
    };

    const loadBlockerStats = async (currentDismissed = dismissedBlockerIds) => {
        try {
            const connectedPlatforms = await getActiveProjectPlatforms();
            const deadlinePromises = connectedPlatforms.map(platform => {
                const extractor = PROJECT_PLATFORM_EXTRACTORS[platform];
                return extractor ? extractor.fetchDeadlines().catch(() => ({ overdue: { count: 0 }, dueToday: { count: 0 } })) : Promise.resolve({ overdue: { count: 0 }, dueToday: { count: 0 } });
            });

            const [slackRes, ...platformsDeadlinesList] = await Promise.all([
                fetch(`${API_URL}/api/blockers?userId=${user.id}`).then((res) => res.json()).catch(() => []),
                ...deadlinePromises
            ]);

            const summariesWithBlockers = Array.isArray(slackRes) ? slackRes : [];
            let activeCount = 0;
            let resolvedCount = 0;
            let totalCount = 0;

            summariesWithBlockers.forEach((summary) => {
                if (!Array.isArray(summary.blockers)) return;
                summary.blockers.forEach((blocker, index) => {
                    if (!blocker) return;

                    const blockerId = `slack-${summary.id}-${index}`;
                    if (currentDismissed.includes(blockerId)) return;

                    totalCount += 1;
                    const status = summary.blocker_status?.[index]?.status || 'active';
                    if (status === 'active') activeCount += 1;
                    if (status === 'resolved') resolvedCount += 1;
                });
            });

            let projectPlatformActive = 0;
            platformsDeadlinesList.forEach(deadlines => {
                projectPlatformActive += (deadlines?.overdue?.count || 0) + (deadlines?.dueToday?.count || 0);
            });
            activeCount += projectPlatformActive;
            totalCount += projectPlatformActive;
            setBlockerStats({ active: activeCount, resolved: resolvedCount, total: totalCount });
        } catch (err) {
            console.error('Blocker stats error:', err);
        }
    };

    const loadProjectStats = async () => {
        try {
            const connectedPlatforms = await getActiveProjectPlatforms();
            if (connectedPlatforms.length === 0) {
                setProjectStats({ connected: false, platform: null, projects: 0, atRisk: 0, extractorReady: false });
                return;
            }

            let totalProjects = 0;
            let totalAtRisk = 0;
            const mergedDeadlinesList = [];

            await Promise.all(connectedPlatforms.map(async (platform) => {
                const extractor = PROJECT_PLATFORM_EXTRACTORS[platform];
                const [projectsData, deadlinesData] = await Promise.all([
                    extractor.fetchProjects().catch(() => ({ projects: [] })),
                    extractor.fetchDeadlines().catch(() => ({ totalAtRisk: 0 }))
                ]);
                totalProjects += projectsData.projects?.length || 0;
                totalAtRisk += deadlinesData.totalAtRisk || 0;
                mergedDeadlinesList.push({ platform, deadlines: deadlinesData });
            }));

            setProjectDeadlineSignals(mergedDeadlinesList);
            setProjectStats({
                connected: true,
                platform: connectedPlatforms[0],
                projects: totalProjects,
                atRisk: totalAtRisk,
                extractorReady: true
            });
        } catch (err) {
            setProjectStats({ connected: false, platform: null, projects: 0, atRisk: 0, extractorReady: false });
        }
    };

    const loadGithubSignals = async () => {
        try {
            const data = await api.getGithubPulls({ limit: 12, staleDays: 7 });
            setGithubSignals({
                pulls: Array.isArray(data?.pulls) ? data.pulls : [],
                meta: data?.meta || {}
            });
        } catch (err) {
            setGithubSignals(createEmptyGithubPulls());
        }
    };

    const loadCalendarSignals = async () => {
        try {
            const [eventsData, actionItemsData] = await Promise.all([
                api.getGoogleCalendarEvents(7),
                api.getGoogleCalendarActionItems(7)
            ]);
            setCalendarSignals({
                events: Array.isArray(eventsData?.events) ? eventsData.events : [],
                actionItems: Array.isArray(actionItemsData?.actionItems) ? actionItemsData.actionItems : []
            });
        } catch (err) {
            setCalendarSignals(createEmptyCalendarSignals());
        }
    };

    const loadActivities = async () => {
        // Removed as per request to keep dashboard minimal
    };

    const triggerDashboardLoad = async ({ force = false } = {}) => {
        if (!user || refreshing) return;
        if (!force && hasLoadedData) return;

        setRefreshing(true);
        setNotice(null);

        try {
            await Promise.all([
                loadAllData(),
                loadPersonalContext()
            ]);
            setHasLoadedData(true);
        } catch (error) {
            console.error('Failed to load dashboard data:', error);
            setNotice({
                tone: 'error',
                message: 'Could not load workspace data. Please try again.'
            });
        } finally {
            setRefreshing(false);
        }
    };

    const handlePrepareMeeting = async (meeting) => {
        setPreparingMeetingId(meeting.id);
        setNotice(null);

        try {
            // Build context from related data
            const relatedContext = {};
            const meetingKeywords = buildMeetingKeywords(meeting);
            
            // Try to find related tasks from project deadlines
            let candidateTasks = [];
            if (Array.isArray(projectDeadlineSignals)) {
                projectDeadlineSignals.forEach(signal => {
                    candidateTasks = candidateTasks.concat(signal.deadlines?.dueToday?.tasks || []);
                    candidateTasks = candidateTasks.concat(signal.deadlines?.overdue?.tasks || []);
                });
            }

            if (candidateTasks.length > 0) {
                relatedContext.relatedTasks = candidateTasks
                    .filter((task) => {
                        const haystack = `${task?.name || ''} ${task?.project?.name || ''}`.toLowerCase();
                        return meetingKeywords.length === 0 || meetingKeywords.some((keyword) => haystack.includes(keyword));
                    })
                    .slice(0, 4)
                    .map(t => `${t.name} - ${t.project?.name || 'Project'}`)
                    .filter(Boolean);
            }

            const relatedMessages = (Array.isArray(summaries) ? summaries : [])
                .filter((summary) => {
                    const text = String(summary?.summary || '').toLowerCase();
                    return meetingKeywords.length > 0 && meetingKeywords.some((keyword) => text.includes(keyword));
                })
                .slice(0, 3)
                .map((summary) => summary.summary.substring(0, 220));

            const matchingActionItems = (Array.isArray(calendarSignals?.actionItems) ? calendarSignals.actionItems : [])
                .filter((item) => item?.eventId === meeting.id || String(item?.source || '').toLowerCase().includes(String(meeting?.title || '').toLowerCase()))
                .slice(0, 3)
                .map((item) => item?.text)
                .filter(Boolean);

            const combinedMessages = [...relatedMessages, ...matchingActionItems];
            if (combinedMessages.length > 0) {
                relatedContext.relatedMessages = combinedMessages.slice(0, 4);
            }

            const result = await prepareMeeting(user.id, meeting, relatedContext);
            
            setNotice({
                tone: 'success',
                message: `${meeting.title} - Opening meeting prep...`
            });

            // Navigate to AgentChat with the conversation
            if (result.conversationId) {
                setTimeout(() => {
                    navigate(`/app/chat?conversation=${result.conversationId}`);
                }, 1000);
            }
        } catch (error) {
            console.error('Failed to prepare meeting:', error);
            setNotice({
                tone: 'error',
                message: `Failed to prepare for meeting: ${error.message}`
            });
        } finally {
            setPreparingMeetingId(null);
        }
    };


    const nextMeeting = getNextMeeting(calendarSignals);
    const upcomingMeetings = [...(calendarSignals?.events || [])]
        .filter(e => e?.start && new Date(e.start) > new Date())
        .sort((a, b) => new Date(a.start) - new Date(b.start))
        .slice(0, 5);
    
    const briefing = buildDashboardBriefing({
        channels,
        summaries,
        projectStats,
        projectDeadlineSignals,
        githubSignals,
        calendarSignals,
        dismissedBlockerIds
    });

    const snapshotItems = [
        { label: 'Approvals', value: workInsightsPreview.length, hint: 'Ready for review', icon: Sparkles, path: '/app/insights' },
        { label: 'Blockers', value: blockerStats.active, hint: `${blockerStats.resolved} resolved`, icon: AlertCircle, path: '/app/blockers' },
        { label: 'Meetings', value: calendarSignals.events.length, hint: nextMeeting ? `Next: ${trimSentence(nextMeeting.title, 20)}` : 'No meetings', icon: Clock, path: '/app/meetings' },
        { label: 'Projects', value: projectStats.connected ? projectStats.projects : '-', hint: projectStats.atRisk > 0 ? `${projectStats.atRisk} at risk` : 'On track', icon: Target, path: '/app/projects' }
    ];



    return (
        <div className="min-h-screen bg-black text-white selection:bg-gray-800">
            <div className="mx-auto max-w-7xl px-4 pb-20 pt-8 md:px-8">
                {notice && <DashboardNotice notice={notice} />}
                {!hasLoadedData && (
                    <div className="mb-6 rounded-2xl border border-white/10 bg-white/[0.02] px-6 py-5">
                        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                            <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400">
                                Data sync is paused to save API usage. Load when you are ready.
                            </p>
                            <button
                                onClick={() => triggerDashboardLoad({ force: true })}
                                disabled={refreshing}
                                className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-[11px] font-bold uppercase tracking-widest text-white hover:bg-white/10 disabled:opacity-60"
                            >
                                <Activity size={14} className={refreshing ? 'animate-pulse' : ''} />
                                {refreshing ? 'Loading...' : 'Load Workspace Data'}
                            </button>
                        </div>
                    </div>
                )}

                <div className="grid gap-6 xl:grid-cols-[1.5fr_0.5fr] animate-in fade-in slide-in-from-bottom-4 duration-700">
                    <AgentHeroCard
                        briefing={briefing}
                        personalContext={personalContext}
                        refreshing={refreshing}
                        hasLoadedData={hasLoadedData}
                        onLoadData={() => triggerDashboardLoad({ force: true })}
                        onRefresh={() => triggerDashboardLoad({ force: true })}
                        navigate={navigate}
                    />
                    <CommandSnapshotCard items={snapshotItems} navigate={navigate} />
                </div>

                <div className="mt-8 grid gap-6 xl:grid-cols-2 animate-in fade-in slide-in-from-bottom-6 duration-700 delay-100">
                    <FocusPanel briefing={briefing} navigate={navigate} />
                    <SuggestionsPanel insights={workInsightsPreview} message={workInsightsMessage} navigate={navigate} />
                </div>

                <div className="mt-8 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-200">
                    <CommandCenterCard actions={briefing.actions} navigate={navigate} />
                </div>

                {upcomingMeetings.length > 0 && (
                    <div className="mt-8 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-300">
                        <UpcomingMeetingsCard 
                            meetings={upcomingMeetings} 
                            preparingMeetingId={preparingMeetingId}
                            onPrepareMeeting={handlePrepareMeeting}
                            navigate={navigate}
                        />
                    </div>
                )}
            </div>
        </div>
    );
}

function DashboardNotice({ notice }) {
    return (
        <div className={`mb-8 rounded-2xl border px-6 py-4 text-xs font-bold uppercase tracking-widest ${notice.tone === 'success' ? 'border-white/10 bg-white/5 text-white' : 'border-red-500/20 bg-red-500/5 text-red-500'}`}>
            <p>{notice.message}</p>
        </div>
    );
}

function AgentHeroCard({ briefing, personalContext, refreshing, hasLoadedData, onLoadData, onRefresh, navigate }) {
    const WeatherIcon = getWeatherIcon(personalContext?.weather?.code);

    return (
        <section className="relative overflow-hidden rounded-[2.5rem] bg-white/[0.02] border border-white/5 p-8 md:p-10 transition-all hover:border-white/10 group">
            <div className="flex flex-wrap items-center justify-between gap-6 mb-12">
                <div className="flex flex-wrap items-center gap-3">
                    <div className="px-4 py-1.5 bg-white text-black rounded-full">
                        <span className="text-[10px] font-bold uppercase tracking-widest">Today's Overview</span>
                    </div>
                    
                    {personalContext?.loaded && (
                        <div className="flex items-center gap-3 px-4 py-1.5 bg-white/5 border border-white/10 rounded-full animate-in fade-in slide-in-from-left-4 duration-700">
                            <div className="flex items-center gap-1.5 text-gray-400">
                                <Clock size={12} className="text-gray-500" />
                                <span className="text-[10px] font-bold uppercase tracking-widest">{personalContext.timeString}</span>
                            </div>
                            
                            {personalContext.location && (
                                <>
                                    <div className="w-1 h-1 rounded-full bg-white/10"></div>
                                    <div className="flex items-center gap-1.5 text-gray-400">
                                        <MapPin size={12} className="text-gray-500" />
                                        <span className="text-[10px] font-bold uppercase tracking-widest">{personalContext.location.city}</span>
                                    </div>
                                </>
                            )}

                            {personalContext.weather && (
                                <>
                                    <div className="w-1 h-1 rounded-full bg-white/10"></div>
                                    <div className="flex items-center gap-1.5 text-gray-400">
                                        <WeatherIcon size={12} className="text-gray-500" />
                                        <span className="text-[10px] font-bold uppercase tracking-widest">{personalContext.weather.temp}°C</span>
                                    </div>
                                </>
                            )}
                        </div>
                    )}
                </div>

                {hasLoadedData ? (
                    <button
                        onClick={onRefresh}
                        className="p-3 rounded-2xl bg-white/5 border border-white/5 text-gray-500 hover:text-white transition-all active:scale-95"
                    >
                        <RefreshCw size={20} className={refreshing ? 'animate-spin' : ''} />
                    </button>
                ) : (
                    <button
                        onClick={onLoadData}
                        className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-white hover:bg-white/10 transition-all active:scale-95"
                    >
                        <Activity size={16} className={refreshing ? 'animate-pulse' : ''} />
                        {refreshing ? 'Loading' : 'Load Data'}
                    </button>
                )}
            </div>

            <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-white mb-6 leading-tight uppercase">
                {personalContext?.greeting || 'Welcome back.'}
            </h1>
            <p className="text-xl font-medium text-gray-400 mb-4">{briefing.headline}</p>
            <p className="max-w-2xl text-sm leading-relaxed text-gray-500 font-medium mb-10">
                {trimSentence(briefing.summary, 180)}
            </p>

            <div className="flex flex-wrap gap-4">
                <button
                    onClick={() => navigate('/app/chat')}
                    className="inline-flex items-center gap-3 bg-white text-black px-8 py-4 rounded-2xl text-xs font-bold uppercase tracking-widest hover:bg-gray-200 transition-all active:scale-95"
                >
                    Start Chatting
                    <ArrowRight size={18} />
                </button>
            </div>

            <div className="mt-12 pt-8 border-t border-white/5 flex flex-wrap gap-6">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Tools Connected:</span>
                <div className="flex gap-4">
                    {briefing.sources.map(source => (
                        <div key={source} className="flex items-center gap-2">
                            <div className="w-1.5 h-1.5 bg-white/10 rounded-full"></div>
                            <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">{source}</span>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}

function CommandSnapshotCard({ items, navigate }) {
    return (
        <section className="rounded-[2rem] bg-white/[0.02] border border-white/5 p-6 shadow-sm">
            <h2 className="text-xl font-bold text-white mb-8 tracking-tight">Quick Stats</h2>
            <div className="grid gap-4 sm:grid-cols-2">
                {items.map((item) => (
                    <button
                        key={item.label}
                        onClick={() => navigate(item.path)}
                        className="rounded-2xl bg-white/[0.02] border border-white/5 p-5 text-left transition-all hover:border-white/10 active:scale-[0.98]"
                    >
                        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">{item.label}</p>
                        <p className="text-3xl font-bold text-white mb-1">{item.value}</p>
                        <p className="text-[10px] font-medium text-gray-400 truncate">{item.hint}</p>
                    </button>
                ))}
            </div>
        </section>
    );
}

function FocusPanel({ briefing, navigate }) {
    return (
        <section className="rounded-[2rem] bg-white/[0.02] border border-white/5 p-8">
            <h2 className="text-3xl font-bold text-white mb-10 tracking-tight">Attention Needed</h2>
            <div className="space-y-4">
                {briefing.attentionItems.map((item, i) => (
                    <button
                        key={i}
                        onClick={() => item.path && navigate(item.path)}
                        className="w-full flex items-center justify-between p-6 rounded-3xl bg-white/[0.01] border border-white/5 hover:border-white/10 transition-all text-left group"
                    >
                        <div>
                            <p className="text-sm font-bold text-white mb-2 group-hover:text-gray-300 transition-colors">{item.title}</p>
                            <p className="text-sm text-gray-400 leading-relaxed font-medium">{item.description}</p>
                        </div>
                        <ChevronRight size={20} className="text-gray-400 group-hover:text-white" />
                    </button>
                ))}
            </div>
        </section>
    );
}

function SuggestionsPanel({ insights, message, navigate }) {
    const preview = Array.isArray(insights) ? insights.slice(0, 3) : [];
    return (
        <section className="rounded-[2rem] bg-white/[0.02] border border-white/5 p-8">
            <h2 className="text-3xl font-bold text-white mb-10 tracking-tight">Ready for Review</h2>
            {preview.length === 0 ? (
                <div className="p-10 text-center border border-dashed border-white/5 rounded-3xl">
                    <p className="text-sm font-bold uppercase tracking-widest text-gray-400">{message || 'Checking for updates...'}</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {preview.map((insight, i) => (
                        <button
                            key={i}
                            onClick={() => navigate('/app/insights')}
                            className="w-full p-6 text-left rounded-3xl bg-white/[0.01] border border-white/5 hover:border-white/10 transition-all group"
                        >
                            <p className="text-sm font-bold text-white mb-2 group-hover:text-gray-300 transition-colors">
                                {insight.ticketName || 'Proposed Update'}
                            </p>
                            <p className="text-xs text-gray-400 leading-relaxed font-medium line-clamp-2">
                                {trimSentence(insight.evidence?.[0]?.text || 'Review suggested improvements for your workflow.', 120)}
                            </p>
                        </button>
                    ))}
                    <button onClick={() => navigate('/app/insights')} className="w-full pt-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest hover:text-white">
                        View All Insights →
                    </button>
                </div>
            )}
        </section>
    );
}

function CommandCenterCard({ actions, navigate }) {
    return (
        <section className="rounded-[2.5rem] bg-white/[0.02] border border-white/5 p-8">
            <h2 className="text-3xl font-bold text-white mb-10 tracking-tight">Quick Actions</h2>
            <div className="space-y-3 mb-10">
                {actions.map((action, i) => (
                    <button
                        key={i}
                        onClick={() => navigate(action.path)}
                        className="w-full flex items-center justify-between p-5 rounded-2xl bg-white/[0.01] border border-white/5 hover:border-white/10 transition-all group"
                    >
                        <div className="text-left">
                            <p className="text-xs font-bold text-white mb-1 group-hover:text-gray-300 transition-colors uppercase tracking-tight">{action.title}</p>
                            <p className="text-xs text-gray-400 font-medium">{action.description}</p>
                        </div>
                        <ArrowRight size={16} className="text-gray-400 group-hover:text-white" />
                    </button>
                ))}
            </div>

        </section>
    );
}

function UpcomingMeetingsCard({ meetings, preparingMeetingId, onPrepareMeeting, navigate }) {
    return (
        <section className="rounded-[2.5rem] bg-white/[0.02] border border-white/5 p-8">
            <div className="flex items-center justify-between mb-10">
                <h2 className="text-3xl font-bold text-white tracking-tight">Upcoming Meetings</h2>
                <button onClick={() => navigate('/app/meetings')} className="p-3 text-gray-400 hover:text-white transition-all">
                    <ChevronRight size={20} />
                </button>
            </div>
            {meetings.length === 0 ? (
                <div className="p-10 text-center border border-dashed border-white/5 rounded-3xl">
                    <p className="text-xs font-bold uppercase tracking-widest text-gray-400">No upcoming meetings</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {meetings.map((meeting) => (
                        <div
                            key={meeting.id}
                            className="p-5 rounded-2xl bg-white/[0.01] border border-white/5 hover:border-white/10 transition-all"
                        >
                            <div className="flex items-start justify-between gap-4">
                                <div className="flex-1">
                                    <p className="text-sm font-bold text-white mb-2">{meeting.title || 'Untitled Meeting'}</p>
                                    <p className="text-xs text-gray-400">
                                        {meeting.start ? new Date(meeting.start).toLocaleString(undefined, { 
                                            month: 'short',
                                            day: 'numeric',
                                            hour: '2-digit',
                                            minute: '2-digit'
                                        }) : 'Time not set'}
                                    </p>
                                </div>
                                <button
                                    onClick={() => onPrepareMeeting(meeting)}
                                    disabled={preparingMeetingId === meeting.id}
                                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed transition-all text-xs font-bold"
                                >
                                    <Lightbulb size={14} />
                                    {preparingMeetingId === meeting.id ? 'Preparing...' : 'Prepare'}
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </section>
    );
}

function buildDashboardBriefing({ channels, summaries, projectStats, projectDeadlineSignals, githubSignals, calendarSignals, dismissedBlockerIds = [] }) {
    const sorted = [...(summaries || [])].sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
    const latest = sorted[0] || null;

    const slackBlockers = extractSlackBlockers(sorted).filter(item => 
        item.status === 'active' && !dismissedBlockerIds.includes(item.id)
    );
    let projectBlockers = [];
    if (Array.isArray(projectDeadlineSignals)) {
        projectDeadlineSignals.forEach(signal => {
            if (signal.platform && signal.deadlines) {
                const blockers = extractProjectPlatformBlockers(signal.deadlines, signal.platform).filter(item => 
                    !dismissedBlockerIds.includes(item.id)
                );
                projectBlockers = projectBlockers.concat(blockers);
            }
        });
    }
    const githubBlockers = extractGithubBlockers(githubSignals, 7).filter(item => 
        item.status === 'active' && !dismissedBlockerIds.includes(item.id)
    );
    const calendarBlockers = extractCalendarBlockers(calendarSignals).filter(item => 
        item.status === 'active' && !dismissedBlockerIds.includes(item.id)
    );
    
    const active = mergeBlockers(slackBlockers, projectBlockers, githubBlockers, calendarBlockers).filter(item => item.status === 'active');
    
    const sources = [];
    if (channels.length > 0) sources.push('Slack');
    if (projectStats?.connected) sources.push(PROJECT_PLATFORM_LABELS[projectStats.platform] || 'Projects');
    if (githubSignals?.pulls?.length > 0) sources.push('GitHub');
    if (calendarSignals?.events?.length > 0) sources.push('Calendar');
    if (sources.length === 0) sources.push('Setup needed');

    let headline = 'Welcome. Here is an overview of your workspace.';
    if (active.length > 0) {
        headline = `There are ${active.length} items that need your attention.`;
    }

    const summaryParts = [];
    if (latest?.summary) summaryParts.push(`Latest from Slack: ${trimSentence(latest.summary, 120)}`);
    if (projectStats?.atRisk > 0) summaryParts.push(`${projectStats.atRisk} deliverables are marked at risk.`);
    if (githubBlockers.length > 0) summaryParts.push(`${githubBlockers.length} code reviews are pending.`);
    if (summaryParts.length === 0) summaryParts.push('Your workspace is quiet. Use the dashboard to stay on top of team activities.');

    const attentionItems = [];
    if (slackBlockers.length > 0) attentionItems.push({ title: 'Slack Blockers', description: describeSignals(slackBlockers), path: '/app/blockers' });
    if (projectStats?.atRisk > 0) attentionItems.push({ title: 'At-Risk Tasks', description: 'Some tasks are due soon or late.', path: '/app/projects' });
    if (githubBlockers.length > 0) attentionItems.push({ title: 'Pending Code Reviews', description: describeSignals(githubBlockers), path: '/app/code' });
    if (attentionItems.length === 0) attentionItems.push({ title: 'No Critical Issues', description: 'Everything is running smoothly.', path: '/app/chat' });

    const actions = [
        { title: 'Chat with AI', description: 'Ask questions about your work.', path: '/app/chat' },
        { title: 'View Blockers', description: 'Check what is stopping progress.', path: '/app/blockers' }
    ];
    if (channels.length === 0) actions.push({ title: 'Connect Slack', description: 'Get team summaries.', path: '/app/integrations' });
    if (!projectStats?.connected) actions.push({ title: 'Connect Projects', description: 'Track task deadlines.', path: '/app/integrations' });

    return {
        headline,
        summary: summaryParts.join(' '),
        sources,
        attentionItems: attentionItems.slice(0, 4),
        actions: actions.slice(0, 4)
    };
}

function getNextMeeting(signals) {
    const upcoming = [...(signals?.events || [])]
        .filter(e => e?.start && new Date(e.start) > new Date())
        .sort((a, b) => new Date(a.start) - new Date(b.start));
    return upcoming[0] || null;
}

function describeSignals(signals) {
    const texts = (signals || []).map(s => s?.title).filter(Boolean).slice(0, 2);
    return texts.length > 0 ? texts.join('; ') : 'High-risk items detected.';
}

function formatConversationTime(value) {
    if (!value) return '';
    const date = new Date(value);
    const diff = Math.floor((Date.now() - date.getTime()) / 60000);
    if (diff < 1) return 'NOW';
    if (diff < 60) return `${diff}M`;
    const hours = Math.floor(diff / 60);
    if (hours < 24) return `${hours}H`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}D`;
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }).toUpperCase();
}

function trimSentence(value, maxLength = 160) {
    const normalized = typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
    if (!normalized) return '';
    if (normalized.length <= maxLength) return normalized;
    return `${normalized.slice(0, maxLength - 3)}...`;
}

function getWeatherIcon(code) {
    if (code === undefined || code === null) return Sun;
    
    // WMO Weather interpretation codes (WW)
    // https://open-meteo.com/en/docs
    if (code === 0) return Sun; // Clear sky
    if (code >= 1 && code <= 3) return Cloud; // Mainly clear, partly cloudy, and overcast
    if (code >= 45 && code <= 48) return Cloud; // Fog
    if (code >= 51 && code <= 67) return CloudRain; // Drizzle/Rain
    if (code >= 71 && code <= 77) return Cloud; // Snow
    if (code >= 80 && code <= 82) return CloudRain; // Rain showers
    if (code >= 95) return CloudRain; // Thunderstorm
    
    return Cloud;
}
