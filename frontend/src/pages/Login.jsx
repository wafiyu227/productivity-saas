import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Mail, Lock, ArrowRight, Github } from 'lucide-react';

function sanitizeRedirectPath(path) {
    if (typeof path !== 'string') {
        return '/app';
    }

    if (!path.startsWith('/') || path.startsWith('//')) {
        return '/app';
    }

    return path;
}

export default function Login() {
    const [searchParams] = useSearchParams();
    const safeRedirectPath = sanitizeRedirectPath(searchParams.get('redirect') || '/app');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [googleLoading, setGoogleLoading] = useState(false);
    const { signIn, signInWithGoogle } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const { error } = await signIn(email, password);
            if (error) throw error;
            navigate(safeRedirectPath);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleGoogleSignIn = async () => {
        setError('');
        setGoogleLoading(true);

        try {
            const { error } = await signInWithGoogle({ nextPath: safeRedirectPath });
            if (error) throw error;
            // Supabase handles redirect automatically
        } catch (err) {
            setError(err.message);
            setGoogleLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-[#000000] p-4 selection:bg-blue-500/30">

            <div className="max-w-md w-full relative z-10">
                <div className="bg-black rounded-[2.5rem] border border-white/10 p-8 md:p-10 shadow-2xl">
                    <div className="flex flex-col items-center mb-10">
                        <Link to="/" className="mb-6 group">
                            <div className="relative">
                                <img src="/logo.png" alt="Teama AI" className="relative w-14 h-14 object-contain" />
                            </div>
                        </Link>
                        <h2 className="text-3xl font-bold text-center text-white tracking-tight uppercase">
                            Welcome Back
                        </h2>
                        <p className="text-gray-400 text-sm font-bold mt-2 uppercase tracking-widest text-center">Login to your account</p>
                    </div>

                    {error && (
                        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 text-red-100 rounded-2xl text-xs font-bold animate-in fade-in slide-in-from-top-2 duration-300">
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-5">
                        <div className="space-y-2">
                            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">
                                Email
                            </label>
                            <div className="relative group">
                                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-600" size={18} />
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="w-full pl-12 pr-4 py-4 bg-white/5 border border-white/10 rounded-2xl focus:bg-white/10 transition-all text-sm font-bold text-white placeholder-gray-800"
                                    placeholder="name@example.com"
                                    required
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <div className="flex justify-between items-center ml-1">
                                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                                    Password
                                </label>
                                <Link to="/forgot-password" disable={loading} className="text-[10px] font-bold text-white hover:underline uppercase tracking-widest transition-colors">
                                    Forgot Password?
                                </Link>
                            </div>
                            <div className="relative group">
                                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-600" size={18} />
                                <input
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full pl-12 pr-4 py-4 bg-white/5 border border-white/10 rounded-2xl focus:bg-white/10 transition-all text-sm font-bold text-white placeholder-gray-800"
                                    placeholder="••••••••"
                                    required
                                />
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={loading || googleLoading}
                            className="w-full py-4 bg-white text-black rounded-2xl hover:bg-gray-200 disabled:opacity-50 transition-all font-bold text-sm uppercase tracking-widest flex items-center justify-center gap-2 group active:scale-95"
                        >
                            {loading ? 'Logging in...' : 'Login'}
                            {!loading && <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />}
                        </button>
                    </form>

                    <div className="mt-8">
                        <div className="relative mb-8">
                            <div className="absolute inset-0 flex items-center">
                                <div className="w-full border-t border-white/10"></div>
                            </div>
                            <div className="relative flex justify-center text-[10px] uppercase tracking-widest font-bold">
                                <span className="px-3 bg-black text-gray-400">Or</span>
                            </div>
                        </div>

                        <button
                            type="button"
                            onClick={handleGoogleSignIn}
                            disabled={googleLoading || loading}
                            className="w-full py-4 px-4 bg-white/5 border border-white/10 rounded-2xl font-bold text-[10px] uppercase tracking-widest text-white hover:bg-white/10 transition-all flex items-center justify-center gap-3 disabled:opacity-50 active:scale-95"
                        >
                            <svg className="w-5 h-5" viewBox="0 0 24 24">
                                <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                                <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                                <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                                <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                            </svg>
                            {googleLoading ? 'Connecting...' : 'Continue with Google'}
                        </button>
                    </div>

                    <div className="mt-8 space-y-4 pt-6 border-t border-white/5">
                        <p className="text-center text-[10px] font-bold uppercase tracking-widest text-gray-400">
                            Don't have an account?{' '}
                            <Link to="/signup" className="text-white hover:underline transition-colors ml-1">
                                Sign Up
                            </Link>
                        </p>
                        <p className="text-center text-[10px] font-bold uppercase tracking-widest text-gray-400">
                            Researching?{' '}
                            <Link to="/demo" className="text-white hover:underline transition-colors ml-1">
                                Try Demo
                            </Link>
                        </p>
                    </div>
                </div>
                
                <p className="mt-8 text-center text-[9px] font-bold uppercase tracking-widest text-gray-500">
                    © 2026 Teama AI
                </p>
            </div>
        </div>
    );
}
