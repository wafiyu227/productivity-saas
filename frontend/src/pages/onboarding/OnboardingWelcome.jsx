import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, ArrowRight, Loader2, User } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

const OnboardingWelcome = () => {
    const { user, profile, refreshProfile } = useAuth();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);

    const [formData, setFormData] = useState({
        fullName: profile?.full_name || user?.user_metadata?.full_name || '',
        teamName: '',
        teamDescription: '',
        role: ''
    });

    const handleNext = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const apiUrl = import.meta.env.VITE_API_URL;

            // 1. Update Profile (Name)
            await fetch(`${apiUrl}/api/user/me`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: user.id,
                    full_name: formData.fullName
                })
            });

            // 2. Create Team
            const teamRes = await fetch(`${apiUrl}/api/teams`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: user.id,
                    name: formData.teamName,
                    description: formData.teamDescription
                })
            });

            if (!teamRes.ok) throw new Error('Failed to create team');
            const team = await teamRes.json();

            // 3. Update Profile with role and current_team_id
            await fetch(`${apiUrl}/api/user/me`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: user.id,
                    job_title: formData.role,
                    current_team_id: team.id
                })
            });

            await refreshProfile();
            navigate('/onboarding/invite-team');
        } catch (error) {
            console.error('Welcome step error:', error);
            alert('Something went wrong. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <form onSubmit={handleNext} className="space-y-6 animate-fadeIn">
            <div className="flex items-center gap-3 mb-6 text-blue-600">
                <Building2 className="w-6 h-6" />
                <h2 className="text-xl font-semibold">Setup Your Team</h2>
            </div>

            <div className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Your Full Name</label>
                    <div className="relative">
                        <User className="absolute left-3 top-3.5 text-slate-400" size={18} />
                        <input
                            required
                            className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                            placeholder="Jane Doe"
                            value={formData.fullName}
                            onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                        />
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Team Name</label>
                    <input
                        required
                        className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                        placeholder="e.g. Acme Marketing"
                        value={formData.teamName}
                        onChange={(e) => setFormData({ ...formData, teamName: e.target.value })}
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Your Role</label>
                    <select
                        required
                        className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all bg-white"
                        value={formData.role}
                        onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                    >
                        <option value="">Select your role...</option>
                        <option value="Founder">Founder</option>
                        <option value="Manager">Manager</option>
                        <option value="Team Lead">Team Lead</option>
                        <option value="Engineer">Engineer</option>
                        <option value="Product Manager">Product Manager</option>
                        <option value="Other">Other</option>
                    </select>
                </div>

                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Team Description (Optional)</label>
                    <textarea
                        className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all resize-none"
                        placeholder="What does your team do?"
                        rows="2"
                        value={formData.teamDescription}
                        onChange={(e) => setFormData({ ...formData, teamDescription: e.target.value })}
                    />
                </div>
            </div>

            <div className="mt-8 pt-6 border-t border-slate-100 flex justify-end">
                <button
                    type="submit"
                    disabled={loading}
                    className="flex items-center gap-2 bg-blue-600 text-white font-semibold py-3 px-8 rounded-xl shadow-lg shadow-blue-200 hover:bg-blue-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed transform active:scale-[0.98]"
                >
                    {loading ? (
                        <>
                            <Loader2 className="animate-spin w-5 h-5" />
                            Creating...
                        </>
                    ) : (
                        <>
                            Continue
                            <ArrowRight className="w-5 h-5" />
                        </>
                    )}
                </button>
            </div>
        </form>
    );
};

export default OnboardingWelcome;
