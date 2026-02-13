import React, { useEffect } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const Onboarding = () => {
    const { profile } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();

    // Mapping routes to step numbers for the indicator
    const steps = {
        '/onboarding/welcome': 1,
        '/onboarding/invite-team': 2,
        '/onboarding/complete': 3,
        '/onboarding/member-welcome': 1 // Member welcome is a single step
    };

    const currentStep = steps[location.pathname] || 1;
    const isMemberFlow = location.pathname === '/onboarding/member-welcome';

    // Redirect to first step if just at /onboarding
    useEffect(() => {
        if (location.pathname === '/onboarding' || location.pathname === '/onboarding/') {
            if (profile?.team_id) {
                navigate('/onboarding/member-welcome');
            } else {
                navigate('/onboarding/welcome');
            }
        }
    }, [location.pathname, profile, navigate]);

    const renderStepIndicator = () => {
        if (isMemberFlow) return null;

        return (
            <div className="flex justify-center mb-8 gap-2">
                {[1, 2, 3].map(s => {
                    let state = 'pending';
                    if (s === currentStep) state = 'current';
                    else if (s < currentStep) state = 'done';

                    return (
                        <div
                            key={s}
                            className={`h-2 rounded-full transition-all duration-300 ${state === 'current' ? 'w-8 bg-blue-600' :
                                state === 'done' ? 'w-4 bg-green-500' : 'w-2 bg-gray-300'
                                }`}
                            title={state}
                        />
                    );
                })}
            </div>
        );
    };

    return (
        <div className="min-h-screen bg-[#f8fafc] flex flex-col items-center justify-center p-4">
            <div className="w-full max-w-lg bg-white rounded-2xl shadow-xl p-8 transition-all duration-300">
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-bold text-slate-900 mb-2">Welcome to Teama AI</h1>
                    <p className="text-slate-500">
                        {isMemberFlow ? "Join your team's workspace" : "Let's set up your workspace"}
                    </p>
                </div>

                {!isMemberFlow && renderStepIndicator()}

                <div className="min-h-[360px]">
                    <Outlet />
                </div>
            </div>
        </div>
    );
};

export default Onboarding;
