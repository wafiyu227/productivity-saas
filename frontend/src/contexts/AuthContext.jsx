// src/contexts/AuthContext.jsx
// Redirects are suppressed while AuthCallback is processing (authCallbackState.isProcessing).
// This eliminates the race condition where onAuthStateChange fired mid-OAuth and
// redirected before AuthCallback could determine new-vs-returning user status.

import { createContext, useContext, useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { setCurrentUser } from '../api/client';
import { authCallbackState } from '../lib/authCallbackState';

const AuthContext = createContext({});
export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();
    const location = useLocation();

    // Pages that should NEVER trigger an auto-redirect
    const REDIRECT_BLOCKED_PATHS = new Set([
        '/auth/callback',
        '/join',
    ]);

    const isRedirectBlocked = () =>
        REDIRECT_BLOCKED_PATHS.has(location.pathname) ||
        authCallbackState.isProcessing; // ← key addition

    // ── Redirect helpers ────────────────────────────────────────────────────────

    const redirectToDashboard = (profileData = profile) => {
        if (isRedirectBlocked()) return;
        const currentPath = window.location.pathname;
        const isPublicPage = ['/', '/login', '/signup'].includes(currentPath);
        if (!isPublicPage) return;

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

    // ── Profile helpers ─────────────────────────────────────────────────────────

    const ensureProfileFromAuth = async (userId, sessionUser = null) => {
        const authUser = sessionUser || user;
        const fallbackName = authUser?.email?.split('@')?.[0] || null;

        const { error: upsertError } = await supabase
            .from('profiles')
            .upsert(
                {
                    id: userId,
                    email: authUser?.email || null,
                    full_name: authUser?.user_metadata?.full_name ||
                        authUser?.user_metadata?.name ||
                        fallbackName,
                    updated_at: new Date().toISOString(),
                },
                { onConflict: 'id' }
            );

        if (upsertError) throw upsertError;
    };

    // ── Bootstrap ───────────────────────────────────────────────────────────────

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            const currentUser = session?.user ?? null;
            setUser(currentUser);
            setCurrentUser(currentUser);

            if (currentUser && !isRedirectBlocked()) {
                fetchProfile(currentUser.id);
            } else {
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
                setLoading(false);
            } else {
                // Callback is processing — don't touch loading/profile here
                setLoading(false);
            }
        });

        return () => subscription.unsubscribe();
    }, []); // eslint-disable-line react-hooks/exhaustive-deps
    // ↑ intentionally empty deps — we re-read isRedirectBlocked() at call time

    // ── fetchProfile ────────────────────────────────────────────────────────────

    const fetchProfile = async (userId) => {
        try {
            const res = await fetch(`${import.meta.env.VITE_API_URL}/api/user/me?userId=${userId}`);

            if (res.ok) {
                const data = await res.json();
                setProfile(data || {});

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
                        const retryRes = await fetch(`${import.meta.env.VITE_API_URL}/api/user/me?userId=${userId}`);
                        if (retryRes.ok) {
                            const retryData = await retryRes.json();
                            setProfile(retryData || {});
                            redirectToOnboardingIfNeeded();
                            return;
                        }
                    } catch (profileSyncError) {
                        console.error('Failed to auto-create profile:', profileSyncError);
                    }
                    setProfile({ id: userId, is_new_user: true });
                    redirectToOnboardingIfNeeded();
                } else {
                    setProfile(null);
                    navigate('/login');
                }
            } else {
                console.error('Error fetching profile:', res.status);
                setProfile({});
            }
        } catch (error) {
            console.error('Error fetching profile:', error);
            const { data: { session } } = await supabase.auth.getSession();
            if (session) {
                setProfile({});
            } else {
                navigate('/login');
            }
        } finally {
            setLoading(false);
        }
    };

    // ── Auth actions ────────────────────────────────────────────────────────────

    const signUp = async (email, password, fullName) => {
        try {
            const { data, error } = await supabase.auth.signUp({
                email,
                password,
                options: { data: { full_name: fullName } },
            });
            if (error) throw error;

            if (data.user) {
                const { error: profileError } = await supabase
                    .from('profiles')
                    .upsert(
                        { id: data.user.id, full_name: fullName, email, updated_at: new Date().toISOString() },
                        { onConflict: 'id' }
                    );
                if (profileError) console.error('Profile upsert failed:', profileError);
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
            if (plan) callbackUrl.searchParams.set('plan', plan);

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
        await supabase.auth.signOut();
        navigate('/login');
    };

    const refreshProfile = async () => {
        if (user) await fetchProfile(user.id);
    };

    const value = {
        user, profile, loading,
        refreshProfile,
        signUp, signIn, signOut,
        signInWithGoogle, signUpWithGoogle,
        supabase,
    };

    return (
        <AuthContext.Provider value={value}>
            {!loading && children}
        </AuthContext.Provider>
    );
}