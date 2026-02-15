// FIXED: frontend/src/contexts/AuthContext.jsx
// Handles stale sessions when user is deleted from database

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
            console.log('Fetching profile for user:', userId);
            const res = await fetch(`${import.meta.env.VITE_API_URL}/api/user/me?userId=${userId}`);

            if (res.ok) {
                const data = await res.json();
                console.log('Profile data:', data);
                setProfile(data || {});

                // Check if user needs onboarding
                if (data && data.userId && !data.current_team_id && (!data.teams || data.teams.length === 0)) {
                    console.log('User has no team, redirecting to team setup');
                    const currentPath = window.location.pathname;
                    if (!currentPath.includes('/onboarding') && !currentPath.includes('/join')) {
                        navigate('/onboarding/team-setup');
                    }
                }
            } else if (res.status === 404) {
                // ✅ FIX: Profile doesn't exist - could be deleted user with stale session
                console.warn('Profile not found (404) - checking if this is a stale session');

                // Check if we have an active auth session
                const { data: { session } } = await supabase.auth.getSession();

                if (session) {
                    // We have a session but no profile - user was likely deleted
                    // Sign out to clear the stale session
                    console.log('Stale session detected - signing out');
                    await supabase.auth.signOut();
                    setUser(null);
                    setProfile(null);
                    navigate('/login');
                } else {
                    // No session - just redirect to login
                    setProfile({});
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
                console.log('Creating profile for user:', data.user.id);

                const { error: profileError } = await supabase
                    .from('profiles')
                    .insert({
                        id: data.user.id,
                        full_name: fullName,
                        email: email
                    });

                if (profileError) {
                    console.error('❌ Failed to create profile:', profileError);
                    // Don't fail signup, but log the error
                    alert('Account created but profile setup incomplete. Please contact support.');
                } else {
                    console.log('✅ Profile created successfully');
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
        supabase
    };

    return (
        <AuthContext.Provider value={value}>
            {!loading && children}
        </AuthContext.Provider>
    );
}