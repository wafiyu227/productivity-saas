import { useNavigate } from 'react-router-dom';
import { CheckCircle, ArrowRight } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

export default function OnboardingComplete() {
    const navigate = useNavigate();
    const { refreshProfile } = useAuth();

    const handleGoToDashboard = async () => {
        await refreshProfile();
        navigate('/app/dashboard');
    };

    return (
        <div className="flex flex-col items-center justify-center p-8 text-center max-w-md mx-auto">
            <div className="flex flex-col items-center mb-10">
                <div className="w-16 h-16 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-center mb-6">
                    <CheckCircle size={32} className="text-white" />
                </div>
                <h1 className="text-4xl font-bold text-white tracking-tight mb-4">
                    You're all set
                </h1>
                <p className="text-gray-500 text-lg leading-relaxed">
                    Your workspace is ready. You can now start summarizing your team's work.
                </p>
            </div>

            <div className="w-full bg-white/[0.02] border border-white/5 rounded-3xl p-8 mb-10 text-left">
                <h3 className="text-xs font-bold text-gray-700 uppercase tracking-widest mb-6">What's next?</h3>
                <ul className="space-y-4">
                    {[
                        "Invite your team members",
                        "Connect your favorite tools",
                        "Generate your first summary",
                        "Identify blockers automatically"
                    ].map((item, i) => (
                        <li key={i} className="flex items-center gap-3 text-sm text-gray-400 font-medium">
                            <div className="w-1.5 h-1.5 bg-white/20 rounded-full"></div>
                            {item}
                        </li>
                    ))}
                </ul>
            </div>

            <button
                onClick={handleGoToDashboard}
                className="w-full bg-white text-black py-4 rounded-xl font-bold hover:bg-gray-200 transition flex items-center justify-center gap-2 active:scale-95"
            >
                Go to Dashboard
                <ArrowRight size={20} />
            </button>
        </div>
    );
}
