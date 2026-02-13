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
            const res = await fetch(`${import.meta.env.VITE_API_URL}/api/user/me?userId=${userId}`);
            if (res.ok) {
                const data = await res.json();
                setProfile(data || {});
            } else if (res.status === 404) {
                setProfile({});
            } else {
                console.error('Error response fetching profile:', res.status);
                setProfile({});
            }
        } catch (error) {
            console.error('Error fetching profile:', error);
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
        signOut,
        supabase // Export for direct Supabase actions like password reset
    };

    return (
        <AuthContext.Provider value={value}>
            {!loading && children}
        </AuthContext.Provider>
    );
}