import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import {
    RefreshCw, MessageSquare, AlertTriangle, TrendingUp,
    Sparkles, Clock, CheckCircle, ArrowRight, Zap, Activity
} from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL;

export default function Dashboard() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [channels, setChannels] = useState([]);
    const [summaries, setSummaries] = useState([]);
    const [activities, setActivities] = useState([]);
    const [blockerStats, setBlockerStats] = useState({ active: 0, resolved: 0, total: 0 });
    const [loading, setLoading] = useState(false);
    const [selectedChannel, setSelectedChannel] = useState('');
    const [refreshing, setRefreshing] = useState(false);

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
        if (user) {
            loadChannels();
            loadSummaries();
            loadActivities();
            loadBlockerStats();
        }
    }, [user]);

    const loadChannels = async () => {
        if (!user) return;

        try {
            const data = await api.getChannels();
            setChannels(data.channels || []);
        } catch (error) {
            console.error('Failed to load channels:', error);
            setChannels([]);
        }
    };

    const loadSummaries = async () => {
        if (!user) return;

        try {
            const data = await api.getSummaries();
            setSummaries(data || []);
        } catch (error) {
            console.error('Failed to load summaries:', error);
        }
    };

    const loadBlockerStats = async () => {
        if (!user) return;

        try {
            const res = await fetch(`${API_URL}/api/blockers?userId=${user.id}`);
            const summariesWithBlockers = await res.json();

            let activeCount = 0;
            let resolvedCount = 0;
            let totalCount = 0;

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

            setBlockerStats({
                active: activeCount,
                resolved: resolvedCount,
                total: totalCount
            });
        } catch (error) {
            console.error('Failed to load blocker stats:', error);
        }
    };

    const loadActivities = async () => {
        if (!user) return;

        try {
            const data = await api.getSummaries();
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
            const result = await api.createSummary(selectedChannel, 24);
            await loadSummaries();
            await loadActivities();
            await loadBlockerStats();
            setSelectedChannel('');
            alert('✅ Summary generated successfully!');
        } catch (error) {
            if (error.message.includes('not_in_channel')) {
                alert('⚠️ The bot is not in this channel!\n\nTo fix:\n1. Go to the channel in Slack\n2. Type: /invite @Productivity Assistant\n3. Try again');
            } else {
                alert('Failed to generate summary: ' + error.message);
            }
        } finally {
            setLoading(false);
        }
    };

    const handleRefresh = async () => {
        setRefreshing(true);
        await Promise.all([
            loadSummaries(),
            loadActivities(),
            loadBlockerStats()
        ]);
        setRefreshing(false);
    };

    const stats = {
        channelsMonitored: channels.length,
        summariesGenerated: summaries.length,
        activeBlockers: blockerStats.active,
        totalMessages: summaries.reduce((acc, s) => acc + (s.message_count || 0), 0)
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50">
            <div className="p-8">
                <div className="max-w-7xl mx-auto">
                    {/* Header */}
                    <div className="mb-8">
                        <h1 className="text-4xl font-bold text-gray-900 mb-2">
                            Welcome back! 👋
                        </h1>
                        <p className="text-lg text-gray-600">
                            Here's what's happening with your team today
                        </p>
                    </div>

                    {/* Stats Grid */}
                    <div className="grid md:grid-cols-4 gap-6 mb-8">
                        <StatCard
                            title="Channels"
                            value={stats.channelsMonitored}
                            icon={<MessageSquare className="text-blue-600" size={24} />}
                            change={`${stats.channelsMonitored} connected`}
                            trend="neutral"
                        />
                        <StatCard
                            title="Summaries"
                            value={stats.summariesGenerated}
                            icon={<Sparkles className="text-purple-600" size={24} />}
                            change={`${stats.summariesGenerated} generated`}
                            trend="up"
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
                    </div>

                    {/* Generate Summary Card */}
                    <div className="bg-gradient-to-br from-blue-600 to-purple-600 rounded-2xl shadow-xl p-8 mb-8 text-white">
                        <div className="flex items-start justify-between mb-6">
                            <div>
                                <h2 className="text-2xl font-bold mb-2">
                                    Generate AI Summary
                                </h2>
                                <p className="text-blue-100">
                                    Get instant insights from any Slack channel
                                </p>
                            </div>
                            <Zap className="text-yellow-300" size={32} />
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

                    {/* Main Content Grid */}
                    <div className="grid lg:grid-cols-3 gap-8">
                        {/* Recent Summaries */}
                        <div className="lg:col-span-2">
                            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                                <div className="flex items-center justify-between mb-6">
                                    <h2 className="text-2xl font-bold text-gray-900">
                                        Recent Summaries
                                    </h2>
                                    <button
                                        onClick={handleRefresh}
                                        className="text-blue-600 hover:text-blue-700 text-sm font-medium flex items-center gap-1"
                                    >
                                        {refreshing ? (
                                            <RefreshCw size={16} className="animate-spin" />
                                        ) : (
                                            <>
                                                Refresh
                                                <RefreshCw size={16} />
                                            </>
                                        )}
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
            <h3 className="font-bold text-gray-900 mb-4">Quick Actions</h3>
            <div className="space-y-3">
                <QuickAction
                    icon={<AlertTriangle size={18} className="text-red-600" />}
                    title="Manage Blockers"
                    description="Track and resolve issues"
                    onClick={() => navigate('/app/blockers')}
                />
                <QuickAction
                    icon={<MessageSquare size={18} className="text-blue-600" />}
                    title="Connect Slack"
                    description="Add more workspaces"
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
                    Recent Activity
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
                    <p className="text-sm text-gray-500 text-center py-4">No activities yet</p>
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