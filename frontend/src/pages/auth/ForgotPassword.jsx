import { useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';

export default function ForgotPassword() {
    const [email, setEmail] = useState('');
    const [status, setStatus] = useState('idle'); // 'idle' | 'loading' | 'success' | 'error'
    const [errorMessage, setErrorMessage] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        setStatus('loading');
        setErrorMessage('');

        try {
            const { error } = await supabase.auth.resetPasswordForEmail(email, {
                redirectTo: `${window.location.origin}/auth/callback?next=/auth/update-password`,
            });
            if (error) throw error;
            setStatus('success');
        } catch (error) {
            console.error('Password reset error:', error);
            setErrorMessage(error.message || 'Failed to send reset email. Please try again.');
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
                    <h2 className="text-2xl font-bold text-white mb-2 uppercase tracking-tight">Check your email</h2>
                    <p className="text-gray-700 text-sm font-bold uppercase tracking-widest mb-6">
                        We sent a link to {email}.
                    </p>
                    <Link
                        to="/login"
                        className="inline-block w-full py-3 px-4 bg-white text-black font-bold rounded-xl hover:bg-gray-200 transition-colors uppercase tracking-widest text-xs"
                    >
                        Back to Login
                    </Link>
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
                        Forgot Password
                    </h2>
                    <p className="text-center text-gray-400 text-xs font-bold uppercase tracking-widest mt-2">
                        Enter your email to receive a reset link.
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
                            Email
                        </label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:bg-white/10 transition-all outline-none text-white text-sm font-bold placeholder-gray-800"
                            placeholder="name@example.com"
                            required
                            disabled={status === 'loading'}
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={status === 'loading'}
                        className="w-full py-4 bg-white text-black rounded-xl font-bold uppercase tracking-widest text-xs hover:bg-gray-200 disabled:opacity-50 transition-all flex justify-center items-center"
                    >
                        {status === 'loading' ? 'Sending...' : 'Send Link'}
                    </button>
                </form>

                <div className="mt-8 text-center">
                    <Link to="/login" className="text-[10px] font-bold text-gray-400 hover:text-white transition-all uppercase tracking-widest">
                        Back to login
                    </Link>
                </div>
            </div>
        </div>
    );
}
