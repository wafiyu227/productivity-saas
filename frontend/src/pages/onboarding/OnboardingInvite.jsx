import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, Plus, X, ArrowRight, Loader2 } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

const OnboardingInvite = () => {
    const { user, profile } = useAuth();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [invites, setInvites] = useState(['']);

    const handleAddInvite = () => {
        setInvites([...invites, '']);
    };

    const handleRemoveInvite = (index) => {
        const newInvites = invites.filter((_, i) => i !== index);
        setInvites(newInvites.length ? newInvites : ['']);
    };

    const handleInviteChange = (index, value) => {
        const newInvites = [...invites];
        newInvites[index] = value;
        setInvites(newInvites);
    };

    const handleNext = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const apiUrl = import.meta.env.VITE_API_URL;
            const teamId = profile?.current_team_id;

            const validEmails = invites.filter(email => email.trim() && email.includes('@'));

            if (validEmails.length > 0 && teamId) {
                const invitePromises = validEmails.map(email =>
                    fetch(`${apiUrl}/api/teams/${teamId}/invite`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            userId: user.id,
                            email: email.trim()
                        })
                    })
                );
                await Promise.all(invitePromises);
            }

            navigate('/onboarding/complete');
        } catch (error) {
            console.error('Invite step error:', error);
            alert('Failed to send some invites. You can try again from the Team settings later.');
            navigate('/onboarding/complete'); // Still move forward
        } finally {
            setLoading(false);
        }
    };

    return (
        <form onSubmit={handleNext} className="space-y-6 animate-fadeIn">
            <div className="flex items-center gap-3 mb-6 text-blue-600">
                <Users className="w-6 h-6" />
                <h2 className="text-xl font-semibold">Invite Your Team</h2>
            </div>

            <p className="text-sm text-slate-500 mb-6">Teammates will receive an email invitation to join your workspace and access connected tools.</p>

            <div className="space-y-3 max-h-[220px] overflow-y-auto pr-2 custom-scrollbar">
                {invites.map((email, index) => (
                    <div key={index} className="flex gap-2">
                        <input
                            type="email"
                            className="flex-1 px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                            placeholder="colleague@company.com"
                            value={email}
                            onChange={(e) => handleInviteChange(index, e.target.value)}
                        />
                        {invites.length > 1 && (
                            <button
                                type="button"
                                onClick={() => handleRemoveInvite(index)}
                                className="p-3 text-slate-400 hover:text-red-500 transition-colors"
                            >
                                <X size={20} />
                            </button>
                        )}
                    </div>
                ))}
            </div>

            <button
                type="button"
                onClick={handleAddInvite}
                className="text-sm text-blue-600 font-medium hover:text-blue-700 flex items-center gap-1 mt-2"
            >
                <Plus size={16} />
                Add another member
            </button>

            <div className="mt-8 p-4 bg-blue-50 rounded-xl border border-blue-100">
                <p className="text-sm text-blue-800">
                    <strong>Pro Tip:</strong> You can connect your team's Slack, one project platform (Jira/Asana/Trello), and Calendar tools later in the <strong>Integrations</strong> page once you're in the dashboard.
                </p>
            </div>

            <div className="mt-8 pt-6 border-t border-slate-100 flex justify-between items-center">
                <p className="text-xs text-slate-400 italic">You can also invite members later</p>
                <button
                    type="submit"
                    disabled={loading}
                    className="flex items-center gap-2 bg-blue-600 text-white font-semibold py-3 px-8 rounded-xl shadow-lg shadow-blue-200 hover:bg-blue-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed transform active:scale-[0.98]"
                >
                    {loading ? (
                        <>
                            <Loader2 className="animate-spin w-5 h-5" />
                            Sending...
                        </>
                    ) : (
                        <>
                            Finish Setup
                            <ArrowRight className="w-5 h-5" />
                        </>
                    )}
                </button>
            </div>
        </form>
    );
};

export default OnboardingInvite;
