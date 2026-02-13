import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layers, Check, ArrowRight, Loader2, Calendar, Users } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

const IntegrationCard = ({ name, description, icon: Icon, connected, onConnect }) => (
    <div className="flex items-center justify-between p-4 rounded-xl border border-slate-100 bg-slate-50/50 hover:bg-white hover:shadow-md transition-all">
        <div className="flex items-center gap-4">
            <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${connected ? 'bg-green-100 text-green-600' : 'bg-white text-slate-400 border border-slate-100'}`}>
                <Icon size={24} />
            </div>
            <div>
                <h3 className="font-semibold text-slate-900">{name}</h3>
                <p className="text-xs text-slate-500">{description}</p>
            </div>
        </div>
        <button
            onClick={onConnect}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${connected
                ? 'bg-green-50 text-green-600 cursor-default flex items-center gap-1 border border-green-100'
                : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
        >
            {connected ? (
                <>
                    <Check size={16} />
                    Connected
                </>
            ) : 'Connect'}
        </button>
    </div>
);

const OnboardingIntegrations = () => {
    const { user, profile } = useAuth();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [integrations, setIntegrations] = useState({
        slack: false,
        asana: false,
        google: false
    });

    useEffect(() => {
        const checkStatus = async () => {
            if (!user) return;
            try {
                const apiUrl = import.meta.env.VITE_API_URL;
                const platforms = ['slack', 'asana', 'google'];
                const status = {};
                for (const platform of platforms) {
                    const res = await fetch(`${apiUrl}/api/auth/status?userId=${user.id}&platform=${platform}`);
                    if (res.ok) {
                        const data = await res.json();
                        status[platform] = data.connected;
                    }
                }
                setIntegrations(prev => ({ ...prev, ...status }));
            } catch (err) {
                console.error('Failed to check integration status:', err);
            }
        };
        checkStatus();
    }, [user]);

    const handleConnect = (platform) => {
        const apiUrl = import.meta.env.VITE_API_URL;
        const scope = 'team';
        const teamId = profile?.current_team_id;
        window.location.href = `${apiUrl}/api/auth/${platform}/connect?userId=${user.id}&teamId=${teamId}&scope=${scope}`;
    };

    return (
        <div className="space-y-6 animate-fadeIn">
            <div className="flex items-center gap-3 mb-4 text-blue-600">
                <Layers className="w-6 h-6" />
                <h2 className="text-xl font-semibold">Connect Team Tools</h2>
            </div>
            <p className="text-sm text-slate-500 mb-6">These integrations will be shared with all team members to provide unified insights.</p>

            <div className="space-y-4">
                <IntegrationCard
                    name="Slack"
                    description="Get AI summaries of team channels"
                    icon={Layers}
                    connected={integrations.slack}
                    onConnect={() => handleConnect('slack')}
                />
                <IntegrationCard
                    name="Asana"
                    description="Track projects and team workload"
                    icon={Users}
                    connected={integrations.asana}
                    onConnect={() => handleConnect('asana')}
                />
                <IntegrationCard
                    name="Google Calendar"
                    description="Sync meetings and schedules"
                    icon={Calendar}
                    connected={integrations.google}
                    onConnect={() => handleConnect('google')}
                />
            </div>

            <div className="mt-8 pt-6 border-t border-slate-100 flex justify-between items-center">
                <p className="text-xs text-slate-400 italic">You can add more or skip for now</p>
                <button
                    onClick={() => navigate('/onboarding/invite-team')}
                    className="flex items-center gap-2 bg-blue-600 text-white font-semibold py-3 px-8 rounded-xl shadow-lg shadow-blue-200 hover:bg-blue-700 transition-all transform active:scale-[0.98]"
                >
                    Continue
                    <ArrowRight className="w-5 h-5" />
                </button>
            </div>
        </div>
    );
};

export default OnboardingIntegrations;
