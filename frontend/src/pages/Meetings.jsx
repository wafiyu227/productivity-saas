import { Calendar, Clock, Users, Video, Plus } from 'lucide-react';

export default function Meetings() {
    const upcomingMeetings = [
        {
            id: 1,
            title: 'Sprint Planning',
            time: 'Today, 2:00 PM',
            duration: '60 min',
            attendees: 8,
            type: 'Recurring'
        },
        {
            id: 2,
            title: 'Design Review',
            time: 'Tomorrow, 10:00 AM',
            duration: '45 min',
            attendees: 5,
            type: 'One-time'
        }
    ];

    const pastMeetings = [
        {
            id: 3,
            title: 'Team Standup',
            date: 'Yesterday, 9:00 AM',
            summary: 'Discussed Q4 roadmap priorities and identified 3 blockers in the authentication flow.',
            keyPoints: ['Authentication flow redesign', 'API performance optimization', 'Mobile app launch timeline']
        }
    ];

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 to-purple-50">
            <div className="p-8">
                <div className="max-w-6xl mx-auto">
                    {/* Header */}
                    <div className="flex items-center justify-between mb-8">
                        <div>
                            <h1 className="text-4xl font-bold text-gray-900 mb-2">
                                Meetings
                            </h1>
                            <p className="text-lg text-gray-600">
                                AI-powered meeting summaries and insights
                            </p>
                        </div>
                        <button className="px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:shadow-lg transition flex items-center gap-2">
                            <Plus size={20} />
                            Schedule Meeting
                        </button>
                    </div>

                    {/* Upcoming Meetings */}
                    <div className="mb-8">
                        <h2 className="text-2xl font-bold text-gray-900 mb-4">Upcoming</h2>
                        <div className="grid md:grid-cols-2 gap-6">
                            {upcomingMeetings.map((meeting) => (
                                <UpcomingMeetingCard key={meeting.id} meeting={meeting} />
                            ))}
                        </div>
                    </div>

                    {/* Past Meetings */}
                    <div>
                        <h2 className="text-2xl font-bold text-gray-900 mb-4">Past Meetings</h2>
                        <div className="space-y-6">
                            {pastMeetings.map((meeting) => (
                                <PastMeetingCard key={meeting.id} meeting={meeting} />
                            ))}
                        </div>
                    </div>

                    {/* Coming Soon Banner */}
                    <div className="mt-8 bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl p-8 text-center text-white">
                        <Calendar className="mx-auto mb-4" size={48} />
                        <h3 className="text-2xl font-bold mb-2">More Features Coming Soon</h3>
                        <p className="text-blue-100">
                            Automatic meeting recording, transcription, and AI-powered action item extraction
                        </p>
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

function PastMeetingCard({ meeting }) {
    return (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-start justify-between mb-4">
                <div>
                    <h3 className="text-xl font-bold text-gray-900 mb-1">{meeting.title}</h3>
                    <p className="text-sm text-gray-500">{meeting.date}</p>
                </div>
                <button className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition text-sm">
                    View Full Notes
                </button>
            </div>

            <div className="mb-4">
                <h4 className="font-semibold text-gray-900 mb-2">AI Summary</h4>
                <p className="text-gray-700">{meeting.summary}</p>
            </div>

            <div>
                <h4 className="font-semibold text-gray-900 mb-2">Key Points</h4>
                <ul className="space-y-2">
                    {meeting.keyPoints.map((point, i) => (
                        <li key={i} className="flex items-start gap-2">
                            <span className="w-1.5 h-1.5 bg-blue-600 rounded-full mt-2" />
                            <span className="text-gray-700">{point}</span>
                        </li>
                    ))}
                </ul>
            </div>
        </div>
    );
}