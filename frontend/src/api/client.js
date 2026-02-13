const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://teama-ai.vercel.app';

// Get current user from Supabase auth
let currentUser = null;

// Function to set the current user (called from AuthContext)
export const setCurrentUser = (user) => {
    currentUser = user;
};

// Helper function to get userId
const getUserId = () => {
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

    return userId;
};

export const api = {
    // ==================== SLACK API ====================
    async getChannels(teamId = null) {
        const userId = getUserId();

        console.log('getChannels - userId:', userId, 'teamId:', teamId);

        if (!userId) {
            const error = 'Not authenticated - no user ID';
            console.error(error);
            return { channels: [], error };
        }

        let url = `${API_BASE_URL}/api/slack/channels?userId=${userId}`;
        if (teamId) url += `&teamId=${teamId}`;
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

    async createSummary(channelId, hours = 24, teamId = null) {
        const userId = getUserId();

        if (!userId) {
            throw new Error('Not authenticated - cannot create summary');
        }

        console.log('Creating summary for channel:', channelId, 'userId:', userId, 'teamId:', teamId);

        try {
            const res = await fetch(`${API_BASE_URL}/api/slack/summarize`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ channelId, hours, userId, teamId })
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

    async getSummaries(teamId = null) {
        const userId = getUserId();

        if (!userId) {
            throw new Error('Not authenticated - cannot fetch summaries');
        }

        console.log('Fetching summaries for user:', userId, 'team:', teamId);

        try {
            const url = new URL(`${API_BASE_URL}/api/summaries`);
            url.searchParams.append('userId', userId);
            if (teamId) url.searchParams.append('teamId', teamId);

            const res = await fetch(url.toString());

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
    },

    // ==================== ASANA API ====================
    async getAsanaProjects(teamId = null) {
        const userId = getUserId();

        if (!userId) {
            const error = 'Not authenticated - no user ID';
            console.error(error);
            return { projects: [], error };
        }

        const url = new URL(`${API_BASE_URL}/api/asana/projects`);
        url.searchParams.append('userId', userId);
        if (teamId) url.searchParams.append('teamId', teamId);

        console.log('Fetching Asana projects from:', url.toString());

        try {
            const res = await fetch(url.toString());
            console.log('Asana projects response status:', res.status);

            if (!res.ok) {
                const data = await res.json();
                console.error('Asana projects error response:', data);
                return { projects: [], error: data.error };
            }

            const data = await res.json();
            console.log('Asana projects fetched:', data);
            return data;
        } catch (error) {
            console.error('Fetch Asana projects error:', error);
            return { projects: [], error: error.message };
        }
    },

    async getAsanaProjectHealth(projectId, teamId = null) {
        const userId = getUserId();

        if (!userId) {
            throw new Error('Not authenticated - cannot fetch project health');
        }

        if (!projectId) {
            throw new Error('Project ID is required');
        }

        const url = new URL(`${API_BASE_URL}/api/asana/projects/${projectId}/health`);
        url.searchParams.append('userId', userId);
        if (teamId) url.searchParams.append('teamId', teamId);

        console.log('Fetching project health from:', url.toString());

        try {
            const res = await fetch(url.toString());
            console.log('Project health response status:', res.status);

            if (!res.ok) {
                const data = await res.json();
                console.error('Project health error response:', data);
                throw new Error(data.error || 'Failed to fetch project health');
            }

            const data = await res.json();
            console.log('Project health fetched:', data);
            return data;
        } catch (error) {
            console.error('Fetch project health error:', error);
            throw error;
        }
    },

    async getAsanaWorkload(teamId = null) {
        const userId = getUserId();

        if (!userId) {
            const error = 'Not authenticated - no user ID';
            console.error(error);
            return { workload: [], error };
        }

        const url = new URL(`${API_BASE_URL}/api/asana/workload`);
        url.searchParams.append('userId', userId);
        if (teamId) url.searchParams.append('teamId', teamId);

        console.log('Fetching Asana workload from:', url.toString());

        try {
            const res = await fetch(url.toString());
            console.log('Asana workload response status:', res.status);

            if (!res.ok) {
                const data = await res.json();
                console.error('Asana workload error response:', data);
                return { workload: [], error: data.error };
            }

            const data = await res.json();
            console.log('Asana workload fetched:', data);
            return data;
        } catch (error) {
            console.error('Fetch Asana workload error:', error);
            return { workload: [], error: error.message };
        }
    },

    async getAsanaWorkspaces(teamId = null) {
        const userId = getUserId();

        if (!userId) {
            const error = 'Not authenticated - no user ID';
            console.error(error);
            return { workspaces: [], error };
        }

        const url = new URL(`${API_BASE_URL}/api/asana/workspaces`);
        url.searchParams.append('userId', userId);
        if (teamId) url.searchParams.append('teamId', teamId);
        console.log('Fetching Asana workspaces from:', url.toString());

        try {
            const res = await fetch(url.toString());
            console.log('Asana workspaces response status:', res.status);

            if (!res.ok) {
                const data = await res.json();
                console.error('Asana workspaces error response:', data);
                return { workspaces: [], error: data.error };
            }

            const data = await res.json();
            console.log('Asana workspaces fetched:', data);
            return data;
        } catch (error) {
            console.error('Fetch Asana workspaces error:', error);
            return { workspaces: [], error: error.message };
        }
    },

    async getAsanaDeadlines(teamId = null) {
        const userId = getUserId();

        if (!userId) {
            const error = 'Not authenticated - no user ID';
            console.error(error);
            return { error };
        }

        const url = new URL(`${API_BASE_URL}/api/asana/deadlines`);
        url.searchParams.append('userId', userId);
        if (teamId) url.searchParams.append('teamId', teamId);
        console.log('Fetching Asana deadlines from:', url.toString());

        try {
            const res = await fetch(url.toString());
            console.log('Asana deadlines response status:', res.status);

            if (!res.ok) {
                const data = await res.json();
                console.error('Asana deadlines error response:', data);
                return { error: data.error, needsReauth: data.needsReauth };
            }

            const data = await res.json();
            console.log('Asana deadlines fetched:', data);
            return data;
        } catch (error) {
            console.error('Fetch Asana deadlines error:', error);
            return { error: error.message };
        }
    },

    async getAsanaTasks(filters = {}, teamId = null) {
        const userId = getUserId();

        if (!userId) {
            const error = 'Not authenticated - no user ID';
            console.error(error);
            return { tasks: [], error };
        }

        const params = new URLSearchParams({ userId });
        if (teamId) params.append('teamId', teamId);
        if (filters.status) params.append('status', filters.status);
        if (filters.projectId) params.append('projectId', filters.projectId);

        const url = `${API_BASE_URL}/api/asana/tasks?${params}`;
        console.log('Fetching Asana tasks from:', url);

        try {
            const res = await fetch(url);
            console.log('Asana tasks response status:', res.status);

            if (!res.ok) {
                const data = await res.json();
                console.error('Asana tasks error response:', data);
                return { tasks: [], error: data.error, needsReauth: data.needsReauth };
            }

            const data = await res.json();
            console.log('Asana tasks fetched:', data);
            return data;
        } catch (error) {
            console.error('Fetch Asana tasks error:', error);
            return { tasks: [], error: error.message };
        }
    },

    async getGoogleCalendarEvents(teamId = null, days = 7) {
        const userId = getUserId();
        if (!userId) return { error: 'Not authenticated' };

        const url = new URL(`${API_BASE_URL}/api/google-calendar/events`);
        url.searchParams.append('userId', userId);
        url.searchParams.append('days', days);
        if (teamId) url.searchParams.append('teamId', teamId);

        try {
            const res = await fetch(url.toString());
            if (!res.ok) {
                const data = await res.json();
                return { error: data.error, needsReauth: data.needsReauth };
            }
            return await res.json();
        } catch (error) {
            return { error: error.message };
        }
    },

    async getGoogleCalendarAnalytics(teamId = null, days = 30) {
        const userId = getUserId();
        if (!userId) return { error: 'Not authenticated' };

        const url = new URL(`${API_BASE_URL}/api/google-calendar/analytics`);
        url.searchParams.append('userId', userId);
        url.searchParams.append('days', days);
        if (teamId) url.searchParams.append('teamId', teamId);

        try {
            const res = await fetch(url.toString());
            if (!res.ok) {
                const data = await res.json();
                return { error: data.error, needsReauth: data.needsReauth };
            }
            return await res.json();
        } catch (error) {
            return { error: error.message };
        }
    },

    async getGoogleCalendarActionItems(teamId = null, days = 7) {
        const userId = getUserId();
        if (!userId) return { error: 'Not authenticated' };

        const url = new URL(`${API_BASE_URL}/api/google-calendar/action-items`);
        url.searchParams.append('userId', userId);
        url.searchParams.append('days', days);
        if (teamId) url.searchParams.append('teamId', teamId);

        try {
            const res = await fetch(url.toString());
            if (!res.ok) {
                const data = await res.json();
                return { error: data.error, needsReauth: data.needsReauth };
            }
            return await res.json();
        } catch (error) {
            return { error: error.message };
        }
    }
};