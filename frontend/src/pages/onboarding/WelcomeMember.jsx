import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { CheckCircle, ArrowRight, MessageSquare, FolderKanban, Calendar } from 'lucide-react';

export default function WelcomeMember() {
    const navigate = useNavigate();
    const { profile, refreshProfile } = useAuth();

    useEffect(() => {
        refreshProfile();
    }, [refreshProfile]);

    // In a real app, we'd fetch the team details here
    const teamName = profile?.current_team_id ? 'Your Team' : 'Teama AI';

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 flex items-center justify-center p-4">
            <div className="max-w-2xl w-full bg-white rounded-2xl shadow-xl p-8">
                <div className="text-center mb-8">
                    <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                        <CheckCircle className="text-green-600" size={48} />
                    </div>
                    <h1 className="text-3xl font-bold text-gray-900 mb-4">
                        Welcome to {teamName}! 🎉
                    </h1>
                    <p className="text-gray-600">
                        You're all set! Your team admin has already configured everything.
                    </p>
                </div>

                <div className="bg-gray-50 rounded-lg p-6 mb-8">
                    <h3 className="font-semibold text-gray-900 mb-4">You now have access to:</h3>

                    <div className="space-y-4">
                        <div className="flex items-start gap-4">
                            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center flex-shrink-0">
                                <MessageSquare className="text-purple-600" size={24} />
                            </div>
                            <div>
                                <h4 className="font-semibold text-gray-900">Slack Summaries</h4>
                                <p className="text-sm text-gray-600">
                                    View and generate AI summaries of your team's Slack channels
                                </p>
                            </div>
                        </div>

                        <div className="flex items-start gap-4">
                            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                                <FolderKanban className="text-blue-600" size={24} />
                            </div>
                            <div>
                                <h4 className="font-semibold text-gray-900">Team Projects</h4>
                                <p className="text-sm text-gray-600">
                                    Track Asana projects, tasks, and team workload
                                </p>
                            </div>
                        </div>

                        <div className="flex items-start gap-4">
                            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
                                <Calendar className="text-green-600" size={24} />
                            </div>
                            <div>
                                <h4 className="font-semibold text-gray-900">Team Calendar</h4>
                                <p className="text-sm text-gray-600">
                                    View team schedules, meetings, and availability
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                <button
                    onClick={() => navigate('/app')}
                    className="w-full bg-gradient-to-r from-purple-600 to-blue-600 text-white py-3 rounded-lg font-semibold hover:shadow-lg transition flex items-center justify-center gap-2"
                >
                    Go to Dashboard
                    <ArrowRight size={20} />
                </button>
            </div>
        </div>
    );
}
