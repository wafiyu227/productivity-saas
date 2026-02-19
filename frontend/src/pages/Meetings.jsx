import { Calendar, Clock, Users, Video, CheckSquare, RefreshCw } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../api/client';

const API_URL = import.meta.env.VITE_API_URL;

export default function Meetings() {
    const { user, profile } = useAuth();
    const [calendarEvents, setCalendarEvents] = useState([]);
    const [analytics, setAnalytics] = useState(null);
    const [actionItems, setActionItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [calendarConnected, setCalendarConnected] = useState(null);
    const [connectionChecked, setConnectionChecked] = useState(false);
    const [dataError, setDataError] = useState('');

    useEffect(() => {
        if (user && profile) {
            fetchCalendarData();
        }
    }, [user, profile?.current_team_id]);

    const handleRefresh = async () => {
        setRefreshing(true);
        await fetchCalendarData();
        setRefreshing(false);
    };

    const checkCalendarStatus = async () => {
        if (!user) return { connected: false };

        const teamId = profile?.current_team_id;
        const url = new URL(`${API_URL}/api/auth/status`);
        url.searchParams.append('userId', user.id);
        url.searchParams.append('platform', 'google');
        if (teamId) {
            url.searchParams.append('teamId', teamId);
        }
        const res = await fetch(url.toString());

        if (!res.ok) {
            throw new Error(`Status check failed (${res.status})`);
        }

        return await res.json();
    };

    const fetchCalendarData = async () => {
        setLoading(true);
        setDataError('');
        try {
            const status = await checkCalendarStatus();
            setConnectionChecked(true);

            if (!status.connected) {
                setCalendarConnected(false);
                setCalendarEvents([]);
                setAnalytics(null);
                setActionItems([]);
                return;
            }

            setCalendarConnected(true);
            const teamId = profile?.current_team_id;
            const [eventsData, analyticsData, actionItemsData] = await Promise.all([
                api.getGoogleCalendarEvents(teamId),
                api.getGoogleCalendarAnalytics(teamId),
                api.getGoogleCalendarActionItems(teamId)
            ]);

            if (eventsData.error) {
                if (eventsData.needsReauth) {
                    setCalendarConnected(false);
                    setCalendarEvents([]);
                    setAnalytics(null);
                    setActionItems([]);
                } else {
                    setDataError('Calendar is connected, but we could not load meeting data right now. Please refresh.');
                }
                return;
            }

            setCalendarEvents(eventsData.events || []);

            if (!analyticsData.error) {
                setAnalytics(analyticsData);
            }

            if (!actionItemsData.error) {
                setActionItems(actionItemsData.actionItems || []);
            }

        } catch (error) {
            console.error('Failed to fetch calendar data:', error);
            setConnectionChecked(true);
            setDataError('Could not verify calendar status. Check your connection and refresh.');
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
                                Team Schedule & Analytics
                            </h1>
                            <p className="text-lg text-gray-600">
                                Monitor your team's meeting load and track action items
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

                    {connectionChecked && !loading && calendarConnected === false && (
                        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-8 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <Calendar className="w-6 h-6 text-blue-600" />
                                <div>
                                    <p className="text-blue-900 font-medium">Connect Google Calendar</p>
                                    <p className="text-blue-700 text-sm">Get insight into your team's meeting load and identify focus time.</p>
                                </div>
                            </div>
                            <a href="/app/integrations" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm font-medium">
                                Connect Now
                            </a>
                        </div>
                    )}

                    {dataError && (
                        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-8">
                            <p className="text-amber-900 text-sm">{dataError}</p>
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
                                    <div className="w-4 h-4 rounded-full bg-blue-100 flex items-center justify-center">
                                        <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
                                    </div>
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
                                    <p className="text-gray-500">No upcoming meetings scheduled for the next 7 days.</p>
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

                        {/* Right Column: Action Items */}
                        <div className="space-y-8">
                            {/* Action Items */}
                            {calendarConnected && (
                                <div className="sticky top-8">
                                    <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                                        <CheckSquare className="w-5 h-5 text-green-600" />
                                        Action Items
                                    </h2>
                                    <p className="text-sm text-gray-500 mb-3">
                                        Tasks extracted from your calendar event descriptions (e.g., "TODO: Review deck")
                                    </p>
                                    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                                        {actionItems.length === 0 ? (
                                            <div className="text-center py-8">
                                                <p className="text-gray-500 text-sm">No action items found.</p>
                                                <p className="text-xs text-gray-400 mt-2">Add "TODO:" or "Action:" to your meeting descriptions.</p>
                                            </div>
                                        ) : (
                                            <ul className="space-y-3">
                                                {actionItems.map((item, i) => (
                                                    <li key={i} className="flex items-start gap-3 p-2 hover:bg-gray-50 rounded-lg transition group">
                                                        <div className="w-5 h-5 rounded border border-gray-300 flex items-center justify-center mt-0.5 bg-white group-hover:border-blue-400 transition">
                                                            <div className="w-3 h-3 rounded-sm bg-transparent group-hover:bg-blue-100 transition"></div>
                                                        </div>
                                                        <div>
                                                            <p className="text-gray-800 text-sm font-medium">{item.text}</p>
                                                            <p className="text-xs text-gray-500 mt-1">
                                                                From: <span className="text-blue-600">{item.source}</span>
                                                            </p>
                                                        </div>
                                                    </li>
                                                ))}
                                            </ul>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
