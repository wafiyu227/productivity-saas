import React, { useState } from 'react';
import { ChevronRight, Check, User, Building2, Users, Layers, ArrowRight, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const Toggle = ({ id, checked, onChange }) => {
    return (
        <div className="relative inline-block w-10 mr-2 align-middle select-none transition duration-200 ease-in">
            <input
                type="checkbox"
                name={id}
                id={id}
                checked={checked}
                onChange={onChange}
                className="peer absolute block w-6 h-6 rounded-full bg-white border-4 appearance-none cursor-pointer checked:right-0 checked:bg-vibrant-cyan checked:border-vibrant-cyan transition-all duration-200"
            />
            <label
                htmlFor={id}
                onClick={onChange}
                className="block overflow-hidden h-6 rounded-full bg-gray-300 cursor-pointer peer-checked:bg-vibrant-cyan transition-colors duration-200"
            ></label>
        </div>
    );
};

const Onboarding = () => {
    const { user, refreshProfile } = useAuth();
    const navigate = useNavigate();
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);

    // Form State
    const [formData, setFormData] = useState({
        fullName: user?.user_metadata?.full_name || '',
        jobTitle: '',
        companyName: '',
        companySize: '',
        teamInvites: [''], // Array of email strings
        integrations: {
            slack: false,
            asana: false
        }
    });

    const handleInputChange = (field, value) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const handleInviteChange = (index, value) => {
        const newInvites = [...formData.teamInvites];
        newInvites[index] = value;
        setFormData(prev => ({ ...prev, teamInvites: newInvites }));
    };

    const addInviteField = () => {
        setFormData(prev => ({ ...prev, teamInvites: [...prev.teamInvites, ''] }));
    };

    const handleNext = async () => {
        if (step < 3) {
            setStep(step + 1);
        } else {
            await completeOnboarding();
        }
    };

    const completeOnboarding = async () => {
        setLoading(true);
        try {
            const apiUrl = import.meta.env.VITE_API_URL;
            const userId = user.id;

            // 1. Update Profile (Create if doesn't exist)
            const profileRes = await fetch(`${apiUrl}/api/user/profile`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId,
                    email: user.email,
                    full_name: formData.fullName,
                    job_title: formData.jobTitle
                })
            });

            if (!profileRes.ok) {
                const err = await profileRes.json();
                throw new Error(err.error || 'Failed to update profile');
            }

            // 2. Create Team (Company)
            const teamRes = await fetch(`${apiUrl}/api/user/team`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId,
                    name: formData.companyName,
                    size_range: formData.companySize
                })
            });

            if (!teamRes.ok) {
                const err = await teamRes.json();
                throw new Error(err.error || 'Failed to create team');
            }

            const teamData = await teamRes.json();

            // 3. Send Invites
            const validEmails = formData.teamInvites.filter(e => e && e.includes('@'));
            for (const email of validEmails) {
                await fetch(`${apiUrl}/api/user/team/invite`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        userId,
                        teamId: teamData.id,
                        email
                    })
                });
                // We'll allow individual invites to fail without blocking the whole flow, 
                // but we might want to log it.
            }

            // Refresh profile to update AppShell state
            await refreshProfile();

            // Force a small delay to ensure state propagates
            await new Promise(resolve => setTimeout(resolve, 500));

            // Redirect to dashboard
            navigate('/app/dashboard');
        } catch (error) {
            console.error('Onboarding error:', error);
            alert(`Setup failed: ${error.message}. Please try again.`);
            setLoading(false);
        }
    };

    const renderStepIndicator = () => (
        <div className="flex justify-center mb-8 gap-2">
            {[1, 2, 3].map(s => (
                <div
                    key={s}
                    className={`h-2 rounded-full transition-all duration-300 ${s === step ? 'w-8 bg-blue-600' : 'w-2 bg-gray-300'}`}
                />
            ))}
        </div>
    );

    return (
        <div className="min-h-screen bg-[#f8fafc] flex flex-col items-center justify-center p-4">
            <div className="w-full max-w-lg bg-white rounded-2xl shadow-xl p-8 transition-all duration-300">
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-bold text-slate-900 mb-2">Welcome to Teama AI</h1>
                    <p className="text-slate-500">Let's set up your workspace</p>
                </div>

                {renderStepIndicator()}

                <div className="min-h-[320px]">
                    {step === 1 && (
                        <div className="space-y-6 animate-fadeIn">
                            <div className="flex items-center gap-3 mb-6 text-blue-600">
                                <User className="w-6 h-6" />
                                <h2 className="text-xl font-semibold">About You</h2>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Full Name</label>
                                <input
                                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                                    placeholder="Jane Doe"
                                    value={formData.fullName}
                                    onChange={(e) => handleInputChange('fullName', e.target.value)}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Job Title</label>
                                <input
                                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                                    placeholder="Product Manager"
                                    value={formData.jobTitle}
                                    onChange={(e) => handleInputChange('jobTitle', e.target.value)}
                                />
                            </div>
                        </div>
                    )}

                    {step === 2 && (
                        <div className="space-y-6 animate-fadeIn">
                            <div className="flex items-center gap-3 mb-6 text-blue-600">
                                <Building2 className="w-6 h-6" />
                                <h2 className="text-xl font-semibold">Your Workplace</h2>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Company Name</label>
                                <input
                                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                                    placeholder="Acme Corp"
                                    value={formData.companyName}
                                    onChange={(e) => handleInputChange('companyName', e.target.value)}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Company Size</label>
                                <select
                                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all bg-white"
                                    value={formData.companySize}
                                    onChange={(e) => handleInputChange('companySize', e.target.value)}
                                >
                                    <option value="">Select size...</option>
                                    <option value="1-10">1-10 employees</option>
                                    <option value="11-50">11-50 employees</option>
                                    <option value="51-200">51-200 employees</option>
                                    <option value="201+">201+ employees</option>
                                </select>
                            </div>
                        </div>
                    )}

                    {step === 3 && (
                        <div className="space-y-6 animate-fadeIn">
                            <div className="flex items-center gap-3 mb-6 text-blue-600">
                                <Users className="w-6 h-6" />
                                <h2 className="text-xl font-semibold">Invite Team</h2>
                            </div>
                            <p className="text-sm text-slate-500 mb-4">Add your teammates' emails to invite them to your workspace.</p>
                            <div className="space-y-3 max-h-[220px] overflow-y-auto pr-2 custom-scrollbar">
                                {formData.teamInvites.map((email, index) => (
                                    <input
                                        key={index}
                                        type="email"
                                        className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                                        placeholder="colleague@company.com"
                                        value={email}
                                        onChange={(e) => handleInviteChange(index, e.target.value)}
                                    />
                                ))}
                            </div>
                            <button
                                onClick={addInviteField}
                                className="text-sm text-blue-600 font-medium hover:text-blue-700 flex items-center gap-1"
                            >
                                + Add another
                            </button>
                        </div>
                    )}
                </div>

                <div className="mt-8 pt-6 border-t border-slate-100 flex justify-end">
                    <button
                        onClick={handleNext}
                        disabled={loading || (step === 1 && !formData.fullName) || (step === 2 && !formData.companyName)}
                        className="flex items-center gap-2 bg-blue-600 text-white font-semibold py-3 px-8 rounded-xl shadow-lg shadow-blue-200 hover:bg-blue-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed transform active:scale-[0.98]"
                    >
                        {loading ? (
                            <>
                                <Loader2 className="animate-spin w-5 h-5" />
                                Setting up...
                            </>
                        ) : (
                            <>
                                {step === 3 ? 'Finish Setup' : 'Continue'}
                                {step < 3 && <ArrowRight className="w-5 h-5" />}
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default Onboarding;
