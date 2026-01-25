import { useState, useEffect } from 'react';
import { api } from '../api/client';
import { RefreshCw, MessageSquare, AlertTriangle } from 'lucide-react';

export default function Dashboard() {
    const [channels, setChannels] = useState([]);
    const [summaries, setSummaries] = useState([]);
    const [loading, setLoading] = useState(false);
    const [selectedChannel, setSelectedChannel] = useState('');

    useEffect(() => {
        loadChannels();
    }, []);

    const loadChannels = async () => {
        try {
            const data = await api.getChannels();
            setChannels(data.channels || []);
        } catch (error) {
            console.error('Failed to load channels:', error);
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
            alert('Summary generated!');
        } catch (error) {
            alert('Failed to generate summary: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="p-8">
            <div className="max-w-6xl mx-auto">
                <h1 className="text-3xl font-bold text-gray-900 mb-8">Dashboard</h1>

                {/* Generate Summary Card */}
                <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
                    <h2 className="text-xl font-semibold text-gray-900 mb-4">
                        Generate AI Summary
                    </h2>
                    <div className="flex gap-4">
                        <select
                            value={selectedChannel}
                            onChange={(e) => setSelectedChannel(e.target.value)}
                            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        >
                            <option value="">Select a channel...</option>
                            {channels.map((ch) => (
                                <option key={ch.id} value={ch.id}>
                                    #{ch.name}
                                </option>
                            ))}
                        </select>
                        <button
                            onClick={generateSummary}
                            disabled={loading}
                            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
                        >
                            {loading ? (
                                <>
                                    <RefreshCw size={20} className="animate-spin" />
                                    Generating...
                                </>
                            ) : (
                                <>
                                    <MessageSquare size={20} />
                                    Generate Summary
                                </>
                            )}
                        </button>
                    </div>
                </div>

                {/* Stats Grid */}
                <div className="grid md:grid-cols-3 gap-6 mb-8">
                    <StatCard
                        title="Channels Monitored"
                        value={channels.length}
                        icon={<MessageSquare className="text-blue-600" size={24} />}
                    />
                    <StatCard
                        title="Summaries Generated"
                        value={summaries.length}
                        icon={<RefreshCw className="text-green-600" size={24} />}
                    />
                    <StatCard
                        title="Active Blockers"
                        value={summaries.reduce((acc, s) => acc + (s.blockers?.length || 0), 0)}
                        icon={<AlertTriangle className="text-red-600" size={24} />}
                    />
                </div>

                {/* Recent Summaries */}
                <div className="bg-white rounded-lg shadow-sm p-6">
                    <h2 className="text-xl font-semibold text-gray-900 mb-4">
                        Recent Summaries
                    </h2>
                    {summaries.length === 0 ? (
                        <p className="text-gray-500 text-center py-8">
                            No summaries yet. Generate your first summary above!
                        </p>
                    ) : (
                        <div className="space-y-4">
                            {summaries.map((summary, idx) => (
                                <SummaryCard key={idx} summary={summary} />
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

function StatCard({ title, value, icon }) {
    return (
        <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center justify-between">
                <div>
                    <p className="text-sm text-gray-600">{title}</p>
                    <p className="text-3xl font-bold text-gray-900 mt-1">{value}</p>
                </div>
                {icon}
            </div>
        </div>
    );
}

function SummaryCard({ summary }) {
    return (
        <div className="border border-gray-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-gray-900">#{summary.channel}</h3>
                <span className="text-sm text-gray-500">
                    {summary.messageCount} messages
                </span>
            </div>
            <p className="text-gray-700 mb-3">{summary.summary}</p>
            {summary.blockers && summary.blockers.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-2">
                    {summary.blockers.map((blocker, i) => (
                        <span
                            key={i}
                            className="px-2 py-1 bg-red-100 text-red-700 text-sm rounded"
                        >
                            🚧 {blocker}
                        </span>
                    ))}
                </div>
            )}
            {summary.keyTopics && (
                <div className="flex flex-wrap gap-2">
                    {summary.keyTopics.map((topic, i) => (
                        <span
                            key={i}
                            className="px-2 py-1 bg-blue-100 text-blue-700 text-sm rounded"
                        >
                            {topic}
                        </span>
                    ))}
                </div>
            )}
        </div>
    );
}