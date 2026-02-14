import { useNavigate } from 'react-router-dom';
import { CheckCircle, ArrowRight } from 'lucide-react';

export default function OnboardingComplete() {
    const navigate = useNavigate();

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 flex items-center justify-center p-4">
            <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center">
                <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                    <CheckCircle className="text-green-600" size={48} />
                </div>

                <h1 className="text-3xl font-bold text-gray-900 mb-4">
                    🎉 You're All Set!
                </h1>

                <p className="text-gray-600 mb-8">
                    Your team workspace is ready. Your team members will receive email invitations to join.
                </p>

                <div className="bg-gray-50 rounded-lg p-6 mb-8 text-left">
                    <h3 className="font-semibold text-gray-900 mb-3">What's next?</h3>
                    <ul className="space-y-2 text-sm text-gray-700">
                        <li className="flex items-start gap-2">
                            <span className="text-purple-600 mt-0.5">•</span>
                            Team members can join with one click
                        </li>
                        <li className="flex items-start gap-2">
                            <span className="text-purple-600 mt-0.5">•</span>
                            Everyone will have access to team integrations
                        </li>
                        <li className="flex items-start gap-2">
                            <span className="text-purple-600 mt-0.5">•</span>
                            Generate your first Slack summary
                        </li>
                        <li className="flex items-start gap-2">
                            <span className="text-purple-600 mt-0.5">•</span>
                            View team projects and workload
                        </li>
                    </ul>
                </div>

                <button
                    onClick={() => navigate('/app/dashboard')}
                    className="w-full bg-gradient-to-r from-purple-600 to-blue-600 text-white py-3 rounded-lg font-semibold hover:shadow-lg transition flex items-center justify-center gap-2"
                >
                    Go to Dashboard
                    <ArrowRight size={20} />
                </button>
            </div>
        </div>
    );
}
