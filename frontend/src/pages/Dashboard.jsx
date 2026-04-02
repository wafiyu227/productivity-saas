import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import {
    RefreshCw, MessageSquare, AlertTriangle, TrendingUp,
    Sparkles, Clock, ArrowRight, Activity, Target
} from 'lucide-react';
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
const PROJECT_PLATFORM_PRIORITY = ['jira', 'asana', 'trello'];
const PROJECT_PLATFORM_LABELS = {
    jira: 'Jira',
    asana: 'Asana',
    trello: 'Trello'
};
const PROJECT_PLATFORM_EXTRACTORS = {
    jira: {
        fetchProjects: (teamId) => api.getJiraProjects(teamId),
        fetchDeadlines: (teamId) => api.getJiraDeadlines(teamId)
    },
    asana: {
        fetchProjects: (teamId) => api.getAsanaProjects(teamId),
        fetchDeadlines: (teamId) => api.getAsanaDeadlines(teamId)
    },
    trello: {
        fetchProjects: (teamId) => api.getTrelloProjects(teamId),
        fetchDeadlines: (teamId) => api.getTrelloDeadlines(teamId)
    }
};

export default function Dashboard() {
    const { user, profile } = useAuth();
    const navigate = useNavigate();
    const [channels, setChannels] = useState([]);
    const [summaries, setSummaries] = useState([]);
    const [workInsightsPreview, setWorkInsightsPreview] = useState([]);
    const [workInsightsMessage, setWorkInsightsMessage] = useState('');
    const [activities, setActivities] = useState([]);
    const [blockerStats, setBlockerStats] = useState({ active: 0, resolved: 0, total: 0 });
    const [refreshing, setRefreshing] = useState(false);
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

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const success = params.get('success');
        const error = params.get('error');

        if (success === 'slack_connected') {
            alert('✅ Slack connected successfully!');
            loadChannels();
            window.history.replaceState({}, '', '/app');
        } else if (error) {
            alert('❌ Connection failed: ' + error);
            window.history.replaceState({}, '', '/app');
        }
    }, []);

    useEffect(() => {
        if (user && profile) {
            loadChannels();
            loadSummaries();
            loadWorkInsights();
            loadActivities();
            loadBlockerStats();
            loadProjectStats();
            loadGithubSignals();
            loadCalendarSignals();
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

    const loadChannels = async () => {
        if (!user) return;

        try {
            const data = await api.getChannels(profile?.current_team_id);
            setChannels(data.channels || []);
        } catch (error) {
            console.error('Failed to load channels:', error);
            setChannels([]);
        }
    };

    const loadSummaries = async () => {
        if (!user) return;

        try {
            const data = await api.getSummaries(profile?.current_team_id);
            setSummaries(data || []);
        } catch (error) {
            console.error('Failed to load summaries:', error);
        }
    };

    const loadWorkInsights = async () => {
        if (!user) return;

        try {
            const data = await api.getWorkInsights(profile?.current_team_id, { limit: 6 });
            setWorkInsightsPreview(Array.isArray(data?.insights) ? data.insights : []);
            setWorkInsightsMessage(data?.message || '');
        } catch (error) {
            console.error('Failed to load work insights:', error);
            setWorkInsightsPreview([]);
            setWorkInsightsMessage('');
        }
    };

    const loadBlockerStats = async () => {
        if (!user) return;

        try {
            const teamId = profile?.current_team_id;

            const activeProjectPlatform = await getActiveProjectPlatform(teamId);
            const extractor = PROJECT_PLATFORM_EXTRACTORS[activeProjectPlatform];
            const projectDeadlinePromise = extractor
                ? extractor.fetchDeadlines(teamId).catch(() => ({ overdue: { count: 0 }, dueToday: { count: 0 } }))
                : Promise.resolve({ overdue: { count: 0 }, dueToday: { count: 0 } });

            const [slackRes, projectPlatformDeadlines] = await Promise.all([
                fetch(`${API_URL}/api/blockers?userId=${user.id}${teamId ? `&teamId=${teamId}` : ''}`).then(r => r.json()).catch(() => []),
                projectDeadlinePromise
            ]);

            const summariesWithBlockers = Array.isArray(slackRes) ? slackRes : [];

            let activeCount = 0;
            let resolvedCount = 0;
            let totalCount = 0;

            // Count Slack blockers
            summariesWithBlockers.forEach(summary => {
                if (summary.blockers && Array.isArray(summary.blockers)) {
                    summary.blockers.forEach((blocker, index) => {
                        totalCount++;
                        const status = summary.blocker_status?.[index]?.status || 'active';
                        if (status === 'active') {
                            activeCount++;
                        } else if (status === 'resolved') {
                            resolvedCount++;
                        }
                    });
                }
            });

            // Add project platform blockers where extractor is available.
            const projectPlatformActive = (projectPlatformDeadlines?.overdue?.count || 0) + (projectPlatformDeadlines?.dueToday?.count || 0);
            activeCount += projectPlatformActive;
            totalCount += projectPlatformActive;

            setBlockerStats({
                active: activeCount,
                resolved: resolvedCount,
                total: totalCount
            });
        } catch (error) {
            console.error('Failed to load blocker stats:', error);
        }
    };

    const loadProjectStats = async () => {
        if (!user) return;

        try {
            const teamId = profile?.current_team_id;
            const activeProjectPlatform = await getActiveProjectPlatform(teamId);

            if (!activeProjectPlatform) {
                setProjectStats({
                    connected: false,
                    platform: null,
                    projects: 0,
                    atRisk: 0,
                    extractorReady: false
                });
                setProjectDeadlineSignals(null);
                return;
            }

            const extractor = PROJECT_PLATFORM_EXTRACTORS[activeProjectPlatform];
            if (!extractor) {
                setProjectStats({
                    connected: true,
                    platform: activeProjectPlatform,
                    projects: 0,
                    atRisk: 0,
                    extractorReady: false
                });
                setProjectDeadlineSignals(null);
                return;
            }

            const [projectsData, deadlinesData] = await Promise.all([
                extractor.fetchProjects(teamId).catch(() => ({ projects: [] })),
                extractor.fetchDeadlines(teamId).catch(() => ({ totalAtRisk: 0 }))
            ]);

            setProjectDeadlineSignals({
                platform: activeProjectPlatform,
                deadlines: deadlinesData
            });

            setProjectStats({
                connected: true,
                platform: activeProjectPlatform,
                projects: projectsData.projects?.length || 0,
                atRisk: deadlinesData.totalAtRisk || 0,
                extractorReady: true
            });
        } catch (error) {
            if (!error.message?.includes('401')) {
                console.error('Failed to load project platform stats:', error);
            }
            setProjectDeadlineSignals(null);
        }
    };

    const loadGithubSignals = async () => {
        if (!user) return;

        try {
            const data = await api.getGithubPulls(profile?.current_team_id, { limit: 12, staleDays: 7 });
            if (data?.error) {
                setGithubSignals(createEmptyGithubPulls());
                return;
            }

            setGithubSignals({
                pulls: Array.isArray(data?.pulls) ? data.pulls : [],
                meta: data?.meta || {}
            });
        } catch (error) {
            console.error('Failed to load GitHub signals:', error);
            setGithubSignals(createEmptyGithubPulls());
        }
    };

    const loadCalendarSignals = async () => {
        if (!user) return;

        try {
            const teamId = profile?.current_team_id;
            const [eventsData, actionItemsData] = await Promise.all([
                api.getGoogleCalendarEvents(teamId, 7),
                api.getGoogleCalendarActionItems(teamId, 7)
            ]);

            setCalendarSignals({
                events: Array.isArray(eventsData?.events) && !eventsData?.error ? eventsData.events : [],
                actionItems: Array.isArray(actionItemsData?.actionItems) && !actionItemsData?.error
                    ? actionItemsData.actionItems
                    : []
            });
        } catch (error) {
            console.error('Failed to load calendar signals:', error);
            setCalendarSignals(createEmptyCalendarSignals());
        }
    };

    const loadActivities = async () => {
        if (!user) return;

        try {
            const data = await api.getSummaries(profile?.current_team_id);
            const activityList = [];

            data?.forEach(summary => {
                activityList.push({
                    id: `summary-${summary.id}`,
                    type: 'summary',
                    text: `Summary generated for #${summary.channel_name}`,
                    time: new Date(summary.created_at),
                    icon: Sparkles,
                    color: 'blue'
                });

                const blockers = summary.blockers || [];
                if (Array.isArray(blockers) && blockers.length > 0) {
                    blockers.forEach((blocker, idx) => {
                        activityList.push({
                            id: `blocker-${summary.id}-${idx}`,
                            type: 'blocker',
                            text: `Blocker detected: "${blocker}" in #${summary.channel_name}`,
                            time: new Date(summary.created_at),
                            icon: AlertTriangle,
                            color: 'red'
                        });
                    });
                }
            });

            activityList.sort((a, b) => b.time - a.time);
            setActivities(activityList.slice(0, 10));
        } catch (error) {
            console.error('Failed to load activities:', error);
        }
    };

    const generateSummary = async () => {
        if (!selectedChannel) {
            alert('Please select a channel');
            return;
        }

        setLoading(true);
        try {
            const result = await api.createSummary(selectedChannel, 24, profile?.current_team_id);

            if (result.count === 0) {
                alert('ℹ️ No new messages found in this channel over the last 24 hours to summarize.');
            } else {
                alert('✅ Summary generated successfully!');
                await loadSummaries();
                await loadActivities();
                await loadBlockerStats();
            }

            setSelectedChannel('');
        } catch (error) {
            if (error.message?.includes('not_in_channel')) {
                alert('⚠️ The bot is not in this channel!\n\nTo fix:\n1. Go to the channel in Slack\n2. Type: /invite @Teama AI Bot\n3. Try again');
            } else if (error.message?.includes('Monthly summary limit reached')) {
                const wantsUpgrade = window.confirm(`🛑 ${error.message}\n\nWould you like to go to Team Settings to upgrade your plan?`);
                if (wantsUpgrade) {
                    navigate('/app/team');
                }
            } else {
                alert('Failed to generate summary: ' + (error.message || 'Unknown error'));
            }
        } finally {
            setLoading(false);
        }
    };

    const handleRefresh = async () => {
        setRefreshing(true);
        await Promise.all([
            loadSummaries(),
            loadWorkInsights(),
            loadActivities(),
            loadBlockerStats(),
            loadProjectStats(),
            loadGithubSignals(),
            loadCalendarSignals()
        ]);
        setRefreshing(false);
    };

    const stats = {
        pendingApprovals: workInsightsPreview.length,
        channelsMonitored: channels.length,
        summariesGenerated: summaries.length,
        activeBlockers: blockerStats.active,
        totalMessages: summaries.reduce((acc, s) => acc + (s.message_count || 0), 0),
        followUps: Array.isArray(calendarSignals?.actionItems) ? calendarSignals.actionItems.length : 0
    };
    const teamBriefing = buildTeamBriefing({
        channels,
        summaries,
        projectStats,
        projectDeadlineSignals,
        githubSignals,
        calendarSignals
    });

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50">
            <div className="p-4 md:p-8">
                <div className="max-w-7xl mx-auto">
                    {/* Header */}
                    <div className="mb-6 md:mb-8">
                        <h1 className="text-2xl md:text-4xl font-bold text-gray-900 mb-2">
                            Command Center
                        </h1>
                        <p className="text-base md:text-lg text-gray-600">
                            Teama is watching your workspace, surfacing what matters, and waiting for approval before it acts.
                        </p>
                    </div>

                    <TeamBriefingCard briefing={teamBriefing} navigate={navigate} />

                    {/* Stats Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 md:gap-6 mb-6 md:mb-8">
                        <StatCard
                            title="Pending Approvals"
                            value={stats.pendingApprovals}
                            icon={<Sparkles className="text-violet-600" size={24} />}
                            change={stats.pendingApprovals > 0 ? 'Needs review' : 'All clear'}
                            trend={stats.pendingApprovals > 0 ? "down" : "up"}
                            onClick={() => navigate('/app/insights')}
                        />
                        <StatCard
                            title="Channels"
                            value={stats.channelsMonitored}
                            icon={<MessageSquare className="text-blue-600" size={24} />}
                            change={`${stats.channelsMonitored} connected`}
                            trend="neutral"
                        />
                        <StatCard
                            title="Active Blockers"
                            value={stats.activeBlockers}
                            icon={<AlertTriangle className="text-red-600" size={24} />}
                            change={`${blockerStats.resolved} resolved`}
                            trend={stats.activeBlockers > 0 ? "down" : "up"}
                            onClick={() => navigate('/app/blockers')}
                        />
                        <StatCard
                            title="Messages Analyzed"
                            value={stats.totalMessages}
                            icon={<TrendingUp className="text-green-600" size={24} />}
                            change={`${stats.totalMessages} messages`}
                            trend="up"
                        />
                        <StatCard
                            title="Meeting Follow-ups"
                            value={stats.followUps}
                            icon={<Clock className="text-amber-600" size={24} />}
                            change={stats.followUps > 0 ? 'Still open' : 'No open items'}
                            trend={stats.followUps > 0 ? "down" : "up"}
                            onClick={() => navigate('/app/meetings')}
                        />
                        <StatCard
                            title={projectStats.platform ? `${PROJECT_PLATFORM_LABELS[projectStats.platform]} Projects` : 'Project Platform'}
                            value={projectStats.extractorReady ? projectStats.projects : (projectStats.connected ? '—' : 0)}
                            icon={<Target className="text-cyan-600" size={24} />}
                            change={projectStats.connected
                                ? (projectStats.extractorReady
                                    ? (projectStats.atRisk > 0 ? `${projectStats.atRisk} at risk` : 'All on track')
                                    : 'Extractor not wired yet')
                                : 'Not connected'}
                            trend={projectStats.connected && projectStats.extractorReady && projectStats.atRisk > 0 ? "down" : "up"}
                            onClick={() => navigate('/app/projects')}
                        />
                    </div>

                    <ApprovalModelCard
                        insights={workInsightsPreview}
                        message={workInsightsMessage}
                        navigate={navigate}
                    />

                    {/* Generate Summary Card */}
                    {false && (
                    <div className="bg-gradient-to-br from-blue-600 to-purple-600 rounded-2xl shadow-xl p-5 md:p-8 mb-6 md:mb-8 text-white">
                        <div className="flex items-start justify-between mb-4 md:mb-6">
                            <div>
                                <h2 className="text-2xl font-bold mb-2">
                                    Generate AI Summary
                                </h2>
                                <p className="text-blue-100">
                                    Get instant insights from any Slack channel
                                </p>
                            </div>
                            <img src="/logo.png" alt="Teama AI Logo" className="w-8 h-8 object-contain" />
                        </div>

                        <div className="flex flex-col md:flex-row gap-4">
                            <select
                                value={selectedChannel}
                                onChange={(e) => setSelectedChannel(e.target.value)}
                                className="flex-1 px-4 py-3 bg-white/20 backdrop-blur-sm border border-white/30 rounded-lg text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-white/50"
                            >
                                <option value="" className="text-gray-900">
                                    Select a channel...
                                </option>
                                {channels.length === 0 && (
                                    <option value="" className="text-gray-900">
                                        No channels - Connect Slack in Integrations →
                                    </option>
                                )}
                                {channels.map((ch) => (
                                    <option key={ch.id} value={ch.id} className="text-gray-900">
                                        #{ch.name}
                                    </option>
                                ))}
                            </select>
                            <button
                                onClick={generateSummary}
                                disabled={loading || !selectedChannel}
                                className="px-8 py-3 bg-white text-blue-600 font-semibold rounded-lg hover:bg-blue-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 whitespace-nowrap"
                            >
                                {loading ? (
                                    <>
                                        <RefreshCw size={20} className="animate-spin" />
                                        Analyzing...
                                    </>
                                ) : (
                                    <>
                                        <Sparkles size={20} />
                                        Generate Summary
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                    )}

                    {/* Main Content Grid */}
                    <div className="grid lg:grid-cols-3 gap-8">
                        <ApprovalQueueCard
                            insights={workInsightsPreview}
                            message={workInsightsMessage}
                            navigate={navigate}
                        />

                        {/* Recent Summaries */}
                        {false && (
                        <div className="lg:col-span-2">
                            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                                <div className="flex items-center justify-between mb-6">
                                    <h2 className="text-2xl font-bold text-gray-900">
                                        Recent Summaries
                                    </h2>
                                    <button
                                        onClick={() => navigate('/app/summaries')}
                                        className="text-blue-600 hover:text-blue-700 text-sm font-medium flex items-center gap-1"
                                    >


                                        View all summaries


                                    </button>
                                </div>

                                {summaries.length === 0 ? (
                                    <EmptyState />
                                ) : (
                                    <div className="space-y-4">
                                        {summaries.slice(0, 3).map((summary, idx) => (
                                            <SummaryCard key={idx} summary={summary} />
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                        )}

                        {/* Quick Actions & Activity */}
                        <div className="space-y-6">
                            <QuickActionsCard navigate={navigate} />
                            <ActivityFeed activities={activities} refreshing={refreshing} onRefresh={handleRefresh} />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

function StatCard({ title, value, icon, change, trend, onClick }) {
    return (
        <div
            onClick={onClick}
            className={`bg-white rounded-2xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition-shadow ${onClick ? 'cursor-pointer' : ''}`}
        >
            <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl">
                    {icon}
                </div>
                <span className={`text-sm font-medium ${trend === 'up' ? 'text-green-600' :
                    trend === 'down' ? 'text-red-600' :
                        'text-gray-600'
                    }`}>
                    {change}
                </span>
            </div>
            <p className="text-sm text-gray-600 mb-1">{title}</p>
            <p className="text-3xl font-bold text-gray-900">{value}</p>
        </div>
    );
}

function ApprovalModelCard({ insights, message, navigate }) {
    const previewInsights = Array.isArray(insights) ? insights.slice(0, 2) : [];

    return (
        <section className="mb-6 md:mb-8 overflow-hidden rounded-3xl bg-gradient-to-br from-sky-700 via-blue-700 to-cyan-700 p-6 md:p-8 text-white shadow-xl">
            <div className="grid gap-6 xl:grid-cols-[1.1fr_1fr]">
                <div>
                    <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-blue-100">
                        <Sparkles size={14} />
                        Approval-First AI
                    </div>
                    <h2 className="mb-3 text-2xl font-bold leading-tight md:text-4xl">
                        Teama works proactively, but it never writes without approval.
                    </h2>
                    <p className="max-w-3xl text-sm leading-7 text-blue-50 md:text-base">
                        This is the core product contract: Teama learns from Slack, Jira, GitHub, Calendar, and your other tools,
                        explains what it found, then waits for a human to accept, edit, or ignore the next action.
                    </p>

                    <div className="mt-6 grid gap-3 sm:grid-cols-3">
                        <ApprovalPrinciple
                            title="Evidence-backed"
                            description="Every suggestion shows the exact signals and source context behind it."
                        />
                        <ApprovalPrinciple
                            title="Human-in-loop"
                            description="Nothing gets pushed back to a connected tool until a user approves it."
                        />
                        <ApprovalPrinciple
                            title="Cross-tool aware"
                            description="Insights combine workspace activity instead of forcing users to jump between apps."
                        />
                    </div>

                    <div className="mt-6 flex flex-wrap gap-3">
                        <button
                            onClick={() => navigate('/app/insights')}
                            className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-semibold text-blue-700 transition hover:bg-blue-50"
                        >
                            Review Approvals
                            <ArrowRight size={16} />
                        </button>
                        <button
                            onClick={() => navigate('/app/integrations')}
                            className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/15"
                        >
                            Manage Sources
                        </button>
                    </div>
                </div>

                <div className="space-y-4">
                    <div className="rounded-3xl border border-white/15 bg-white/10 p-5">
                        <div className="mb-3 flex items-center justify-between gap-3">
                            <div>
                                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-blue-100">Approval Queue</p>
                                <p className="mt-1 text-3xl font-bold text-white">{previewInsights.length}</p>
                            </div>
                            <div className="rounded-2xl bg-white/10 p-3">
                                <Sparkles size={22} className="text-blue-100" />
                            </div>
                        </div>
                        <p className="text-sm leading-6 text-blue-50">
                            {previewInsights.length > 0
                                ? 'Teama has surfaced actions that are ready for review right now.'
                                : (message || 'No approvals are waiting right now. Teama is still watching your connected workspace.')}
                        </p>
                    </div>

                    {previewInsights.length > 0 ? (
                        previewInsights.map((insight) => (
                            <div key={insight.id} className="rounded-3xl border border-white/15 bg-white/10 p-5">
                                <div className="mb-2 flex items-center justify-between gap-3">
                                    <div className="flex items-center gap-2">
                                        <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-blue-50">
                                            {insight.platformLabel}
                                        </span>
                                        <p className="font-semibold text-white">{insight.ticketKey}</p>
                                    </div>
                                    <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-blue-50">
                                        {insight.suggestedStatus}
                                    </span>
                                </div>
                                <p className="text-sm leading-6 text-blue-50">
                                    {insight.signals?.join(' • ') || 'Signals detected'}
                                </p>
                            </div>
                        ))
                    ) : (
                        <div className="rounded-3xl border border-dashed border-white/20 bg-black/10 p-5 text-sm leading-6 text-blue-50">
                            Connect sources and share work-item updates in Slack so Teama can start surfacing approval-ready actions.
                        </div>
                    )}
                </div>
            </div>
        </section>
    );
}

function ApprovalPrinciple({ title, description }) {
    return (
        <div className="rounded-2xl border border-white/15 bg-white/10 p-4">
            <p className="text-sm font-semibold text-white">{title}</p>
            <p className="mt-2 text-xs leading-6 text-blue-50">{description}</p>
        </div>
    );
}

function ApprovalQueueCard({ insights, message, navigate }) {
    const items = Array.isArray(insights) ? insights.slice(0, 4) : [];

    return (
        <div className="lg:col-span-2">
            <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
                <div className="mb-6 flex items-center justify-between">
                    <div>
                        <h2 className="text-2xl font-bold text-gray-900">Approval Queue</h2>
                        <p className="mt-1 text-sm leading-6 text-gray-600">
                            Review Teama's latest evidence-backed suggestions before anything is written back to your tools.
                        </p>
                    </div>
                    <button
                        onClick={() => navigate('/app/insights')}
                        className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-4 py-3 text-sm font-semibold text-gray-700 transition hover:border-gray-300 hover:bg-gray-50"
                    >
                        View all
                        <ArrowRight size={16} />
                    </button>
                </div>

                {items.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-8 text-center">
                        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-white shadow-sm">
                            <Sparkles className="text-sky-600" size={24} />
                        </div>
                        <h3 className="text-lg font-semibold text-gray-900">No approvals waiting</h3>
                        <p className="mx-auto mt-2 max-w-2xl text-sm leading-7 text-gray-600">
                            {message || 'Teama has not found any approval-ready actions yet.'}
                        </p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {items.map((insight) => (
                            <button
                                key={insight.id}
                                onClick={() => navigate('/app/insights')}
                                className="w-full rounded-2xl border border-gray-200 p-5 text-left transition hover:border-blue-200 hover:bg-blue-50/40"
                            >
                                <div className="flex flex-wrap items-start justify-between gap-3">
                                    <div>
                                        <div className="mb-2 flex items-center gap-2">
                                            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-700">
                                                {insight.platformLabel}
                                            </span>
                                            <span className="rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white">
                                                {insight.ticketKey}
                                            </span>
                                            <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-800">
                                                {insight.suggestedStatus}
                                            </span>
                                        </div>
                                        <p className="text-lg font-semibold text-gray-900">{insight.ticketName}</p>
                                        <p className="mt-1 text-sm leading-6 text-gray-600">
                                            {insight.evidence?.[0]?.text || 'Teama found activity worth reviewing.'}
                                        </p>
                                    </div>
                                    <ArrowRight size={18} className="mt-1 text-gray-400" />
                                </div>

                                <div className="mt-4 flex flex-wrap gap-2">
                                    {insight.signals?.map((signal) => (
                                        <span
                                            key={`${insight.id}-${signal}`}
                                            className="rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700"
                                        >
                                            {signal}
                                        </span>
                                    ))}
                                </div>
                            </button>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

function TeamBriefingCard({ briefing, navigate }) {
    return (
        <section className="mb-6 md:mb-8 overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 p-6 md:p-8 text-white shadow-xl">
            <div className="grid gap-6 xl:grid-cols-[1.1fr_1fr]">
                <div>
                    <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-blue-100">
                        <Activity size={14} />
                        Proactive Briefing
                    </div>
                    <h2 className="mb-3 text-2xl font-bold leading-tight md:text-4xl">
                        {briefing.headline}
                    </h2>
                    <p className="max-w-3xl text-sm leading-7 text-slate-200 md:text-base">
                        {briefing.summary}
                    </p>

                    <div className="mt-5 flex flex-wrap gap-2">
                        {briefing.sources.map((source) => (
                            <span
                                key={source}
                                className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-medium text-slate-100"
                            >
                                {source}
                            </span>
                        ))}
                    </div>

                    <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                        {briefing.metrics.map((metric) => (
                            <div
                                key={metric.label}
                                className="rounded-2xl border border-white/10 bg-white/10 p-4"
                            >
                                <p className="text-xs font-semibold uppercase tracking-wide text-slate-300">
                                    {metric.label}
                                </p>
                                <p className="mt-2 text-2xl font-bold text-white">{metric.value}</p>
                                <p className="mt-1 text-xs text-slate-300">{metric.description}</p>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-1">
                    <div className="rounded-3xl border border-white/10 bg-white/10 p-5">
                        <div className="mb-4 flex items-center gap-2">
                            <AlertTriangle size={18} className="text-amber-300" />
                            <h3 className="text-lg font-semibold">Needs Attention</h3>
                        </div>
                        <div className="space-y-3">
                            {briefing.attentionItems.map((item) => (
                                <button
                                    key={item.title}
                                    onClick={() => item.path && navigate(item.path)}
                                    className="w-full rounded-2xl border border-white/10 bg-black/10 p-4 text-left transition hover:border-white/20 hover:bg-white/10"
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <div>
                                            <p className="font-semibold text-white">{item.title}</p>
                                            <p className="mt-1 text-sm leading-6 text-slate-200">{item.description}</p>
                                        </div>
                                        <ArrowRight size={16} className="mt-1 shrink-0 text-slate-300" />
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="rounded-3xl border border-white/10 bg-white/10 p-5">
                        <div className="mb-4 flex items-center gap-2">
                            <Sparkles size={18} className="text-blue-200" />
                            <h3 className="text-lg font-semibold">Recommended Next Steps</h3>
                        </div>
                        <div className="space-y-3">
                            {briefing.actions.map((action) => (
                                <button
                                    key={action.title}
                                    onClick={() => navigate(action.path)}
                                    className="w-full rounded-2xl border border-white/10 bg-black/10 p-4 text-left transition hover:border-white/20 hover:bg-white/10"
                                >
                                    <p className="font-semibold text-white">{action.title}</p>
                                    <p className="mt-1 text-sm leading-6 text-slate-200">{action.description}</p>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}

function SummaryCard({ summary }) {
    const channelName = summary.channel_name || summary.channelName || 'unknown';
    const summaryText = summary.summary || '';
    const blockers = summary.blockers || [];
    const keyTopics = summary.key_topics || summary.keyTopics || [];
    const messageCount = summary.message_count || summary.messageCount || 0;
    const createdAt = summary.created_at ? new Date(summary.created_at).toLocaleDateString() : 'Just now';

    return (
        <div className="border border-gray-200 rounded-xl p-5 hover:shadow-md hover:border-blue-200 transition-all">
            <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-500 rounded-lg flex items-center justify-center">
                        <MessageSquare className="text-white" size={20} />
                    </div>
                    <div>
                        <h3 className="font-semibold text-gray-900">#{channelName}</h3>
                        <p className="text-sm text-gray-500 flex items-center gap-1">
                            <Clock size={14} />
                            {createdAt} • {messageCount} messages
                        </p>
                    </div>
                </div>
            </div>

            <p className="text-gray-700 mb-4 leading-relaxed">{summaryText}</p>

            {Array.isArray(blockers) && blockers.length > 0 && (
                <div className="mb-3">
                    <p className="text-xs font-semibold text-red-600 mb-2 uppercase">Blockers Detected</p>
                    <div className="flex flex-wrap gap-2">
                        {blockers.map((blocker, i) => (
                            <span
                                key={i}
                                className="px-3 py-1.5 bg-red-50 text-red-700 text-sm rounded-lg border border-red-200 flex items-center gap-1"
                            >
                                <AlertTriangle size={14} />
                                {blocker}
                            </span>
                        ))}
                    </div>
                </div>
            )}

            {Array.isArray(keyTopics) && keyTopics.length > 0 && (
                <div className="flex flex-wrap gap-2">
                    {keyTopics.map((topic, i) => (
                        <span
                            key={i}
                            className="px-3 py-1 bg-blue-50 text-blue-700 text-sm rounded-lg"
                        >
                            #{topic}
                        </span>
                    ))}
                </div>
            )}
        </div>
    );
}

function EmptyState() {
    return (
        <div className="text-center py-12">
            <div className="w-20 h-20 bg-gradient-to-br from-blue-100 to-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Sparkles className="text-blue-600" size={32} />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
                No summaries yet
            </h3>
            <p className="text-gray-600 mb-4">
                Generate your first AI summary from a Slack channel above
            </p>
        </div>
    );
}

function QuickActionsCard({ navigate }) {
    return (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h3 className="font-bold text-gray-900 mb-4">Workspace Actions</h3>
            <div className="space-y-3">
                <QuickAction
                    icon={<Sparkles size={18} className="text-violet-600" />}
                    title="Review Approvals"
                    description="Accept, edit, or ignore Teama suggestions"
                    onClick={() => navigate('/app/insights')}
                />
                <QuickAction
                    icon={<Target size={18} className="text-cyan-600" />}
                    title="Check Project Health"
                    description="Review cross-tool delivery risk"
                    onClick={() => navigate('/app/projects')}
                />
                <QuickAction
                    icon={<Clock size={18} className="text-amber-600" />}
                    title="Prep for Meetings"
                    description="Open meeting context and follow-ups"
                    onClick={() => navigate('/app/meetings')}
                />
                <QuickAction
                    icon={<MessageSquare size={18} className="text-blue-600" />}
                    title="Review Slack Context"
                    description="Inspect the signals Teama is learning from"
                    onClick={() => navigate('/app/summaries')}
                />
                <QuickAction
                    icon={<AlertTriangle size={18} className="text-red-600" />}
                    title="Manage Sources"
                    description="Connect or tune the tools Teama watches"
                    onClick={() => navigate('/app/integrations')}
                />
            </div>
        </div>
    );
}

function QuickAction({ icon, title, description, onClick }) {
    return (
        <button
            onClick={onClick}
            className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors text-left"
        >
            <div className="p-2 bg-gray-50 rounded-lg">
                {icon}
            </div>
            <div>
                <p className="font-medium text-gray-900 text-sm">{title}</p>
                <p className="text-xs text-gray-500">{description}</p>
            </div>
        </button>
    );
}

function ActivityFeed({ activities, refreshing, onRefresh }) {
    const formatTime = (date) => {
        const now = new Date();
        const diffMs = now - new Date(date);
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays < 7) return `${diffDays}d ago`;
        return new Date(date).toLocaleDateString();
    };

    const colorMap = {
        blue: 'bg-blue-500',
        red: 'bg-red-500',
        green: 'bg-green-500',
        purple: 'bg-purple-500'
    };

    return (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-gray-900 flex items-center gap-2">
                    <Activity size={20} />
                    Recent Signals
                </h3>
                <button
                    onClick={onRefresh}
                    disabled={refreshing}
                    className="text-gray-400 hover:text-gray-600 transition"
                >
                    <RefreshCw
                        size={16}
                        className={refreshing ? 'animate-spin' : ''}
                    />
                </button>
            </div>
            <div className="space-y-4">
                {activities.length === 0 ? (
                    <p className="text-sm text-gray-500 text-center py-4">No signals yet</p>
                ) : (
                    activities.map((activity) => (
                        <div key={activity.id} className="flex gap-3">
                            <div className={`w-2 h-2 rounded-full mt-2 ${colorMap[activity.color]}`} />
                            <div className="flex-1 min-w-0">
                                <p className="text-sm text-gray-900 truncate">{activity.text}</p>
                                <p className="text-xs text-gray-500">{formatTime(activity.time)}</p>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}

function buildTeamBriefing({
    channels,
    summaries,
    projectStats,
    projectDeadlineSignals,
    githubSignals,
    calendarSignals
}) {
    const sortedSummaries = [...(Array.isArray(summaries) ? summaries : [])].sort(
        (first, second) => new Date(second.created_at || 0) - new Date(first.created_at || 0)
    );
    const latestSummary = sortedSummaries[0] || null;
    const slackBlockers = extractSlackBlockers(sortedSummaries).filter((item) => item.status === 'active');
    const projectBlockers = projectDeadlineSignals?.platform && projectDeadlineSignals?.deadlines
        ? extractProjectPlatformBlockers(projectDeadlineSignals.deadlines, projectDeadlineSignals.platform)
        : [];
    const githubBlockers = extractGithubBlockers(githubSignals, 7).filter((item) => item.status === 'active');
    const calendarBlockers = extractCalendarBlockers(calendarSignals).filter((item) => item.status === 'active');
    const activeSignals = mergeBlockers(slackBlockers, projectBlockers, githubBlockers, calendarBlockers)
        .filter((item) => item.status === 'active');
    const meetingActionItems = Array.isArray(calendarSignals?.actionItems) ? calendarSignals.actionItems : [];
    const upcomingEvents = [...(Array.isArray(calendarSignals?.events) ? calendarSignals.events : [])]
        .filter((event) => event?.start)
        .sort((first, second) => new Date(first.start) - new Date(second.start));
    const nextMeeting = upcomingEvents[0] || null;
    const githubMeta = githubSignals?.meta || {};
    const openPullRequests = githubMeta.total_open || githubSignals?.pulls?.length || 0;
    const latestTopics = latestSummary?.key_topics || latestSummary?.keyTopics || [];

    const sources = [];
    if (channels.length > 0 || sortedSummaries.length > 0) sources.push('Slack');
    if (projectStats?.connected && projectStats?.platform) {
        sources.push(PROJECT_PLATFORM_LABELS[projectStats.platform] || projectStats.platform);
    }
    if (openPullRequests > 0 || githubBlockers.length > 0) sources.push('GitHub');
    if (meetingActionItems.length > 0 || upcomingEvents.length > 0) sources.push('Calendar');
    if (sources.length === 0) sources.push('Workspace setup');

    let headline = 'Teama has not found any connected work signals yet.';
    if (activeSignals.length > 0) {
        headline = `${activeSignals.length} cross-tool signal${activeSignals.length === 1 ? '' : 's'} need attention today.`;
    } else if (projectStats?.connected || sortedSummaries.length > 0 || upcomingEvents.length > 0 || openPullRequests > 0) {
        headline = 'Your team is steady right now, with no critical blockers surfaced.';
    } else if (channels.length > 0) {
        headline = 'Slack is ready. The next step is to turn activity into proactive team context.';
    }

    const summaryParts = [];
    if (latestSummary?.summary) {
        summaryParts.push(`Latest Slack signal: ${trimSentence(latestSummary.summary)}`);
    }
    if (projectStats?.connected && projectStats?.atRisk > 0) {
        summaryParts.push(`${projectStats.atRisk} project task${projectStats.atRisk === 1 ? '' : 's'} are already at risk in ${PROJECT_PLATFORM_LABELS[projectStats.platform] || projectStats.platform}.`);
    }
    if (githubBlockers.length > 0) {
        summaryParts.push(`${githubBlockers.length} pull request${githubBlockers.length === 1 ? '' : 's'} need review or have gone stale.`);
    }
    if (meetingActionItems.length > 0) {
        summaryParts.push(`${meetingActionItems.length} meeting follow-up item${meetingActionItems.length === 1 ? '' : 's'} are still open.`);
    }
    if (summaryParts.length === 0 && nextMeeting?.title) {
        summaryParts.push(`Next meeting on deck: ${nextMeeting.title} ${formatRelativeDate(nextMeeting.start)}.`);
    }
    if (summaryParts.length === 0) {
        summaryParts.push('Connect Slack, a project platform, and your team workflow tools so Teama can start surfacing what matters automatically.');
    }

    const attentionItems = [];
    if (slackBlockers.length > 0) {
        attentionItems.push({
            title: `${slackBlockers.length} Slack blocker${slackBlockers.length === 1 ? '' : 's'} surfaced`,
            description: describeSignals(slackBlockers),
            path: '/app/blockers'
        });
    }
    if (projectStats?.connected && projectStats?.atRisk > 0) {
        attentionItems.push({
            title: `${projectStats.atRisk} ${PROJECT_PLATFORM_LABELS[projectStats.platform] || 'project'} task${projectStats.atRisk === 1 ? '' : 's'} at risk`,
            description: projectBlockers.length > 0
                ? describeSignals(projectBlockers)
                : 'Deadlines are slipping or clustering close together. Review the project health panel for details.',
            path: '/app/projects'
        });
    }
    if (githubBlockers.length > 0) {
        attentionItems.push({
            title: `${githubBlockers.length} GitHub review signal${githubBlockers.length === 1 ? '' : 's'}`,
            description: describeSignals(githubBlockers),
            path: '/app/code'
        });
    }
    if (meetingActionItems.length > 0) {
        attentionItems.push({
            title: `${meetingActionItems.length} meeting follow-up item${meetingActionItems.length === 1 ? '' : 's'}`,
            description: describeActionItems(meetingActionItems),
            path: '/app/meetings'
        });
    }
    if (attentionItems.length === 0) {
        attentionItems.push({
            title: 'No urgent blockers detected',
            description: nextMeeting?.title
                ? `Next scheduled touchpoint: ${nextMeeting.title} ${formatRelativeDate(nextMeeting.start)}.`
                : 'Teama is not seeing any urgent blockers across your connected data right now.',
            path: '/app/analytics'
        });
    }

    const actions = [];
    if (channels.length === 0) {
        actions.push({
            title: 'Connect Slack first',
            description: 'Slack is the fastest way to start capturing live work signals, blockers, and progress updates.',
            path: '/app/integrations'
        });
    } else if (sortedSummaries.length === 0) {
        actions.push({
            title: 'Review Slack context',
            description: 'Use the Slack context view to inspect the conversation signals Teama is learning from across your workspace.',
            path: '/app/summaries'
        });
    }
    if (!projectStats?.connected) {
        actions.push({
            title: 'Add a project platform',
            description: 'Connect Jira, Asana, or Trello so Teama can link conversation signals to execution status.',
            path: '/app/integrations'
        });
    } else if (projectStats.atRisk > 0) {
        actions.push({
            title: 'Review at-risk project work',
            description: 'Open project health to triage overdue or due-soon tasks before they turn into missed commitments.',
            path: '/app/projects'
        });
    }
    if (githubBlockers.length > 0 || openPullRequests > 0) {
        actions.push({
            title: 'Check the code queue',
            description: githubBlockers.length > 0
                ? 'Teama found pull requests waiting on review or sitting stale.'
                : 'Use the code view to stay ahead of open pull request activity.',
            path: '/app/code'
        });
    }
    if (meetingActionItems.length > 0) {
        actions.push({
            title: 'Close meeting follow-ups',
            description: 'Review extracted action items from upcoming and recent meetings to keep follow-through visible.',
            path: '/app/meetings'
        });
    }
    if (actions.length === 0) {
        actions.push({
            title: 'Review team analytics',
            description: 'Dive into the trend view to understand workload, blockers, and communication patterns over time.',
            path: '/app/analytics'
        });
    }

    return {
        headline,
        summary: summaryParts.join(' '),
        sources,
        metrics: [
            {
                label: 'Signals',
                value: activeSignals.length,
                description: 'Active cross-tool issues or risk cues'
            },
            {
                label: 'Summaries',
                value: sortedSummaries.length,
                description: latestSummary
                    ? `${latestTopics.length} topic${latestTopics.length === 1 ? '' : 's'} in the latest read`
                    : 'No recent Slack summaries yet'
            },
            {
                label: 'Project Risk',
                value: projectStats?.connected ? projectStats.atRisk : '-',
                description: projectStats?.connected
                    ? `${PROJECT_PLATFORM_LABELS[projectStats.platform] || projectStats.platform} due-soon or overdue work`
                    : 'Connect a project platform'
            },
            {
                label: 'Meetings',
                value: upcomingEvents.length > 0 ? upcomingEvents.length : '-',
                description: nextMeeting?.title
                    ? `${nextMeeting.title} ${formatRelativeDate(nextMeeting.start)}`
                    : 'No upcoming meetings found'
            }
        ],
        attentionItems: attentionItems.slice(0, 4),
        actions: actions.slice(0, 4)
    };
}

function describeSignals(signals) {
    const titles = signals
        .map((item) => item?.title)
        .filter(Boolean)
        .slice(0, 2);

    if (titles.length === 0) {
        return 'Teama detected risk signals that need a closer look.';
    }

    return titles.join('  ');
}

function describeActionItems(actionItems) {
    const items = actionItems
        .map((item) => item?.text)
        .filter(Boolean)
        .slice(0, 2);

    if (items.length === 0) {
        return 'Open the meeting workspace to review extracted follow-up work.';
    }

    return items.join('  ');
}

function formatRelativeDate(value) {
    if (!value) return '';

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';

    const diffMs = date.getTime() - Date.now();
    const diffHours = Math.round(diffMs / (1000 * 60 * 60));
    const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

    if (Math.abs(diffHours) < 24) {
        if (diffHours === 0) return 'today';
        return diffHours > 0 ? `in ${diffHours}h` : `${Math.abs(diffHours)}h ago`;
    }

    if (diffDays === 0) return 'today';
    if (diffDays > 0) return `in ${diffDays} day${diffDays === 1 ? '' : 's'}`;
    return `${Math.abs(diffDays)} day${Math.abs(diffDays) === 1 ? '' : 's'} ago`;
}

function trimSentence(value, maxLength = 160) {
    const text = typeof value === 'string' ? value.trim() : '';
    if (text.length <= maxLength) return text;
    return `${text.slice(0, maxLength).trimEnd()}...`;
}
