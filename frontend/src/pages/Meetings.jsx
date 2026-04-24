import { Calendar, Clock, Users, Video, CheckSquare, RefreshCw, Activity, Target, Zap, ChevronRight, ExternalLink, Lightbulb, Bot } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../api/client';
import { prepareMeeting } from '../utils/api-helpers';

const API_URL = import.meta.env.VITE_API_URL || 'https://api.teamaai.xyz';

function normalizeMeetingText(value) {
    return String(value || '').toLowerCase().replace(/\s+/g, ' ').trim();
}

export default function Meetings() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [calendarEvents, setCalendarEvents] = useState([]);
    const [analytics, setAnalytics] = useState(null);
    const [actionItems, setActionItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [calendarConnected, setCalendarConnected] = useState(null);
    const [connectionChecked, setConnectionChecked] = useState(false);
    const [dataError, setDataError] = useState('');
    const [preparingMeetingId, setPreparingMeetingId] = useState(null);
    const [assigningTaskId, setAssigningTaskId] = useState(null);
    const [notice, setNotice] = useState(null);

    useEffect(() => {
        if (user) {
            fetchCalendarData();
        }
    }, [user]);

    const handleRefresh = async () => {
        setRefreshing(true);
        await fetchCalendarData();
        setRefreshing(false);
    };

    const handlePrepareMeeting = async (meeting) => {
        setPreparingMeetingId(meeting.id);
        setNotice(null);

        try {
            const relatedContext = {};

            const normalizedTitle = normalizeMeetingText(meeting.title);
            const matchingActionItems = (Array.isArray(actionItems) ? actionItems : [])
                .filter((item) => {
                    const source = normalizeMeetingText(item?.source);
                    return item?.eventId === meeting.id || (normalizedTitle && source.includes(normalizedTitle));
                })
                .slice(0, 4);

            if (matchingActionItems.length > 0) {
                relatedContext.relatedTasks = matchingActionItems
                    .map((item) => item?.text)
                    .filter(Boolean);
            }

            if (meeting.description) {
                relatedContext.relatedMessages = [meeting.description];
            }

            const result = await prepareMeeting(user.id, meeting, relatedContext);
            
            setNotice({
                tone: 'success',
                message: `${meeting.title} - Opening meeting prep...`
            });

            // Navigate to AgentChat with the conversation
            if (result.conversationId) {
                setTimeout(() => {
                    navigate(`/app/chat?conversation=${result.conversationId}`);
                }, 1000);
            }
        } catch (error) {
            console.error('Failed to prepare meeting:', error);
            setNotice({
                tone: 'error',
                message: `Failed to prepare for meeting: ${error.message}`
            });
        } finally {
            setPreparingMeetingId(null);
        }
    };

    const handleAssignTaskToAgent = async (task) => {
        setAssigningTaskId(task.id || task.text);
        setNotice(null);

        try {
            const result = await api.assignGoogleTaskToAgent(task);
            
            setNotice({
                tone: 'success',
                message: `Task assigned! Opening chat...`
            });

            if (result.conversationId) {
                setTimeout(() => {
                    navigate(`/app/chat?conversation=${result.conversationId}`);
                }, 1000);
            }
        } catch (error) {
            console.error('Failed to assign task:', error);
            setNotice({
                tone: 'error',
                message: `Failed to assign task: ${error.message}`
            });
        } finally {
            setAssigningTaskId(null);
        }
    };

    const checkCalendarStatus = async () => {
        if (!user) return { connected: false };

        const url = new URL(`${API_URL}/api/auth/status`);
        url.searchParams.append('userId', user.id);
        url.searchParams.append('platform', 'google');
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

            if (!status.connected || status.metadata?.disabled_tools?.includes('google_calendar')) {
                setCalendarConnected(false);
                setCalendarEvents([]);
                setAnalytics(null);
                setActionItems([]);
                return;
            }

            const [eventsData, analyticsData, actionItemsData] = await Promise.all([
                api.getGoogleCalendarEvents(),
                api.getGoogleCalendarAnalytics(),
                api.getGoogleCalendarActionItems()
            ]);

            const requiresReauth = [eventsData, analyticsData, actionItemsData]
                .some(payload => payload?.needsReauth);

            if (requiresReauth) {
                setCalendarConnected(false);
                setCalendarEvents([]);
                setAnalytics(null);
                setActionItems([]);
                setDataError('Google Calendar authorization expired. Please reconnect from Integrations.');
                return;
            }

            if (eventsData.error) {
                setDataError('Calendar is connected, but we could not load meeting data right now. Please refresh.');
                return;
            }

            setCalendarConnected(true);
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

    if (loading && !refreshing) {
        return (
            <div className="flex min-h-[60vh] items-center justify-center bg-black">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-8 h-8 border-4 border-white/5 border-t-white rounded-full animate-spin"></div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-gray-700">Loading schedule...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-black text-gray-100 selection:bg-blue-500/30">
            {/* Background elements */}

            <div className="relative mx-auto max-w-7xl px-4 pb-20 pt-4 md:px-8 md:pt-8">
                {/* Header */}
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 mb-10 md:mb-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
                    <div>
                        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-[10px] font-bold uppercase tracking-widest text-gray-400">
                            Schedule
                        </div>
                        <h1 className="text-4xl font-bold text-white uppercase tracking-tight md:text-5xl">Meetings</h1>
                        <p className="mt-4 max-w-3xl text-sm leading-relaxed text-gray-500 font-medium">
                            Your upcoming meetings and summaries. Stay updated on what's happening.
                        </p>
                    </div>
                    <button
                        onClick={handleRefresh}
                        disabled={refreshing}
                        className="p-4 rounded-2xl bg-white/5 border border-white/5 text-gray-500 hover:text-white hover:bg-white/10 transition-all active:scale-95 disabled:opacity-60"
                    >
                        <RefreshCw size={24} className={refreshing ? 'animate-spin' : ''} />
                    </button>
                </div>

                {connectionChecked && calendarConnected === false && (
                    <div className="mb-10 rounded-3xl border border-white/5 bg-white/[0.02] p-8 flex flex-col md:flex-row items-center justify-between gap-6 animate-in fade-in">
                        <div className="flex items-center gap-6">
                            <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                                <Calendar className="w-8 h-8 text-white" />
                            </div>
                            <div>
                                <p className="text-white font-bold uppercase tracking-widest text-sm mb-1">Connect your calendar</p>
                                <p className="text-gray-500 text-xs font-medium">Sync your meetings to get automatic summaries and action items.</p>
                            </div>
                        </div>
                        <a href="/app/integrations" className="px-8 py-4 bg-white text-black text-[10px] font-bold uppercase tracking-widest rounded-2xl hover:bg-gray-200 transition-all active:scale-95">
                            Connect
                        </a>
                    </div>
                )}

                {dataError && (
                    <div className="mb-10 rounded-2xl border border-white/10 bg-white/5 px-8 py-6 text-xs font-bold uppercase tracking-widest text-white animate-in fade-in flex items-center gap-4">
                        <div className="w-1.5 h-1.5 bg-white rounded-full"></div>
                        {dataError}
                    </div>
                )}

                {notice && (
                    <div className={`mb-10 rounded-2xl border px-8 py-6 text-xs font-bold uppercase tracking-widest animate-in fade-in flex items-center gap-4 ${notice.tone === 'success' ? 'border-white/10 bg-white/5 text-white' : 'border-red-500/20 bg-red-500/5 text-red-500'}`}>
                        <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: notice.tone === 'success' ? 'white' : '#ff0000' }}></div>
                        {notice.message}
                    </div>
                )}

                {calendarConnected && analytics && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-10 md:mb-12 animate-in fade-in duration-700">
                        <AnalyticCard label="Meeting Load" value={`${analytics.totalHours}H`} hint="Per Month" icon={Clock} />
                        <AnalyticCard label="Avg Length" value={`${analytics.avgMeetingLength}M`} hint="Meeting Duration" icon={Activity} />
                        <AnalyticCard label="Busiest Day" value={new Date(analytics.busiestDay).toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase()} hint="High Demand" icon={Target} />
                        <AnalyticCard label="Focus Time" value={`${analytics.focusTimePercent}%`} hint="Deep Work" icon={Zap} />
                    </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start animate-in fade-in slide-in-from-bottom-8 duration-700 delay-200">
                    {/* Left Column: Upcoming Meetings */}
                    <div className="lg:col-span-8 space-y-6">
                        <div className="flex items-center gap-4 mb-2">
                            <h2 className="text-xl font-bold text-white uppercase tracking-widest">Upcoming Schedule</h2>
                        </div>

                        {calendarEvents.length === 0 ? (
                            <div className="rounded-3xl border border-dashed border-white/5 p-16 text-center">
                                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-700">No meetings scheduled.</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {calendarEvents.map(event => (
                                    <div key={event.id} className="rounded-2xl border border-white/5 bg-white/[0.02] px-6 py-5 transition-all hover:bg-white/[0.04] group hover:border-white/10">
                                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                                            <div className="min-w-0 flex-1">
                                                <div className="flex items-center gap-3 mb-2">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]"></span>
                                                    <h3 className="text-lg font-bold text-white uppercase tracking-tight group-hover:text-blue-400 transition-colors leading-tight truncate">{event.title}</h3>
                                                </div>
                                                
                                                <div className="flex flex-wrap items-center gap-5 text-[10px] font-bold uppercase tracking-widest text-gray-400">
                                                    <div className="flex items-center gap-2">
                                                        <Clock size={12} className="text-gray-500" />
                                                        <span>{new Date(event.start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} — {new Date(event.end).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <Calendar size={12} className="text-gray-500" />
                                                        <span>{new Date(event.start).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toUpperCase()}</span>
                                                    </div>
                                                    {event.attendees && event.attendees.length > 0 && (
                                                        <div className="flex items-center gap-2">
                                                            <Users size={12} className="text-gray-500" />
                                                            <span>{event.attendees.length} Attendees</span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                            
                                            <div className="flex items-center gap-2 shrink-0">
                                                <button
                                                    onClick={() => handlePrepareMeeting(event)}
                                                    disabled={preparingMeetingId === event.id}
                                                    className="flex items-center gap-2 px-5 py-2.5 bg-white/5 border border-white/5 text-gray-300 text-[9px] font-bold uppercase tracking-widest rounded-xl hover:bg-white/10 disabled:opacity-50 transition-all"
                                                >
                                                    <Lightbulb size={12} />
                                                    {preparingMeetingId === event.id ? 'Working...' : 'Prepare'}
                                                </button>
                                                {event.meetingLink && (
                                                    <a
                                                        href={event.meetingLink}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="px-6 py-2.5 bg-white text-black text-[9px] font-bold uppercase tracking-widest rounded-xl hover:bg-gray-200 transition-all active:scale-95"
                                                    >
                                                        Join
                                                    </a>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Right Column: Tasks */}
                    <div className="lg:col-span-4 space-y-6 lg:sticky lg:top-8">
                        <div className="flex items-center gap-4 mb-2">
                            <h2 className="text-xl font-bold text-white uppercase tracking-widest">Unified Tasks</h2>
                        </div>
                        
                        <div className="rounded-3xl border border-white/5 bg-white/[0.01] p-6 lg:p-8">
                            <p className="text-[9px] font-bold uppercase tracking-widest text-gray-500 mb-8 border-b border-white/5 pb-6 leading-relaxed">
                                Action items from your calendar and meeting notes.
                            </p>

                            {calendarConnected && (
                                <div className="space-y-2">
                                    {actionItems.length === 0 ? (
                                        <div className="text-center py-12 rounded-2xl border border-dashed border-white/5">
                                            <p className="text-[9px] font-bold uppercase tracking-widest text-gray-700">No pending tasks</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-3">
                                            {actionItems.map((item, i) => (
                                                <div key={item.id || i} className="group relative rounded-xl border border-white/5 bg-white/[0.02] p-4 transition-all hover:bg-white/[0.04] hover:border-white/10">
                                                    <div className="flex items-start gap-4 pr-10">
                                                        <div className="w-4 h-4 rounded-md border border-white/10 flex items-center justify-center mt-1 bg-black group-hover:border-white/20 transition-all shrink-0">
                                                            <div className="w-1 h-1 rounded-full bg-transparent group-hover:bg-blue-400 transition-all"></div>
                                                        </div>
                                                        <div className="min-w-0 flex-1">
                                                            <p className="text-xs font-bold text-gray-200 leading-relaxed uppercase tracking-normal transition-colors group-hover:text-white">{item.text}</p>
                                                            <div className="mt-3 flex items-center gap-3">
                                                                <span className={`text-[8px] font-bold px-2 py-0.5 rounded-full border ${item.sourceType === 'google_tasks' ? 'bg-blue-500/10 border-blue-500/20 text-blue-400' : 'bg-white/5 border-white/10 text-gray-500'} uppercase tracking-widest`}>
                                                                    {item.sourceType === 'google_tasks' ? 'Google Task' : 'Meeting'}
                                                                </span>
                                                                {item.sourceType !== 'google_tasks' && (
                                                                    <span className="text-[8px] font-bold text-gray-700 uppercase tracking-widest truncate max-w-[120px]">
                                                                        {item.source}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                    
                                                    <button
                                                        onClick={() => handleAssignTaskToAgent(item)}
                                                        disabled={assigningTaskId === (item.id || item.text)}
                                                        className="absolute top-4 right-4 p-2.5 rounded-xl bg-white/5 border border-white/10 text-gray-500 hover:text-white hover:bg-white/10 transition-all opacity-0 group-hover:opacity-100 disabled:opacity-50 shadow-xl"
                                                        title="Assign to Agent"
                                                    >
                                                        <Bot size={14} className={assigningTaskId === (item.id || item.text) ? 'animate-pulse' : ''} />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                            
                            {!calendarConnected && (
                                <div className="text-center py-12 rounded-2xl border border-dashed border-white/5">
                                    <p className="text-[10px] font-bold uppercase tracking-widest text-gray-800">Connection required.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

function AnalyticCard({ label, value, hint, icon: Icon }) {
    return (
        <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-8 transition-all hover:bg-white/[0.03]">
            <div className="flex items-center justify-between mb-6">
                <p className="text-[9px] font-bold uppercase tracking-widest text-gray-700 leading-none">{label}</p>
                <div className="p-2 bg-white/5 border border-white/10 rounded-lg">
                    <Icon size={14} className="text-gray-500" />
                </div>
            </div>
            <p className="text-4xl font-bold text-white tracking-tight leading-none">{value}</p>
            <p className="mt-4 text-[9px] font-bold uppercase tracking-widest text-gray-800">{hint}</p>
        </div>
    );
}
