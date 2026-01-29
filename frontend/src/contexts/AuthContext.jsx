import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { setCurrentUser } from '../api/client';

const AuthContext = createContext({});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Get initial session
        supabase.auth.getSession().then(({ data: { session } }) => {
            const currentUser = session?.user ?? null;
            setUser(currentUser);
            setCurrentUser(currentUser);
            console.log('Auth initialized, user:', currentUser?.id);
            setLoading(false);
        });

        // Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            const currentUser = session?.user ?? null;
            setUser(currentUser);
            setCurrentUser(currentUser);
            console.log('Auth changed, user:', currentUser?.id);
        });

        return () => subscription.unsubscribe();
    }, []);

    const signUp = (email, password) => {
        return supabase.auth.signUp({ email, password });
    };

    const signIn = (email, password) => {
        return supabase.auth.signInWithPassword({ email, password });
    };

    const signOut = () => {
        return supabase.auth.signOut();
    };

    const value = {
        user,
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