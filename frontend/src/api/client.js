const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://api.teamaai.xyz';

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

    async getSummaries(teamId = null, options = {}) {
        const userId = getUserId();
        const { limit } = options;

        if (!userId) {
            throw new Error('Not authenticated - cannot fetch summaries');
        }

        console.log('Fetching summaries for user:', userId, 'team:', teamId);

        try {
            const url = new URL(`${API_BASE_URL}/api/summaries`);
            url.searchParams.append('userId', userId);
            if (teamId) url.searchParams.append('teamId', teamId);
            if (Number.isFinite(limit) && limit > 0) {
                url.searchParams.append('limit', Math.floor(limit).toString());
            }

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

    async getIntegrationStatus(platform, teamId = null) {
        const userId = getUserId();
        if (!userId) {
            return { connected: false, platform, error: 'Not authenticated' };
        }

        try {
            const url = new URL(`${API_BASE_URL}/api/auth/status`);
            url.searchParams.append('userId', userId);
            url.searchParams.append('platform', platform);
            if (teamId) url.searchParams.append('teamId', teamId);

            const res = await fetch(url.toString());
            const data = await res.json();
            if (!res.ok) {
                return { connected: false, platform, error: data?.error || 'Failed to fetch integration status' };
            }

            return data;
        } catch (error) {
            return { connected: false, platform, error: error.message };
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

    // ==================== JIRA API ====================
    async getJiraProjects(teamId = null) {
        const userId = getUserId();

        if (!userId) {
            const error = 'Not authenticated - no user ID';
            console.error(error);
            return { projects: [], error };
        }

        const url = new URL(`${API_BASE_URL}/api/jira/projects`);
        url.searchParams.append('userId', userId);
        if (teamId) url.searchParams.append('teamId', teamId);

        try {
            const res = await fetch(url.toString());
            if (!res.ok) {
                const data = await res.json();
                return { projects: [], error: data.error || 'Failed to fetch Jira projects' };
            }
            return await res.json();
        } catch (error) {
            return { projects: [], error: error.message };
        }
    },

    async getJiraProjectHealth(projectId, teamId = null) {
        const userId = getUserId();
        if (!userId) {
            throw new Error('Not authenticated - cannot fetch project health');
        }
        if (!projectId) {
            throw new Error('Project ID is required');
        }

        const url = new URL(`${API_BASE_URL}/api/jira/projects/${projectId}/health`);
        url.searchParams.append('userId', userId);
        if (teamId) url.searchParams.append('teamId', teamId);

        const res = await fetch(url.toString());
        if (!res.ok) {
            const data = await res.json();
            throw new Error(data.error || 'Failed to fetch Jira project health');
        }
        return await res.json();
    },

    async getJiraWorkload(teamId = null) {
        const userId = getUserId();
        if (!userId) {
            return { workload: [], error: 'Not authenticated - no user ID' };
        }

        const url = new URL(`${API_BASE_URL}/api/jira/workload`);
        url.searchParams.append('userId', userId);
        if (teamId) url.searchParams.append('teamId', teamId);

        try {
            const res = await fetch(url.toString());
            if (!res.ok) {
                const data = await res.json();
                return { workload: [], error: data.error || 'Failed to fetch Jira workload' };
            }
            return await res.json();
        } catch (error) {
            return { workload: [], error: error.message };
        }
    },

    async getJiraDeadlines(teamId = null) {
        const userId = getUserId();
        if (!userId) {
            return { error: 'Not authenticated - no user ID' };
        }

        const url = new URL(`${API_BASE_URL}/api/jira/deadlines`);
        url.searchParams.append('userId', userId);
        if (teamId) url.searchParams.append('teamId', teamId);

        try {
            const res = await fetch(url.toString());
            if (!res.ok) {
                const data = await res.json();
                return { error: data.error || 'Failed to fetch Jira deadlines' };
            }
            return await res.json();
        } catch (error) {
            return { error: error.message };
        }
    },

    async getJiraTasks(filters = {}, teamId = null) {
        const userId = getUserId();
        if (!userId) {
            return { tasks: [], error: 'Not authenticated - no user ID' };
        }

        const params = new URLSearchParams({ userId });
        if (teamId) params.append('teamId', teamId);
        if (filters.status) params.append('status', filters.status);
        if (filters.projectId) params.append('projectId', filters.projectId);

        const url = `${API_BASE_URL}/api/jira/tasks?${params}`;

        try {
            const res = await fetch(url);
            if (!res.ok) {
                const data = await res.json();
                return { tasks: [], error: data.error || 'Failed to fetch Jira tasks' };
            }
            return await res.json();
        } catch (error) {
            return { tasks: [], error: error.message };
        }
    },

    // ==================== TRELLO API ====================
    async getTrelloProjects(teamId = null) {
        const userId = getUserId();

        if (!userId) {
            const error = 'Not authenticated - no user ID';
            console.error(error);
            return { projects: [], error };
        }

        const url = new URL(`${API_BASE_URL}/api/trello/projects`);
        url.searchParams.append('userId', userId);
        if (teamId) url.searchParams.append('teamId', teamId);

        try {
            const res = await fetch(url.toString());
            if (!res.ok) {
                const data = await res.json();
                return { projects: [], error: data.error || 'Failed to fetch Trello projects' };
            }
            return await res.json();
        } catch (error) {
            return { projects: [], error: error.message };
        }
    },

    async getTrelloProjectHealth(projectId, teamId = null) {
        const userId = getUserId();
        if (!userId) {
            throw new Error('Not authenticated - cannot fetch project health');
        }
        if (!projectId) {
            throw new Error('Project ID is required');
        }

        const url = new URL(`${API_BASE_URL}/api/trello/projects/${projectId}/health`);
        url.searchParams.append('userId', userId);
        if (teamId) url.searchParams.append('teamId', teamId);

        const res = await fetch(url.toString());
        if (!res.ok) {
            const data = await res.json();
            throw new Error(data.error || 'Failed to fetch Trello project health');
        }
        return await res.json();
    },

    async getTrelloWorkload(teamId = null) {
        const userId = getUserId();
        if (!userId) {
            return { workload: [], error: 'Not authenticated - no user ID' };
        }

        const url = new URL(`${API_BASE_URL}/api/trello/workload`);
        url.searchParams.append('userId', userId);
        if (teamId) url.searchParams.append('teamId', teamId);

        try {
            const res = await fetch(url.toString());
            if (!res.ok) {
                const data = await res.json();
                return { workload: [], error: data.error || 'Failed to fetch Trello workload' };
            }
            return await res.json();
        } catch (error) {
            return { workload: [], error: error.message };
        }
    },

    async getTrelloDeadlines(teamId = null) {
        const userId = getUserId();
        if (!userId) {
            return { error: 'Not authenticated - no user ID' };
        }

        const url = new URL(`${API_BASE_URL}/api/trello/deadlines`);
        url.searchParams.append('userId', userId);
        if (teamId) url.searchParams.append('teamId', teamId);

        try {
            const res = await fetch(url.toString());
            if (!res.ok) {
                const data = await res.json();
                return { error: data.error || 'Failed to fetch Trello deadlines' };
            }
            return await res.json();
        } catch (error) {
            return { error: error.message };
        }
    },

    async getTrelloTasks(filters = {}, teamId = null) {
        const userId = getUserId();
        if (!userId) {
            return { tasks: [], error: 'Not authenticated - no user ID' };
        }

        const params = new URLSearchParams({ userId });
        if (teamId) params.append('teamId', teamId);
        if (filters.status) params.append('status', filters.status);
        if (filters.projectId) params.append('projectId', filters.projectId);

        const url = `${API_BASE_URL}/api/trello/tasks?${params}`;

        try {
            const res = await fetch(url);
            if (!res.ok) {
                const data = await res.json();
                return { tasks: [], error: data.error || 'Failed to fetch Trello tasks' };
            }
            return await res.json();
        } catch (error) {
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
    },

    async getGithubPulls(teamId = null, options = {}) {
        const userId = getUserId();
        if (!userId) return { pulls: [], error: 'Not authenticated' };

        const { limit = 10, staleDays = 7, repo = null } = options;

        const url = new URL(`${API_BASE_URL}/api/github/pulls`);
        url.searchParams.append('userId', userId);
        if (teamId) url.searchParams.append('teamId', teamId);
        if (repo) url.searchParams.append('repo', repo);
        if (Number.isFinite(limit) && limit > 0) {
            url.searchParams.append('limit', String(Math.floor(limit)));
        }
        if (Number.isFinite(staleDays) && staleDays > 0) {
            url.searchParams.append('staleDays', String(Math.floor(staleDays)));
        }

        try {
            const res = await fetch(url.toString());
            if (!res.ok) {
                const data = await res.json();
                return { pulls: [], meta: {}, error: data.error || 'Failed to fetch GitHub pull requests' };
            }
            return await res.json();
        } catch (error) {
            return { pulls: [], meta: {}, error: error.message };
        }
    },

    async deleteSummary(summaryId) {
        const userId = getUserId();
        if (!userId) throw new Error('Not authenticated');

        const res = await fetch(`${API_BASE_URL}/api/summaries/${summaryId}?userId=${userId}`, {
            method: 'DELETE'
        });

        if (!res.ok) {
            const data = await res.json();
            throw new Error(data.error || 'Failed to delete summary');
        }

        return await res.json();
    }
};
