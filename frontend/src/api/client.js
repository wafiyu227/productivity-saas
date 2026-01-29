const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://productivity-saas-tau.vercel.app';

// Get current user from auth context or localStorage
const getCurrentUserId = () => {
    try {
        const authData = localStorage.getItem('auth');
        if (authData) {
            const parsed = JSON.parse(authData);
            return parsed.user?.id;
        }
    } catch (e) {
        console.error('Failed to get user ID:', e);
    }
    return null;
};

export const api = {
    async getChannels() {
        const userId = getCurrentUserId();
        if (!userId) {
            return { channels: [], error: 'Not authenticated' };
        }
        
        const res = await fetch(`${API_BASE_URL}/api/slack/channels?userId=${userId}`);
        if (!res.ok) {
            const data = await res.json();
            return { channels: [], error: data.error };
        }
        return res.json();
    },

    async createSummary(channelId, hours = 24) {
        const res = await fetch(`${API_BASE_URL}/api/slack/summarize`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ channelId, hours, teamId: 'default' })
        });
        if (!res.ok) throw new Error('Failed to create summary');
        return res.json();
    },

    async getSummaries(teamId = 'default') {
        const res = await fetch(`${API_BASE_URL}/api/summaries?teamId=${teamId}`);
        if (!res.ok) throw new Error('Failed to fetch summaries');
        return res.json();
    }
};