const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://productivity-saas-tau.vercel.app';

// Get current user from Supabase auth
let currentUser = null;

// Function to set the current user (called from AuthContext)
export const setCurrentUser = (user) => {
    currentUser = user;
};

export const api = {
    async getChannels() {
        let userId = null;
        
        // Try to get user ID from current context
        if (currentUser?.id) {
            userId = currentUser.id;
        } else {
            // Fallback to localStorage
            try {
                const authData = localStorage.getItem('auth');
                if (authData) {
                    const parsed = JSON.parse(authData);
                    userId = parsed.user?.id;
                }
            } catch (e) {
                console.error('Failed to get user ID:', e);
            }
        }
        
        console.log('getChannels - userId:', userId);
        
        if (!userId) {
            const error = 'Not authenticated - no user ID';
            console.error(error);
            return { channels: [], error };
        }
        
        const url = `${API_BASE_URL}/api/slack/channels?userId=${userId}`;
        console.log('Fetching channels from:', url);
        
        try {
            const res = await fetch(url);
            console.log('Channels response status:', res.status);
            
            if (!res.ok) {
                const data = await res.json();
                console.error('Channels error response:', data);
                return { channels: [], error: data.error };
            }
            const data = await res.json();
            console.log('Channels fetched:', data);
            return data;
        } catch (error) {
            console.error('Fetch error:', error);
            return { channels: [], error: error.message };
        }
    },

    async createSummary(channelId, hours = 24) {
        let userId = null;
        
        if (currentUser?.id) {
            userId = currentUser.id;
        } else {
            try {
                const authData = localStorage.getItem('auth');
                if (authData) {
                    const parsed = JSON.parse(authData);
                    userId = parsed.user?.id;
                }
            } catch (e) {
                console.error('Failed to get user ID:', e);
            }
        }

        if (!userId) {
            throw new Error('Not authenticated - cannot create summary');
        }

        console.log('Creating summary for channel:', channelId, 'userId:', userId);

        try {
            const res = await fetch(`${API_BASE_URL}/api/slack/summarize`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ channelId, hours, userId })
            });
            
            console.log('Summary response status:', res.status);

            if (!res.ok) {
                const data = await res.json();
                console.error('Summary error:', data);
                throw new Error(data.error || 'Failed to create summary');
            }
            
            const data = await res.json();
            console.log('Summary created:', data);
            return data;
        } catch (error) {
            console.error('Summary creation error:', error);
            throw error;
        }
    },

    async getSummaries() {
        let userId = null;
        
        if (currentUser?.id) {
            userId = currentUser.id;
        } else {
            try {
                const authData = localStorage.getItem('auth');
                if (authData) {
                    const parsed = JSON.parse(authData);
                    userId = parsed.user?.id;
                }
            } catch (e) {
                console.error('Failed to get user ID:', e);
            }
        }

        if (!userId) {
            throw new Error('Not authenticated - cannot fetch summaries');
        }

        console.log('Fetching summaries for user:', userId);

        try {
            const res = await fetch(`${API_BASE_URL}/api/summaries?userId=${userId}`);
            
            if (!res.ok) {
                const data = await res.json();
                console.error('Summaries error:', data);
                throw new Error(data.error || 'Failed to fetch summaries');
            }
            
            const data = await res.json();
            console.log('Summaries fetched:', data);
            return data;
        } catch (error) {
            console.error('Fetch summaries error:', error);
            throw error;
        }
    }
};