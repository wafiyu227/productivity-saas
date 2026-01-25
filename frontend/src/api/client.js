const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://productivity-saas-tau.vercel.app';

export const api = {
    async getChannels() {
        const res = await fetch(`${API_BASE_URL}/api/slack/channels`);
        if (!res.ok) throw new Error('Failed to fetch channels');
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