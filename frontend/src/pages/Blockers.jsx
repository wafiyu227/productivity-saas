import { AlertTriangle, Clock, MessageSquare } from 'lucide-react';

export default function Blockers() {
    // Mock data - replace with real API call later
    const blockers = [
        {
            id: 1,
            title: 'API rate limiting issues',
            source: '#engineering',
            date: '2 hours ago',
            status: 'active'
        },
        {
            id: 2,
            title: 'Database migration pending',
            source: '#devops',
            date: '5 hours ago',
            status: 'active'
        }
    ];

    return (
        <div className="p-8">
            <div className="max-w-4xl mx-auto">
                <h1 className="text-3xl font-bold text-gray-900 mb-8">
                    Team Blockers
                </h1>

                {blockers.length === 0 ? (
                    <div className="bg-white rounded-lg shadow-sm p-12 text-center">
                        <AlertTriangle className="mx-auto text-gray-400 mb-4" size={48} />
                        <p className="text-gray-600">No blockers detected! 🎉</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {blockers.map((blocker) => (
                            <div
                                key={blocker.id}
                                className="bg-white rounded-lg shadow-sm p-6 border-l-4 border-red-500"
                            >
                                <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                        <h3 className="text-lg font-semibold text-gray-900 mb-2">
                                            {blocker.title}
                                        </h3>
                                        <div className="flex items-center gap-4 text-sm text-gray-600">
                                            <span className="flex items-center gap-1">
                                                <MessageSquare size={16} />
                                                {blocker.source}
                                            </span>
                                            <span className="flex items-center gap-1">
                                                <Clock size={16} />
                                                {blocker.date}
                                            </span>
                                        </div>
                                    </div>
                                    <span className="px-3 py-1 bg-red-100 text-red-700 text-sm rounded-full">
                                        {blocker.status}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}