import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Loader2, Users, ArrowRight, AlertCircle } from 'lucide-react';

const JoinTeam = () => {
    const [searchParams] = useSearchParams();
    const token = searchParams.get('token');
    const navigate = useNavigate();
    const { user, refreshProfile } = useAuth();

    const [status, setStatus] = useState('verifying'); // verifying, success, error
    const [error, setError] = useState('');

    useEffect(() => {
        if (!token) {
            setStatus('error');
            setError('Missing invitation token');
            return;
        }

        if (!user) {
            // Wait for user to login
            return;
        }

        const joinTeam = async () => {
            try {
                const apiUrl = import.meta.env.VITE_API_URL;
                const res = await fetch(`${apiUrl}/api/user/team/join`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        userId: user.id,
                        token
                    })
                });

                if (!res.ok) {
                    const err = await res.json();
                    throw new Error(err.error || 'Failed to join team');
                }

                await refreshProfile();
                setStatus('success');

                // Redirect after brief delay
                setTimeout(() => {
                    navigate('/app/dashboard');
                }, 2000);

            } catch (err) {
                setStatus('error');
                setError(err.message);
            }
        };

        joinTeam();
    }, [user, token, navigate, refreshProfile]);

    if (!user) {
        return (
            <div className="min-h-screen bg-[#f8fafc] flex flex-col items-center justify-center p-4">
                <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8 text-center">
                    <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-6">
                        <Users className="w-8 h-8 text-blue-600" />
                    </div>
                    <h1 className="text-2xl font-bold text-slate-900 mb-2">You've been invited!</h1>
                    <p className="text-slate-500 mb-8">Please log in or create an account to join the team.</p>

                    <div className="space-y-4">
                        <button
                            onClick={() => navigate('/login?redirect=' + encodeURIComponent(`/join?token=${token}`))}
                            className="w-full bg-blue-600 text-white font-semibold py-3 px-6 rounded-xl hover:bg-blue-700 transition-all flex items-center justify-center gap-2"
                        >
                            Log In
                            <ArrowRight className="w-4 h-4" />
                        </button>
                        <button
                            onClick={() => navigate('/signup?redirect=' + encodeURIComponent(`/join?token=${token}`))}
                            className="w-full bg-white text-slate-700 font-semibold py-3 px-6 rounded-xl border border-slate-200 hover:bg-slate-50 transition-all"
                        >
                            Create Account
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#f8fafc] flex flex-col items-center justify-center p-4">
            <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8 text-center">
                {status === 'verifying' && (
                    <div className="flex flex-col items-center">
                        <Loader2 className="w-12 h-12 text-blue-600 animate-spin mb-4" />
                        <h2 className="text-xl font-semibold text-slate-900">Joining team...</h2>
                    </div>
                )}

                {status === 'success' && (
                    <div className="flex flex-col items-center animate-fadeIn">
                        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-6">
                            <Users className="w-8 h-8 text-green-600" />
                        </div>
                        <h2 className="text-xl font-bold text-slate-900 mb-2">Success!</h2>
                        <p className="text-slate-500">You have successfully joined the team.</p>
                        <p className="text-sm text-slate-400 mt-4">Redirecting to dashboard...</p>
                    </div>
                )}

                {status === 'error' && (
                    <div className="flex flex-col items-center animate-fadeIn">
                        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-6">
                            <AlertCircle className="w-8 h-8 text-red-600" />
                        </div>
                        <h2 className="text-xl font-bold text-slate-900 mb-2">Unable to join</h2>
                        <p className="text-slate-500 mb-6">{error}</p>
                        <button
                            onClick={() => navigate('/app/dashboard')}
                            className="text-blue-600 font-medium hover:underline"
                        >
                            Go to Dashboard
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default JoinTeam;
