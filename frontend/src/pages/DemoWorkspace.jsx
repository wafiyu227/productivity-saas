import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
    AlertTriangle,
    BarChart3,
    CheckCircle,
    Clock,
    MessageSquare,
    Sparkles,
    TrendingUp,
    Users,
    ArrowLeft,
    Activity,
    Terminal,
    ChevronRight,
    Zap,
    Globe,
    Cpu
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

const CHART_COLORS = ['#ffffff', '#a1a1aa', '#71717a', '#52525b', '#3f3f46'];

const DEMO_SUMMARIES = [
    {
        id: 'sum-1',
        channel_name: 'engineering',
        message_count: 128,
        summary: 'Team fixed bugs in the API and improved speed by 18%.',
        blockers: ['Waiting for budget approval'],
        blocker_status: [{ status: 'active' }],
        created_at: '2026-02-18T09:00:00.000Z'
    },
    {
        id: 'sum-2',
        channel_name: 'product',
        message_count: 76,
        summary: 'Reviewed the roadmap for the next few months and agreed on success metrics for new features.',
        blockers: [],
        blocker_status: [],
        created_at: '2026-02-17T15:00:00.000Z'
    },
    {
        id: 'sum-3',
        channel_name: 'support',
        message_count: 91,
        summary: 'Identified where customers are getting confused with billing and made notes for improvements.',
        blockers: ['Need copy updates from legal'],
        blocker_status: [{ status: 'resolved', resolved_at: '2026-02-17T20:00:00.000Z' }],
        created_at: '2026-02-17T11:00:00.000Z'
    },
    {
        id: 'sum-4',
        channel_name: 'growth',
        message_count: 63,
        summary: 'Launched a new referral page and started tracking the results.',
        blockers: ['Missing tracking setup for LinkedIn'],
        blocker_status: [{ status: 'active' }],
        created_at: '2026-02-16T14:00:00.000Z'
    }
];

const DEMO_ACTIVITY = [
    { day: 'Mon', summaries: 2 },
    { day: 'Tue', summaries: 3 },
    { day: 'Wed', summaries: 2 },
    { day: 'Thu', summaries: 4 },
    { day: 'Fri', summaries: 3 },
    { day: 'Sat', summaries: 5 },
    { day: 'Sun', summaries: 4 }
];

const DEMO_CHANNELS = [
    { name: 'engineering', count: 9 },
    { name: 'support', count: 6 },
    { name: 'product', count: 5 },
    { name: 'growth', count: 4 },
    { name: 'general', count: 3 }
];

const DEMO_BLOCKERS = [
    { name: 'Budget', count: 3 },
    { name: 'Tracking', count: 2 },
    { name: 'Legal', count: 1 }
];

export default function DemoWorkspace() {
    const navigate = useNavigate();
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
        <div className="min-h-screen bg-black text-white selection:bg-gray-800 font-sans">
            <div className="mx-auto max-w-7xl px-4 py-12 md:px-8">
                {/* Header */}
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-8 mb-16">
                    <div>
                        <div className="flex items-center gap-4 mb-8">
                            <button onClick={() => navigate('/')} className="p-2 text-gray-700 hover:text-white transition-all">
                                <ArrowLeft size={20} />
                            </button>
                            <span className="px-3 py-1 bg-white/5 border border-white/10 rounded-full text-white text-[10px] font-bold uppercase tracking-widest">
                                Demo
                            </span>
                        </div>
                        <h1 className="text-4xl md:text-5xl font-bold text-white tracking-tight uppercase">Acme Corp</h1>
                        <p className="mt-3 text-gray-700 text-sm font-bold uppercase tracking-widest">A preview of how Teama AI summarizes your team's work.</p>
                    </div>
                    
                    <div className="flex">
                        <Link
                            to="/signup"
                            className="px-8 py-3 bg-white text-black text-[10px] font-bold uppercase tracking-widest rounded-xl hover:bg-gray-200 transition-all active:scale-95"
                        >
                            Sign Up
                        </Link>
                    </div>
                </div>

                <div className="mb-12 p-5 rounded-2xl bg-white/[0.01] border border-white/5 text-gray-800 text-[10px] font-bold uppercase tracking-widest flex items-center gap-4">
                    <Terminal size={18} />
                    Example data. No accounts connected.
                </div>

                {/* Tabs */}
                <div className="mb-10 flex flex-wrap gap-2">
                    {[
                        { id: 'dashboard', label: 'Summaries', icon: <Sparkles size={16} /> },
                        { id: 'analytics', label: 'Analytics', icon: <BarChart3 size={16} /> },
                        { id: 'blockers', label: 'Blockers', icon: <AlertTriangle size={16} /> }
                    ].map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setView(tab.id)}
                            className={`px-6 py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all flex items-center gap-2 border ${view === tab.id
                                ? 'bg-white text-black border-white'
                                : 'bg-transparent border-white/10 text-gray-800 hover:text-white hover:border-white/20'
                                }`}
                        >
                            {tab.icon}
                            {tab.label}
                        </button>
                    ))}
                </div>

                <div className="fade-in">
                    {view === 'dashboard' && <DashboardView stats={stats} />}
                    {view === 'analytics' && <AnalyticsView stats={stats} />}
                    {view === 'blockers' && <BlockersView stats={stats} />}
                </div>
            </div>
        </div>
    );
}

function DashboardView({ stats }) {
    return (
        <div className="space-y-12">
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                <SmallMetric label="Channels" value={stats.channels} icon={<Users size={18} />} />
                <SmallMetric label="Summaries" value={stats.summaries} icon={<Sparkles size={18} />} />
                <SmallMetric label="Active Blockers" value={stats.activeBlockers} icon={<AlertTriangle size={18} />} />
                <SmallMetric label="Resolved" value={stats.resolvedBlockers} icon={<CheckCircle size={18} />} />
                <SmallMetric label="Messages" value={stats.messages} icon={<MessageSquare size={18} />} />
            </div>
            
            <div className="bg-white/[0.01] rounded-3xl border border-white/5 p-10">
                <h2 className="text-xl font-bold text-white mb-10 uppercase tracking-widest">
                    Summaries
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {DEMO_SUMMARIES.map((summary) => (
                        <div key={summary.id} className="bg-white/[0.02] border border-white/5 rounded-2xl p-8 hover:border-white/10 transition-all">
                            <div className="flex items-center justify-between mb-4 pb-4 border-b border-white/5">
                                <p className="text-[10px] font-bold text-white uppercase tracking-widest">#{summary.channel_name}</p>
                                <p className="text-[10px] font-bold text-gray-800 uppercase tracking-widest">{summary.message_count} Messages</p>
                            </div>
                            <p className="text-white text-base font-bold leading-relaxed uppercase">{summary.summary}</p>
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
        <div className="space-y-12">
            <div className="grid lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 bg-white/[0.01] rounded-3xl border border-white/5 p-10">
                    <h2 className="text-xl font-bold text-white mb-10 uppercase tracking-widest">History</h2>
                    <div className="h-80">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={DEMO_ACTIVITY}>
                                <defs>
                                    <linearGradient id="colorSum" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#ffffff" stopOpacity={0.1}/>
                                        <stop offset="95%" stopColor="#ffffff" stopOpacity={0}/>
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff0a" vertical={false} />
                                <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{fill: '#4b5563', fontSize: 11}} dy={10} />
                                <YAxis axisLine={false} tickLine={false} tick={{fill: '#4b5563', fontSize: 11}} />
                                <Tooltip 
                                    contentStyle={{ backgroundColor: '#111', border: '1px solid #333', borderRadius: '8px', fontSize: '12px' }}
                                    itemStyle={{ color: '#fff' }}
                                />
                                <Area type="monotone" dataKey="summaries" stroke="#fff" strokeWidth={2} fillOpacity={1} fill="url(#colorSum)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>
                <div className="bg-white/[0.01] rounded-3xl border border-white/5 p-10 text-center">
                    <h2 className="text-xl font-bold text-white mb-10 uppercase tracking-widest">Channels</h2>
                    <div className="h-60 mb-6">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie data={pieData} dataKey="count" nameKey="name" outerRadius={80} stroke="none">
                                    {pieData.map((entry, index) => (
                                        <Cell key={entry.name} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip 
                                    contentStyle={{ backgroundColor: '#111', border: '1px solid #333', borderRadius: '8px' }}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        {pieData.slice(0, 4).map((row, i) => (
                            <div key={i} className="flex flex-col items-center">
                                <div className="text-lg font-bold text-white">{row.share}%</div>
                                <div className="text-[9px] text-gray-800 font-bold uppercase tracking-widest">{row.name}</div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}

function BlockersView({ stats }) {
    return (
        <div className="space-y-12">
            <div className="bg-white/[0.01] rounded-3xl border border-white/5 p-10 md:p-14">
                <h2 className="text-xl font-bold text-white mb-12 uppercase tracking-widest">
                    Blockers
                </h2>
                <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={DEMO_BLOCKERS} layout="vertical">
                            <CartesianGrid strokeDasharray="3 3" stroke="#ffffff0a" horizontal={false} />
                            <XAxis type="number" axisLine={false} tickLine={false} tick={{fill: '#4b5563', fontSize: 12}} />
                            <YAxis dataKey="name" type="category" width={100} axisLine={false} tickLine={false} tick={{fill: '#4b5563', fontSize: 12}} />
                            <Tooltip 
                                contentStyle={{ backgroundColor: '#111', border: '1px solid #333', borderRadius: '8px' }}
                            />
                            <Bar dataKey="count" fill="#fff" opacity={0.8} radius={[0, 4, 4, 0]} barSize={32} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
                <p className="mt-12 text-center text-gray-500 text-sm">
                    Blockers are automatically detected from your team's conversations.
                </p>
            </div>
        </div>
    );
}

function SmallMetric({ label, value, icon }) {
    return (
        <div className="bg-white/[0.01] p-8 rounded-3xl border border-white/5 transition-all hover:border-white/10 group">
            <div className="flex items-center justify-between mb-8">
                <div className="p-3 rounded-xl bg-white/5 text-white">
                    {icon}
                </div>
            </div>
            <p className="text-[10px] font-bold text-gray-800 uppercase tracking-widest mb-1">{label}</p>
            <p className="text-4xl font-bold text-white tracking-tight">{value}</p>
        </div>
    );
}
