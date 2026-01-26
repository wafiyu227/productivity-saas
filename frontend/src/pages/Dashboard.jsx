import { useState, useEffect } from 'react';
import { api } from '../api/client';
import {
    RefreshCw, MessageSquare, AlertTriangle, TrendingUp,
    Sparkles, Clock, CheckCircle, ArrowRight, Zap
} from 'lucide-react';

export default function Dashboard() {
    const [channels, setChannels] = useState([]);
    const [summaries, setSummaries] = useState([]);
    const [loading, setLoading] = useState(false);
    const [selectedChannel, setSelectedChannel] = useState('');


    useEffect(() => {
        // Check for OAuth success/error in URL
        const params = new URLSearchParams(window.location.search);
        const success = params.get('success');
        const error = params.get('error');

        if (success === 'slack_connected') {
            alert('✅ Slack connected successfully!');
            loadChannels(); // Reload channels
            window.history.replaceState({}, '', '/app'); // Clean URL
        } else if (error) {
            alert('❌ Connection failed: ' + error);
            window.history.replaceState({}, '', '/app');
        }
    }, []);

    useEffect(() => {
        loadChannels();
    }, []);

    const loadChannels = async () => {
        try {
            const data = await api.getChannels();
            setChannels(data.channels || []);
        } catch (error) {
            console.error('Failed to load channels:', error);
            // If no channels, might need to connect Slack
            if (error.message.includes('401') || error.message.includes('403')) {
                setChannels([]);
            }
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
            setSummaries([result.summary, ...summaries]);
        } catch (error) {
            alert('Failed to generate summary: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    const stats = {
        channelsMonitored: channels.length,
        summariesGenerated: summaries.length,
        activeBlockers: summaries.reduce((acc, s) => acc + (s.blockers?.length || 0), 0),
        totalMessages: summaries.reduce((acc, s) => acc + (s.messageCount || 0), 0)
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
                            change="+2 this week"
                            trend="up"
                        />
                        <StatCard
                            title="Summaries"
                            value={stats.summariesGenerated}
                            icon={<Sparkles className="text-purple-600" size={24} />}
                            change="+12 today"
                            trend="up"
                        />
                        <StatCard
                            title="Active Blockers"
                            value={stats.activeBlockers}
                            icon={<AlertTriangle className="text-red-600" size={24} />}
                            change="-3 resolved"
                            trend="down"
                        />
                        <StatCard
                            title="Messages Analyzed"
                            value={stats.totalMessages}
                            icon={<TrendingUp className="text-green-600" size={24} />}
                            change="+156 today"
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
                                    <button className="text-blue-600 hover:text-blue-700 text-sm font-medium flex items-center gap-1">
                                        View All
                                        <ArrowRight size={16} />
                                    </button>
                                </div>

                                {summaries.length === 0 ? (
                                    <EmptyState />
                                ) : (
                                    <div className="space-y-4">
                                        {summaries.map((summary, idx) => (
                                            <SummaryCard key={idx} summary={summary} />
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Quick Actions */}
                        <div className="space-y-6">
                            <QuickActionsCard />
                            <ActivityFeed />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

function StatCard({ title, value, icon, change, trend }) {
    return (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl">
                    {icon}
                </div>
                <span className={`text-sm font-medium ${trend === 'up' ? 'text-green-600' : 'text-red-600'
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
    return (
        <div className="border border-gray-200 rounded-xl p-5 hover:shadow-md hover:border-blue-200 transition-all">
            <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-500 rounded-lg flex items-center justify-center">
                        <MessageSquare className="text-white" size={20} />
                    </div>
                    <div>
                        <h3 className="font-semibold text-gray-900">#{summary.channel}</h3>
                        <p className="text-sm text-gray-500 flex items-center gap-1">
                            <Clock size={14} />
                            Just now • {summary.messageCount} messages
                        </p>
                    </div>
                </div>
            </div>

            <p className="text-gray-700 mb-4 leading-relaxed">{summary.summary}</p>

            {summary.blockers && summary.blockers.length > 0 && (
                <div className="mb-3">
                    <p className="text-xs font-semibold text-red-600 mb-2 uppercase">Blockers Detected</p>
                    <div className="flex flex-wrap gap-2">
                        {summary.blockers.map((blocker, i) => (
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

            {summary.keyTopics && (
                <div className="flex flex-wrap gap-2">
                    {summary.keyTopics.map((topic, i) => (
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

function QuickActionsCard() {
    return (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h3 className="font-bold text-gray-900 mb-4">Quick Actions</h3>
            <div className="space-y-3">
                <QuickAction
                    icon={<MessageSquare size={18} className="text-blue-600" />}
                    title="Connect Slack"
                    description="Add more workspaces"
                />
                <QuickAction
                    icon={<TrendingUp size={18} className="text-green-600" />}
                    title="View Analytics"
                    description="Team productivity insights"
                />
                <QuickAction
                    icon={<AlertTriangle size={18} className="text-red-600" />}
                    title="Manage Blockers"
                    description="Track and resolve issues"
                />
            </div>
        </div>
    );
}

function QuickAction({ icon, title, description }) {
    return (
        <button className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors text-left">
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

function ActivityFeed() {
    const activities = [
        { type: 'summary', text: 'Summary generated for #engineering', time: '2m ago' },
        { type: 'blocker', text: 'New blocker detected in #devops', time: '15m ago' },
        { type: 'resolved', text: 'Blocker resolved in #design', time: '1h ago' }
    ];

    return (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h3 className="font-bold text-gray-900 mb-4">Recent Activity</h3>
            <div className="space-y-4">
                {activities.map((activity, i) => (
                    <div key={i} className="flex gap-3">
                        <div className={`w-2 h-2 rounded-full mt-2 ${activity.type === 'blocker' ? 'bg-red-500' :
                            activity.type === 'resolved' ? 'bg-green-500' : 'bg-blue-500'
                            }`} />
                        <div>
                            <p className="text-sm text-gray-900">{activity.text}</p>
                            <p className="text-xs text-gray-500">{activity.time}</p>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}