// src/pages/auth/AuthCallback.jsx
// Single source of truth for post-OAuth redirects.
// Sets authCallbackState.isProcessing = true immediately on mount so that
// AuthContext.fetchProfile will NOT trigger its own redirect while we work.

import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { authCallbackState } from '../../lib/authCallbackState';

const VALID_PLANS = new Set(['free', 'starter', 'growth']);

// Status step definitions for the progress UI
const STEPS = [
    { key: 'session', label: 'Verifying your session' },
    { key: 'profile', label: 'Loading your profile' },
    { key: 'redirect', label: 'Taking you to your space' },
];

export default function AuthCallback() {
    const navigate = useNavigate();
    const location = useLocation();
    const { refreshProfile } = useAuth();

    const [currentStep, setCurrentStep] = useState(0); // index into STEPS
    const [done, setDone] = useState(false);
    const [isNewUser, setIsNewUser] = useState(false);
    const [error, setError] = useState('');

    // Prevent double-execution in React Strict Mode
    const ranRef = useRef(false);

    useEffect(() => {
        if (ranRef.current) return;
        ranRef.current = true;

        // 🔒 Block AuthContext from racing us
        authCallbackState.startProcessing();

        handleCallback();

        // Cleanup: always release the lock when this component unmounts
        return () => {
            authCallbackState.stopProcessing();
        };
    }, []);

    const handleCallback = async () => {
        try {
            const search = new URLSearchParams(location.search);
            const hash = new URLSearchParams((location.hash || '').replace(/^#/, ''));

            // ── 1. Check for provider errors ──────────────────────────────────────
            const providerError =
                search.get('error_description') ||
                search.get('error') ||
                hash.get('error_description') ||
                hash.get('error');

            if (providerError) throw new Error(decodeURIComponent(providerError));

            // ── 2. Read destination hints ─────────────────────────────────────────
            const nextPath = search.get('next') || '/app';
            const plan = search.get('plan') || 'free';

            // ── 3. Exchange authorization code (PKCE flow) ────────────────────────
            setCurrentStep(0); // "Verifying your session"
            const code = search.get('code');
            if (code) {
                const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
                // Supabase sometimes emits a benign "code verifier" error on second attempt — ignore it
                if (exchangeError && !exchangeError.message?.toLowerCase().includes('code verifier')) {
                    throw exchangeError;
                }
            }

            // ── 4. Handle implicit / hash tokens ─────────────────────────────────
            const accessToken = hash.get('access_token');
            const refreshToken = hash.get('refresh_token');
            if (accessToken && refreshToken) {
                const { error: sessionError } = await supabase.auth.setSession({
                    access_token: accessToken,
                    refresh_token: refreshToken,
                });
                if (sessionError) throw sessionError;
            }

            // ── 5. Confirm session ────────────────────────────────────────────────
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.user) throw new Error('No session established after OAuth callback.');

            const sessionUser = session.user;

            // ── 6. Load / create profile ──────────────────────────────────────────
            setCurrentStep(1); // "Loading your profile"
            let hasTeam = false;
            let userIsNew = false;

            try {
                const apiUrl = import.meta.env.VITE_API_URL;
                const profileRes = await fetch(`${apiUrl}/api/user/me?userId=${sessionUser.id}`);

                if (profileRes.ok) {
                    const profileData = await profileRes.json();
                    hasTeam = !!(
                        profileData.current_team_id ||
                        (profileData.teams && profileData.teams.length > 0)
                    );
                    userIsNew = !hasTeam;
                } else if (profileRes.status === 404) {
                    // Brand-new user — create their profile row
                    userIsNew = true;
                    const fullName =
                        sessionUser.user_metadata?.full_name ||
                        sessionUser.user_metadata?.name ||
                        sessionUser.email?.split('@')?.[0] ||
                        'User';

                    const { error: upsertError } = await supabase
                        .from('profiles')
                        .upsert(
                            {
                                id: sessionUser.id,
                                email: sessionUser.email,
                                full_name: fullName,
                                updated_at: new Date().toISOString(),
                            },
                            { onConflict: 'id' }
                        );

                    if (upsertError) console.error('Profile upsert failed:', upsertError);
                }
            } catch (fetchErr) {
                // Non-fatal — we still have a valid session; just send to a safe default
                console.error('Profile fetch error (non-fatal):', fetchErr);
                userIsNew = true;
            }

            setIsNewUser(userIsNew);

            // ── 7. Sync profile into AuthContext ──────────────────────────────────
            await refreshProfile();

            // ── 8. Determine destination ──────────────────────────────────────────
            setCurrentStep(2); // "Taking you to your space"
            let destination;

            if (hasTeam) {
                // Returning user — send to app (or the intended next path)
                destination = nextPath.startsWith('/onboarding') ? '/app/dashboard' : nextPath;
            } else {
                // New user — send to onboarding
                const validPlan = VALID_PLANS.has(plan.toLowerCase()) ? plan.toLowerCase() : 'free';
                destination = `/onboarding/team-setup?plan=${validPlan}`;
            }

            console.log('[AuthCallback] Redirecting to:', destination, '| new user:', userIsNew);

            // ── 9. Show success state, then navigate ──────────────────────────────
            setDone(true);

            setTimeout(() => {
                authCallbackState.stopProcessing(); // release lock before navigating
                navigate(destination, { replace: true });
            }, 1800);

        } catch (callbackError) {
            console.error('[AuthCallback] Error:', callbackError);
            authCallbackState.stopProcessing();
            setError(callbackError.message || 'Authentication failed. Please try again.');
        }
    };

    // ── Error state ─────────────────────────────────────────────────────────────
    if (error) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
                <div className="max-w-md w-full bg-white rounded-2xl shadow-lg p-8 text-center">
                    <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <svg className="w-7 h-7 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </div>
                    <h1 className="text-xl font-semibold text-gray-900 mb-2">Authentication Failed</h1>
                    <p className="text-sm text-gray-500 mb-6">{error}</p>
                    <button
                        onClick={() => navigate('/login')}
                        className="w-full bg-blue-600 text-white py-2.5 rounded-xl font-medium hover:bg-blue-700 transition-colors"
                    >
                        Back to Login
                    </button>
                </div>
            </div>
        );
    }

    // ── Success state ────────────────────────────────────────────────────────────
    if (done) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="text-center px-4">
                    {/* Animated checkmark */}
                    <div className="relative w-20 h-20 mx-auto mb-6">
                        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center
                            animate-[ping_0.4s_ease-out_forwards] opacity-0"
                            style={{ animationFillMode: 'forwards' }} />
                        <div className="absolute inset-0 w-20 h-20 bg-green-100 rounded-full flex items-center justify-center">
                            <svg
                                className="w-10 h-10 text-green-600"
                                fill="none" stroke="currentColor" viewBox="0 0 24 24"
                                style={{
                                    strokeDasharray: 50,
                                    strokeDashoffset: 50,
                                    animation: 'drawCheck 0.5s ease-out 0.1s forwards',
                                }}
                            >
                                <style>{`
                  @keyframes drawCheck {
                    to { stroke-dashoffset: 0; }
                  }
                `}</style>
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5}
                                    d="M5 13l4 4L19 7" />
                            </svg>
                        </div>
                    </div>

                    <h2 className="text-2xl font-bold text-gray-900 mb-2">
                        {isNewUser ? 'Welcome aboard! 🎉' : 'Welcome back! 👋'}
                    </h2>
                    <p className="text-gray-500 text-sm">
                        {isNewUser
                            ? "Let's get your workspace set up..."
                            : 'Taking you to your dashboard...'}
                    </p>

                    {/* Subtle progress bar */}
                    <div className="mt-6 w-48 mx-auto h-1 bg-gray-200 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-green-500 rounded-full"
                            style={{ animation: 'progress 1.8s linear forwards' }}
                        />
                        <style>{`
              @keyframes progress {
                from { width: 0%; }
                to   { width: 100%; }
              }
            `}</style>
                    </div>
                </div>
            </div>
        );
    }

    // ── Loading / progress state ─────────────────────────────────────────────────
    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
            <div className="text-center px-4">
                {/* Spinner */}
                <div className="w-12 h-12 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin mx-auto mb-8" />

                {/* Step list */}
                <div className="space-y-3 text-left inline-block">
                    {STEPS.map((step, i) => {
                        const isDone = i < currentStep;
                        const isActive = i === currentStep;
                        const isPending = i > currentStep;

                        return (
                            <div key={step.key} className="flex items-center gap-3">
                                {/* Icon */}
                                <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 transition-all duration-300 ${isDone ? 'bg-green-500' :
                                        isActive ? 'bg-blue-600' :
                                            'bg-gray-200'
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

                                {/* Label */}
                                <span className={`text-sm font-medium transition-colors duration-300 ${isDone ? 'text-green-600' :
                                        isActive ? 'text-gray-900' :
                                            'text-gray-400'
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