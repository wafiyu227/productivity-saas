import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
    AlertTriangle,
    BarChart3,
    CheckCircle,
    Clock,
    MessageSquare,
    Sparkles,
    TrendingUp,
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

const CHART_COLORS = ['#2563EB', '#06B6D4', '#0EA5E9', '#6366F1', '#14B8A6'];

const DEMO_SUMMARIES = [
    {
        id: 'sum-1',
        channel_name: 'engineering',
        message_count: 128,
        summary: 'Team finalized caching improvements for API endpoints and cut latency by 18% in staging.',
        blockers: ['Pending approval for load test budget'],
        blocker_status: [{ status: 'active' }],
        created_at: '2026-02-18T09:00:00.000Z'
    },
    {
        id: 'sum-2',
        channel_name: 'product',
        message_count: 76,
        summary: 'Product reviewed Q2 roadmap and aligned on onboarding experiment success metrics.',
        blockers: [],
        blocker_status: [],
        created_at: '2026-02-17T15:00:00.000Z'
    },
    {
        id: 'sum-3',
        channel_name: 'support',
        message_count: 91,
        summary: 'Support identified recurring billing confusion and documented top 5 friction points.',
        blockers: ['Need billing copy updates from legal'],
        blocker_status: [{ status: 'resolved', resolved_at: '2026-02-17T20:00:00.000Z' }],
        created_at: '2026-02-17T11:00:00.000Z'
    },
    {
        id: 'sum-4',
        channel_name: 'growth',
        message_count: 63,
        summary: 'Growth team launched a referral landing test and prepared tracking dashboards.',
        blockers: ['Missing LinkedIn conversion event mapping'],
        blocker_status: [{ status: 'active' }],
        created_at: '2026-02-16T14:00:00.000Z'
    }
];

const DEMO_ACTIVITY = [
    { day: 'Feb 12', summaries: 2 },
    { day: 'Feb 13', summaries: 3 },
    { day: 'Feb 14', summaries: 2 },
    { day: 'Feb 15', summaries: 4 },
    { day: 'Feb 16', summaries: 3 },
    { day: 'Feb 17', summaries: 5 },
    { day: 'Feb 18', summaries: 4 }
];

const DEMO_CHANNELS = [
    { name: 'engineering', count: 9 },
    { name: 'support', count: 6 },
    { name: 'product', count: 5 },
    { name: 'growth', count: 4 },
    { name: 'general', count: 3 }
];

const DEMO_BLOCKERS = [
    { name: 'Pending approval for load test budget', count: 3 },
    { name: 'Missing LinkedIn conversion event mapping', count: 2 },
    { name: 'Need billing copy updates from legal', count: 1 }
];

export default function DemoWorkspace() {
    const [view, setView] = useState('dashboard');

    const stats = useMemo(() => {
        let activeBlockers = 0;
        let resolvedBlockers = 0;

        DEMO_SUMMARIES.forEach((summary) => {
            summary.blockers.forEach((_, index) => {
                const status = summary.blocker_status?.[index]?.status || 'active';
                if (status === 'resolved') {
                    resolvedBlockers += 1;
                } else {
                    activeBlockers += 1;
                }
            });
        });

        return {
            channels: 12,
            summaries: 27,
            messages: DEMO_SUMMARIES.reduce((sum, summary) => sum + summary.message_count, 0),
            activeBlockers,
            resolvedBlockers
        };
    }, []);

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
            <div className="max-w-7xl mx-auto p-8">
                <div className="mb-6 flex items-center justify-between">
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-blue-700 mb-2">Interactive Demo</p>
                        <h1 className="text-4xl font-bold text-slate-900">Teama AI Demo Workspace</h1>
                        <p className="text-slate-600 mt-2">Sample data from a realistic product and engineering team.</p>
                    </div>
                    <Link
                        to="/signup"
                        className="px-5 py-3 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700 transition"
                    >
                        Start Free Trial
                    </Link>
                </div>

                <div className="mb-6 p-4 rounded-xl bg-blue-50 border border-blue-100 text-blue-800 text-sm">
                    Demo Mode: data is simulated for exploration and resets automatically.
                </div>

                <div className="mb-8 flex gap-2">
                    {[
                        { id: 'dashboard', label: 'Dashboard' },
                        { id: 'analytics', label: 'Analytics' },
                        { id: 'blockers', label: 'Blockers' }
                    ].map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setView(tab.id)}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${view === tab.id
                                ? 'bg-blue-600 text-white'
                                : 'bg-white border border-slate-200 text-slate-700 hover:border-blue-300'
                                }`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>

                {view === 'dashboard' && <DashboardView stats={stats} />}
                {view === 'analytics' && <AnalyticsView stats={stats} />}
                {view === 'blockers' && <BlockersView stats={stats} />}
            </div>
        </div>
    );
}

function DashboardView({ stats }) {
    return (
        <div className="space-y-8">
            <div className="grid md:grid-cols-5 gap-4">
                <StatCard title="Channels" value={stats.channels} icon={<Users className="text-blue-600" size={20} />} />
                <StatCard title="Summaries" value={stats.summaries} icon={<Sparkles className="text-purple-600" size={20} />} />
                <StatCard title="Active Blockers" value={stats.activeBlockers} icon={<AlertTriangle className="text-red-600" size={20} />} />
                <StatCard title="Resolved" value={stats.resolvedBlockers} icon={<CheckCircle className="text-green-600" size={20} />} />
                <StatCard title="Messages" value={stats.messages} icon={<MessageSquare className="text-cyan-600" size={20} />} />
            </div>
            <div className="bg-white rounded-2xl border border-slate-100 p-6">
                <h2 className="text-xl font-bold text-slate-900 mb-4">Recent Summaries</h2>
                <div className="space-y-3">
                    {DEMO_SUMMARIES.map((summary) => (
                        <div key={summary.id} className="border border-slate-100 rounded-xl p-4">
                            <div className="flex items-center justify-between mb-2">
                                <p className="font-semibold text-slate-900">#{summary.channel_name}</p>
                                <p className="text-xs text-slate-500">{summary.message_count} messages</p>
                            </div>
                            <p className="text-slate-600 text-sm">{summary.summary}</p>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

function AnalyticsView({ stats }) {
    const pieData = DEMO_CHANNELS.map((row) => ({ ...row, share: Math.round((row.count / 27) * 100) }));

    return (
        <div className="space-y-8">
            <div className="grid md:grid-cols-4 gap-4">
                <StatCard title="Total Summaries" value={stats.summaries} icon={<BarChart3 className="text-blue-600" size={20} />} />
                <StatCard title="Total Messages" value={stats.messages} icon={<MessageSquare className="text-indigo-600" size={20} />} />
                <StatCard title="Open Blockers" value={stats.activeBlockers} icon={<AlertTriangle className="text-red-600" size={20} />} />
                <StatCard title="Resolution Rate" value={`${Math.round((stats.resolvedBlockers / (stats.resolvedBlockers + stats.activeBlockers)) * 100)}%`} icon={<TrendingUp className="text-green-600" size={20} />} />
            </div>

            <div className="grid lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-100 p-6">
                    <h2 className="text-lg font-bold text-slate-900 mb-4">Activity Over Time</h2>
                    <div className="h-72">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={DEMO_ACTIVITY}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                                <XAxis dataKey="day" />
                                <YAxis allowDecimals={false} />
                                <Tooltip />
                                <Area type="monotone" dataKey="summaries" stroke="#2563EB" fill="#BFDBFE" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>
                <div className="bg-white rounded-2xl border border-slate-100 p-6">
                    <h2 className="text-lg font-bold text-slate-900 mb-4">Top Channels</h2>
                    <div className="h-48">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie data={pieData} dataKey="count" nameKey="name" outerRadius={70}>
                                    {pieData.map((entry, index) => (
                                        <Cell key={entry.name} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>
        </div>
    );
}

function BlockersView({ stats }) {
    return (
        <div className="space-y-8">
            <div className="grid md:grid-cols-3 gap-4">
                <StatCard title="Active Blockers" value={stats.activeBlockers} icon={<AlertTriangle className="text-red-600" size={20} />} />
                <StatCard title="Resolved Blockers" value={stats.resolvedBlockers} icon={<CheckCircle className="text-green-600" size={20} />} />
                <StatCard title="Avg Resolution Time" value="6.2h" icon={<Clock className="text-blue-600" size={20} />} />
            </div>
            <div className="bg-white rounded-2xl border border-slate-100 p-6">
                <h2 className="text-lg font-bold text-slate-900 mb-4">Most Frequent Blockers</h2>
                <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={DEMO_BLOCKERS} layout="vertical">
                            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                            <XAxis type="number" allowDecimals={false} />
                            <YAxis dataKey="name" type="category" width={230} />
                            <Tooltip />
                            <Bar dataKey="count" fill="#DC2626" radius={[0, 6, 6, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </div>
    );
}

function StatCard({ title, value, icon }) {
    return (
        <div className="bg-white rounded-2xl border border-slate-100 p-5">
            <div className="flex items-center justify-between mb-3">
                <div className="p-2 rounded-lg bg-slate-50">{icon}</div>
            </div>
            <p className="text-sm text-slate-500">{title}</p>
            <p className="text-2xl font-bold text-slate-900">{value}</p>
        </div>
    );
}
