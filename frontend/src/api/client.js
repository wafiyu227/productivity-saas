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
    // ==================== GENERIC HTTP METHODS ====================
    async get(endpoint, options = {}) {
        const url = new URL(`${API_BASE_URL}${endpoint}`);
        
        try {
            const res = await fetch(url.toString(), {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    ...options.headers
                },
                ...options
            });

            const data = await res.json();

            if (!res.ok) {
                const error = new Error(data.error || `HTTP ${res.status}`);
                error.response = { status: res.status, data };
                throw error;
            }

            return { data, status: res.status };
        } catch (error) {
            console.error('GET request failed:', error);
            throw error;
        }
    },

    // ==================== SLACK API ====================
    async getChannels() {
        const userId = getUserId();

        if (!userId) {
            const error = 'Not authenticated - no user ID';
            console.error(error);
            return { channels: [], error };
        }

        let url = `${API_BASE_URL}/api/slack/channels?userId=${userId}`;

        try {
            const res = await fetch(url);
            if (!res.ok) {
                const data = await res.json();
                return { channels: [], error: data.error };
            }
            return await res.json();
        } catch (error) {
            console.error('Fetch channels error:', error);
            return { channels: [], error: error.message };
        }
    },

    async createSummary(channelId, hours = 24) {
        const userId = getUserId();
        if (!userId) throw new Error('Not authenticated - cannot create summary');

        try {
            const res = await fetch(`${API_BASE_URL}/api/slack/summarize`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ channelId, hours, userId })
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || 'Failed to create summary');
            }

            return await res.json();
        } catch (error) {
            console.error('Summary creation error:', error);
            throw error;
        }
    },

    async getSummaries(options = {}) {
        const userId = getUserId();
        const { limit } = options;
        if (!userId) throw new Error('Not authenticated - cannot fetch summaries');

        try {
            const url = new URL(`${API_BASE_URL}/api/summaries`);
            url.searchParams.append('userId', userId);
            if (Number.isFinite(limit) && limit > 0) {
                url.searchParams.append('limit', Math.floor(limit).toString());
            }

            const res = await fetch(url.toString());
            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || 'Failed to fetch summaries');
            }

            return await res.json();
        } catch (error) {
            console.error('Fetch summaries error:', error);
            throw error;
        }
    },

    async getWorkInsights(options = {}) {
        const userId = getUserId();
        const { limit = 12 } = options;
        if (!userId) throw new Error('Not authenticated - cannot fetch work insights');

        try {
            const url = new URL(`${API_BASE_URL}/api/work-insights`);
            url.searchParams.append('userId', userId);
            if (Number.isFinite(limit) && limit > 0) {
                url.searchParams.append('limit', Math.floor(limit).toString());
            }

            const res = await fetch(url.toString());
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to fetch work insights');
            return data;
        } catch (error) {
            console.error('Fetch work insights error:', error);
            throw error;
        }
    },

    async applyWorkInsight(payload = {}) {
        const userId = getUserId();
        if (!userId) throw new Error('Not authenticated - cannot apply work insight');

        try {
            const res = await fetch(`${API_BASE_URL}/api/work-insights/apply`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...payload, userId })
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to apply work insight');
            return data;
        } catch (error) {
            console.error('Apply work insight error:', error);
            throw error;
        }
    },

    async getIntegrationStatus(platform) {
        const userId = getUserId();
        if (!userId) return { connected: false, platform, error: 'Not authenticated' };

        try {
            const url = new URL(`${API_BASE_URL}/api/auth/status`);
            url.searchParams.append('userId', userId);
            url.searchParams.append('platform', platform);

            const res = await fetch(url.toString());
            const data = await res.json();
            if (!res.ok) return { connected: false, platform, error: data?.error || 'Failed to fetch integration status' };
            return data;
        } catch (error) {
            return { connected: false, platform, error: error.message };
        }
    },

    // ==================== ASANA API ====================
    async getAsanaProjects() {
        const userId = getUserId();
        if (!userId) return { projects: [], error: 'Not authenticated' };

        const url = new URL(`${API_BASE_URL}/api/asana/projects`);
        url.searchParams.append('userId', userId);

        try {
            const res = await fetch(url.toString());
            if (!res.ok) {
                const data = await res.json();
                return { projects: [], error: data.error };
            }
            return await res.json();
        } catch (error) {
            return { projects: [], error: error.message };
        }
    },

    async getAsanaProjectHealth(projectId) {
        const userId = getUserId();
        if (!userId) throw new Error('Not authenticated');
        if (!projectId) throw new Error('Project ID is required');

        const url = new URL(`${API_BASE_URL}/api/asana/projects/${projectId}/health`);
        url.searchParams.append('userId', userId);

        try {
            const res = await fetch(url.toString());
            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || 'Failed to fetch project health');
            }
            return await res.json();
        } catch (error) {
            throw error;
        }
    },

    async getAsanaWorkload() {
        const userId = getUserId();
        if (!userId) return { workload: [], error: 'Not authenticated' };

        const url = new URL(`${API_BASE_URL}/api/asana/workload`);
        url.searchParams.append('userId', userId);

        try {
            const res = await fetch(url.toString());
            if (!res.ok) {
                const data = await res.json();
                return { workload: [], error: data.error };
            }
            return await res.json();
        } catch (error) {
            return { workload: [], error: error.message };
        }
    },

    async getAsanaWorkspaces() {
        const userId = getUserId();
        if (!userId) return { workspaces: [], error: 'Not authenticated' };

        const url = new URL(`${API_BASE_URL}/api/asana/workspaces`);
        url.searchParams.append('userId', userId);

        try {
            const res = await fetch(url.toString());
            if (!res.ok) {
                const data = await res.json();
                return { workspaces: [], error: data.error };
            }
            return await res.json();
        } catch (error) {
            return { workspaces: [], error: error.message };
        }
    },

    async getAsanaDeadlines() {
        const userId = getUserId();
        if (!userId) return { error: 'Not authenticated' };

        const url = new URL(`${API_BASE_URL}/api/asana/deadlines`);
        url.searchParams.append('userId', userId);

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

    async getAsanaTasks(filters = {}) {
        const userId = getUserId();
        if (!userId) return { tasks: [], error: 'Not authenticated' };

        const params = new URLSearchParams({ userId });
        if (filters.status) params.append('status', filters.status);
        if (filters.projectId) params.append('projectId', filters.projectId);

        const url = `${API_BASE_URL}/api/asana/tasks?${params}`;

        try {
            const res = await fetch(url);
            if (!res.ok) {
                const data = await res.json();
                return { tasks: [], error: data.error, needsReauth: data.needsReauth };
            }
            return await res.json();
        } catch (error) {
            return { tasks: [], error: error.message };
        }
    },

    // ==================== JIRA API ====================
    async getJiraProjects() {
        const userId = getUserId();
        if (!userId) return { projects: [], error: 'Not authenticated' };

        const url = new URL(`${API_BASE_URL}/api/jira/projects`);
        url.searchParams.append('userId', userId);

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

    async getJiraProjectHealth(projectId) {
        const userId = getUserId();
        if (!userId) throw new Error('Not authenticated');
        if (!projectId) throw new Error('Project ID is required');

        const url = new URL(`${API_BASE_URL}/api/jira/projects/${projectId}/health`);
        url.searchParams.append('userId', userId);

        try {
            const res = await fetch(url.toString());
            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || 'Failed to fetch Jira project health');
            }
            return await res.json();
        } catch (error) {
            throw error;
        }
    },

    async getJiraWorkload() {
        const userId = getUserId();
        if (!userId) return { workload: [], error: 'Not authenticated' };

        const url = new URL(`${API_BASE_URL}/api/jira/workload`);
        url.searchParams.append('userId', userId);

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

    async getJiraDeadlines() {
        const userId = getUserId();
        if (!userId) return { error: 'Not authenticated' };

        const url = new URL(`${API_BASE_URL}/api/jira/deadlines`);
        url.searchParams.append('userId', userId);

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

    async getJiraTasks(filters = {}) {
        const userId = getUserId();
        if (!userId) return { tasks: [], error: 'Not authenticated' };

        const params = new URLSearchParams({ userId });
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

    // ==================== GOOGLE CALENDAR API ====================
    async getGoogleCalendarEvents(days = 7) {
        const userId = getUserId();
        if (!userId) return { error: 'Not authenticated' };

        const url = new URL(`${API_BASE_URL}/api/google-calendar/events`);
        url.searchParams.append('userId', userId);
        url.searchParams.append('days', days);

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

    async getGoogleCalendarAnalytics(days = 30) {
        const userId = getUserId();
        if (!userId) return { error: 'Not authenticated' };

        const url = new URL(`${API_BASE_URL}/api/google-calendar/analytics`);
        url.searchParams.append('userId', userId);
        url.searchParams.append('days', days);

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

    async getGoogleCalendarActionItems(days = 7) {
        const userId = getUserId();
        if (!userId) return { error: 'Not authenticated' };

        const url = new URL(`${API_BASE_URL}/api/google-calendar/action-items`);
        url.searchParams.append('userId', userId);
        url.searchParams.append('days', days);

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

    async assignGoogleTaskToAgent(task) {
        const userId = getUserId();
        if (!userId) throw new Error('Not authenticated');

        try {
            const res = await fetch(`${API_BASE_URL}/api/google-calendar/tasks/assign`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId, task })
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to assign task');
            return data;
        } catch (error) {
            console.error('Task assignment error:', error);
            throw error;
        }
    },

    // ==================== GITHUB API ====================
    async getGithubPulls(options = {}) {
        const userId = getUserId();
        if (!userId) return { pulls: [], error: 'Not authenticated' };

        const { limit = 10, staleDays = 7, repo = null } = options;

        const url = new URL(`${API_BASE_URL}/api/github/pulls`);
        url.searchParams.append('userId', userId);

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

    // ==================== AGENT API ====================
    async listAgentConversations() {
        const userId = getUserId();
        if (!userId) throw new Error('Not authenticated');

        const res = await fetch(`${API_BASE_URL}/api/agent/conversations?userId=${encodeURIComponent(userId)}`);
        const data = await res.json();

        if (!res.ok) {
            throw new Error(data.error || 'Failed to load agent conversations');
        }

        return data;
    },

    async createAgentConversation(payload = {}) {
        const userId = getUserId();
        if (!userId) throw new Error('Not authenticated');

        const res = await fetch(`${API_BASE_URL}/api/agent/conversations`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, ...payload })
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to create chat');
        return data;
    },

    async getAgentConversation(conversationId) {
        const userId = getUserId();
        if (!userId) throw new Error('Not authenticated');
        if (!conversationId) throw new Error('conversationId required');

        const res = await fetch(`${API_BASE_URL}/api/agent/conversations/${conversationId}?userId=${encodeURIComponent(userId)}`);
        const data = await res.json();

        if (!res.ok) throw new Error(data.error || 'Failed to load chat');
        return data;
    },

    async renameAgentConversation(conversationId, title) {
        const userId = getUserId();
        if (!userId) throw new Error('Not authenticated');
        if (!conversationId) throw new Error('conversationId required');

        const res = await fetch(`${API_BASE_URL}/api/agent/conversations/${conversationId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, title })
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to rename chat');
        return data;
    },

    async shareAgentConversation(conversationId) {
        const userId = getUserId();
        if (!userId) throw new Error('Not authenticated');
        if (!conversationId) throw new Error('conversationId required');

        const res = await fetch(`${API_BASE_URL}/api/agent/conversations/${conversationId}/share`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId })
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to share chat');
        return data;
    },

    async deleteAgentConversation(conversationId) {
        const userId = getUserId();
        if (!userId) throw new Error('Not authenticated');
        if (!conversationId) throw new Error('conversationId required');

        const res = await fetch(`${API_BASE_URL}/api/agent/conversations/${conversationId}?userId=${encodeURIComponent(userId)}`, {
            method: 'DELETE'
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to delete chat');
        return data;
    },

    async approveAgentAction(conversationId, approvalId) {
        const userId = getUserId();
        if (!userId) throw new Error('Not authenticated');
        if (!conversationId || !approvalId) throw new Error('conversationId and approvalId are required');

        const res = await fetch(`${API_BASE_URL}/api/agent/approvals/${encodeURIComponent(approvalId)}/approve`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, conversationId })
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to approve action');
        return data;
    },

    async rejectAgentAction(conversationId, approvalId) {
        const userId = getUserId();
        if (!userId) throw new Error('Not authenticated');
        if (!conversationId || !approvalId) throw new Error('conversationId and approvalId are required');

        const res = await fetch(`${API_BASE_URL}/api/agent/approvals/${encodeURIComponent(approvalId)}/reject`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, conversationId })
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to reject action');
        return data;
    },

    async getSharedAgentConversation(shareToken) {
        if (!shareToken) throw new Error('shareToken required');

        const res = await fetch(`${API_BASE_URL}/api/agent/shared/${encodeURIComponent(shareToken)}`);
        const data = await res.json();

        if (!res.ok) throw new Error(data.error || 'Failed to load shared chat');
        return data;
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
    },

    async listDismissedBlockers() {
        const userId = getUserId();
        if (!userId) return [];

        try {
            const res = await fetch(`${API_BASE_URL}/api/blockers/dismissed?userId=${userId}`);
            if (!res.ok) return [];
            return await res.json();
        } catch (error) {
            console.error('Fetch dismissed blockers failed:', error);
            return [];
        }
    },

    async dismissBlocker(blockerId) {
        const userId = getUserId();
        if (!userId) throw new Error('Not authenticated');

        try {
            const res = await fetch(`${API_BASE_URL}/api/blockers/dismiss`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId, blockerId })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to dismiss blocker');
            return data;
        } catch (error) {
            console.error('Dismiss blocker failed:', error);
            throw error;
        }
    }
};

export default api;
