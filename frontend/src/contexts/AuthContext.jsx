// src/contexts/AuthContext.jsx
import { createContext, useContext, useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { setCurrentUser } from '../api/client';
import { authCallbackState } from '../lib/authCallbackState';
import { useNetworkStatus } from '../hooks/useNetworkStatus';

const PROFILE_CACHE_KEY = 'teamaai_cached_profile';

const AuthContext = createContext({});
export const useAuth = () => useContext(AuthContext);

/** Read cached profile from localStorage (returns null if missing/corrupt). */
function loadCachedProfile() {
    try {
        const raw = localStorage.getItem(PROFILE_CACHE_KEY);
        if (raw) {
            const parsed = JSON.parse(raw);
            if (parsed && typeof parsed === 'object' && parsed.userId) return parsed;
        }
    } catch { /* ignore */ }
    return null;
}

/** Persist profile to localStorage. */
function saveCachedProfile(profile) {
    try {
        if (profile && profile.userId) {
            localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(profile));
        }
    } catch { /* ignore — quota exceeded, private mode, etc. */ }
}

/** Clear the cached profile (e.g. on sign-out). */
function clearCachedProfile() {
    try { localStorage.removeItem(PROFILE_CACHE_KEY); } catch { /* ignore */ }
}

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [isOffline, setIsOffline] = useState(false);
    const navigate = useNavigate();
    const location = useLocation();
    const { isOnline } = useNetworkStatus();

    // Sync network status into context-level flag
    useEffect(() => {
        setIsOffline(!isOnline);
    }, [isOnline]);

    const REDIRECT_BLOCKED_PATHS = new Set(['/auth/callback', '/join']);

    const isRedirectBlocked = () => {
        const searchParams = new URLSearchParams(location.search);
        const hashParams = new URLSearchParams((location.hash || '').replace(/^#/, ''));
        const hasOAuthParams =
            searchParams.has('code') ||
            searchParams.has('error') ||
            hashParams.has('access_token') ||
            hashParams.has('error');

        return (
            REDIRECT_BLOCKED_PATHS.has(location.pathname) ||
            authCallbackState.isProcessing ||
            hasOAuthParams
        );
    };

    const redirectToDashboard = (profileData = profile) => {
        if (isRedirectBlocked()) return;
        const currentPath = window.location.pathname;
        if (!['/', '/login', '/signup'].includes(currentPath)) return;

        if (profileData?.userId && (profileData.current_team_id || profileData.teams?.length > 0)) {
            navigate('/app/dashboard', { replace: true });
        } else {
            navigate('/onboarding/team-setup', { replace: true });
        }
    };

    const redirectToOnboardingIfNeeded = () => {
        if (isRedirectBlocked()) return;
        const currentPath = window.location.pathname;
        if (currentPath.includes('/onboarding') || currentPath.includes('/join')) return;
        navigate('/onboarding/team-setup', { replace: true });
    };

    const ensureProfileFromAuth = async (userId, sessionUser = null) => {
        const authUser = sessionUser || user;
        const { error } = await supabase
            .from('profiles')
            .upsert(
                {
                    id: userId,
                    email: authUser?.email || null,
                    full_name:
                        authUser?.user_metadata?.full_name ||
                        authUser?.user_metadata?.name ||
                        authUser?.email?.split('@')?.[0] ||
                        null,
                    updated_at: new Date().toISOString(),
                },
                { onConflict: 'id' }
            );
        if (error) throw error;
    };

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            const currentUser = session?.user ?? null;
            setUser(currentUser);
            setCurrentUser(currentUser);

            if (currentUser && !isRedirectBlocked()) {
                fetchProfile(currentUser.id);
            } else {
                // No session — try to hydrate from cache so we don't flash-redirect
                if (!currentUser) {
                    const cached = loadCachedProfile();
                    if (cached) setProfile(cached);
                }
                setLoading(false);
            }
        });

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            const currentUser = session?.user ?? null;
            setUser(currentUser);
            setCurrentUser(currentUser);

            if (currentUser && !isRedirectBlocked()) {
                fetchProfile(currentUser.id);
            } else if (!currentUser) {
                setProfile(null);
                clearCachedProfile();
                setLoading(false);
            } else {
                setLoading(false);
            }
        });

        return () => subscription.unsubscribe();
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const fetchProfile = async (userId) => {
        try {
            const res = await fetch(`${import.meta.env.VITE_API_URL}/api/user/me?userId=${userId}`);

            if (res.ok) {
                const data = await res.json();
                setProfile(data || {});
                setIsOffline(false);
                // Cache the profile for offline resilience
                if (data) saveCachedProfile(data);
                if (data?.userId) {
                    const hasTeam = !!(data.current_team_id || data.teams?.length > 0);
                    if (hasTeam) {
                        redirectToDashboard(data);
                    } else {
                        redirectToOnboardingIfNeeded();
                    }
                }
            } else if (res.status === 404) {
                const { data: { session } } = await supabase.auth.getSession();
                if (session) {
                    try {
                        await ensureProfileFromAuth(userId, session.user);
                        const retry = await fetch(`${import.meta.env.VITE_API_URL}/api/user/me?userId=${userId}`);
                        if (retry.ok) {
                            const retryData = await retry.json();
                            setProfile(retryData || {});
                            if (retryData) saveCachedProfile(retryData);
                            redirectToOnboardingIfNeeded();
                            return;
                        }
                    } catch (e) {
                        console.error('Profile sync error:', e);
                    }
                    setProfile({ id: userId, is_new_user: true });
                    redirectToOnboardingIfNeeded();
                } else {
                    setProfile(null);
                    clearCachedProfile();
                    navigate('/login');
                }
            } else {
                setProfile({});
            }
        } catch (error) {
            console.error('fetchProfile error:', error);

            // ── OFFLINE RESILIENCE ──
            // If the fetch failed due to a network error, use the cached profile
            // instead of wiping state and redirecting away.
            const cached = loadCachedProfile();
            if (cached) {
                console.info('Using cached profile while offline');
                setProfile(cached);
                setIsOffline(true);
                // Do NOT redirect — keep the user where they are
            } else {
                // No cache available — fall back to the original behavior
                const { data: { session } } = await supabase.auth.getSession();
                if (!session) navigate('/login');
                else setProfile({});
            }
        } finally {
            setLoading(false);
        }
    };

    const signUp = async (email, password, fullName) => {
        try {
            const { data, error } = await supabase.auth.signUp({
                email,
                password,
                options: { data: { full_name: fullName } },
            });
            if (error) throw error;
            if (data.user) {
                await supabase.from('profiles').upsert(
                    { id: data.user.id, full_name: fullName, email, updated_at: new Date().toISOString() },
                    { onConflict: 'id' }
                );
            }
            return { user: data.user, error: null };
        } catch (error) {
            return { user: null, error };
        }
    };

    const signIn = (email, password) =>
        supabase.auth.signInWithPassword({ email, password });

    const signInWithGoogle = async ({ nextPath = '/app', plan } = {}) => {
        try {
            const callbackUrl = new URL('/auth/callback', window.location.origin);
            callbackUrl.searchParams.set('next', nextPath);
            if (plan) {
                callbackUrl.searchParams.set('plan', plan);
                // Store plan in sessionStorage as backup in case Supabase strips query params
                sessionStorage.setItem('oauth_pending_plan', plan);
            }

            const { data, error } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: { redirectTo: callbackUrl.toString() },
            });
            if (error) throw error;
            return { data, error: null };
        } catch (error) {
            return { data: null, error };
        }
    };

    const signUpWithGoogle = async (plan = 'free') =>
        signInWithGoogle({ nextPath: '/onboarding/team-setup', plan });

    const signOut = async () => {
        setUser(null);
        setProfile(null);
        clearCachedProfile();
        await supabase.auth.signOut();
        navigate('/login');
    };

    const refreshProfile = async () => {
        if (user) await fetchProfile(user.id);
    };

    const value = {
        user, profile, loading, isOffline,
        refreshProfile,
        signUp, signIn, signOut,
        signInWithGoogle, signUpWithGoogle,
        supabase,
    };

    return (
        // ✅ Always render children — never block the tree on loading state.
        // ProtectedRoute handles the loading spinner individually per route.
        // This prevents the entire app from re-rendering and flash-redirecting
        // when onAuthStateChange fires during the OAuth callback flow.
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
}