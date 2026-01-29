import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import {
    MessageSquare, AlertTriangle, Clock, Sparkles, ArrowLeft,
    Search, Filter, Download, Trash2
} from 'lucide-react';

export default function Summaries() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [summaries, setSummaries] = useState([]);
    const [filteredSummaries, setFilteredSummaries] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedChannel, setSelectedChannel] = useState('');

    useEffect(() => {
        loadSummaries();
    }, [user]);

    useEffect(() => {
        filterSummaries();
    }, [summaries, searchTerm, selectedChannel]);

    const loadSummaries = async () => {
        if (!user) return;

        try {
            setLoading(true);
            const data = await api.getSummaries();
            setSummaries(data || []);
        } catch (error) {
            console.error('Failed to load summaries:', error);
        } finally {
            setLoading(false);
        }
    };

    const filterSummaries = () => {
        let filtered = summaries;

        if (searchTerm) {
            filtered = filtered.filter(s =>
                s.summary?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                s.channel_name?.toLowerCase().includes(searchTerm.toLowerCase())
            );
        }

        if (selectedChannel) {
            filtered = filtered.filter(s => s.channel_id === selectedChannel);
        }

        setFilteredSummaries(filtered);
    };

    const channels = [...new Set(summaries.map(s => s.channel_name))];

    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 p-8">
                <div className="text-center">
                    <Sparkles className="animate-spin mx-auto text-blue-600 mb-4" size={32} />
                    <p className="text-gray-600">Loading summaries...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50">
            <div className="p-8">
                <div className="max-w-6xl mx-auto">
                    {/* Header */}
                    <div className="mb-8">
                        <button
                            onClick={() => navigate('/app/dashboard')}
                            className="flex items-center gap-2 text-blue-600 hover:text-blue-700 mb-4"
                        >
                            <ArrowLeft size={20} />
                            Back to Dashboard
                        </button>
                        <h1 className="text-4xl font-bold text-gray-900 mb-2">All Summaries</h1>
                        <p className="text-lg text-gray-600">
                            {filteredSummaries.length} of {summaries.length} summaries
                        </p>
                    </div>

                    {/* Filters */}
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-8">
                        <div className="grid md:grid-cols-3 gap-4">
                            {/* Search */}
                            <div className="relative">
                                <Search className="absolute left-3 top-3 text-gray-400" size={20} />
                                <input
                                    type="text"
                                    placeholder="Search summaries..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>

                            {/* Channel Filter */}
                            <div className="relative">
                                <Filter className="absolute left-3 top-3 text-gray-400" size={20} />
                                <select
                                    value={selectedChannel}
                                    onChange={(e) => setSelectedChannel(e.target.value)}
                                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                >
                                    <option value="">All Channels</option>
                                    {channels.map((ch) => (
                                        <option key={ch} value={summaries.find(s => s.channel_name === ch)?.channel_id}>
                                            #{ch}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Export Button */}
                            <button className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition">
                                <Download size={20} />
                                Export
                            </button>
                        </div>
                    </div>

                    {/* Summaries List */}
                    {filteredSummaries.length === 0 ? (
                        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center">
                            <Sparkles className="mx-auto text-gray-400 mb-4" size={48} />
                            <h3 className="text-xl font-semibold text-gray-900 mb-2">No summaries found</h3>
                            <p className="text-gray-600">
                                {summaries.length === 0 ? 'Generate your first summary on the dashboard' : 'Try adjusting your filters'}
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {filteredSummaries.map((summary) => (
                                <SummaryRow key={summary.id} summary={summary} />
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

function SummaryRow({ summary }) {
    const channelName = summary.channel_name || 'unknown';
    const summaryText = summary.summary || '';
    const blockers = summary.blockers || summary.key_topics || [];
    const messageCount = summary.message_count || 0;
    const createdAt = summary.created_at ? new Date(summary.created_at).toLocaleDateString() : 'Unknown';

    return (
        <div className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-md hover:border-blue-200 transition-all">
            <div className="flex items-start justify-between mb-4">
                <div className="flex items-start gap-4">
                    <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-500 rounded-lg flex items-center justify-center flex-shrink-0">
                        <MessageSquare className="text-white" size={24} />
                    </div>
                    <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                            <h3 className="text-lg font-semibold text-gray-900">#{channelName}</h3>
                            <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded">
                                {messageCount} messages
                            </span>
                        </div>
                        <p className="text-sm text-gray-500 flex items-center gap-1 mb-2">
                            <Clock size={14} />
                            {createdAt}
                        </p>
                        <p className="text-gray-700 leading-relaxed">{summaryText}</p>
                    </div>
                </div>
                <button className="text-red-400 hover:text-red-600 transition">
                    <Trash2 size={20} />
                </button>
            </div>

            {Array.isArray(blockers) && blockers.length > 0 && (
                <div className="pt-4 border-t border-gray-100">
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
        </div>
    );
}
