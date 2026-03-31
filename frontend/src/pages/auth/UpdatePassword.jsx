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
            <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
                <div className="max-w-md w-full bg-white rounded-2xl shadow-md p-8 text-center">
                    <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                        <svg className="w-8 h-8 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900 mb-2">Password Updated</h2>
                    <p className="text-gray-600 mb-6">
                        Your password has been changed successfully. Redirecting you to the app...
                    </p>
                    <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
            <div className="max-w-md w-full bg-white rounded-2xl shadow-md p-8">
                <div className="flex flex-col items-center mb-8">
                    <img src="/logo.png" alt="Teama AI Logo" className="w-12 h-12 object-contain mb-4" />
                    <h2 className="text-2xl font-bold text-center text-gray-900">
                        Set New Password
                    </h2>
                    <p className="text-center text-gray-500 mt-2">
                        Please enter your new password below.
                    </p>
                </div>

                {status === 'error' && (
                    <div className="mb-6 p-4 bg-red-50 text-red-700 rounded-xl text-sm border border-red-100">
                        {errorMessage}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            New Password
                        </label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow outline-none"
                            placeholder="••••••••"
                            required
                            disabled={status === 'loading'}
                            minLength={6}
                        />
                    </div>
                    
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Confirm Password
                        </label>
                        <input
                            type="password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow outline-none"
                            placeholder="••••••••"
                            required
                            disabled={status === 'loading'}
                            minLength={6}
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={status === 'loading' || !password || !confirmPassword}
                        className="w-full py-3 px-4 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 disabled:opacity-70 transition-colors flex justify-center items-center"
                    >
                        {status === 'loading' ? (
                            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        ) : (
                            'Update Password'
                        )}
                    </button>
                </form>
            </div>
        </div>
    );
}
