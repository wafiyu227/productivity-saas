import React, { useState } from 'react';
import { ChevronDown, Plus, Check, Building2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

const TeamSwitcher = () => {
    const { user, profile, refreshProfile } = useAuth();
    const [isOpen, setIsOpen] = useState(false);
    const navigate = useNavigate();

    const teams = profile?.teams || [];
    const currentTeam = teams.find(t => t.team_id === profile?.current_team_id) || (teams.length > 0 ? teams[0] : null);

    const handleSwitchTeam = async (teamId) => {
        try {
            const apiUrl = import.meta.env.VITE_API_URL;
            const res = await fetch(`${apiUrl}/api/user/current-team`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: user.id,
                    teamId
                })
            });

            if (res.ok) {
                await refreshProfile();
                setIsOpen(false);
                navigate('/app/dashboard');
            }
        } catch (error) {
            console.error('Failed to switch team:', error);
        }
    };

    return (
        <div className="relative px-3 mb-6">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex items-center justify-between p-2 rounded-xl hover:bg-slate-100 transition-all border border-transparent hover:border-slate-200"
            >
                <div className="flex items-center gap-3 overflow-hidden">
                    <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white shrink-0">
                        <Building2 size={18} />
                    </div>
                    <div className="text-left overflow-hidden">
                        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Current Team</p>
                        <p className="text-sm font-bold text-slate-900 truncate">{currentTeam?.teams?.name || 'No Team Selected'}</p>
                    </div>
                </div>
                <ChevronDown size={16} className={`text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {isOpen && (
                <div className="absolute top-full left-3 right-3 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-50 py-2 animate-in fade-in slide-in-from-top-2">
                    <div className="max-h-60 overflow-y-auto">
                        {teams.map((t) => (
                            <button
                                key={t.team_id}
                                onClick={() => handleSwitchTeam(t.team_id)}
                                className="w-full flex items-center justify-between px-4 py-2 hover:bg-slate-50 transition-colors"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="w-6 h-6 rounded bg-slate-100 flex items-center justify-center text-slate-600">
                                        <Building2 size={14} />
                                    </div>
                                    <span className="text-sm font-medium text-slate-700">{t.teams?.name}</span>
                                </div>
                                {t.team_id === profile?.current_team_id && (
                                    <Check size={16} className="text-green-500" />
                                )}
                            </button>
                        ))}
                    </div>

                    <div className="border-t border-slate-100 mt-2 pt-2 px-2">
                        <button
                            onClick={() => {
                                setIsOpen(false);
                                navigate('/onboarding/welcome');
                            }}
                            className="w-full flex items-center gap-3 px-2 py-2 rounded-lg text-blue-600 hover:bg-blue-50 transition-colors text-sm font-semibold"
                        >
                            <Plus size={16} />
                            Create New Team
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TeamSwitcher;
