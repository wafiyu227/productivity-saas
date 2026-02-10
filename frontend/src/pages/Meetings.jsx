import { Calendar, Clock, Users, Video, Plus, MessageSquare, BarChart2, CheckSquare, RefreshCw, AlertCircle } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../api/client';

export default function Meetings() {
    const { user } = useAuth();
    const [meetings, setMeetings] = useState([]);
    const [calendarEvents, setCalendarEvents] = useState([]);
    const [analytics, setAnalytics] = useState(null);
    const [actionItems, setActionItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [calendarConnected, setCalendarConnected] = useState(false);

    useEffect(() => {
        if (user) {
            fetchAllData();
        }
    }, [user]);

    const fetchAllData = async () => {
        setLoading(true);
        await Promise.all([
            fetchSlackSummaries(),
            fetchCalendarData()
        ]);
        setLoading(false);
    };

    const handleRefresh = async () => {
        setRefreshing(true);
        await fetchAllData();
        setRefreshing(false);
    };

    const fetchSlackSummaries = async () => {
        try {
            const summaries = await api.getSummaries();
            if (summaries && !summaries.error) {
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
            }
        } catch (error) {
            console.error('Failed to fetch summaries:', error);
        }
    };

    const fetchCalendarData = async () => {
        try {
            // Check status first to avoid unnecessary calls
            // For now we'll just try to fetch events, if 401/error we know it's not connected
            const eventsData = await api.getGoogleCalendarEvents();

            if (eventsData.error) {
                setCalendarConnected(false);
                return;
            }

            setCalendarConnected(true);
            setCalendarEvents(eventsData.events || []);

            // Fetch analytics
            const analyticsData = await api.getGoogleCalendarAnalytics();
            if (!analyticsData.error) {
                setAnalytics(analyticsData);
            }

            // Fetch action items
            const actionItemsData = await api.getGoogleCalendarActionItems();
            if (!actionItemsData.error) {
                setActionItems(actionItemsData.actionItems || []);
            }

        } catch (error) {
            console.error('Failed to fetch calendar data:', error);
            setCalendarConnected(false);
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
                                Team Discussions & Schedule
                            </h1>
                            <p className="text-lg text-gray-600">
                                AI-powered summaries of your meetings and Slack discussions
                            </p>
                        </div>
                        <button
                            onClick={handleRefresh}
                            disabled={refreshing}
                            className="p-2 bg-white hover:bg-gray-50 rounded-lg shadow-sm border border-gray-200 transition-all disabled:opacity-50"
                        >
                            <RefreshCw className={`w-5 h-5 text-gray-600 ${refreshing ? 'animate-spin' : ''}`} />
                        </button>
                    </div>

                    {!calendarConnected && (
                        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-8 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <Calendar className="w-6 h-6 text-blue-600" />
                                <div>
                                    <p className="text-blue-900 font-medium">Connect Google Calendar</p>
                                    <p className="text-blue-700 text-sm">Get AI meeting summaries and schedule analytics</p>
                                </div>
                            </div>
                            <a href="/app/integrations" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm font-medium">
                                Connect Now
                            </a>
                        </div>
                    )}

                    {calendarConnected && analytics && (
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
                            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                                <div className="flex items-center gap-2 text-gray-500 mb-1">
                                    <Clock size={16} />
                                    <span className="text-sm">Time in Meetings</span>
                                </div>
                                <p className="text-2xl font-bold text-gray-900">{analytics.totalHours}h <span className="text-sm font-normal text-gray-500">/ month</span></p>
                            </div>
                            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                                <div className="flex items-center gap-2 text-gray-500 mb-1">
                                    <BarChart2 size={16} />
                                    <span className="text-sm">Avg Duration</span>
                                </div>
                                <p className="text-2xl font-bold text-gray-900">{analytics.avgMeetingLength}m</p>
                            </div>
                            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                                <div className="flex items-center gap-2 text-gray-500 mb-1">
                                    <Calendar size={16} />
                                    <span className="text-sm">Busiest Day</span>
                                </div>
                                <p className="text-lg font-bold text-gray-900 truncate" title={analytics.busiestDay}>{new Date(analytics.busiestDay).toLocaleDateString('en-US', { weekday: 'long' })}</p>
                            </div>
                            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                                <div className="flex items-center gap-2 text-gray-500 mb-1">
                                    <CheckSquare size={16} />
                                    <span className="text-sm">Focus Time</span>
                                </div>
                                <p className="text-2xl font-bold text-green-600">{analytics.focusTimePercent}%</p>
                            </div>
                        </div>
                    )}

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        {/* Left Column: Upcoming Meetings */}
                        <div className="lg:col-span-2">
                            <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                                <Calendar className="w-6 h-6 text-blue-600" />
                                Upcoming Meetings
                            </h2>

                            {loading && !calendarEvents.length ? (
                                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center">
                                    <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4"></div>
                                    <p className="text-gray-500">Loading schedule...</p>
                                </div>
                            ) : calendarEvents.length === 0 ? (
                                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center">
                                    <p className="text-gray-500">No upcoming meetings scheduled</p>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {calendarEvents.map(event => (
                                        <div key={event.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 hover:shadow-md transition">
                                            <div className="flex justify-between items-start">
                                                <div>
                                                    <h3 className="font-bold text-gray-900 text-lg mb-1">{event.title}</h3>
                                                    <div className="flex items-center gap-4 text-sm text-gray-600 mb-3">
                                                        <div className="flex items-center gap-1">
                                                            <Calendar size={14} />
                                                            {new Date(event.start).toLocaleDateString()}
                                                        </div>
                                                        <div className="flex items-center gap-1">
                                                            <Clock size={14} />
                                                            {new Date(event.start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} -
                                                            {new Date(event.end).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                        </div>
                                                    </div>
                                                    {event.attendees && event.attendees.length > 0 && (
                                                        <div className="flex items-center gap-2">
                                                            <Users size={14} className="text-gray-400" />
                                                            <div className="flex -space-x-2">
                                                                {event.attendees.slice(0, 5).map((att, i) => (
                                                                    <div key={i} className="w-6 h-6 rounded-full bg-blue-100 border border-white flex items-center justify-center text-xs text-blue-700 font-medium" title={att.email}>
                                                                        {att.email.charAt(0).toUpperCase()}
                                                                    </div>
                                                                ))}
                                                                {event.attendees.length > 5 && (
                                                                    <div className="w-6 h-6 rounded-full bg-gray-100 border border-white flex items-center justify-center text-xs text-gray-600 font-medium">
                                                                        +{event.attendees.length - 5}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                                {event.meetingLink && (
                                                    <a
                                                        href={event.meetingLink}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center gap-2 text-sm font-medium"
                                                    >
                                                        <Video size={16} />
                                                        Join
                                                    </a>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Right Column: Action Items & Slack */}
                        <div className="space-y-8">
                            {/* Action Items */}
                            {calendarConnected && (
                                <div>
                                    <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                                        <CheckSquare className="w-5 h-5 text-green-600" />
                                        Action Items
                                    </h2>
                                    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                                        {actionItems.length === 0 ? (
                                            <p className="text-gray-500 text-sm text-center py-4">No action items detected from recent meetings</p>
                                        ) : (
                                            <ul className="space-y-3">
                                                {actionItems.map((item, i) => (
                                                    <li key={i} className="flex items-start gap-3 p-2 hover:bg-gray-50 rounded-lg transition">
                                                        <div className="w-5 h-5 rounded border border-gray-300 flex items-center justify-center mt-0.5 bg-white">
                                                            <div className="w-3 h-3 rounded-sm bg-transparent"></div>
                                                        </div>
                                                        <div>
                                                            <p className="text-gray-800 text-sm">{item.text}</p>
                                                            <p className="text-xs text-gray-500 mt-1">From: {item.source}</p>
                                                        </div>
                                                    </li>
                                                ))}
                                            </ul>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Recent Slack Discussions */}
                            <div>
                                <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                                    <MessageSquare className="w-5 h-5 text-purple-600" />
                                    Recent Discussions
                                </h2>
                                <div className="space-y-4">
                                    {meetings.slice(0, 3).map(meeting => (
                                        <div key={meeting.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                                            <div className="flex justify-between items-start mb-2">
                                                <h3 className="font-bold text-gray-900 text-sm">{meeting.channelName}</h3>
                                                <span className="text-xs text-gray-500">{meeting.time}</span>
                                            </div>
                                            <p className="text-sm text-gray-600 line-clamp-2">{meeting.summary}</p>
                                        </div>
                                    ))}
                                    {meetings.length === 0 && (
                                        <div className="text-center py-8 bg-white rounded-xl border border-gray-100">
                                            <p className="text-gray-500 text-sm">No recent discussions</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}