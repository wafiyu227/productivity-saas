import { useCallback, useEffect, useMemo, useState } from 'react';
import {
    AlertTriangle,
    ArrowDownRight,
    ArrowUpRight,
    BarChart3,
    CheckCircle,
    Clock,
    MessageSquare,
    RefreshCw,
    Users,
    Activity,
    Target,
    Zap,
    ChevronRight,
    Filter
} from 'lucide-react';
import {
    Area,
    AreaChart,
    Bar,
    BarChart,
    CartesianGrid,
    Cell,
    Pie,
    PieChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis
} from 'recharts';
import { api } from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import {
    buildTopActiveBlockerData,
    createEmptyAsanaDeadlines,
    createEmptyCalendarSignals,
    createEmptyGithubPulls,
    extractProjectPlatformBlockers,
    extractCalendarBlockers,
    extractGithubBlockers,
    extractSlackBlockers,
    mergeBlockers
} from '../utils/blockerSignals';

const CHART_COLORS = ['#FFFFFF', '#E5E7EB', '#D1D5DB', '#9CA3AF', '#6B7280', '#4B5563'];
const GITHUB_STALE_DAYS = 7;
const GITHUB_BLOCKER_LIMIT = 25;
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

export default function Analytics() {
    const { user } = useAuth();
    const [summaries, setSummaries] = useState([]);
    const [projectDeadlines, setProjectDeadlines] = useState(createEmptyAsanaDeadlines());
    const [githubPulls, setGithubPulls] = useState(createEmptyGithubPulls());
    const [calendarSignals, setCalendarSignals] = useState(createEmptyCalendarSignals());
    const [loading, setLoading] = useState(true);
    const [timeRange, setTimeRange] = useState('7days');
    const [refreshing, setRefreshing] = useState(false);
    const [lastUpdated, setLastUpdated] = useState(null);
    const [activeProjectPlatform, setActiveProjectPlatform] = useState(null);
    const [projectPlatformNotice, setProjectPlatformNotice] = useState('');

    const getActiveProjectPlatforms = useCallback(async () => {
        const statuses = await Promise.all(
            PROJECT_PLATFORM_PRIORITY.map(async (platform) => ({
                platform,
                status: await api.getIntegrationStatus(platform).catch(() => ({ connected: false }))
            }))
        );
        return statuses.filter((entry) => entry.status?.connected).map((entry) => entry.platform);
    }, []);

    const loadAnalytics = useCallback(async ({ showLoader = true } = {}) => {
        if (!user) return;

        if (showLoader) setLoading(true);
        try {
            const connectedPlatforms = await getActiveProjectPlatforms();
            setActiveProjectPlatform(connectedPlatforms);

            const projectDeadlinePromises = connectedPlatforms.map(platform => {
                const fetcher = PROJECT_PLATFORM_DEADLINE_FETCHERS[platform];
                return fetcher ? fetcher().then(res => ({platform, data: res})).catch(() => ({platform, data: createEmptyAsanaDeadlines()})) : Promise.resolve({platform, data: createEmptyAsanaDeadlines()});
            });

            const [summaryData, deadlinesList, githubData, calendarData] = await Promise.all([
                api.getSummaries({ limit: 500 }),
                Promise.all(projectDeadlinePromises),
                api.getGithubPulls({ limit: GITHUB_BLOCKER_LIMIT, staleDays: GITHUB_STALE_DAYS }).catch(() => createEmptyGithubPulls()),
                api.getGoogleCalendarActionItems(CALENDAR_BLOCKER_WINDOW_DAYS).catch(() => createEmptyCalendarSignals())
            ]);

            setSummaries(Array.isArray(summaryData) ? summaryData : []);

            setProjectDeadlines(deadlinesList.map(item => ({
                platform: item.platform,
                deadlines: item.data?.error ? createEmptyAsanaDeadlines() : (item.data || createEmptyAsanaDeadlines())
            })));

            if (githubData?.error) {
                setGithubPulls(createEmptyGithubPulls());
            } else {
                setGithubPulls(githubData || createEmptyGithubPulls());
            }

            if (calendarData?.error || calendarData?.needsReauth) {
                setCalendarSignals(createEmptyCalendarSignals());
            } else {
                setCalendarSignals(calendarData || createEmptyCalendarSignals());
            }

            if (connectedPlatforms.length > 0) {
                setProjectPlatformNotice(`${connectedPlatforms.map(p => PROJECT_PLATFORM_LABELS[p]).join(' and ')} active.`);
            } else {
                setProjectPlatformNotice('');
            }
            setLastUpdated(new Date());
        } catch (error) {
            console.error('Failed to load analytics:', error);
            setProjectDeadlines([]);
            setGithubPulls(createEmptyGithubPulls());
            setCalendarSignals(createEmptyCalendarSignals());
            setActiveProjectPlatform([]);
            setProjectPlatformNotice('');
        } finally {
            if (showLoader) setLoading(false);
        }
    }, [user, getActiveProjectPlatforms]);

    useEffect(() => {
        if (user) {
            loadAnalytics({ showLoader: true });
        }
    }, [user, loadAnalytics]);

    useEffect(() => {
        if (!user) return undefined;

        const filter = `user_id=eq.${user.id}`;

        const channel = supabase
            .channel(`analytics-live-${user.id}-${Date.now()}`)
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'slack_summaries',
                filter
            }, () => {
                loadAnalytics({ showLoader: false });
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [user, user?.id, loadAnalytics]);

    const handleRefresh = async () => {
        setRefreshing(true);
        await loadAnalytics({ showLoader: false });
        setRefreshing(false);
    };

    const filteredSummaries = useMemo(
        () => filterSummariesByRange(summaries, timeRange),
        [summaries, timeRange]
    );

    const analytics = useMemo(
        () => calculateAnalytics(summaries, timeRange, {
            projectDeadlines,
            activeProjectPlatform,
            githubPulls,
            calendarSignals,
            githubStaleDays: GITHUB_STALE_DAYS
        }),
        [summaries, timeRange, projectDeadlines, activeProjectPlatform, githubPulls, calendarSignals]
    );
    const activityData = useMemo(
        () => buildActivityData(filteredSummaries, timeRange),
        [filteredSummaries, timeRange]
    );
    const channelData = useMemo(
        () => buildChannelData(filteredSummaries),
        [filteredSummaries]
    );
    const blockerData = useMemo(() => {
        let projectBlockers = [];
        if (Array.isArray(projectDeadlines)) {
            projectDeadlines.forEach(item => {
                projectBlockers = projectBlockers.concat(extractProjectPlatformBlockers(item.deadlines, item.platform));
            });
        }
        const combined = mergeBlockers(
            extractSlackBlockers(filteredSummaries),
            projectBlockers,
            extractGithubBlockers(githubPulls, GITHUB_STALE_DAYS),
            extractCalendarBlockers(calendarSignals)
        );
        return buildTopActiveBlockerData(combined, 8);
    }, [filteredSummaries, projectDeadlines, githubPulls, calendarSignals]);

    return (
        <div className="min-h-screen bg-black text-white selection:bg-blue-500/30">

            <div className="relative mx-auto max-w-7xl px-4 pb-20 pt-4 md:px-8 md:pt-8">
                {/* Header */}
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-8 mb-10 md:mb-16 animate-in fade-in slide-in-from-bottom-4 duration-700">
                    <div>
                        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-[10px] font-bold uppercase tracking-widest text-white">
                            Data
                        </div>
                        <h1 className="text-4xl font-bold text-white uppercase tracking-tight md:text-6xl">Analytics</h1>
                        <div className="mt-4 flex flex-wrap items-center gap-6">
                            <p className="max-w-xl text-sm leading-relaxed text-gray-400 font-bold uppercase tracking-widest">
                                Track activity and blockers across your workspaces.
                            </p>
                            {lastUpdated && (
                                <div className="flex items-center gap-2 px-3 py-1 bg-white/[0.03] border border-white/5 rounded-lg text-[9px] font-black uppercase tracking-widest text-gray-400">
                                    <Clock size={12} />
                                    Synced: {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                </div>
                            )}
                        </div>
                    </div>
                    
                    <button
                        onClick={handleRefresh}
                        disabled={refreshing}
                        className="p-4 rounded-[2rem] bg-white text-black hover:bg-gray-200 transition-all active:scale-95 shadow-2xl disabled:opacity-20 flex items-center gap-4"
                    >
                        <RefreshCw
                            size={20}
                            className={refreshing ? 'animate-spin' : ''}
                        />
                        <span className="text-[10px] font-bold uppercase tracking-widest px-2">Refresh</span>
                    </button>
                </div>

                {projectPlatformNotice && (
                    <div className="mb-10 rounded-[2rem] border border-amber-500/20 bg-amber-500/10 px-8 py-6 text-[11px] font-black uppercase tracking-widest text-amber-400 animate-in fade-in slide-in-from-top-4 duration-500 flex items-center gap-4">
                        <div className="w-2 h-2 bg-amber-500 rounded-full animate-pulse"></div>
                        {projectPlatformNotice}
                    </div>
                )}

                {/* Range Selector */}
                <div className="mb-10 flex flex-wrap gap-2 animate-in fade-in slide-in-from-bottom-6 duration-700 delay-100">
                    {[
                        { label: 'Today', value: '1day' },
                        { label: '7 Days', value: '7days' },
                        { label: '30 Days', value: '30days' },
                        { label: 'All Time', value: 'all' }
                    ].map((option) => (
                        <button
                            key={option.value}
                            onClick={() => setTimeRange(option.value)}
                            className={`px-6 py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all border ${timeRange === option.value
                                ? 'bg-white text-black border-white'
                                : 'bg-white/5 text-gray-400 border-white/10 hover:bg-white/10 hover:text-white'
                                }`}
                        >
                            {option.label}
                        </button>
                    ))}
                </div>

                {loading ? (
                    <LoadingState />
                ) : (
                    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-200">
                        {/* Metric Grid */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
                            <MetricCard
                                title="Messages"
                                value={analytics.totalMessages}
                                change={analytics.messageChange}
                                trend={analytics.messageChange >= 0 ? 'up' : 'down'}
                                icon={<MessageSquare className="text-white" size={24} />}
                                color="white"
                            />
                            <MetricCard
                                title="Active Blockers"
                                value={analytics.activeBlockers}
                                change={analytics.blockerChange}
                                trend={analytics.blockerChange <= 0 ? 'down' : 'up'}
                                icon={<AlertTriangle className="text-white" size={24} />}
                                color="white"
                            />
                            <MetricCard
                                title="Channels"
                                value={analytics.channelCount}
                                change={analytics.channelChange}
                                trend={analytics.channelChange >= 0 ? 'up' : 'down'}
                                icon={<Users className="text-white" size={24} />}
                                color="white"
                            />
                            <MetricCard
                                title="Summaries"
                                value={analytics.summaryCount}
                                change={analytics.summaryChange}
                                trend={analytics.summaryChange >= 0 ? 'up' : 'down'}
                                icon={<BarChart3 className="text-white" size={24} />}
                                color="white"
                            />
                        </div>

                        {/* Charts Area */}
                        <div className="grid lg:grid-cols-3 gap-6 md:gap-8">
                            <div className="lg:col-span-2 bg-white/[0.01] rounded-[2.5rem] border border-white/5 p-8 shadow-2xl transition-all hover:border-white/10 group">
                                <div className="flex items-center gap-4 mb-8">
                                    <div className="p-3 rounded-2xl bg-white/5 border border-white/10 text-white">
                                        <Activity size={20} />
                                    </div>
                                    <div>
                                        <h2 className="text-xl font-bold text-white uppercase tracking-widest">Activity</h2>
                                    </div>
                                </div>
                                <ActivityChart data={activityData} />
                            </div>

                            <div className="bg-white/[0.01] rounded-[2.5rem] border border-white/5 p-8 shadow-2xl transition-all hover:border-white/10 group">
                                <div className="flex items-center gap-4 mb-8">
                                    <div className="p-3 rounded-2xl bg-white/5 border border-white/10 text-white">
                                        <Target size={20} />
                                    </div>
                                    <div>
                                        <h2 className="text-xl font-bold text-white uppercase tracking-widest">Channels</h2>
                                    </div>
                                </div>
                                <ChannelDistribution data={channelData} />
                            </div>
                        </div>

                        <div className="bg-white/[0.01] rounded-[2.5rem] border border-white/5 p-8 shadow-2xl transition-all hover:border-white/10 group">
                            <div className="flex items-center gap-4 mb-8">
                                <div className="p-3 rounded-2xl bg-white/5 border border-white/10 text-white">
                                    <AlertTriangle size={20} />
                                </div>
                                <div>
                                    <h2 className="text-xl font-bold text-white uppercase tracking-widest">Blockers</h2>
                                </div>
                            </div>
                            <BlockersAnalysis data={blockerData} />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
                            <PerformanceMetrics analytics={analytics} />
                            <EngagementMetrics analytics={analytics} />
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

function MetricCard({ title, value, change, trend, icon }) {
    const trendColor = trend === 'up' ? 'text-white' : 'text-gray-400';
    const TrendIcon = trend === 'up' ? ArrowUpRight : ArrowDownRight;

    return (
        <div className="rounded-[2rem] border border-white/5 bg-white/[0.01] p-8 shadow-2xl transition-all hover:border-white/10 group">
            <div className="flex items-center justify-between mb-6">
                <div className="p-4 rounded-2xl border border-white/10 bg-white/5 transition-transform group-hover:scale-110 duration-500">
                    {icon}
                </div>
                <div className={`flex items-center gap-1.5 px-3 py-1 bg-white/5 rounded-lg border border-white/10 ${trendColor} text-[10px] font-bold`}>
                    <TrendIcon size={14} />
                    {Math.abs(change)}%
                </div>
            </div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">{title}</p>
            <p className="text-4xl font-bold text-white tracking-tight">{value.toLocaleString()}</p>
        </div>
    );
}

function ActivityChart({ data }) {
    if (!data.length) {
        return <EmptyState message="SIGNAL STREAM VOID" />;
    }

    return (
        <div className="h-[320px] w-full mt-4">
            <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                    <linearGradient id="activityFill" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#FFFFFF" stopOpacity={0.1} />
                            <stop offset="95%" stopColor="#FFFFFF" stopOpacity={0} />
                        </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
                    <XAxis 
                        dataKey="label" 
                        axisLine={false} 
                        tickLine={false}
                        tick={{ fill: '#4b5563', fontSize: 10, fontWeight: 900, textTransform: 'uppercase' }} 
                        dy={10}
                    />
                    <YAxis 
                        allowDecimals={false} 
                        axisLine={false} 
                        tickLine={false}
                        tick={{ fill: '#4b5563', fontSize: 10, fontWeight: 900 }} 
                    />
                    <Tooltip 
                        contentStyle={{ backgroundColor: '#09090b', borderColor: '#ffffff10', borderRadius: '1rem', fontSize: '12px', fontWeight: 'bold' }}
                        itemStyle={{ color: '#fff' }}
                        cursor={{ stroke: '#ffffff10' }}
                    />
                    <Area
                        type="monotone"
                        dataKey="summaries"
                        stroke="#FFFFFF"
                        strokeWidth={2}
                        fill="url(#activityFill)"
                        animationDuration={1000}
                    />
                </AreaChart>
            </ResponsiveContainer>
        </div>
    );
}

function ChannelDistribution({ data }) {
    if (!data.length) {
        return <EmptyState message="NODE DISTRIBUTION VOID" />;
    }

    return (
        <div className="space-y-10 mt-4">
            <div className="h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Pie
                            data={data}
                            dataKey="count"
                            nameKey="name"
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={85}
                            paddingAngle={8}
                            stroke="none"
                        >
                            {data.map((entry, index) => (
                                <Cell key={entry.name} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                            ))}
                        </Pie>
                        <Tooltip />
                    </PieChart>
                </ResponsiveContainer>
            </div>
            <div className="space-y-4">
                {data.map((entry, index) => (
                    <div key={entry.name} className="flex items-center justify-between text-[11px] font-black uppercase tracking-widest">
                        <div className="flex items-center gap-3">
                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }}></div>
                            <span className="text-gray-400 group-hover:text-white transition-colors">#{entry.name}</span>
                        </div>
                        <span className="text-white">
                            {entry.count} <span className="text-gray-400 ml-2">[{entry.share}%]</span>
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
}

function BlockersAnalysis({ data }) {
    if (!data.length) {
        return (
            <div className="text-center py-16 opacity-40">
                <CheckCircle size={48} className="mx-auto mb-6 text-emerald-500" />
                <p className="text-[11px] font-black uppercase tracking-[0.3em]">ALL VECTORS CLEAR</p>
            </div>
        );
    }

    return (
        <div className="h-[320px] w-full mt-4">
            <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data} layout="vertical" margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" horizontal={false} />
                    <XAxis type="number" hide />
                    <YAxis 
                        type="category" 
                        dataKey="name" 
                        width={120} 
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: '#4b5563', fontSize: 10, fontWeight: 900, textTransform: 'uppercase' }} 
                    />
                    <Tooltip 
                        contentStyle={{ backgroundColor: '#09090b', borderColor: '#ffffff10', borderRadius: '1rem', fontSize: '12px', fontWeight: 'bold' }}
                        cursor={{ fill: '#ffffff05' }}
                    />
                    <Bar dataKey="count" fill="#FFFFFF" radius={[0, 4, 4, 0]} barSize={20} />
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
}

function PerformanceMetrics({ analytics }) {
    const metricRows = [
        {
            label: 'Avg Messages',
            value: analytics.avgMessagesPerSummary.toFixed(1),
            icon: MessageSquare,
            color: 'text-white border-white/10'
        },
        {
            label: 'Avg Blockers',
            value: analytics.avgTotalBlockersPerSummary.toFixed(2),
            icon: AlertTriangle,
            color: 'text-white border-white/10'
        },
        {
            label: 'Channels',
            value: analytics.channelCount.toString(),
            icon: Users,
            color: 'text-white border-white/10'
        },
        {
            label: 'Resolution Rate',
            value: `${analytics.resolutionRate}%`,
            icon: CheckCircle,
            color: 'text-white border-white/10'
        }
    ];

    return (
        <div className="bg-white/[0.01] rounded-[2.5rem] border border-white/5 p-8 shadow-2xl transition-all hover:border-white/10 group">
            <div className="flex items-center gap-4 mb-10">
                <div className="p-3 rounded-2xl bg-white/5 border border-white/10">
                    <Zap size={20} className="text-white" />
                </div>
                <div>
                    <h2 className="text-xl font-bold text-white uppercase tracking-widest">Performance</h2>
                </div>
            </div>
            <div className="space-y-3">
                {metricRows.map((row) => {
                    const IconComponent = row.icon;
                    return (
                        <div key={row.label} className="flex items-center justify-between p-5 rounded-[1.5rem] bg-white/[0.02] border border-white/5 hover:bg-white/[0.04] transition-all group/item">
                            <div className="flex items-center gap-4">
                                <div className={`p-2.5 rounded-xl border ${row.color}`}>
                                    <IconComponent size={16} />
                                </div>
                                <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest group-hover/item:text-white transition-colors">{row.label}</p>
                            </div>
                            <p className="text-2xl font-bold text-white">{row.value}</p>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

function EngagementMetrics({ analytics }) {
    const cards = [
        { label: 'Summaries', value: analytics.summaryCount, color: 'text-white' },
        { label: 'Resolved', value: analytics.resolvedBlockers, color: 'text-white' },
        { label: 'Avg/Day', value: analytics.avgSummariesPerActiveDay, color: 'text-white' },
        { label: 'Active', value: analytics.activeBlockers, color: 'text-white' }
    ];

    return (
        <div className="bg-white/[0.01] rounded-[2.5rem] border border-white/5 p-8 shadow-2xl transition-all hover:border-white/10 group">
            <div className="flex items-center gap-4 mb-10">
                <div className="p-3 rounded-2xl bg-white/5 border border-white/10">
                    <Activity size={20} className="text-white" />
                </div>
                <div>
                    <h2 className="text-xl font-bold text-white uppercase tracking-widest">Engagement</h2>
                </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
                {cards.map((metric) => (
                    <div key={metric.label} className="p-6 rounded-[2rem] bg-white/[0.02] border border-white/5 hover:bg-white/5 transition-all flex flex-col items-center justify-center text-center">
                        <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-2">{metric.label}</span>
                        <span className={`text-3xl font-bold ${metric.color}`}>{metric.value}</span>
                    </div>
                ))}
            </div>
            
            <div className="mt-8 p-6 rounded-[1.5rem] bg-white/5 border border-white/10 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-1.5 h-1.5 bg-white rounded-full"></div>
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Active Days</span>
                </div>
                <span className="text-sm font-bold text-white uppercase">{analytics.activeDays} DAYS</span>
            </div>
        </div>
    );
}

function LoadingState() {
    return (
        <div className="flex flex-col items-center justify-center py-40 gap-8 animate-in fade-in duration-700">
            <div className="w-12 h-12 border-4 border-white/5 border-t-white rounded-full animate-spin"></div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Loading...</p>
        </div>
    );
}

function EmptyState({ message }) {
    return (
        <div className="h-full min-h-56 flex flex-col items-center justify-center gap-4">
            <div className="w-12 h-12 bg-white/[0.02] border border-white/5 rounded-2xl flex items-center justify-center">
                <ChevronRight size={20} className="text-gray-400" />
            </div>
            <span className="text-[10px] font-black uppercase tracking-[0.4em] text-gray-400">{message}</span>
        </div>
    );
}

function filterSummariesByRange(summaries, timeRange) {
    if (timeRange === 'all') return summaries;

    const dayMap = { '1day': 1, '7days': 7, '30days': 30 };
    const days = dayMap[timeRange] || 7;
    const cutoff = Date.now() - (days * 24 * 60 * 60 * 1000);

    return summaries.filter((summary) => {
        const timestamp = new Date(summary.created_at).getTime();
        return Number.isFinite(timestamp) && timestamp >= cutoff;
    });
}

function calculateAnalytics(summaries, timeRange, signals) {
    const {
        projectDeadlines,
        githubPulls,
        calendarSignals,
        githubStaleDays
    } = signals || {};

    const currentPeriod = filterSummariesByRange(summaries, timeRange);
    const previousPeriod = getPreviousPeriodSummaries(summaries, timeRange);

    const currentMessages = sumMessages(currentPeriod);
    let projectBlockers = [];
    if (Array.isArray(projectDeadlines)) {
        projectDeadlines.forEach(item => {
            projectBlockers = projectBlockers.concat(extractProjectPlatformBlockers(item.deadlines, item.platform));
        });
    }
    const externalSignals = mergeBlockers(
        projectBlockers,
        extractGithubBlockers(githubPulls, githubStaleDays || GITHUB_STALE_DAYS),
        extractCalendarBlockers(calendarSignals)
    );
    const currentBlockers = mergeBlockers(
        extractSlackBlockers(currentPeriod),
        externalSignals
    );
    const currentChannels = new Set(currentPeriod.map((summary) => summary.channel_id)).size;
    const currentSummaries = currentPeriod.length;

    const previousMessages = sumMessages(previousPeriod);
    const previousBlockers = mergeBlockers(
        extractSlackBlockers(previousPeriod),
        externalSignals
    );
    const previousChannels = new Set(previousPeriod.map((summary) => summary.channel_id)).size;
    const previousSummaries = previousPeriod.length;
    const currentCounts = countByStatus(currentBlockers);
    const previousCounts = countByStatus(previousBlockers);

    const activeDays = new Set(
        currentPeriod.map((summary) => new Date(summary.created_at).toISOString().split('T')[0])
    ).size;

    const avgMessagesPerSummary = currentSummaries > 0 ? currentMessages / currentSummaries : 0;
    const totalCurrentBlockers = currentCounts.active + currentCounts.resolved;
    const avgTotalBlockersPerSummary = currentSummaries > 0 ? totalCurrentBlockers / currentSummaries : 0;
    const resolutionRate = totalCurrentBlockers > 0
        ? Math.round((currentCounts.resolved / totalCurrentBlockers) * 100)
        : 0;

    return {
        totalMessages: currentMessages,
        activeBlockers: currentCounts.active,
        resolvedBlockers: currentCounts.resolved,
        channelCount: currentChannels,
        summaryCount: currentSummaries,
        messageChange: calculateChange(currentMessages, previousMessages),
        blockerChange: calculateChange(currentCounts.active, previousCounts.active),
        channelChange: calculateChange(currentChannels, previousChannels),
        summaryChange: calculateChange(currentSummaries, previousSummaries),
        avgMessagesPerSummary,
        avgTotalBlockersPerSummary,
        resolutionRate,
        activeDays,
        avgSummariesPerActiveDay: activeDays > 0 ? (currentSummaries / activeDays).toFixed(1) : '0.0'
    };
}

function getPreviousPeriodSummaries(summaries, timeRange) {
    if (timeRange === 'all') return [];

    const dayMap = { '1day': 1, '7days': 7, '30days': 30 };
    const days = dayMap[timeRange] || 7;
    const now = Date.now();
    const currentStart = now - (days * 24 * 60 * 60 * 1000);
    const previousStart = now - (days * 2 * 24 * 60 * 60 * 1000);

    return summaries.filter((summary) => {
        const timestamp = new Date(summary.created_at).getTime();
        return Number.isFinite(timestamp) && timestamp >= previousStart && timestamp < currentStart;
    });
}

function buildActivityData(summaries, timeRange) {
    const grouped = {};

    summaries.forEach((summary) => {
        const date = new Date(summary.created_at);
        if (Number.isNaN(date.getTime())) return;
        const key = date.toISOString().split('T')[0];
        grouped[key] = (grouped[key] || 0) + 1;
    });

    const maxPoints = timeRange === 'all' ? 30 : 14;
    return Object.entries(grouped)
        .sort(([a], [b]) => a.localeCompare(b))
        .slice(-maxPoints)
        .map(([date, count]) => ({
            label: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
            summaries: count
        }));
}

function buildChannelData(summaries) {
    const counts = {};
    summaries.forEach((summary) => {
        const name = summary.channel_name || 'unknown';
        counts[name] = (counts[name] || 0) + 1;
    });

    const rows = Object.entries(counts)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 6);

    const total = rows.reduce((sum, row) => sum + row.count, 0) || 1;
    return rows.map((row) => ({
        ...row,
        share: Math.round((row.count / total) * 100)
    }));
}

function sumMessages(summaries) {
    return summaries.reduce((total, summary) => total + (summary.message_count || 0), 0);
}

function countByStatus(blockers) {
    return (Array.isArray(blockers) ? blockers : []).reduce((acc, blocker) => {
        if (blocker?.status === 'resolved') {
            acc.resolved += 1;
        } else {
            acc.active += 1;
        }
        return acc;
    }, { active: 0, resolved: 0 });
}

function calculateChange(current, previous) {
    if (!previous) return 0;
    return Math.round(((current - previous) / previous) * 100);
}
