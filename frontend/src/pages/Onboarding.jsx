import React, { useEffect } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Terminal, Cpu, Shield, Activity, Zap } from 'lucide-react';

const Onboarding = () => {
    const { profile } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();

    // Redirect to first step if just at /onboarding
    useEffect(() => {
        if (location.pathname === '/onboarding' || location.pathname === '/onboarding/') {
            navigate('/onboarding/welcome');
        }
    }, [location.pathname, navigate]);

    return (
        <div className="min-h-screen bg-black text-white selection:bg-gray-800 font-sans flex flex-col items-center justify-center p-4">
            <div className="relative w-full max-w-2xl">
                {/* Header Context */}
                <div className="flex items-center justify-between mb-8 px-6">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-white/5 border border-white/10 rounded-lg flex items-center justify-center text-gray-400">
                            <Cpu size={16} />
                        </div>
                        <div className="flex flex-col">
                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest leading-none mb-1">Setup</span>
                            <span className="text-xs font-bold text-white uppercase tracking-widest leading-none">Account Setup</span>
                        </div>
                    </div>
                </div>

                {/* Main Onboarding Container */}
                <div className="bg-white/[0.02] border border-white/5 rounded-[2.5rem] p-4 md:p-12 relative overflow-hidden">
                    <div className="min-h-[440px] flex flex-col pt-4">
                        <Outlet />
                    </div>
                    
                    {/* Progress Marker */}
                    <div className="mt-12 pt-8 border-t border-white/5 flex items-center justify-between">
                        <div className="flex gap-2">
                            {[1, 2, 3].map(step => (
                                <div key={step} className={`h-1 rounded-full transition-all duration-500 ${location.pathname.includes('welcome') ? 'w-8 bg-white' : 'w-4 bg-white/10'}`}></div>
                            ))}
                        </div>
                        <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">In Progress</div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Onboarding;
