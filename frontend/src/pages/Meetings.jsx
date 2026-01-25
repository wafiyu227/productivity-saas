import { Calendar } from 'lucide-react';

export default function Meetings() {
    return (
        <div className="p-8">
            <div className="max-w-4xl mx-auto">
                <h1 className="text-3xl font-bold text-gray-900 mb-8">
                    Meeting Summaries
                </h1>

                <div className="bg-white rounded-lg shadow-sm p-12 text-center">
                    <Calendar className="mx-auto text-gray-400 mb-4" size={48} />
                    <h2 className="text-xl font-semibold text-gray-900 mb-2">
                        Coming Soon
                    </h2>
                    <p className="text-gray-600">
                        Meeting summaries and notes will appear here
                    </p>
                </div>
            </div>
        </div>
    );
}