// src/pages/auth/AuthCallback.jsx
import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { authCallbackState } from '../../lib/authCallbackState';

const STEPS = [
    { key: 'session', label: 'Verifying your session' },
    { key: 'profile', label: 'Loading your profile' },
    { key: 'redirect', label: 'Almost there...' },
];

export default function AuthCallback() {
    const navigate = useNavigate();
    const location = useLocation();

    const { refreshProfile } = useAuth();
    const [currentStep, setCurrentStep] = useState(0);
    const [done, setDone] = useState(false);
    const [isNewUser, setIsNewUser] = useState(false);
    const [error, setError] = useState('');
    const [continuing, setContinuing] = useState(false);

    const ranRef = useRef(false);
    const destinationRef = useRef('');

    useEffect(() => {
        if (ranRef.current) return;
        ranRef.current = true;
        authCallbackState.startProcessing();
        handleCallback();
        return () => authCallbackState.stopProcessing();
    }, []);

    const handleCallback = async () => {
        try {
            const search = new URLSearchParams(location.search);
            const hash = new URLSearchParams((location.hash || '').replace(/^#/, ''));

            // 1. Provider errors
            const providerError =
                search.get('error_description') || search.get('error') ||
                hash.get('error_description') || hash.get('error');
            if (providerError) throw new Error(decodeURIComponent(providerError));

            // 2. Destination hints
            const nextPath = search.get('next') || hash.get('next') || '/app';

            // 3. Exchange code (PKCE)
            setCurrentStep(0);
            const code = search.get('code');
            if (code) {
                const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
                if (exchangeError && !exchangeError.message?.toLowerCase().includes('code verifier')) {
                    throw exchangeError;
                }
            }

            // 4. Hash tokens (implicit flow)
            const accessToken = hash.get('access_token');
            const refreshToken = hash.get('refresh_token');
            if (accessToken && refreshToken) {
                const { error: sessionError } = await supabase.auth.setSession({
                    access_token: accessToken,
                    refresh_token: refreshToken,
                });
                if (sessionError) throw sessionError;
            }

            // 5. Confirm session
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.user) throw new Error('No session established after OAuth callback.');
            const sessionUser = session.user;

            // 6. Check profile / ensure user exists
            setCurrentStep(1);
            let userIsNew = false;

            try {
                const fullName =
                    sessionUser.user_metadata?.full_name ||
                    sessionUser.user_metadata?.name ||
                    sessionUser.email?.split('@')?.[0] ||
                    'User';

                // Create or update profile
                const { data: existingProfile, error: fetchError } = await supabase
                    .from('profiles')
                    .select('id')
                    .eq('id', sessionUser.id)
                    .single();

                if (fetchError && fetchError.code === 'PGRST116') {
                    // Profile doesn't exist - this is a new user
                    userIsNew = true;
                    await supabase.from('profiles').insert({
                        id: sessionUser.id,
                        email: sessionUser.email,
                        full_name: fullName,
                        updated_at: new Date().toISOString(),
                    });
                } else if (!existingProfile) {
                    userIsNew = true;
                    await supabase.from('profiles').upsert(
                        {
                            id: sessionUser.id,
                            email: sessionUser.email,
                            full_name: fullName,
                            updated_at: new Date().toISOString(),
                        },
                        { onConflict: 'id' }
                    );
                }
            } catch (profileErr) {
                console.error('Profile creation error:', profileErr);
                userIsNew = true;
            }

            // 7. Determine destination
            setCurrentStep(2);
            let destination;
            
            if (nextPath === '/auth/update-password' || hash.get('type') === 'recovery') {
                destination = '/auth/update-password';
            } else if (userIsNew) {
                // New users go to onboarding first
                destination = '/onboarding';
            } else {
                // Return users go to dashboard
                destination = '/app/dashboard';
            }


            // 8. Store and show success — do NOT navigate yet
            destinationRef.current = destination;
            setIsNewUser(userIsNew);
            setDone(true);

        } catch (callbackError) {
            console.error('[AuthCallback] Error:', callbackError);
            authCallbackState.stopProcessing();
            setError(callbackError.message || 'Authentication failed. Please try again.');
        }
    };

    // User clicks → refresh profile so TeamProtectedRoute has fresh data → release lock → navigate
    const handleContinue = async () => {
        setContinuing(true);
        try {
            await refreshProfile();
        } catch (e) {
            console.error('refreshProfile error (non-fatal):', e);
        }
        authCallbackState.stopProcessing();
        navigate(destinationRef.current, { replace: true });
    };

    // ── Error ────────────────────────────────────────────────────────────────────
    if (error) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
                <div className="max-w-md w-full bg-white rounded-2xl shadow-lg p-8 text-center">
                    <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <svg className="w-7 h-7 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </div>
                    <h1 className="text-xl font-semibold text-gray-900 mb-2">Authentication Failed</h1>
                    <p className="text-sm text-gray-500 mb-6">{error}</p>
                    <button
                        onClick={() => { authCallbackState.stopProcessing(); navigate('/login'); }}
                        className="w-full bg-blue-600 text-white py-2.5 rounded-xl font-medium hover:bg-blue-700 transition-colors"
                    >
                        Back to Login
                    </button>
                </div>
            </div>
        );
    }

    // ── Success ──────────────────────────────────────────────────────────────────
    if (done) {
        const isUpdatePassword = destinationRef.current === '/auth/update-password';

        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="text-center px-4 max-w-md w-full">
                    <div className="relative w-24 h-24 mx-auto mb-8">
                        <div className="absolute inset-0 bg-gradient-to-br from-green-100 to-emerald-100 rounded-full flex items-center justify-center shadow-lg">
                            <svg
                                className="w-12 h-12 text-emerald-600"
                                fill="none" stroke="currentColor" viewBox="0 0 24 24"
                                style={{
                                    strokeDasharray: 50,
                                    strokeDashoffset: 50,
                                    animation: 'drawCheck 0.5s ease-out 0.1s forwards',
                                }}
                            >
                                <style>{`@keyframes drawCheck { to { stroke-dashoffset: 0; } }`}</style>
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                            </svg>
                        </div>
                    </div>

                    <h1 className="text-3xl font-bold text-gray-900 mb-2">
                        {isUpdatePassword ? '🔐 Ready to update!' : isNewUser ? '🎉 Welcome Aboard!' : '👋 Welcome Back!'}
                    </h1>
                    <p className="text-lg text-gray-600 mb-6">
                        {isUpdatePassword
                            ? 'Your session has been verified.'
                            : isNewUser
                                ? 'Your account has been created successfully'
                                : 'You have been signed in successfully'}
                    </p>

                    <div className="bg-white rounded-lg border border-gray-200 p-4 mb-8">
                        <p className="text-sm text-gray-600 mb-1 font-semibold text-gray-900">What's next:</p>
                        <p className="text-sm text-gray-700 leading-relaxed">
                            {isUpdatePassword 
                                ? 'Set a new password to secure your account.'
                                : isNewUser
                                    ? "Connect your existing tools to get AI-powered insights—it only takes a minute!"
                                    : 'Head back to your dashboard and pick up where you left off.'}
                        </p>

                    </div>

                    <button
                        onClick={handleContinue}
                        disabled={continuing}
                        className="w-full bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 disabled:opacity-70 text-white font-semibold py-3 px-6 rounded-lg transition-colors flex items-center justify-center gap-2 shadow-md"
                    >
                        {continuing ? (
                            <>
                                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                <span>Loading...</span>
                            </>
                        ) : (
                            <>
                                <span>{isUpdatePassword ? 'Update Password' : isNewUser ? 'Personalize Teama' : 'Go to Dashboard'}</span>
                                <span>→</span>

                            </>
                        )}
                    </button>
                </div>
            </div>
        );
    }

    // ── Loading ──────────────────────────────────────────────────────────────────
    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
            <div className="text-center px-4">
                <div className="w-12 h-12 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin mx-auto mb-8" />
                <div className="space-y-3 text-left inline-block">
                    {STEPS.map((step, i) => {
                        const isDone = i < currentStep;
                        const isActive = i === currentStep;
                        return (
                            <div key={step.key} className="flex items-center gap-3">
                                <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 transition-all duration-300 ${isDone ? 'bg-green-500' : isActive ? 'bg-blue-600' : 'bg-gray-200'
                                    }`}>
                                    {isDone ? (
                                        <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                        </svg>
                                    ) : isActive ? (
                                        <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
                                    ) : (
                                        <div className="w-2 h-2 bg-gray-400 rounded-full" />
                                    )}
                                </div>
                                <span className={`text-sm font-medium transition-colors duration-300 ${isDone ? 'text-green-600' : isActive ? 'text-gray-900' : 'text-gray-400'
                                    }`}>
                                    {step.label}
                                </span>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}