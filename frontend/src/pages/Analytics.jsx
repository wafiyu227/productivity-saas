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
    Users
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

const CHART_COLORS = ['#2563EB', '#06B6D4', '#0EA5E9', '#6366F1', '#14B8A6', '#0284C7'];

export default function Analytics() {
    const { user, profile } = useAuth();
    const [summaries, setSummaries] = useState([]);
    const [loading, setLoading] = useState(true);
    const [timeRange, setTimeRange] = useState('7days');
    const [refreshing, setRefreshing] = useState(false);
    const [lastUpdated, setLastUpdated] = useState(null);

    const loadAnalytics = useCallback(async ({ showLoader = true } = {}) => {
        if (!user) return;

        if (showLoader) setLoading(true);
        try {
            const data = await api.getSummaries(profile?.current_team_id, { limit: 500 });
            setSummaries(Array.isArray(data) ? data : []);
            setLastUpdated(new Date());
        } catch (error) {
            console.error('Failed to load analytics:', error);
        } finally {
            if (showLoader) setLoading(false);
        }
    }, [user, profile?.current_team_id]);

    useEffect(() => {
        if (user && profile) {
            loadAnalytics({ showLoader: true });
        }
    }, [user, profile, loadAnalytics]);

    useEffect(() => {
        if (!user) return undefined;

        const filters = [];
        if (profile?.current_team_id) {
            filters.push(`team_id=eq.${profile.current_team_id}`);
        } else {
            filters.push(`user_id=eq.${user.id}`);
        }

        const channels = filters.map((filter, index) => (
            supabase
                .channel(`analytics-live-${user.id}-${index}-${Date.now()}`)
                .on('postgres_changes', {
                    event: '*',
                    schema: 'public',
                    table: 'slack_summaries',
                    filter
                }, () => {
                    loadAnalytics({ showLoader: false });
                })
                .subscribe()
        ));

        return () => {
            channels.forEach((channel) => {
                supabase.removeChannel(channel);
            });
        };
    }, [user, user?.id, profile?.current_team_id, loadAnalytics]);

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
        () => calculateAnalytics(summaries, timeRange),
        [summaries, timeRange]
    );
    const activityData = useMemo(
        () => buildActivityData(filteredSummaries, timeRange),
        [filteredSummaries, timeRange]
    );
    const channelData = useMemo(
        () => buildChannelData(filteredSummaries),
        [filteredSummaries]
    );
    const blockerData = useMemo(
        () => buildBlockerData(filteredSummaries),
        [filteredSummaries]
    );

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
            <div className="p-8">
                <div className="max-w-7xl mx-auto">
                    <div className="mb-8 flex items-center justify-between">
                        <div>
                            <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent mb-2">
                                Analytics & Insights
                            </h1>
                            <p className="text-lg text-gray-600">
                                Live team productivity and collaboration metrics
                            </p>
                            {lastUpdated && (
                                <p className="text-sm text-gray-500 mt-1">
                                    Updated {lastUpdated.toLocaleTimeString()}
                                </p>
                            )}
                        </div>
                        <button
                            onClick={handleRefresh}
                            disabled={refreshing}
                            className="p-3 rounded-lg bg-white border border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition"
                            title="Refresh analytics"
                        >
                            <RefreshCw
                                size={20}
                                className={`text-gray-600 ${refreshing ? 'animate-spin' : ''}`}
                            />
                        </button>
                    </div>

                    <div className="mb-8 flex gap-2">
                        {[
                            { label: 'Today', value: '1day' },
                            { label: '7 Days', value: '7days' },
                            { label: '30 Days', value: '30days' },
                            { label: 'All Time', value: 'all' }
                        ].map((option) => (
                            <button
                                key={option.value}
                                onClick={() => setTimeRange(option.value)}
                                className={`px-4 py-2 rounded-lg font-medium transition-all ${timeRange === option.value
                                    ? 'bg-blue-600 text-white shadow-lg'
                                    : 'bg-white text-gray-700 border border-gray-200 hover:border-blue-300'
                                    }`}
                            >
                                {option.label}
                            </button>
                        ))}
                    </div>

                    {loading ? (
                        <LoadingState />
                    ) : (
                        <>
                            <div className="grid md:grid-cols-4 gap-6 mb-8">
                                <MetricCard
                                    title="Total Messages"
                                    value={analytics.totalMessages}
                                    change={analytics.messageChange}
                                    trend={analytics.messageChange >= 0 ? 'up' : 'down'}
                                    icon={<MessageSquare className="text-blue-600" size={24} />}
                                    color="blue"
                                />
                                <MetricCard
                                    title="Active Blockers"
                                    value={analytics.activeBlockers}
                                    change={analytics.blockerChange}
                                    trend={analytics.blockerChange <= 0 ? 'down' : 'up'}
                                    icon={<AlertTriangle className="text-red-600" size={24} />}
                                    color="red"
                                />
                                <MetricCard
                                    title="Channels"
                                    value={analytics.channelCount}
                                    change={analytics.channelChange}
                                    trend={analytics.channelChange >= 0 ? 'up' : 'down'}
                                    icon={<Users className="text-indigo-600" size={24} />}
                                    color="indigo"
                                />
                                <MetricCard
                                    title="Summaries"
                                    value={analytics.summaryCount}
                                    change={analytics.summaryChange}
                                    trend={analytics.summaryChange >= 0 ? 'up' : 'down'}
                                    icon={<BarChart3 className="text-green-600" size={24} />}
                                    color="green"
                                />
                            </div>

                            <div className="grid lg:grid-cols-3 gap-8 mb-8">
                                <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                                    <h2 className="text-xl font-bold text-gray-900 mb-6">Activity Over Time</h2>
                                    <ActivityChart data={activityData} />
                                </div>

                                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                                    <h2 className="text-xl font-bold text-gray-900 mb-6">Top Channels</h2>
                                    <ChannelDistribution data={channelData} />
                                </div>
                            </div>

                            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-8">
                                <h2 className="text-xl font-bold text-gray-900 mb-6">Top Active Blockers</h2>
                                <BlockersAnalysis data={blockerData} />
                            </div>

                            <div className="grid md:grid-cols-2 gap-8">
                                <PerformanceMetrics analytics={analytics} />
                                <EngagementMetrics analytics={analytics} />
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}

function MetricCard({ title, value, change, trend, icon, color }) {
    const colorClasses = {
        blue: 'bg-blue-50 border-blue-200',
        red: 'bg-red-50 border-red-200',
        green: 'bg-green-50 border-green-200',
        indigo: 'bg-indigo-50 border-indigo-200'
    };

    const trendColor = trend === 'up' ? 'text-green-600' : 'text-red-600';
    const TrendIcon = trend === 'up' ? ArrowUpRight : ArrowDownRight;

    return (
        <div className={`rounded-2xl border p-6 ${colorClasses[color]}`}>
            <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-white rounded-xl">{icon}</div>
                <div className={`flex items-center gap-1 ${trendColor} text-sm font-semibold`}>
                    <TrendIcon size={16} />
                    {Math.abs(change)}%
                </div>
            </div>
            <p className="text-sm text-gray-600 mb-1">{title}</p>
            <p className="text-3xl font-bold text-gray-900">{value.toLocaleString()}</p>
        </div>
    );
}

function ActivityChart({ data }) {
    if (!data.length) {
        return <EmptyState message="No activity data available" />;
    }

    return (
        <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 8 }}>
                    <defs>
                        <linearGradient id="activityFill" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#2563EB" stopOpacity={0.35} />
                            <stop offset="95%" stopColor="#2563EB" stopOpacity={0.05} />
                        </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                    <XAxis dataKey="label" tick={{ fill: '#475569', fontSize: 12 }} />
                    <YAxis allowDecimals={false} tick={{ fill: '#475569', fontSize: 12 }} />
                    <Tooltip />
                    <Area
                        type="monotone"
                        dataKey="summaries"
                        stroke="#2563EB"
                        strokeWidth={3}
                        fill="url(#activityFill)"
                    />
                </AreaChart>
            </ResponsiveContainer>
        </div>
    );
}

function ChannelDistribution({ data }) {
    if (!data.length) {
        return <EmptyState message="No channel data available" />;
    }

    return (
        <div className="space-y-6">
            <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Pie
                            data={data}
                            dataKey="count"
                            nameKey="name"
                            cx="50%"
                            cy="50%"
                            outerRadius={72}
                        >
                            {data.map((entry, index) => (
                                <Cell key={entry.name} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                            ))}
                        </Pie>
                        <Tooltip />
                    </PieChart>
                </ResponsiveContainer>
            </div>
            <div className="space-y-2">
                {data.map((entry) => (
                    <div key={entry.name} className="flex items-center justify-between text-sm">
                        <span className="text-gray-700">#{entry.name}</span>
                        <span className="font-semibold text-gray-900">
                            {entry.count} ({entry.share}%)
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
            <div className="text-center py-8 text-gray-600">
                <CheckCircle size={32} className="mx-auto mb-2 text-green-500" />
                <p>No blockers detected in this range.</p>
            </div>
        );
    }

    return (
        <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, left: 16, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                    <XAxis type="number" allowDecimals={false} />
                    <YAxis type="category" dataKey="name" width={180} tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Bar dataKey="count" fill="#DC2626" radius={[0, 6, 6, 0]} />
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
}

function PerformanceMetrics({ analytics }) {
    const metricRows = [
        {
            label: 'Avg Messages per Summary',
            value: analytics.avgMessagesPerSummary.toFixed(1),
            icon: MessageSquare,
            badgeClass: 'bg-blue-50 text-blue-700'
        },
        {
            label: 'Blockers per Summary',
            value: analytics.avgTotalBlockersPerSummary.toFixed(2),
            icon: AlertTriangle,
            badgeClass: 'bg-red-50 text-red-700'
        },
        {
            label: 'Active Channels',
            value: analytics.channelCount.toString(),
            icon: Users,
            badgeClass: 'bg-indigo-50 text-indigo-700'
        },
        {
            label: 'Resolution Rate',
            value: `${analytics.resolutionRate}%`,
            icon: CheckCircle,
            badgeClass: 'bg-green-50 text-green-700'
        }
    ];

    return (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-6">Team Performance</h2>
            <div className="space-y-4">
                {metricRows.map((row) => {
                    const IconComponent = row.icon;
                    return (
                        <div key={row.label} className="flex items-center justify-between p-4 rounded-lg border border-gray-100">
                            <div className="flex items-center gap-3">
                                <div className={`p-2 rounded-lg ${row.badgeClass}`}>
                                    <IconComponent size={18} />
                                </div>
                                <p className="text-gray-700 font-medium">{row.label}</p>
                            </div>
                            <p className="text-2xl font-bold text-gray-900">{row.value}</p>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

function EngagementMetrics({ analytics }) {
    const cards = [
        {
            label: 'Summaries Generated',
            value: analytics.summaryCount
        },
        {
            label: 'Resolved Blockers',
            value: analytics.resolvedBlockers
        },
        {
            label: 'Avg per Active Day',
            value: analytics.avgSummariesPerActiveDay
        },
        {
            label: 'Open Blockers',
            value: analytics.activeBlockers
        }
    ];

    return (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-6">Team Engagement</h2>
            <div className="grid grid-cols-2 gap-4">
                {cards.map((metric) => (
                    <div key={metric.label} className="p-4 rounded-lg border border-gray-100 hover:border-blue-200 hover:bg-blue-50 transition">
                        <p className="text-sm text-gray-600 mb-2">{metric.label}</p>
                        <p className="text-2xl font-bold text-gray-900">{metric.value}</p>
                    </div>
                ))}
            </div>
        </div>
    );
}

function LoadingState() {
    return (
        <div className="flex items-center justify-center h-96">
            <div className="text-center">
                <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4" />
                <p className="text-gray-600">Loading analytics...</p>
            </div>
        </div>
    );
}

function EmptyState({ message }) {
    return (
        <div className="h-full min-h-56 flex items-center justify-center text-gray-500">
            {message}
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

function calculateAnalytics(summaries, timeRange) {
    const currentPeriod = filterSummariesByRange(summaries, timeRange);
    const previousPeriod = getPreviousPeriodSummaries(summaries, timeRange);

    const currentMessages = sumMessages(currentPeriod);
    const currentBlockers = countBlockers(currentPeriod);
    const currentChannels = new Set(currentPeriod.map((summary) => summary.channel_id)).size;
    const currentSummaries = currentPeriod.length;

    const previousMessages = sumMessages(previousPeriod);
    const previousBlockers = countBlockers(previousPeriod);
    const previousChannels = new Set(previousPeriod.map((summary) => summary.channel_id)).size;
    const previousSummaries = previousPeriod.length;

    const activeDays = new Set(
        currentPeriod.map((summary) => new Date(summary.created_at).toISOString().split('T')[0])
    ).size;

    const avgMessagesPerSummary = currentSummaries > 0 ? currentMessages / currentSummaries : 0;
    const totalCurrentBlockers = currentBlockers.active + currentBlockers.resolved;
    const avgTotalBlockersPerSummary = currentSummaries > 0 ? totalCurrentBlockers / currentSummaries : 0;
    const resolutionRate = totalCurrentBlockers > 0
        ? Math.round((currentBlockers.resolved / totalCurrentBlockers) * 100)
        : 0;

    return {
        totalMessages: currentMessages,
        activeBlockers: currentBlockers.active,
        resolvedBlockers: currentBlockers.resolved,
        channelCount: currentChannels,
        summaryCount: currentSummaries,
        messageChange: calculateChange(currentMessages, previousMessages),
        blockerChange: calculateChange(currentBlockers.active, previousBlockers.active),
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

function buildBlockerData(summaries) {
    const counts = {};
    summaries.forEach((summary) => {
        const blockers = normalizeList(summary.blockers);
        blockers.forEach((blocker, index) => {
            if (getBlockerStatus(summary, index) !== 'active') return;
            const trimmed = blocker.trim();
            if (!trimmed) return;
            counts[trimmed] = (counts[trimmed] || 0) + 1;
        });
    });

    return Object.entries(counts)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 8);
}

function normalizeList(value) {
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

function sumMessages(summaries) {
    return summaries.reduce((total, summary) => total + (summary.message_count || 0), 0);
}

function countBlockers(summaries) {
    return summaries.reduce((acc, summary) => {
        const blockers = normalizeList(summary.blockers);
        blockers.forEach((_, index) => {
            if (getBlockerStatus(summary, index) === 'resolved') {
                acc.resolved += 1;
            } else {
                acc.active += 1;
            }
        });
        return acc;
    }, { active: 0, resolved: 0 });
}

function getBlockerStatus(summary, blockIndex) {
    const blockerStatus = normalizeList(summary.blocker_status);
    const status = blockerStatus?.[blockIndex]?.status;
    return status === 'resolved' ? 'resolved' : 'active';
}

function calculateChange(current, previous) {
    if (!previous) return 0;
    return Math.round(((current - previous) / previous) * 100);
}
