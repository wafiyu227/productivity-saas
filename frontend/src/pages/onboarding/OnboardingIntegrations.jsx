import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layers, Check, ArrowRight, Calendar, Users, Cpu, Zap, Signal, Shield, Terminal, ArrowLeft, ChevronRight } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

const API_URL = import.meta.env.VITE_API_URL || 'https://api.teamaai.xyz';

const IntegrationCard = ({ name, description, icon: Icon, connected, onConnect }) => {
    return (
        <div className={`group flex items-center justify-between p-6 rounded-2xl border transition-all duration-300 ${connected 
            ? 'bg-white/5 border-white/20' 
            : 'bg-white/[0.02] border-white/5 hover:border-white/10'}`}>
            
            <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center transition-all text-white">
                    <Icon size={20} />
                </div>
                <div>
                    <h3 className="text-sm font-bold text-white mb-1 uppercase tracking-widest leading-none">{name}</h3>
                    <p className="text-[10px] text-gray-700 font-bold uppercase tracking-widest">{description}</p>
                </div>
            </div>

            <button
                onClick={() => {
                    if (connected) return;
                    onConnect();
                }}
                disabled={connected}
                className={`px-6 py-2 rounded-lg text-xs font-bold transition-all uppercase tracking-widest ${connected
                    ? 'text-gray-800'
                    : 'bg-white text-black hover:bg-gray-200 active:scale-95'
                    }`}
            >
                {connected ? 'Connected' : 'Connect'}
            </button>
        </div>
    );
};

const OnboardingIntegrations = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [integrations, setIntegrations] = useState({
        slack: false,
        asana: false,
        jira: false,
        google: false
    });

    useEffect(() => {
        const checkStatus = async () => {
            if (!user) return;
            try {
                const platforms = ['slack', 'asana', 'jira', 'google'];
                const status = {};
                for (const platform of platforms) {
                    const url = new URL(`${API_URL}/api/auth/status`);
                    url.searchParams.append('userId', user.id);
                    url.searchParams.append('platform', platform);

                    const res = await fetch(url.toString());
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
        if (!['slack', 'asana', 'jira', 'google'].includes(platform)) {
            return;
        }
        window.location.assign(`${API_URL}/api/auth/${platform}/connect?userId=${user.id}`);
    };

    const connectedProjectPlatform = integrations.jira ? 'Jira' : integrations.asana ? 'Asana' : null;

    return (
        <div className="space-y-10">
            <div className="mb-10">
                <div className="flex items-center gap-4 mb-4">
                    <h2 className="text-3xl font-bold text-white tracking-tight uppercase">Connect your tools</h2>
                </div>
                <p className="text-gray-700 text-sm font-bold uppercase tracking-widest leading-relaxed max-w-md">
                    Connect your workspace tools to automatically summarize conversations and tasks.
                </p>
            </div>

            <div className="space-y-4">
                <IntegrationCard
                    name="Slack"
                    description="Summarize your team's messages"
                    icon={Layers}
                    connected={integrations.slack}
                    onConnect={() => handleConnect('slack')}
                />
                
                <div className="space-y-4">
                    <IntegrationCard
                        name="Project Management"
                        description={connectedProjectPlatform ? `Connected to ${connectedProjectPlatform}` : "Connect Jira or Asana"}
                        icon={Users}
                        connected={!!connectedProjectPlatform}
                        onConnect={() => {}}
                    />
                    
                    {!connectedProjectPlatform && (
                        <div className="flex gap-4">
                            <button
                                onClick={() => handleConnect('jira')}
                                className="flex-1 px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-[10px] font-bold text-white uppercase tracking-widest hover:bg-white/10 transition-all"
                            >
                                Connect Jira
                            </button>
                            <button
                                onClick={() => handleConnect('asana')}
                                className="flex-1 px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-[10px] font-bold text-white uppercase tracking-widest hover:bg-white/10 transition-all"
                            >
                                Connect Asana
                            </button>
                        </div>
                    )}
                </div>

                <IntegrationCard
                    name="Google Calendar"
                    description="Sync meetings and availability"
                    icon={Calendar}
                    connected={integrations.google}
                    onConnect={() => handleConnect('google')}
                />
            </div>

            <div className="mt-12 pt-8 border-t border-white/5 flex flex-col md:flex-row gap-6 justify-between items-center">
                <button
                    onClick={() => navigate('/app/dashboard')}
                    className="text-[10px] font-bold text-gray-800 hover:text-white transition-colors uppercase tracking-widest"
                >
                    Skip for now
                </button>
                <button
                    onClick={() => navigate('/app/dashboard')}
                    className="w-full md:w-auto flex items-center justify-center gap-3 bg-white text-black font-bold py-3 px-10 rounded-xl text-[10px] uppercase tracking-widest transition-all active:scale-95"
                >
                    Dashboard
                    <ArrowRight size={18} />
                </button>
            </div>
        </div>
    );
};

export default OnboardingIntegrations;
