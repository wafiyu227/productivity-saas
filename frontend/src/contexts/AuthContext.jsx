// FIXED: frontend/src/contexts/AuthContext.jsx
// Handles stale sessions when user is deleted from database

import { createContext, useContext, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { setCurrentUser } from '../api/client';

const AuthContext = createContext({});
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

function buildOAuthCallbackUrl({ nextPath = '/app', plan } = {}) {
    const callbackUrl = new URL('/auth/callback', window.location.origin);
    callbackUrl.searchParams.set('next', sanitizeNextPath(nextPath));

    if (typeof plan === 'string' && VALID_PLANS.has(plan.toLowerCase())) {
        callbackUrl.searchParams.set('plan', plan.toLowerCase());
    }

    return callbackUrl.toString();
}

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    const redirectToOnboardingIfNeeded = () => {
        const currentPath = window.location.pathname;
        if (!currentPath.includes('/onboarding') && !currentPath.includes('/join')) {
            navigate('/onboarding/team-setup');
        }
    };

    const ensureProfileFromAuth = async (userId, sessionUser = null) => {
        const authUser = sessionUser || user;
        const fallbackName = authUser?.email?.split('@')?.[0] || null;

        const { error: upsertError } = await supabase
            .from('profiles')
            .upsert({
                id: userId,
                email: authUser?.email || null,
                full_name: authUser?.user_metadata?.full_name
                    || authUser?.user_metadata?.name
                    || fallbackName,
                updated_at: new Date().toISOString()
            }, { onConflict: 'id' });

        if (upsertError) {
            throw upsertError;
        }
    };

    useEffect(() => {
        // Get initial session
        supabase.auth.getSession().then(({ data: { session } }) => {
            const currentUser = session?.user ?? null;
            setUser(currentUser);
            setCurrentUser(currentUser);

            if (currentUser) {
                fetchProfile(currentUser.id);
            } else {
                setLoading(false);
            }
        });

        // Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            const currentUser = session?.user ?? null;
            setUser(currentUser);
            setCurrentUser(currentUser);

            if (currentUser) {
                fetchProfile(currentUser.id);
            } else {
                setProfile(null);
                setLoading(false);
            }
        });

        return () => subscription.unsubscribe();
    }, []);

    const fetchProfile = async (userId) => {
        try {
            console.log('Fetching profile for user:', userId);
            const res = await fetch(`${import.meta.env.VITE_API_URL}/api/user/me?userId=${userId}`);

            if (res.ok) {
                const data = await res.json();
                console.log('Profile data:', data);
                setProfile(data || {});

                // Check if user needs onboarding
                if (data && data.userId && !data.current_team_id && (!data.teams || data.teams.length === 0)) {
                    console.log('User has no team, redirecting to team setup');
                    redirectToOnboardingIfNeeded();
                }
            } else if (res.status === 404) {
                // ✅ FIX: Profile doesn't exist - don't sign out immediately if it's a new user
                console.warn('Profile not found (404)');

                const { data: { session } } = await supabase.auth.getSession();

                if (session) {
                    try {
                        console.log('User session exists but no profile yet. Creating profile from auth metadata.');
                        await ensureProfileFromAuth(userId, session.user);

                        const retryRes = await fetch(`${import.meta.env.VITE_API_URL}/api/user/me?userId=${userId}`);
                        if (retryRes.ok) {
                            const retryData = await retryRes.json();
                            setProfile(retryData || {});

                            if (retryData && retryData.userId && !retryData.current_team_id && (!retryData.teams || retryData.teams.length === 0)) {
                                redirectToOnboardingIfNeeded();
                            }
                            return;
                        }

                        console.warn('Profile retry after upsert failed with status:', retryRes.status);
                    } catch (profileSyncError) {
                        console.error('Failed to auto-create profile for OAuth user:', profileSyncError);
                    }

                    setProfile({ id: userId, is_new_user: true });
                    redirectToOnboardingIfNeeded();
                } else {
                    console.log('No session, redirecting to login');
                    setProfile(null);
                    navigate('/login');
                }
            } else {
                console.error('Error response fetching profile:', res.status);
                setProfile({});
            }
        } catch (error) {
            console.error('Error fetching profile:', error);

            // ✅ FIX: On network error, check if session is valid
            const { data: { session } } = await supabase.auth.getSession();
            if (session) {
                console.log('Network error but session exists - allowing retry');
                setProfile({});
            } else {
                navigate('/login');
            }
        } finally {
            setLoading(false);
        }
    };

    const signUp = async (email, password, fullName) => {
        try {
            // 1. Create Supabase auth user
            const { data, error } = await supabase.auth.signUp({
                email,
                password,
                options: {
                    data: {
                        full_name: fullName
                    }
                }
            });

            if (error) throw error;

            // 2. ✅ Create profile directly in Supabase (with better error handling)
            if (data.user) {
                console.log('Creating/Updating profile for user:', data.user.id);

                // Use upsert to avoid 409 Conflict
                const { error: profileError } = await supabase
                    .from('profiles')
                    .upsert({
                        id: data.user.id,
                        full_name: fullName,
                        email: email,
                        updated_at: new Date().toISOString()
                    }, { onConflict: 'id' });

                if (profileError) {
                    console.error('❌ Failed to create/update profile:', profileError);
                    // Don't fail signup, but log the error
                    alert('Account created but profile setup is pending. Please refresh or try logging in.');
                } else {
                    console.log('✅ Profile upserted successfully');
                }
            }

            return { user: data.user, error: null };
        } catch (error) {
            console.error('Signup error:', error);
            return { user: null, error };
        }
    };

    const signIn = (email, password) => {
        return supabase.auth.signInWithPassword({ email, password });
    };

    // ✅ Helper: Check if user with email already exists
    const checkUserExists = async (email) => {
        try {
            const res = await fetch(`${import.meta.env.VITE_API_URL}/api/user/check-email?email=${encodeURIComponent(email)}`);
            const data = await res.json();
            return data.exists;
        } catch (error) {
            console.error('Error checking user:', error);
            return false;
        }
    };

    const signInWithGoogle = async ({ nextPath = '/app', plan } = {}) => {
        try {
            console.log('🔵 signInWithGoogle: Checking if user exists...');
            
            // For signin on Login page, we need to check if user exists first
            // However, we don't have email yet at this point
            // So we'll store the flow type and let AuthCallback validate
            
            // ✅ FIX: Store intent in localStorage to preserve redirect intent through OAuth flow
            const oAuthIntent = {
                flowType: 'signin',  // This is a signin, not signup
                nextPath: sanitizeNextPath(nextPath),
                plan: typeof plan === 'string' && VALID_PLANS.has(plan.toLowerCase()) 
                    ? plan.toLowerCase() 
                    : null,
                timestamp: Date.now()
            };
            console.log('🔵 signInWithGoogle: Storing intent', oAuthIntent);
            localStorage.setItem('oauth_intent', JSON.stringify(oAuthIntent));

            const { data, error } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    redirectTo: buildOAuthCallbackUrl({ nextPath, plan })
                }
            });

            if (error) throw error;
            return { data, error: null };
        } catch (error) {
            console.error('🔴 Google sign in error:', error);
            return { data: null, error };
        }
    };

    const signUpWithGoogle = async (plan = 'free') => {
        try {
            console.log('🔵 signUpWithGoogle: Starting new user signup with Google');
            
            // ✅ FIX: Store signup intent with special marker
            const oAuthIntent = {
                flowType: 'signup',  // This is a signup, not signin
                nextPath: '/onboarding/team-setup',
                plan: typeof plan === 'string' && VALID_PLANS.has(plan.toLowerCase()) 
                    ? plan.toLowerCase() 
                    : 'free',
                timestamp: Date.now()
            };
            console.log('🔵 signUpWithGoogle: Storing signup intent', oAuthIntent);
            localStorage.setItem('oauth_intent', JSON.stringify(oAuthIntent));

            const { data, error } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    redirectTo: buildOAuthCallbackUrl({ 
                        nextPath: '/onboarding/team-setup', 
                        plan 
                    })
                }
            });

            if (error) throw error;
            return { data, error: null };
        } catch (error) {
            console.error('🔴 Google sign up error:', error);
            return { data: null, error };
        }
    };

    const signOut = async () => {
        // ✅ Clear everything on sign out
        setUser(null);
        setProfile(null);
        await supabase.auth.signOut();
        navigate('/login');
    };

    const refreshProfile = async () => {
        if (user) {
            console.log('Refreshing profile for user:', user.id);
            await fetchProfile(user.id);
        }
    };

    const value = {
        user,
        profile,
        loading,
        refreshProfile,
        signUp,
        signIn,
        signOut,
        signInWithGoogle,
        signUpWithGoogle,
        supabase
    };

    return (
        <AuthContext.Provider value={value}>
            {!loading && children}
        </AuthContext.Provider>
    );
}
