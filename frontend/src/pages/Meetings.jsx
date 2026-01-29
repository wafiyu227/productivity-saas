import { Calendar, Clock, Users, Video, Plus, MessageSquare } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';

const API_URL = import.meta.env.VITE_API_URL;

export default function Meetings() {
    const { user } = useAuth();
    const [meetings, setMeetings] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (user) {
            fetchMeetings();
        }
    }, [user]);

    const fetchMeetings = async () => {
        try {
            setLoading(true);
            const res = await fetch(`${API_URL}/api/summaries?userId=${user.id}`);
            const summaries = await res.json();

            // Transform summaries into meeting format
            const transformedMeetings = summaries.map(s => ({
                id: s.id,
                title: `#${s.channel_name} Discussion`,
                channelName: s.channel_name,
                date: new Date(s.created_at).toLocaleDateString('en-US', {
                    weekday: 'short',
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric'
                }),
                time: new Date(s.created_at).toLocaleTimeString('en-US', {
                    hour: '2-digit',
                    minute: '2-digit'
                }),
                summary: s.summary,
                keyTopics: s.key_topics || [],
                blockers: s.blockers || [],
                messageCount: s.message_count || 0
            }));

            setMeetings(transformedMeetings);
        } catch (error) {
            console.error('Failed to fetch meetings:', error);
            setMeetings([]);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 to-purple-50">
            <div className="p-8">
                <div className="max-w-6xl mx-auto">
                    {/* Header */}
                    <div className="flex items-center justify-between mb-8">
                        <div>
                            <h1 className="text-4xl font-bold text-gray-900 mb-2">
                                Team Discussions
                            </h1>
                            <p className="text-lg text-gray-600">
                                AI-powered summaries of your Slack channel discussions
                            </p>
                        </div>
                    </div>

                    {/* Upcoming Meetings */}
                    <div className="mb-8">
                        <h2 className="text-2xl font-bold text-gray-900 mb-4">Upcoming Meetings</h2>
                        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center">
                            <Calendar className="mx-auto mb-4 text-gray-400" size={48} />
                            <p className="text-gray-600">
                                Connect your Google Calendar to see upcoming meetings here
                            </p>
                        </div>
                    </div>

                    {/* Past Discussions */}
                    <div>
                        <h2 className="text-2xl font-bold text-gray-900 mb-4">
                            Channel Discussions ({meetings.length})
                        </h2>
                        {loading ? (
                            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center">
                                <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4"></div>
                                <p className="text-gray-600">Loading discussions...</p>
                            </div>
                        ) : meetings.length === 0 ? (
                            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center">
                                <MessageSquare className="mx-auto mb-4 text-gray-400" size={48} />
                                <p className="text-gray-600">
                                    Generate summaries to see channel discussions here
                                </p>
                            </div>
                        ) : (
                            <div className="space-y-6">
                                {meetings.map((meeting) => (
                                    <MeetingCard key={meeting.id} meeting={meeting} />
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

function UpcomingMeetingCard({ meeting }) {
    return (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition">
            <div className="flex items-start justify-between mb-4">
                <div>
                    <h3 className="text-xl font-bold text-gray-900 mb-2">{meeting.title}</h3>
                    <div className="space-y-2">
                        <p className="flex items-center gap-2 text-gray-600">
                            <Clock size={16} />
                            {meeting.time}
                        </p>
                        <p className="flex items-center gap-2 text-gray-600">
                            <Users size={16} />
                            {meeting.attendees} attendees
                        </p>
                    </div>
                </div>
                <span className="px-3 py-1 bg-blue-100 text-blue-700 text-xs font-semibold rounded-full">
                    {meeting.type}
                </span>
            </div>
            <button className="w-full py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center justify-center gap-2">
                <Video size={18} />
                Join Meeting
            </button>
        </div>
    );
}

function MeetingCard({ meeting }) {
    return (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition">
            <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                        <MessageSquare size={20} className="text-purple-600" />
                        <div>
                            <h3 className="text-xl font-bold text-gray-900">{meeting.title}</h3>
                            <p className="text-sm text-gray-500">{meeting.date} at {meeting.time}</p>
                        </div>
                    </div>
                </div>
                <span className="px-3 py-1 bg-purple-100 text-purple-700 text-xs font-semibold rounded-full">
                    {meeting.messageCount} messages
                </span>
            </div>

            <div className="mb-4">
                <h4 className="font-semibold text-gray-900 mb-2">AI Summary</h4>
                <p className="text-gray-700">{meeting.summary}</p>
            </div>

            {meeting.keyTopics && meeting.keyTopics.length > 0 && (
                <div className="mb-4">
                    <h4 className="font-semibold text-gray-900 mb-2">Key Topics</h4>
                    <ul className="space-y-2">
                        {meeting.keyTopics.map((topic, i) => (
                            <li key={i} className="flex items-start gap-2">
                                <span className="w-1.5 h-1.5 bg-purple-600 rounded-full mt-2" />
                                <span className="text-gray-700">{topic}</span>
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {meeting.blockers && meeting.blockers.length > 0 && (
                <div>
                    <h4 className="font-semibold text-gray-900 mb-2">Action Items / Blockers</h4>
                    <ul className="space-y-2">
                        {meeting.blockers.map((blocker, i) => (
                            <li key={i} className="flex items-start gap-2">
                                <span className="w-1.5 h-1.5 bg-red-600 rounded-full mt-2" />
                                <span className="text-gray-700">{blocker}</span>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
}