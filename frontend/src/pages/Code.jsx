import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
    GitBranch,
    GitCommit,
    GitPullRequest,
    Loader,
    ExternalLink,
    Github,
    Star,
    Clock,
    AlertCircle
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const API_URL = import.meta.env.VITE_API_URL;

export default function Code() {
    const { user, profile } = useAuth();
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
    }, [user, profile?.current_team_id]);

    const checkConnection = async () => {
        try {
            const teamId = profile?.current_team_id;
            const res = await fetch(`${API_URL}/api/auth/github/status?userId=${user.id}&teamId=${teamId}`);
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
            const teamId = profile?.current_team_id;

            // 1. Fetch Repos
            const reposRes = await fetch(`${API_URL}/api/github/repos?userId=${user.id}&teamId=${teamId}&perPage=10`);
            const reposData = await reposRes.json();
            setRepos(reposData.repos || []);

            // 2. Fetch team-visible Pull Requests and PR health counters
            const pullsRes = await fetch(`${API_URL}/api/github/pulls?userId=${user.id}&teamId=${teamId}&limit=10&staleDays=7`);
            const pullsData = await pullsRes.json();
            setPulls(pullsData.pulls || []);
            setPullMetrics({
                totalOpen: pullsData.meta?.total_open || 0,
                needsReview: pullsData.meta?.needs_review || 0,
                stale: pullsData.meta?.stale || 0,
                staleDays: pullsData.meta?.stale_days || 7,
                limit: pullsData.meta?.limit || 10
            });

            // 3. Fetch Recent Activity
            const activityRes = await fetch(`${API_URL}/api/github/activity?userId=${user.id}&teamId=${teamId}`);
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
            <div className="flex h-[calc(100vh-64px)] items-center justify-center">
                <Loader className="animate-spin text-blue-600" size={32} />
            </div>
        );
    }

    if (!connected) {
        return (
            <div className="flex flex-col items-center justify-center h-[calc(100vh-64px)] px-4">
                <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 text-center max-w-md">
                    <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
                        <Github size={32} className="text-gray-900" />
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900 mb-2">Connect GitHub</h2>
                    <p className="text-gray-600 mb-6">
                        Connect your GitHub account to track pull requests, commits, and developer activity directly from your dashboard.
                    </p>
                    <button
                        onClick={handleConnect}
                        className="w-full py-3 bg-gray-900 text-white rounded-xl hover:bg-gray-800 transition font-medium flex items-center justify-center gap-2"
                    >
                        Go to Integrations
                        <ExternalLink size={18} />
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6 md:space-y-8">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Code & Repositories</h1>
                    <p className="text-gray-600 mt-1">Monitor your team's development activity</p>
                </div>
                <div className="flex items-center gap-2">
                    <span className="flex items-center gap-1.5 px-3 py-1 bg-green-50 text-green-700 rounded-full text-sm font-medium border border-green-200">
                        <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                        Live
                    </span>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left Column: Stats & PRs */}
                <div className="lg:col-span-2 space-y-8">
                    {/* Key Metrics */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                            <div className="flex items-center gap-3 mb-2">
                                <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                                    <GitPullRequest size={20} />
                                </div>
                                <span className="text-sm font-medium text-gray-500">Open PRs</span>
                            </div>
                            <p className="text-3xl font-bold text-gray-900">{pullMetrics.totalOpen}</p>
                            <p className="text-xs text-gray-500 mt-1">Team-visible across connected repositories</p>
                        </div>
                        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                            <div className="flex items-center gap-3 mb-2">
                                <div className="p-2 bg-yellow-50 text-yellow-700 rounded-lg">
                                    <AlertCircle size={20} />
                                </div>
                                <span className="text-sm font-medium text-gray-500">Needs Review</span>
                            </div>
                            <p className="text-3xl font-bold text-gray-900">{pullMetrics.needsReview}</p>
                            <p className="text-xs text-gray-500 mt-1">Open PRs without a review yet</p>
                        </div>
                        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                            <div className="flex items-center gap-3 mb-2">
                                <div className="p-2 bg-red-50 text-red-600 rounded-lg">
                                    <Clock size={20} />
                                </div>
                                <span className="text-sm font-medium text-gray-500">Stale PRs</span>
                            </div>
                            <p className="text-3xl font-bold text-gray-900">{pullMetrics.stale}</p>
                            <p className="text-xs text-gray-500 mt-1">No updates in {pullMetrics.staleDays}+ days</p>
                        </div>
                        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                            <div className="flex items-center gap-3 mb-2">
                                <div className="p-2 bg-orange-50 text-orange-600 rounded-lg">
                                    <Star size={20} />
                                </div>
                                <span className="text-sm font-medium text-gray-500">Active Repos</span>
                            </div>
                            <p className="text-3xl font-bold text-gray-900">{repos.length}</p>
                            <p className="text-xs text-gray-500 mt-1">Top 10 recently updated repositories</p>
                        </div>
                    </div>

                    {/* Pull Requests List */}
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                        <div className="p-6 border-b border-gray-100">
                            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                                <GitPullRequest size={20} className="text-gray-400" />
                                Active Pull Requests
                            </h2>
                            <p className="text-xs text-gray-500 mt-1">
                                Top {pullMetrics.limit} most recently updated open pull requests
                            </p>
                        </div>
                        <div className="divide-y divide-gray-50">
                            {pulls.length === 0 ? (
                                <div className="p-8 text-center text-gray-500">
                                    No open pull requests found.
                                </div>
                            ) : (
                                pulls.map(pr => (
                                    <a
                                        key={pr.id}
                                        href={pr.html_url}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="block p-4 hover:bg-gray-50 transition group"
                                    >
                                        <div className="flex items-start justify-between">
                                            <div className="flex gap-3">
                                                <GitPullRequest size={20} className="text-green-600 mt-1 flex-shrink-0" />
                                                <div>
                                                    <h3 className="font-medium text-gray-900 group-hover:text-blue-600 transition">
                                                        {pr.title}
                                                        <span className="ml-2 text-gray-400 font-normal">#{pr.number}</span>
                                                    </h3>
                                                    <div className="flex items-center gap-3 mt-1 text-sm text-gray-500">
                                                        <span className="flex items-center gap-1">
                                                            <img src={pr.user.avatar_url} alt="" className="w-4 h-4 rounded-full" />
                                                            {pr.user.login}
                                                        </span>
                                                        <span>•</span>
                                                        <span>{pr.repo}</span>
                                                        <span>•</span>
                                                        <span className="flex items-center gap-1">
                                                            <Clock size={12} />
                                                            {new Date(pr.created_at).toLocaleDateString()}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="px-2 py-1 bg-green-50 text-green-700 text-xs font-medium rounded-full border border-green-100">
                                                {pr.state}
                                            </div>
                                        </div>
                                    </a>
                                ))
                            )}
                        </div>
                    </div>
                </div>

                {/* Right Column: Repos & Activity */}
                <div className="space-y-8">
                    {/* Repository List */}
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
                        <div className="p-6 border-b border-gray-100">
                            <h2 className="text-lg font-bold text-gray-900">Repositories</h2>
                            <p className="text-xs text-gray-500 mt-1">Top 10 recently updated repositories</p>
                        </div>
                        <div className="p-2 space-y-1">
                            {repos.length === 0 ? (
                                <div className="p-4 text-sm text-gray-500">No repositories found.</div>
                            ) : (
                                repos.map(repo => (
                                    <a
                                        key={repo.id}
                                        href={repo.html_url}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="flex items-center justify-between p-3 rounded-xl hover:bg-gray-50 transition group"
                                    >
                                        <div className="flex items-center gap-3 overflow-hidden">
                                            <div className="p-2 bg-gray-100 rounded-lg text-gray-600 group-hover:bg-white group-hover:shadow-sm transition">
                                                <GitBranch size={16} />
                                            </div>
                                            <div className="overflow-hidden">
                                                <p className="font-medium text-gray-900 truncate">{repo.name}</p>
                                                <p className="text-xs text-gray-500 truncate">{repo.full_name}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-1 text-xs text-gray-500">
                                            <Star size={12} />
                                            {repo.stargazers_count}
                                        </div>
                                    </a>
                                ))
                            )}
                            {repos.length > 0 && (
                                <button
                                    onClick={() => navigate('/app/code/repos')}
                                    className="w-full py-2 text-sm text-center text-blue-600 hover:bg-blue-50 rounded-lg transition mt-2"
                                >
                                    View all repositories
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Recent Activity Stream */}
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
                        <div className="p-6 border-b border-gray-100">
                            <h2 className="text-lg font-bold text-gray-900">Recent Activity</h2>
                            <p className="text-xs text-gray-500 mt-1">Top 10 most recent events</p>
                        </div>
                        <div className="p-4 space-y-4">
                            {activity.length === 0 ? (
                                <div className="text-sm text-gray-500">No recent activity found.</div>
                            ) : (
                                activity.slice(0, 10).map(event => (
                                    <div key={event.id} className="flex gap-3 text-sm">
                                        <div className="mt-1">
                                            {event.type === 'PushEvent' ? (
                                                <GitCommit size={16} className="text-blue-500" />
                                            ) : event.type === 'PullRequestEvent' ? (
                                                <GitPullRequest size={16} className="text-green-500" />
                                            ) : (
                                                <div className="w-4 h-4 rounded-full border-2 border-gray-300" />
                                            )}
                                        </div>
                                        <div>
                                            <p className="text-gray-900">
                                                <span className="font-semibold text-gray-900">
                                                    {event.actor?.display_login || event.actor?.login || 'User'}
                                                </span>
                                                <span className="text-gray-500 mx-1">
                                                    {event.payload?.action || 'pushed to'}
                                                </span>
                                                <span className="text-blue-600 font-medium">{event.repo}</span>
                                            </p>
                                            <p className="text-gray-400 text-xs mt-0.5">
                                                {new Date(event.created_at).toLocaleString([], {
                                                    year: 'numeric',
                                                    month: 'short',
                                                    day: 'numeric',
                                                    hour: '2-digit',
                                                    minute: '2-digit'
                                                })}
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
    );
}
