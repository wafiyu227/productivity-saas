// UPDATED: frontend/src/contexts/AuthContext.jsx
// Replace your AuthContext with this version

import { createContext, useContext, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { setCurrentUser } from '../api/client';

const AuthContext = createContext({});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

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
            const res = await fetch(`${import.meta.env.VITE_API_URL}/api/user/me?userId=${userId}`);

            if (res.ok) {
                const data = await res.json();
                setProfile(data || {});

                // ✅ FIX: Check if user needs onboarding
                // If user exists but has no team, redirect to team setup
                if (data && !data.current_team_id && (!data.teams || data.teams.length === 0)) {
                    console.log('User has no team, redirecting to team setup');
                    // Only redirect if we're not already on an onboarding page
                    const currentPath = window.location.pathname;
                    if (!currentPath.includes('/onboarding') && !currentPath.includes('/join')) {
                        navigate('/onboarding/team-setup');
                    }
                }
            } else if (res.status === 404) {
                // Profile doesn't exist yet - this is a new user
                setProfile({});
                navigate('/onboarding/team-setup');
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

    const signUp = async (email, password, fullName) => {
        try {
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

            // Create/Update profile (without current_team_id - will be set when team is created)
            if (data.user) {
                await supabase
                    .from('profiles')
                    .upsert({
                        id: data.user.id,
                        full_name: fullName,
                        email: email
                    }, { onConflict: 'id' });
            }

            return { user: data.user, error: null };
        } catch (error) {
            return { user: null, error };
        }
    };

    const signIn = (email, password) => {
        return supabase.auth.signInWithPassword({ email, password });
    };

    const signOut = () => {
        return supabase.auth.signOut();
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
        supabase
    };

    return (
        <AuthContext.Provider value={value}>
            {!loading && children}
        </AuthContext.Provider>
    );
}