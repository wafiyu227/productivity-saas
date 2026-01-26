import { AlertTriangle, Clock, MessageSquare, CheckCircle, Filter, Search } from 'lucide-react';
import { useState } from 'react';

export default function Blockers() {
    const [filter, setFilter] = useState('all');

    const blockers = [
        {
            id: 1,
            title: 'API rate limiting causing delays',
            source: '#engineering',
            date: '2 hours ago',
            status: 'active',
            priority: 'high',
            assignee: 'Sarah Chen',
            description: 'External API rate limits are blocking user registration flow'
        },
        {
            id: 2,
            title: 'Database migration pending approval',
            source: '#devops',
            date: '5 hours ago',
            status: 'active',
            priority: 'medium',
            assignee: 'Mike Rodriguez',
            description: 'Schema changes need review before deployment'
        },
        {
            id: 3,
            title: 'Design assets missing for mobile',
            source: '#design',
            date: '1 day ago',
            status: 'resolved',
            priority: 'low',
            assignee: 'Emily Taylor',
            description: 'Mobile mockups have been delivered'
        }
    ];

    const filteredBlockers = filter === 'all'
        ? blockers
        : blockers.filter(b => b.status === filter);

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
                        <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setFilter('all')}
                                    className={`px-4 py-2 rounded-lg font-medium transition-all ${filter === 'all'
                                            ? 'bg-blue-600 text-white'
                                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                        }`}
                                >
                                    All ({blockers.length})
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

                            <div className="flex gap-2">
                                <button className="p-2 bg-gray-100 rounded-lg hover:bg-gray-200 transition">
                                    <Filter size={20} className="text-gray-600" />
                                </button>
                                <button className="p-2 bg-gray-100 rounded-lg hover:bg-gray-200 transition">
                                    <Search size={20} className="text-gray-600" />
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Blockers List */}
                    {filteredBlockers.length === 0 ? (
                        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center">
                            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                <CheckCircle className="text-green-600" size={40} />
                            </div>
                            <h3 className="text-2xl font-bold text-gray-900 mb-2">
                                No blockers found! 🎉
                            </h3>
                            <p className="text-gray-600">
                                Your team is running smoothly
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
                        <span className="flex items-center gap-2">
                            👤 {blocker.assignee}
                        </span>
                    </div>
                </div>
                <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition">
                    View Details
                </button>
            </div>
        </div>
    );
}