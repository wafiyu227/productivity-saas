import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { setCurrentUser } from '../api/client';

const AuthContext = createContext({});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    const [profile, setProfile] = useState(null);

    useEffect(() => {
        // Get initial session
        supabase.auth.getSession().then(({ data: { session } }) => {
            const currentUser = session?.user ?? null;
            setUser(currentUser);
            setCurrentUser(currentUser);
            if (currentUser) fetchProfile(currentUser.id);
            else setLoading(false);
        });

        // Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            const currentUser = session?.user ?? null;
            setUser(currentUser);
            setCurrentUser(currentUser);
            if (currentUser) fetchProfile(currentUser.id);
            else {
                setProfile(null);
                setLoading(false);
            }
        });

        return () => subscription.unsubscribe();
    }, []);

    const fetchProfile = async (userId) => {
        try {
            const res = await fetch(`${import.meta.env.VITE_API_URL}/api/user/profile?userId=${userId}`);
            if (res.ok) {
                const data = await res.json();
        // Ensure we always set a non-null object so the UI
        // can decide between onboarding vs dashboard states.
        setProfile(data || {});
      } else if (res.status === 404) {
        // No profile yet – treat as empty profile and let
        // the app redirect the user into onboarding.
        setProfile({});
      } else {
        console.error('Error response fetching profile:', res.status);
        // Fallback to an empty profile to avoid infinite loaders
        // and allow onboarding flow to take over.
        setProfile({});
            }
        } catch (error) {
            console.error('Error fetching profile:', error);
      // Avoid leaving profile as null which would cause the
      // app shell to show a perpetual "Loading workspace" state.
      setProfile({});
        } finally {
            setLoading(false);
        }
    };

    const signUp = (email, password) => {
        return supabase.auth.signUp({ email, password });
    };

    const signIn = (email, password) => {
        return supabase.auth.signInWithPassword({ email, password });
    };

    const signOut = () => {
        return supabase.auth.signOut();
    };

    const refreshProfile = async () => {
        if (user) {
            await fetchProfile(user.id);
        }
    };

    const value = {
        user,
        profile,
        refreshProfile,
        signUp,
        signIn,
        signOut
    };

    return (
        <AuthContext.Provider value={value}>
            {!loading && children}
        </AuthContext.Provider>
    );
}