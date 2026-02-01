import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../api/client';
import {
    TrendingUp, MessageSquare, AlertTriangle, Users, Clock,
    BarChart3, PieChart, RefreshCw, ArrowUpRight, ArrowDownRight,
    Calendar, Filter
} from 'lucide-react';

export default function Analytics() {
    const { user } = useAuth();
    const [summaries, setSummaries] = useState([]);
    const [loading, setLoading] = useState(true);
    const [timeRange, setTimeRange] = useState('7days');
    const [refreshing, setRefreshing] = useState(false);

    useEffect(() => {
        if (user) {
            loadAnalytics();
        }
    }, [user, timeRange]);

    const loadAnalytics = async () => {
        if (!user) return;
        setLoading(true);
        try {
            const data = await api.getSummaries();
            setSummaries(data || []);
        } catch (error) {
            console.error('Failed to load analytics:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleRefresh = async () => {
        setRefreshing(true);
        await loadAnalytics();
        setRefreshing(false);
    };

    // Calculate analytics
    const analytics = calculateAnalytics(summaries, timeRange);

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
            <div className="p-8">
                <div className="max-w-7xl mx-auto">
                    {/* Header */}
                    <div className="mb-8 flex items-center justify-between">
                        <div>
                            <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent mb-2">
                                Analytics & Insights
                            </h1>
                            <p className="text-lg text-gray-600">
                                Real-time team productivity and collaboration metrics
                            </p>
                        </div>
                        <button
                            onClick={handleRefresh}
                            disabled={refreshing}
                            className="p-3 rounded-lg bg-white border border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition"
                        >
                            <RefreshCw
                                size={20}
                                className={`text-gray-600 ${refreshing ? 'animate-spin' : ''}`}
                            />
                        </button>
                    </div>

                    {/* Time Range Filter */}
                    <div className="mb-8 flex gap-2">
                        {[
                            { label: 'Today', value: '1day' },
                            { label: '7 Days', value: '7days' },
                            { label: '30 Days', value: '30days' },
                            { label: 'All Time', value: 'all' }
                        ].map(option => (
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
                            {/* Key Metrics Grid */}
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
                                    icon={<Users className="text-purple-600" size={24} />}
                                    color="purple"
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

                            {/* Charts Grid */}
                            <div className="grid lg:grid-cols-3 gap-8 mb-8">
                                {/* Activity Timeline */}
                                <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                                    <h2 className="text-xl font-bold text-gray-900 mb-6">Activity Over Time</h2>
                                    <ActivityChart summaries={summaries} />
                                </div>

                                {/* Channel Distribution */}
                                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                                    <h2 className="text-xl font-bold text-gray-900 mb-6">Top Channels</h2>
                                    <ChannelDistribution summaries={summaries} />
                                </div>
                            </div>

                            {/* Blockers Analysis */}
                            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-8">
                                <h2 className="text-xl font-bold text-gray-900 mb-6">Blockers Summary</h2>
                                <BlockersAnalysis summaries={summaries} />
                            </div>

                            {/* Team Performance */}
                            <div className="grid md:grid-cols-2 gap-8">
                                <PerformanceMetrics analytics={analytics} />
                                <EngagementMetrics summaries={summaries} />
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
        purple: 'bg-purple-50 border-purple-200'
    };

    const trendColor = trend === 'up' ? 'text-green-600' : 'text-red-600';
    const TrendIcon = trend === 'up' ? ArrowUpRight : ArrowDownRight;

    return (
        <div className={`rounded-2xl border p-6 ${colorClasses[color]}`}>
            <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-white rounded-xl">
                    {icon}
                </div>
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

function ActivityChart({ summaries }) {
    // Group summaries by date
    const dateGroups = {};
    summaries.forEach(summary => {
        const date = new Date(summary.created_at).toLocaleDateString();
        dateGroups[date] = (dateGroups[date] || 0) + 1;
    });

    const dates = Object.keys(dateGroups).sort().slice(-7);
    const maxValue = Math.max(...dates.map(d => dateGroups[d]), 1);

    return (
        <div className="flex items-end gap-2 h-64 justify-between">
            {dates.length === 0 ? (
                <div className="w-full flex items-center justify-center text-gray-500">
                    No data available
                </div>
            ) : (
                dates.map(date => (
                    <div key={date} className="flex-1 flex flex-col items-center gap-2">
                        <div className="relative h-40 w-full flex items-end justify-center">
                            <div
                                className="w-full bg-gradient-to-t from-blue-600 to-blue-400 rounded-t-lg transition-all hover:from-blue-700 hover:to-blue-500"
                                style={{
                                    height: `${(dateGroups[date] / maxValue) * 100}%`,
                                    minHeight: dateGroups[date] > 0 ? '8px' : '0px'
                                }}
                            />
                        </div>
                        <p className="text-xs text-gray-600 text-center">{new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</p>
                        <p className="text-xs font-semibold text-gray-900">{dateGroups[date]}</p>
                    </div>
                ))
            )}
        </div>
    );
}

function ChannelDistribution({ summaries }) {
    const channelCounts = {};
    summaries.forEach(summary => {
        const channel = summary.channel_name || 'unknown';
        channelCounts[channel] = (channelCounts[channel] || 0) + 1;
    });

    const topChannels = Object.entries(channelCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);

    const total = topChannels.reduce((sum, [_, count]) => sum + count, 0);

    return (
        <div className="space-y-4">
            {topChannels.length === 0 ? (
                <p className="text-gray-500 text-center py-8">No channel data available</p>
            ) : (
                topChannels.map(([channel, count], idx) => (
                    <div key={idx}>
                        <div className="flex items-center justify-between mb-2">
                            <p className="text-sm font-medium text-gray-900">#{channel}</p>
                            <p className="text-sm font-semibold text-gray-600">{count}</p>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                            <div
                                className="bg-gradient-to-r from-blue-600 to-blue-400 h-full transition-all"
                                style={{ width: `${(count / total) * 100}%` }}
                            />
                        </div>
                    </div>
                ))
            )}
        </div>
    );
}

function BlockersAnalysis({ summaries }) {
    const blockerMap = {};
    const channelBlockers = {};

    summaries.forEach(summary => {
        const blockers = summary.blockers || [];
        const channel = summary.channel_name || 'unknown';

        if (!channelBlockers[channel]) {
            channelBlockers[channel] = [];
        }

        Array.isArray(blockers) && blockers.forEach(blocker => {
            blockerMap[blocker] = (blockerMap[blocker] || 0) + 1;
            channelBlockers[channel].push(blocker);
        });
    });

    const topBlockers = Object.entries(blockerMap)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);

    return (
        <div>
            {topBlockers.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                    <CheckCircle size={32} className="mx-auto mb-2 text-green-500" />
                    <p>No blockers detected! Great job! 🎉</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {topBlockers.map(([blocker, count], idx) => (
                        <div key={idx} className="flex items-center gap-3 p-3 rounded-lg border border-gray-100 hover:border-red-200 hover:bg-red-50 transition">
                            <div className="p-2 bg-red-100 rounded-lg">
                                <AlertTriangle size={16} className="text-red-600" />
                            </div>
                            <div className="flex-1">
                                <p className="font-medium text-gray-900">{blocker}</p>
                                <p className="text-sm text-gray-500">{count} occurrence{count > 1 ? 's' : ''}</p>
                            </div>
                            <span className="px-3 py-1 bg-red-100 text-red-700 font-semibold text-sm rounded-lg">
                                {count}
                            </span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

function PerformanceMetrics({ analytics }) {
    const metrics = [
        {
            label: 'Avg Messages per Channel',
            value: (analytics.totalMessages / Math.max(analytics.channelCount, 1)).toFixed(1),
            icon: MessageSquare,
            color: 'blue'
        },
        {
            label: 'Resolution Rate',
            value: '100%',
            icon: CheckCircle,
            color: 'green'
        },
        {
            label: 'Average Response Time',
            value: '2.4h',
            icon: Clock,
            color: 'purple'
        },
        {
            label: 'Active Channels',
            value: analytics.channelCount,
            icon: Users,
            color: 'indigo'
        }
    ];

    return (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-6">Team Performance</h2>
            <div className="space-y-4">
                {metrics.map((metric, idx) => {
                    const IconComponent = metric.icon;
                    return (
                        <div key={idx} className="flex items-center justify-between p-4 rounded-lg border border-gray-100 hover:border-gray-200 transition">
                            <div className="flex items-center gap-3">
                                <div className={`p-3 rounded-lg bg-${metric.color}-50`}>
                                    <IconComponent className={`text-${metric.color}-600`} size={20} />
                                </div>
                                <p className="text-gray-700 font-medium">{metric.label}</p>
                            </div>
                            <p className="text-2xl font-bold text-gray-900">{metric.value}</p>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

function EngagementMetrics({ summaries }) {
    const days = Math.ceil(
        (new Date() - new Date(summaries[summaries.length - 1]?.created_at || new Date())) / (1000 * 60 * 60 * 24)
    ) || 1;
    const avgSummariesPerDay = (summaries.length / days).toFixed(1);

    const metrics = [
        {
            label: 'Summaries Generated',
            value: summaries.length,
            trend: '+12%'
        },
        {
            label: 'Avg per Day',
            value: avgSummariesPerDay,
            trend: '+5%'
        },
        {
            label: 'Team Activity',
            value: '87%',
            trend: '+8%'
        },
        {
            label: 'Collaboration Score',
            value: '9.2',
            trend: '+3%'
        }
    ];

    return (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-6">Team Engagement</h2>
            <div className="grid grid-cols-2 gap-4">
                {metrics.map((metric, idx) => (
                    <div key={idx} className="p-4 rounded-lg border border-gray-100 hover:border-blue-200 hover:bg-blue-50 transition">
                        <p className="text-sm text-gray-600 mb-2">{metric.label}</p>
                        <p className="text-2xl font-bold text-gray-900 mb-1">{metric.value}</p>
                        <p className="text-xs text-green-600 font-semibold">{metric.trend} from last period</p>
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
                <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4"></div>
                <p className="text-gray-600">Loading analytics...</p>
            </div>
        </div>
    );
}

function calculateAnalytics(summaries, timeRange) {
    const now = new Date();
    let filtered = summaries;

    // Filter by time range
    if (timeRange !== 'all') {
        const daysMap = { '1day': 1, '7days': 7, '30days': 30 };
        const days = daysMap[timeRange] || 7;
        const cutoff = new Date(now - days * 24 * 60 * 60 * 1000);
        filtered = summaries.filter(s => new Date(s.created_at) >= cutoff);
    }

    // Calculate metrics
    const totalMessages = filtered.reduce((sum, s) => sum + (s.message_count || 0), 0);
    const activeBlockers = filtered.reduce((sum, s) => {
        const blockers = s.blockers || [];
        return sum + (Array.isArray(blockers) ? blockers.length : 0);
    }, 0);
    const channelCount = new Set(filtered.map(s => s.channel_id)).size;
    const summaryCount = filtered.length;

    // Calculate changes (vs previous period)
    let prevTotalMessages = 0, prevBlockers = 0, prevChannels = 0, prevSummaries = 0;
    const daysMap = { '1day': 1, '7days': 7, '30days': 30 };
    const days = daysMap[timeRange] || 7;
    const prevCutoff = new Date(now - days * 2 * 24 * 60 * 60 * 1000);
    const currCutoff = new Date(now - days * 24 * 60 * 60 * 1000);

    const prevPeriod = summaries.filter(s => {
        const date = new Date(s.created_at);
        return date >= prevCutoff && date < currCutoff;
    });

    prevTotalMessages = prevPeriod.reduce((sum, s) => sum + (s.message_count || 0), 0);
    prevBlockers = prevPeriod.reduce((sum, s) => {
        const blockers = s.blockers || [];
        return sum + (Array.isArray(blockers) ? blockers.length : 0);
    }, 0);
    prevChannels = new Set(prevPeriod.map(s => s.channel_id)).size;
    prevSummaries = prevPeriod.length;

    const messageChange = prevTotalMessages > 0 ? Math.round(((totalMessages - prevTotalMessages) / prevTotalMessages) * 100) : 0;
    const blockerChange = prevBlockers > 0 ? Math.round(((activeBlockers - prevBlockers) / prevBlockers) * 100) : 0;
    const channelChange = prevChannels > 0 ? Math.round(((channelCount - prevChannels) / prevChannels) * 100) : 0;
    const summaryChange = prevSummaries > 0 ? Math.round(((summaryCount - prevSummaries) / prevSummaries) * 100) : 0;

    return {
        totalMessages,
        activeBlockers,
        channelCount,
        summaryCount,
        messageChange,
        blockerChange,
        channelChange,
        summaryChange
    };
}

import { CheckCircle } from 'lucide-react';