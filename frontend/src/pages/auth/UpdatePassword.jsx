import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';

export default function UpdatePassword() {
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [status, setStatus] = useState('idle'); // 'idle' | 'loading' | 'success' | 'error'
    const [errorMessage, setErrorMessage] = useState('');
    const navigate = useNavigate();

    // Must have a session to update password. 
    // Usually, the password reset flow auto-signs you in via the hash tokens.
    useEffect(() => {
        const checkSession = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                // If they arrived here but aren't logged in, redirect to login
                navigate('/login');
            }
        };
        checkSession();
    }, [navigate]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        if (password !== confirmPassword) {
            setStatus('error');
            setErrorMessage('Passwords do not match');
            return;
        }

        if (password.length < 6) {
            setStatus('error');
            setErrorMessage('Password must be at least 6 characters long');
            return;
        }

        setStatus('loading');
        setErrorMessage('');

        try {
            const { error } = await supabase.auth.updateUser({ password });
            if (error) throw error;
            
            setStatus('success');
            
            // Redirect to app after a short delay
            setTimeout(() => {
                navigate('/app');
            }, 2000);
            
        } catch (error) {
            console.error('Update password error:', error);
            setErrorMessage(error.message || 'Failed to update password. Please try again.');
            setStatus('error');
        }
    };

    if (status === 'success') {
        return (
            <div className="min-h-screen flex items-center justify-center bg-black p-4">
                <div className="max-w-md w-full bg-black border border-white/10 rounded-2xl shadow-2xl p-8 text-center">
                    <div className="w-16 h-16 bg-white/5 border border-white/10 rounded-full flex items-center justify-center mx-auto mb-6 text-white">
                        <CheckCircle2 className="w-8 h-8" />
                    </div>
                    <h2 className="text-2xl font-bold text-white mb-2 uppercase tracking-tight">Updated</h2>
                    <p className="text-gray-700 text-sm font-bold uppercase tracking-widest mb-6">
                        Your password was changed. Redirecting...
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-black p-4">
            <div className="max-w-md w-full bg-black border border-white/10 rounded-2xl shadow-2xl p-8">
                <div className="flex flex-col items-center mb-8">
                    <img src="/logo.png" alt="Teama AI" className="w-12 h-12 object-contain mb-4" />
                    <h2 className="text-2xl font-bold text-center text-white uppercase tracking-tight">
                        Update Password
                    </h2>
                    <p className="text-center text-gray-400 text-xs font-bold uppercase tracking-widest mt-2">
                        Enter your new password below.
                    </p>
                </div>

                {status === 'error' && (
                    <div className="mb-6 p-4 bg-red-50 text-red-700 rounded-xl text-sm border border-red-100">
                        {errorMessage}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div>
                        <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 ml-1">
                            New Password
                        </label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:bg-white/10 transition-all outline-none text-white text-sm font-bold placeholder-gray-800"
                            placeholder="••••••••"
                            required
                            disabled={status === 'loading'}
                            minLength={6}
                        />
                    </div>
                    
                    <div>
                        <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 ml-1">
                            Confirm Password
                        </label>
                        <input
                            type="password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:bg-white/10 transition-all outline-none text-white text-sm font-bold placeholder-gray-800"
                            placeholder="••••••••"
                            required
                            disabled={status === 'loading'}
                            minLength={6}
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={status === 'loading' || !password || !confirmPassword}
                        className="w-full py-4 bg-white text-black rounded-xl font-bold uppercase tracking-widest text-xs hover:bg-gray-200 disabled:opacity-50 transition-all flex justify-center items-center"
                    >
                        {status === 'loading' ? 'Updating...' : 'Update Password'}
                    </button>
                </form>
            </div>
        </div>
    );
}
