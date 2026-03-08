import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

const VALID_PLANS = new Set(['free', 'starter', 'growth']);

function sanitizeNextPath(path) {
    if (typeof path !== 'string') {
        return '/app';
    }

    if (!path.startsWith('/') || path.startsWith('//')) {
        return '/app';
    }

    return path;
}

export default function AuthCallback() {
    const { supabase } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const [error, setError] = useState('');

    useEffect(() => {
        const finalizeOAuth = async () => {
            try {
                const search = new URLSearchParams(location.search);
                const hash = new URLSearchParams((location.hash || '').replace(/^#/, ''));
                const code = search.get('code');
                
                console.log('🔵 AuthCallback: Starting OAuth finalization');
                console.log('🔵 AuthCallback: Code present:', !!code);
                console.log('🔵 AuthCallback: Hash tokens:', {
                    hasAccessToken: !!hash.get('access_token'),
                    hasRefreshToken: !!hash.get('refresh_token')
                });
                
                // ✅ FIX: Retrieve oauth_intent from localStorage (stored before OAuth redirect)
                let nextPath = '/app';
                let planFromStorage = null;
                let flowType = 'signin';  // Default to signin
                try {
                    const oAuthIntentStr = localStorage.getItem('oauth_intent');
                    if (oAuthIntentStr) {
                        const oAuthIntent = JSON.parse(oAuthIntentStr);
                        console.log('🔵 AuthCallback: oauth_intent found:', oAuthIntent);
                        // Only use stored intent if it's recent (within 10 minute window)
                        if (oAuthIntent.timestamp && Date.now() - oAuthIntent.timestamp < 10 * 60 * 1000) {
                            nextPath = oAuthIntent.nextPath || '/app';
                            planFromStorage = oAuthIntent.plan;
                            flowType = oAuthIntent.flowType || 'signin';
                            console.log('🟢 AuthCallback: Using stored intent - nextPath:', nextPath, 'plan:', planFromStorage, 'flowType:', flowType);
                        } else {
                            console.warn('🟡 AuthCallback: oauth_intent expired');
                        }
                        localStorage.removeItem('oauth_intent');
                    } else {
                        console.warn('🟡 AuthCallback: No oauth_intent in localStorage');
                    }
                } catch (e) {
                    console.warn('🟡 AuthCallback: Failed to retrieve oauth_intent:', e);
                }

                // Use plan from storage first, then fallback to URL param
                const plan = planFromStorage || search.get('plan');
                const next = sanitizeNextPath(search.get('next') || nextPath);
                
                console.log('🔵 AuthCallback: Final params - next:', next, 'plan:', plan, 'flowType:', flowType);
                
                const providerError = search.get('error_description')
                    || search.get('error')
                    || hash.get('error_description')
                    || hash.get('error');

                if (providerError) {
                    console.error('🔴 AuthCallback: Provider error:', providerError);
                    throw new Error(decodeURIComponent(providerError));
                }

                if (code) {
                    console.log('🔵 AuthCallback: Exchanging code for session...');
                    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
                    if (exchangeError && !exchangeError.message?.toLowerCase().includes('code verifier')) {
                        throw exchangeError;
                    }
                    console.log('🟢 AuthCallback: Code exchanged successfully');
                }

                const accessToken = hash.get('access_token');
                const refreshToken = hash.get('refresh_token');

                if (accessToken && refreshToken) {
                    console.log('🔵 AuthCallback: Setting session from hash tokens...');
                    const { error: sessionError } = await supabase.auth.setSession({
                        access_token: accessToken,
                        refresh_token: refreshToken
                    });

                    if (sessionError) {
                        throw sessionError;
                    }
                    console.log('🟢 AuthCallback: Session set successfully');
                }

                const { data: { session } } = await supabase.auth.getSession();
                console.log('🔵 AuthCallback: Current session user:', session?.user?.email);
                
                if (!session?.user) {
                    console.error('🔴 AuthCallback: No session found, redirecting to login');
                    navigate('/login', { replace: true });
                    return;
                }

                const userEmail = session.user.email;
                console.log('🔵 AuthCallback: OAuth user email:', userEmail);

                // ✅ NEW: Handle different flows
                if (flowType === 'signin') {
                    // For signin: Check if user profile exists
                    console.log('🔵 AuthCallback: Flow is SIGNIN - checking if user exists...');
                    try {
                        const checkRes = await fetch(`${import.meta.env.VITE_API_URL}/api/user/check-email?email=${encodeURIComponent(userEmail)}`);
                        const checkData = await checkRes.json();
                        
                        if (!checkData.exists) {
                            console.error('🔴 AuthCallback: User does not exist - asking to signup');
                            // User tried to signin with Google but hasn't signed up yet
                            setError('No account found with this Google email. Please sign up first.');
                            // Wait a moment then redirect to signup
                            setTimeout(() => {
                                navigate(`/signup?plan=${encodeURIComponent(plan || 'free')}`, { replace: true });
                            }, 3000);
                            return;
                        }
                        console.log('🟢 AuthCallback: User exists, proceeding with signin');
                    } catch (error) {
                        console.error('🟡 AuthCallback: Error checking user:', error);
                        // If check fails, allow signin anyway (backend will handle)
                    }
                } else if (flowType === 'signup') {
                    // For signup: Create or update profile
                    console.log('🔵 AuthCallback: Flow is SIGNUP - creating/updating profile...');
                    try {
                        const { error: profileError } = await supabase
                            .from('profiles')
                            .upsert({
                                id: session.user.id,
                                email: userEmail,
                                full_name: session.user.user_metadata?.full_name 
                                    || session.user.user_metadata?.name
                                    || userEmail.split('@')[0],
                                updated_at: new Date().toISOString()
                            }, { onConflict: 'id' });

                        if (profileError) {
                            console.error('🔴 AuthCallback: Profile creation failed:', profileError);
                            throw profileError;
                        }
                        console.log('🟢 AuthCallback: Profile created/updated successfully');
                        
                        // Store signup success message for display on onboarding page
                        sessionStorage.setItem('signup_success', JSON.stringify({
                            message: `Welcome! Your account has been created successfully.`,
                            timestamp: Date.now()
                        }));
                    } catch (error) {
                        console.error('🔴 AuthCallback: Error creating profile:', error);
                        setError('Account creation failed. Please try again.');
                        return;
                    }
                }

                let destination = next;
                if (destination.startsWith('/onboarding/team-setup') && typeof plan === 'string' && VALID_PLANS.has(plan.toLowerCase())) {
                    const destinationUrl = new URL(destination, window.location.origin);
                    destinationUrl.searchParams.set('plan', plan.toLowerCase());
                    destination = `${destinationUrl.pathname}${destinationUrl.search}`;
                }

                console.log('🟢 AuthCallback: Redirecting to:', destination);
                navigate(destination, { replace: true });
            } catch (callbackError) {
                console.error('🔴 AuthCallback: Error:', callbackError);
                setError(callbackError.message || 'Failed to complete sign in. Please try again.');
            }
        };

        finalizeOAuth();
    }, [location.hash, location.search, navigate, supabase.auth]);

    if (error) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
                <div className="max-w-md w-full bg-white rounded-xl shadow p-6">
                    <h1 className="text-xl font-semibold text-gray-900 mb-3">Google Sign In Failed</h1>
                    <p className="text-sm text-gray-600 mb-4">{error}</p>
                    <button
                        onClick={() => navigate('/login')}
                        className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition"
                    >
                        Back to Login
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
            <div className="text-center">
                <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                <p className="text-gray-600">Completing sign in...</p>
            </div>
        </div>
    );
}
