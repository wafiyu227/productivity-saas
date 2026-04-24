import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
    GitBranch,
    GitCommit,
    GitPullRequest,
    Loader2,
    ExternalLink,
    Github,
    Star,
    Clock,
    AlertCircle,
    Zap,
    ChevronRight,
    Activity,
    ShieldAlert,
    ArrowUpRight
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const API_URL = import.meta.env.VITE_API_URL;

export default function Code() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [connected, setConnected] = useState(false);
    const [repos, setRepos] = useState([]);
    const [pulls, setPulls] = useState([]);
    const [pullMetrics, setPullMetrics] = useState({
        totalOpen: 0,
        needsReview: 0,
        stale: 0,
        staleDays: 7,
        limit: 10
    });
    const [activity, setActivity] = useState([]);

    useEffect(() => {
        if (user) {
            checkConnection();
        }
    }, [user]);

    const checkConnection = async () => {
        try {
            const res = await fetch(`${API_URL}/api/auth/github/status?userId=${user.id}`);
            const data = await res.json();

            setConnected(data.connected);
            if (data.connected) {
                fetchData();
            } else {
                setLoading(false);
            }
        } catch (error) {
            console.error('Failed to check GitHub status:', error);
            setLoading(false);
        }
    };

    const fetchData = async () => {
        setLoading(true);
        try {
            const reposRes = await fetch(`${API_URL}/api/github/repos?userId=${user.id}&perPage=10`);
            const reposData = await reposRes.json();
            setRepos(reposData.repos || []);

            const pullsRes = await fetch(`${API_URL}/api/github/pulls?userId=${user.id}&limit=10&staleDays=7`);
            const pullsData = await pullsRes.json();
            setPulls(pullsData.pulls || []);
            setPullMetrics({
                totalOpen: pullsData.meta?.total_open || 0,
                needsReview: pullsData.meta?.needs_review || 0,
                stale: pullsData.meta?.stale || 0,
                staleDays: pullsData.meta?.stale_days || 7,
                limit: pullsData.meta?.limit || 10
            });

            const activityRes = await fetch(`${API_URL}/api/github/activity?userId=${user.id}`);
            const activityData = await activityRes.json();
            setActivity(activityData.activity || []);

        } catch (error) {
            console.error('Failed to fetch GitHub data:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleConnect = () => {
        navigate('/app/integrations');
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-black flex flex-col items-center justify-center gap-8 text-white">
                <div className="w-12 h-12 border-4 border-white/5 border-t-white rounded-full animate-spin"></div>
                <p className="text-[10px] font-bold uppercase tracking-widest">Loading...</p>
            </div>
        );
    }

    if (!connected) {
        return (
            <div className="min-h-screen bg-black flex items-center justify-center p-4">
                <div className="bg-black border border-white/10 rounded-[3rem] p-16 max-w-2xl w-full text-center">
                    <div className="w-24 h-24 bg-white/5 border border-white/10 rounded-[2rem] flex items-center justify-center mx-auto mb-10">
                        <Github size={48} className="text-white" />
                    </div>
                    
                    <h2 className="text-4xl font-bold text-white uppercase tracking-tight mb-4">Connect GitHub</h2>
                    <p className="text-gray-700 font-bold uppercase tracking-widest text-xs mb-12 max-w-md mx-auto leading-relaxed">
                        Connect your GitHub account to track pull requests and activity.
                    </p>
                    
                    <button
                        onClick={handleConnect}
                        className="w-full py-5 bg-white text-black text-[10px] font-bold uppercase tracking-widest rounded-2xl transition-all active:scale-95"
                    >
                        Connect
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-black text-white selection:bg-blue-500/30">

            <div className="relative mx-auto max-w-7xl px-4 pb-20 pt-4 md:px-8 md:pt-8">
                {/* Header */}
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-8 mb-16 animate-in fade-in slide-in-from-bottom-4 duration-700">
                    <div>
                        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-[10px] font-bold uppercase tracking-widest text-white">
                            Activity
                        </div>
                        <h1 className="text-4xl font-bold text-white uppercase tracking-tight md:text-6xl">Code</h1>
                        <p className="mt-4 max-w-2xl text-sm leading-relaxed text-gray-700 font-bold uppercase tracking-widest">
                            Track pull requests and activity across your repositories.
                        </p>
                    </div>
                    
                    <div className="flex items-center gap-3">
                        <div className="px-5 py-2.5 bg-white/5 border border-white/10 rounded-xl flex items-center gap-3">
                            <div className="w-1.5 h-1.5 rounded-full bg-white"></div>
                            <span className="text-[10px] font-bold uppercase tracking-widest text-white">Connected</span>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Left Column: Stats & PRs */}
                    <div className="lg:col-span-2 space-y-12">
                        {/* Key Metrics */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 animate-in fade-in slide-in-from-bottom-6 duration-700 delay-100">
                            <SmallMetric 
                                label="Open PRs" 
                                value={pullMetrics.totalOpen} 
                                icon={<GitPullRequest size={20} />} 
                                color="white" 
                            />
                            <SmallMetric 
                                label="Reviews" 
                                value={pullMetrics.needsReview} 
                                icon={<AlertCircle size={20} />} 
                                color="white" 
                            />
                            <SmallMetric 
                                label="Stale" 
                                value={pullMetrics.stale} 
                                icon={<Clock size={20} />} 
                                color="white" 
                            />
                            <SmallMetric 
                                label="Repos" 
                                value={repos.length} 
                                icon={<Star size={20} />} 
                                color="white" 
                            />
                        </div>

                        {/* Pull Requests List */}
                        <div className="bg-white/[0.01] rounded-[2.5rem] border border-white/5 shadow-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-8 duration-700 delay-200">
                            <div className="p-8 border-b border-white/5 flex items-center justify-between">
                                <div>
                                    <h2 className="text-xl font-bold text-white uppercase tracking-widest flex items-center gap-3">
                                        Pull Requests
                                    </h2>
                                </div>
                            </div>
                            <div className="divide-y divide-white/5 bg-black/20">
                                {pulls.length === 0 ? (
                                    <div className="p-16 text-center text-gray-600 font-bold uppercase tracking-widest text-xs">
                                        NO_ACTIVE_LOGISTICS_DETECTED
                                    </div>
                                ) : (
                                    pulls.map((pr, index) => (
                                        <a
                                            key={pr.id}
                                            href={pr.html_url}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="block p-6 hover:bg-white/[0.03] transition-all group"
                                        >
                                            <div className="flex items-start justify-between">
                                                <div className="flex gap-6">
                                                    <div className="mt-1 flex flex-col items-center">
                                                        <img src={pr.user.avatar_url} alt="" className="w-10 h-10 rounded-xl border border-white/10 group-hover:scale-110 transition-transform group-hover:border-blue-500/50" />
                                                    </div>
                                                    <div>
                                                        <h3 className="text-base font-bold text-white uppercase tracking-tight">
                                                            {pr.title}
                                                            <span className="ml-3 text-gray-800 font-mono text-xs">#{pr.number}</span>
                                                        </h3>
                                                        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 mt-3 text-[10px] font-bold uppercase tracking-widest">
                                                            <span className="text-gray-800">{pr.repo.toUpperCase()}</span>
                                                            <span className="text-gray-800">
                                                                BY @{pr.user.login.toUpperCase()}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="px-4 py-1.5 rounded-lg border border-white/10 text-[9px] font-bold uppercase tracking-widest text-white">
                                                    {pr.state.toUpperCase()}
                                                </div>
                                            </div>
                                        </a>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Right Column: Repos & Activity */}
                    <div className="space-y-12 animate-in fade-in slide-in-from-right-8 duration-700 delay-300">
                        {/* Repository List */}
                        <div className="bg-white/[0.01] rounded-[2.5rem] border border-white/5 shadow-2xl transition-all hover:border-white/10">
                            <div className="p-8 border-b border-white/5">
                                <h2 className="text-xl font-bold text-white uppercase tracking-widest">Repositories</h2>
                            </div>
                            <div className="p-4 space-y-2">
                                {repos.length === 0 ? (
                                    <div className="p-8 text-center text-gray-800 font-bold uppercase tracking-widest text-[10px]">No repositories found.</div>
                                ) : (
                                    repos.map(repo => (
                                        <a
                                            key={repo.id}
                                            href={repo.html_url}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="flex items-center justify-between p-4 rounded-2xl bg-white/[0.02] border border-transparent hover:border-white/5 transition-all group"
                                        >
                                            <div className="flex items-center gap-4 min-w-0">
                                                <div className="p-3 bg-white/5 border border-white/10 rounded-xl text-white">
                                                    <GitBranch size={16} />
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="text-sm font-bold text-white uppercase tracking-tight truncate">{repo.name}</p>
                                                    <p className="text-[9px] font-bold text-gray-800 truncate tracking-widest uppercase">{repo.full_name}</p>
                                                </div>
                                            </div>
                                        </a>
                                    ))
                                )}
                                {repos.length > 0 && (
                                    <button
                                        onClick={() => navigate('/app/code/repos')}
                                        className="w-full mt-4 py-4 text-[10px] font-bold text-center text-white hover:bg-white/5 uppercase tracking-widest transition-all flex items-center justify-center border border-white/10 rounded-2xl"
                                    >
                                        View All
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Recent Activity Stream */}
                        <div className="bg-white/[0.01] rounded-[2.5rem] border border-white/5 shadow-2xl">
                            <div className="p-8 border-b border-white/5">
                                <h2 className="text-xl font-bold text-white uppercase tracking-widest">Recent Activity</h2>
                            </div>
                            <div className="p-6 space-y-8">
                                {activity.length === 0 ? (
                                    <div className="text-center py-8 text-gray-800 font-bold uppercase tracking-widest text-[10px]">No recent activity.</div>
                                ) : (
                                    activity.slice(0, 8).map((event, i) => (
                                        <div key={event.id} className="relative flex gap-5 animate-in fade-in slide-in-from-right-4 duration-500" style={{ animationDelay: `${i * 100}ms` }}>
                                            <div className="mt-1 relative z-10">
                                                {event.type === 'PushEvent' ? (
                                                    <div className="p-1 rounded-full bg-white/5 border border-white/10 text-white">
                                                        <GitCommit size={14} />
                                                    </div>
                                                ) : event.type === 'PullRequestEvent' ? (
                                                    <div className="p-1 rounded-full bg-white text-black">
                                                        <GitPullRequest size={14} />
                                                    </div>
                                                ) : (
                                                    <div className="w-[18px] h-[18px] rounded-full border border-white/10" />
                                                )}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-xs font-bold text-white leading-relaxed uppercase tracking-widest">
                                                    <span>
                                                        {event.actor?.display_login || event.actor?.login || 'User'}
                                                    </span>
                                                    <span className="text-gray-800 mx-2">
                                                        {event.payload?.action?.toUpperCase() || 'MODIFIED'}
                                                    </span>
                                                    <span className="text-white block mt-1">{event.repo.toUpperCase()}</span>
                                                </p>
                                                <p className="text-gray-900 text-[9px] font-bold mt-2">
                                                    {new Date(event.created_at).toLocaleString([], {
                                                        month: 'short',
                                                        day: 'numeric',
                                                        hour: '2-digit',
                                                        minute: '2-digit'
                                                    }).toUpperCase()}
                                                </p>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

function SmallMetric({ label, value, icon, subtext }) {
    return (
        <div className="bg-white/[0.01] p-8 rounded-[2.5rem] border border-white/5 shadow-2xl transition-all hover:border-white/10 group">
            <div className="flex items-center gap-4 mb-6">
                <div className="p-3 rounded-2xl border border-white/10 bg-white/5 text-white">
                    {icon}
                </div>
            </div>
            <p className="text-[10px] font-bold text-gray-700 uppercase tracking-widest mb-2">{label}</p>
            <p className="text-4xl font-bold text-white mb-2">{value}</p>
            {subtext && <p className="text-[9px] font-bold text-gray-800 uppercase tracking-widest italic">{subtext}</p>}
        </div>
    );
}
