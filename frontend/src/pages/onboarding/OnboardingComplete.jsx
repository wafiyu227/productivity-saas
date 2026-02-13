import React from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, ArrowRight, PartyPopper } from 'lucide-react';

const OnboardingComplete = () => {
    const navigate = useNavigate();

    return (
        <div className="text-center space-y-6 animate-fadeIn py-8">
            <div className="flex justify-center">
                <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center text-green-600">
                    <CheckCircle2 size={48} />
                </div>
            </div>

            <div className="space-y-2">
                <h2 className="text-2xl font-bold text-slate-900">Workspace Ready!</h2>
                <p className="text-slate-500">Your team workspace is set up and ready to go. We'll start processing your integration data immediately.</p>
            </div>

            <div className="flex justify-center gap-2 text-blue-600 font-medium py-4">
                <PartyPopper size={20} />
                <span>You're all set!</span>
                <PartyPopper size={20} />
            </div>

            <button
                onClick={() => navigate('/app/dashboard')}
                className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white font-semibold py-4 px-8 rounded-xl shadow-lg shadow-blue-200 hover:bg-blue-700 transition-all transform active:scale-[0.98]"
            >
                Go to Dashboard
                <ArrowRight className="w-5 h-5" />
            </button>
        </div>
    );
};

export default OnboardingComplete;
