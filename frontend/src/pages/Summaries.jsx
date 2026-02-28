import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { supabase } from '../lib/supabase';
import {
    MessageSquare, AlertTriangle, Clock, Sparkles, ArrowLeft,
    Search, Filter, Download, Trash2
} from 'lucide-react';

export default function Summaries() {
    const { user, profile } = useAuth();
    const navigate = useNavigate();
    const [summaries, setSummaries] = useState([]);
    const [filteredSummaries, setFilteredSummaries] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedChannel, setSelectedChannel] = useState('');
    const currentMembership = profile?.teams?.find((membership) => membership.team_id === profile?.current_team_id);
    const canManageSummaries = !profile?.current_team_id || ['owner', 'admin'].includes(currentMembership?.role);

    const loadSummaries = useCallback(async () => {
        if (!user) return;

        try {
            setLoading(true);
            const data = await api.getSummaries(profile?.current_team_id, { limit: 200 });
            setSummaries(data || []);
        } catch (error) {
            console.error('Failed to load summaries:', error);
        } finally {
            setLoading(false);
        }
    }, [user, profile?.current_team_id]);

    useEffect(() => {
        if (user && profile) {
            loadSummaries();
        }
    }, [user, profile, loadSummaries]);

    const filterSummaries = useCallback(() => {
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
    }, [summaries, searchTerm, selectedChannel]);

    useEffect(() => {
        filterSummaries();
    }, [filterSummaries]);

    useEffect(() => {
        if (!user) return undefined;

        const filter = profile?.current_team_id
            ? `team_id=eq.${profile.current_team_id}`
            : `user_id=eq.${user.id}`;

        const channel = supabase
            .channel(`summaries-live-${user.id}-${Date.now()}`)
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'slack_summaries',
                filter
            }, () => {
                loadSummaries();
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        }
    }, [user, profile?.current_team_id, loadSummaries]);

    const handleDeleteSummary = async (id) => {
        if (!canManageSummaries) {
            alert('Only team owners/admins can delete summaries.');
            return;
        }
        if (!window.confirm('Are you sure you want to delete this summary?')) return;

        try {
            await api.deleteSummary(id);
            // Real-time update: remove from state
            setSummaries(prev => prev.filter(s => s.id !== id));
        } catch (error) {
            console.error('Delete summary error:', error);
            alert('Failed to delete summary: ' + error.message);
        }
    };

    const handleExport = () => {
        if (filteredSummaries.length === 0) return;

        // Create CSV content
        const headers = ['Date', 'Channel', 'Messages', 'Summary', 'Blockers'];
        const rows = filteredSummaries.map(s => [
            new Date(s.created_at).toLocaleDateString(),
            `#${s.channel_name}`,
            s.message_count,
            `"${s.summary.replace(/"/g, '""')}"`, // Escape quotes for CSV
            `"${(s.blockers || s.key_topics || []).join(', ').replace(/"/g, '""')}"`
        ]);

        const csvContent = [
            headers.join(','),
            ...rows.map(r => r.join(','))
        ].join('\n');

        // Download file
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `teama-summaries-${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const channels = [...new Set(summaries.map(s => s.channel_name))];

    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 p-4 md:p-8">
                <div className="text-center">
                    <Sparkles className="animate-spin mx-auto text-blue-600 mb-4" size={32} />
                    <p className="text-gray-600">Loading summaries...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50">
            <div className="p-4 md:p-8">
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
                        <h1 className="text-2xl md:text-4xl font-bold text-gray-900 mb-2">All Summaries</h1>
                        <p className="text-base md:text-lg text-gray-600">
                            {filteredSummaries.length} of {summaries.length} summaries
                        </p>
                        {!canManageSummaries && (
                            <p className="text-sm text-gray-500 mt-2">
                                Summaries are read-only for members.
                            </p>
                        )}
                    </div>

                    {/* Filters */}
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 md:p-6 mb-6 md:mb-8">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                            <button
                                onClick={handleExport}
                                disabled={filteredSummaries.length === 0}
                                className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                            >
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
                                <SummaryRow
                                    key={summary.id}
                                    summary={summary}
                                    onDelete={handleDeleteSummary}
                                    canDelete={canManageSummaries}
                                />
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

function SummaryRow({ summary, onDelete, canDelete }) {
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
                {canDelete && (
                    <button
                        onClick={() => onDelete(summary.id)}
                        className="text-red-400 hover:text-red-600 transition p-2 hover:bg-red-50 rounded-lg"
                        title="Delete summary"
                    >
                        <Trash2 size={20} />
                    </button>
                )}
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
