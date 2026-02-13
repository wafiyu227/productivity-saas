import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, ArrowRight, Loader2, Sparkles } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

const OnboardingMemberWelcome = () => {
    const { user, profile, refreshProfile } = useAuth();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);

    const [formData, setFormData] = useState({
        fullName: profile?.full_name || user?.user_metadata?.full_name || '',
        role: profile?.job_title || ''
    });

    const handleFinish = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const apiUrl = import.meta.env.VITE_API_URL;

            // Update Profile (Name & Role)
            await fetch(`${apiUrl}/api/user/me`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: user.id,
                    full_name: formData.fullName,
                    job_title: formData.role
                })
            });

            await refreshProfile();
            navigate('/app/dashboard');
        } catch (error) {
            console.error('Member welcome error:', error);
            alert('Something went wrong. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <form onSubmit={handleFinish} className="space-y-6 animate-fadeIn">
            <div className="flex items-center gap-3 mb-6 text-blue-600">
                <Sparkles className="w-6 h-6" />
                <h2 className="text-xl font-semibold">Welcome to the Team!</h2>
            </div>

            <p className="text-sm text-slate-500 mb-6">You've successfully joined your team workspace. Just a few quick details to finish setting up your profile.</p>

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
                            Saving...
                        </>
                    ) : (
                        <>
                            Enter Dashboard
                            <ArrowRight className="w-5 h-5" />
                        </>
                    )}
                </button>
            </div>
        </form>
    );
};

export default OnboardingMemberWelcome;
