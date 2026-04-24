import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { supabase } from '../lib/supabase';
import {
    MessageSquare, AlertTriangle, Clock, Sparkles, ArrowLeft,
    Search, Filter, Download, Trash2, ArrowRight, Zap, ChevronRight, Terminal
} from 'lucide-react';

export default function Summaries() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [summaries, setSummaries] = useState([]);
    const [filteredSummaries, setFilteredSummaries] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedChannel, setSelectedChannel] = useState('');
    const canManageSummaries = true;

    const loadSummaries = useCallback(async () => {
        if (!user) return;

        try {
            setLoading(true);
            const data = await api.getSummaries({ limit: 200 });
            setSummaries(data || []);
        } catch (error) {
            console.error('Failed to load summaries:', error);
        } finally {
            setLoading(false);
        }
    }, [user]);

    useEffect(() => {
        if (user) {
            loadSummaries();
        }
    }, [user, loadSummaries]);

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

        const filter = `user_id=eq.${user.id}`;

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
    }, [user, loadSummaries]);

    const handleDeleteSummary = async (id) => {
        if (!canManageSummaries) {
            alert('Only team owners/admins can delete summaries.');
            return;
        }
        if (!window.confirm('Are you sure you want to delete this summary?')) return;

        try {
            await api.deleteSummary(id);
            setSummaries(prev => prev.filter(s => s.id !== id));
        } catch (error) {
            console.error('Delete summary error:', error);
            alert('Failed to delete summary: ' + error.message);
        }
    };

    const handleExport = () => {
        if (filteredSummaries.length === 0) return;

        const headers = ['Date', 'Channel', 'Messages', 'Summary', 'Blockers'];
        const rows = filteredSummaries.map(s => [
            new Date(s.created_at).toLocaleDateString(),
            `#${s.channel_name}`,
            s.message_count,
            `"${s.summary.replace(/"/g, '""')}"`,
            `"${(s.blockers || s.key_topics || []).join(', ').replace(/"/g, '""')}"`
        ]);

        const csvContent = [
            headers.join(','),
            ...rows.map(r => r.join(','))
        ].join('\n');

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
            <div className="min-h-screen bg-black flex flex-col items-center justify-center gap-8 text-white">
                <div className="w-12 h-12 border-4 border-white/5 border-t-white rounded-full animate-spin"></div>
                <p className="text-[10px] font-bold uppercase tracking-widest">Loading...</p>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-black text-white selection:bg-blue-500/30">

            <div className="relative mx-auto max-w-7xl px-4 pb-20 pt-4 md:px-8 md:pt-8">
                {/* Header */}
                <div className="mb-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
                    <button
                        onClick={() => navigate('/app/dashboard')}
                        className="group mb-8 inline-flex items-center gap-3 text-[10px] font-bold uppercase tracking-widest text-gray-700 hover:text-white transition-all"
                    >
                        <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
                        Back to Dashboard
                    </button>
                    
                    <div className="flex flex-col md:flex-row items-start md:items-end justify-between gap-8">
                        <div>
                            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-[10px] font-bold uppercase tracking-widest text-white">
                                History
                            </div>
                            <h1 className="text-4xl font-bold text-white uppercase tracking-tight md:text-6xl">Summaries</h1>
                            <p className="mt-4 text-sm leading-relaxed text-gray-700 font-bold uppercase tracking-widest">
                                View history of synthesized summaries across your channels.
                            </p>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                             <div className="text-[10px] font-bold text-white uppercase tracking-widest bg-white/5 border border-white/10 px-4 py-2 rounded-xl">
                                {filteredSummaries.length} / {summaries.length} Summaries
                             </div>
                        </div>
                    </div>
                </div>

                {/* Filters */}
                <div className="rounded-[2.5rem] border border-white/5 bg-white/[0.01] p-6 shadow-2xl mb-12 animate-in fade-in slide-in-from-bottom-6 duration-700 delay-100">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {/* Search */}
                        <div className="relative">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-800" size={18} />
                            <input
                                type="text"
                                placeholder="Search..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-12 pr-4 py-4 bg-white/[0.03] border border-white/5 rounded-2xl text-[10px] font-bold uppercase tracking-widest text-white outline-none focus:bg-white/[0.06] focus:border-white/10 transition-all placeholder:text-gray-800"
                            />
                        </div>

                        {/* Channel Filter */}
                        <div className="relative">
                            <Filter className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-800" size={18} />
                            <select
                                value={selectedChannel}
                                onChange={(e) => setSelectedChannel(e.target.value)}
                                className="w-full pl-12 pr-4 py-4 bg-white/[0.03] border border-white/5 rounded-2xl text-[10px] font-bold uppercase tracking-widest text-white outline-none focus:bg-white/[0.06] focus:border-white/10 transition-all appearance-none cursor-pointer"
                            >
                                <option value="" className="bg-black">All Channels</option>
                                {channels.map((ch) => (
                                    <option key={ch} value={summaries.find(s => s.channel_name === ch)?.channel_id} className="bg-black">
                                        Channel: #{ch.toUpperCase()}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Export Button */}
                        <button
                            onClick={handleExport}
                            disabled={filteredSummaries.length === 0}
                            className="flex items-center justify-center gap-3 px-8 py-4 bg-white text-black rounded-2xl text-[10px] font-bold uppercase tracking-widest hover:bg-gray-200 transition-all active:scale-95 disabled:opacity-5 disabled:cursor-not-allowed"
                        >
                            <Download size={18} />
                            Export
                        </button>
                    </div>
                </div>

                {/* Summaries List */}
                {filteredSummaries.length === 0 ? (
                    <div className="rounded-[3rem] border border-white/10 bg-black p-24 text-center animate-in fade-in duration-700 shadow-2xl">
                        <div className="w-24 h-24 bg-white/5 border border-white/10 rounded-[2.5rem] flex items-center justify-center mx-auto mb-10">
                            <Sparkles className="text-white" size={48} />
                        </div>
                        <h3 className="text-3xl font-bold text-white uppercase tracking-tight mb-4">
                            No summaries found.
                        </h3>
                        <p className="text-gray-700 font-bold uppercase tracking-widest text-xs max-w-md mx-auto leading-relaxed">
                            {summaries.length === 0 
                                ? 'No summaries have been created yet.' 
                                : 'No matching summaries found.'}
                        </p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 gap-6 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-200">
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
    );
}

function SummaryRow({ summary, onDelete, canDelete }) {
    const channelName = (summary.channel_name || 'unknown').toUpperCase();
    const summaryText = summary.summary || '';
    const blockers = summary.blockers || summary.key_topics || [];
    const messageCount = summary.message_count || 0;
    const createdAt = summary.created_at ? new Date(summary.created_at).toLocaleDateString().toUpperCase() : 'UNKNOWN';

    return (
        <div className="group bg-white/[0.01] rounded-[2.5rem] border border-white/5 p-8 transition-all hover:bg-white/[0.02] hover:border-white/10 shadow-2xl">
            <div className="flex flex-col lg:flex-row items-start justify-between gap-8 mb-8">
                <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-4 mb-6">
                        <div className="inline-flex items-center gap-2 px-3 py-1 bg-white text-black text-[9px] font-bold uppercase tracking-widest rounded-lg">
                           #{channelName}
                        </div>
                        <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/5 border border-white/10 text-[9px] font-bold uppercase tracking-widest text-white rounded-lg">
                           {messageCount} Messages
                        </div>
                        <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/5 border border-white/10 text-[9px] font-bold uppercase tracking-widest text-gray-700 rounded-lg">
                           <Clock size={12} />
                           {createdAt}
                        </div>
                    </div>

                    <div className="relative">
                        <p className="text-white text-base font-bold leading-relaxed tracking-wide uppercase">
                            {summaryText}
                        </p>
                    </div>
                </div>

                <div className="flex flex-col gap-4 shrink-0 w-full lg:w-auto">
                    {canDelete && (
                        <button
                            onClick={() => onDelete(summary.id)}
                            className="w-full lg:w-auto p-4 rounded-2xl bg-white/5 border border-white/10 text-white hover:bg-white/10 transition-all active:scale-95"
                            title="Delete"
                        >
                            <Trash2 size={20} />
                        </button>
                    )}
                </div>
            </div>

            {Array.isArray(blockers) && blockers.length > 0 && (
                <div className="pt-8 border-t border-white/5">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-1.5 h-1.5 bg-white rounded-full"></div>
                        <p className="text-[10px] font-bold text-white uppercase tracking-widest">Blockers</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {blockers.map((blocker, i) => (
                            <div
                                key={i}
                                className="px-4 py-2 bg-white/5 text-white text-[11px] font-bold uppercase tracking-widest rounded-xl border border-white/10 flex items-center gap-3 transition-all hover:bg-white/10"
                            >
                                <AlertTriangle size={14} className="text-white" />
                                {blocker}
                            </div>
                        ))}
                    </div>
                </div>
            )}
            
            <div className="mt-8 flex justify-end">
                <button 
                  onClick={() => navigate(`/app/agent?summaryId=${summary.id}`)}
                  className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-gray-700 hover:text-white transition-colors"
                >
                    Chat
                    <ChevronRight size={14} />
                </button>
            </div>
        </div>
    );
}
