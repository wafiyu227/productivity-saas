import { AlertTriangle, Clock, MessageSquare, CheckCircle, Filter, Search } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';

const API_URL = import.meta.env.VITE_API_URL;

export default function Blockers() {
    const { user } = useAuth();
    const [blockers, setBlockers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('all');
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        if (user) {
            fetchBlockers();
        }
    }, [user]);

    const fetchBlockers = async () => {
        try {
            setLoading(true);
            const res = await fetch(`${API_URL}/api/summaries?userId=${user.id}`);
            const summaries = await res.json();

            // Extract blockers from summaries
            const extractedBlockers = [];
            summaries.forEach((summary, index) => {
                if (summary.blockers && Array.isArray(summary.blockers)) {
                    summary.blockers.forEach((blocker, blockIndex) => {
                        extractedBlockers.push({
                            id: `${summary.id}-${blockIndex}`,
                            title: blocker,
                            source: `#${summary.channel_name}`,
                            date: new Date(summary.created_at).toLocaleDateString(),
                            status: 'active',
                            priority: 'medium',
                            description: `Blocker detected in #${summary.channel_name}`,
                            channelId: summary.channel_id
                        });
                    });
                }
            });

            setBlockers(extractedBlockers);
        } catch (error) {
            console.error('Failed to fetch blockers:', error);
            setBlockers([]);
        } finally {
            setLoading(false);
        }
    };

    const filteredBlockers = blockers.filter(b => {
        const matchesFilter = filter === 'all' || b.status === filter;
        const matchesSearch = b.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                             b.source.toLowerCase().includes(searchTerm.toLowerCase());
        return matchesFilter && matchesSearch;
    });

    const activeCount = blockers.filter(b => b.status === 'active').length;
    const resolvedCount = blockers.filter(b => b.status === 'resolved').length;

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 to-red-50">
            <div className="p-8">
                <div className="max-w-6xl mx-auto">
                    {/* Header */}
                    <div className="mb-8">
                        <h1 className="text-4xl font-bold text-gray-900 mb-2">
                            Team Blockers
                        </h1>
                        <p className="text-lg text-gray-600">
                            Track and resolve issues blocking your team's progress
                        </p>
                    </div>

                    {/* Stats */}
                    <div className="grid md:grid-cols-3 gap-6 mb-8">
                        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-gray-600 mb-1">Active Blockers</p>
                                    <p className="text-3xl font-bold text-red-600">{activeCount}</p>
                                </div>
                                <div className="p-3 bg-red-50 rounded-xl">
                                    <AlertTriangle className="text-red-600" size={24} />
                                </div>
                            </div>
                        </div>

                        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-gray-600 mb-1">Resolved Today</p>
                                    <p className="text-3xl font-bold text-green-600">{resolvedCount}</p>
                                </div>
                                <div className="p-3 bg-green-50 rounded-xl">
                                    <CheckCircle className="text-green-600" size={24} />
                                </div>
                            </div>
                        </div>

                        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-gray-600 mb-1">Avg Resolution Time</p>
                                    <p className="text-3xl font-bold text-blue-600">4.2h</p>
                                </div>
                                <div className="p-3 bg-blue-50 rounded-xl">
                                    <Clock className="text-blue-600" size={24} />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Filters */}
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
                        <div className="flex flex-col md:flex-row gap-4 items-center justify-between mb-4">
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setFilter('all')}
                                    className={`px-4 py-2 rounded-lg font-medium transition-all ${filter === 'all'
                                            ? 'bg-blue-600 text-white'
                                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                        }`}
                                >
                                    All ({filteredBlockers.length})
                                </button>
                                <button
                                    onClick={() => setFilter('active')}
                                    className={`px-4 py-2 rounded-lg font-medium transition-all ${filter === 'active'
                                            ? 'bg-red-600 text-white'
                                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                        }`}
                                >
                                    Active ({activeCount})
                                </button>
                                <button
                                    onClick={() => setFilter('resolved')}
                                    className={`px-4 py-2 rounded-lg font-medium transition-all ${filter === 'resolved'
                                            ? 'bg-green-600 text-white'
                                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                        }`}
                                >
                                    Resolved ({resolvedCount})
                                </button>
                            </div>
                        </div>

                        {/* Search */}
                        <div className="relative">
                            <Search size={20} className="absolute left-3 top-3 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Search blockers by title or channel..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>
                    </div>

                    {/* Blockers List */}
                    {loading ? (
                        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center">
                            <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4"></div>
                            <p className="text-gray-600">Loading blockers...</p>
                        </div>
                    ) : filteredBlockers.length === 0 ? (
                        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center">
                            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                <CheckCircle className="text-green-600" size={40} />
                            </div>
                            <h3 className="text-2xl font-bold text-gray-900 mb-2">
                                No blockers found! 🎉
                            </h3>
                            <p className="text-gray-600">
                                {filter === 'all' && searchTerm === '' ? 'Generate summaries to see blockers' : 'No matching blockers found'}
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {filteredBlockers.map((blocker) => (
                                <BlockerCard key={blocker.id} blocker={blocker} />
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

function BlockerCard({ blocker }) {
    const priorityColors = {
        high: 'border-red-500 bg-red-50',
        medium: 'border-yellow-500 bg-yellow-50',
        low: 'border-blue-500 bg-blue-50'
    };

    const statusColors = {
        active: 'bg-red-100 text-red-700',
        resolved: 'bg-green-100 text-green-700'
    };

    return (
        <div className={`bg-white rounded-2xl shadow-sm border-l-4 p-6 hover:shadow-md transition-shadow ${priorityColors[blocker.priority]}`}>
            <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-xl font-bold text-gray-900">
                            {blocker.title}
                        </h3>
                        <span className={`px-3 py-1 text-xs font-semibold rounded-full ${statusColors[blocker.status]}`}>
                            {blocker.status.toUpperCase()}
                        </span>
                        <span className="px-3 py-1 bg-gray-100 text-gray-700 text-xs font-semibold rounded-full">
                            {blocker.priority.toUpperCase()}
                        </span>
                    </div>
                    <p className="text-gray-700 mb-4">{blocker.description}</p>
                    <div className="flex items-center gap-6 text-sm text-gray-600">
                        <span className="flex items-center gap-2">
                            <MessageSquare size={16} />
                            {blocker.source}
                        </span>
                        <span className="flex items-center gap-2">
                            <Clock size={16} />
                            {blocker.date}
                        </span>
                    </div>
                </div>
                <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition">
                    Resolve
                </button>
            </div>
        </div>
    );
}