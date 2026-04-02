import dotenv from 'dotenv';
import logger from '../utils/logger.js';

dotenv.config();

const JIRA_CLIENT_ID = process.env.JIRA_CLIENT_ID;
const JIRA_CLIENT_SECRET = process.env.JIRA_CLIENT_SECRET;
const JIRA_REQUEST_TIMEOUT_MS = Number.parseInt(process.env.JIRA_REQUEST_TIMEOUT_MS || '15000', 10);
const JIRA_PROJECT_LIMIT = Number.parseInt(process.env.JIRA_PROJECT_LIMIT || '10', 10);
const JIRA_ISSUES_PER_PROJECT_LIMIT = Number.parseInt(process.env.JIRA_ISSUES_PER_PROJECT_LIMIT || '100', 10);

const ISSUE_FIELDS = [
    'summary',
    'status',
    'assignee',
    'duedate',
    'created',
    'updated',
    'resolutiondate',
    'project',
    'priority'
];

function withTimeout(timeoutMs = JIRA_REQUEST_TIMEOUT_MS) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    return { controller, timer };
}

function escapeJqlValue(value) {
    return String(value || '')
        .replace(/\\/g, '\\\\')
        .replace(/"/g, '\\"');
}

function buildProjectJql(projectId) {
    const normalized = String(projectId || '').trim();
    if (!normalized) {
        throw new Error('projectId is required');
    }

    if (/^\d+$/.test(normalized)) {
        return `project = ${normalized}`;
    }

    return `project = "${escapeJqlValue(normalized)}"`;
}

function getAdfText(node) {
    if (!node) return '';
    if (typeof node === 'string') return node;
    if (Array.isArray(node)) {
        return node.map(getAdfText).join(' ').trim();
    }
    if (typeof node === 'object') {
        if (typeof node.text === 'string') return node.text;
        if (node.content) return getAdfText(node.content);
    }
    return '';
}

class JiraService {
    ensureOAuthConfigured() {
        if (!JIRA_CLIENT_ID || !JIRA_CLIENT_SECRET) {
            throw new Error('Jira OAuth is not configured on the server');
        }
    }

    async requestJson(url, accessToken, options = {}) {
        if (!accessToken) {
            throw new Error('Jira access token is required');
        }

        const method = options?.method || 'GET';
        const body = options?.body;
        const { controller, timer } = withTimeout();
        try {
            const headers = {
                'Authorization': `Bearer ${accessToken}`,
                'Accept': 'application/json'
            };

            if (body !== undefined && body !== null) {
                headers['Content-Type'] = 'application/json';
            }

            const requestInit = {
                method,
                headers,
                signal: controller.signal
            };

            if (body !== undefined && body !== null) {
                requestInit.body = typeof body === 'string' ? body : JSON.stringify(body);
            }

            const response = await fetch(url, {
                ...requestInit
            });

            if (!response.ok) {
                const errorText = await response.text();
                logger.error('Jira API request failed', {
                    url,
                    method,
                    status: response.status,
                    error: errorText
                });
                const error = new Error(`Jira API Error: ${response.status}`);
                error.status = response.status;
                throw error;
            }

            if (response.status === 204) {
                return null;
            }

            const text = await response.text();
            if (!text) {
                return null;
            }

            return JSON.parse(text);
        } catch (error) {
            if (error.name === 'AbortError') {
                const timeoutError = new Error('Jira API request timed out');
                timeoutError.status = 504;
                throw timeoutError;
            }
            throw error;
        } finally {
            clearTimeout(timer);
        }
    }

    async refreshAccessToken(refreshToken) {
        this.ensureOAuthConfigured();
        if (!refreshToken) {
            throw new Error('Jira refresh token is required');
        }

        const { controller, timer } = withTimeout();
        try {
            const response = await fetch('https://auth.atlassian.com/oauth/token', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify({
                    grant_type: 'refresh_token',
                    client_id: JIRA_CLIENT_ID,
                    client_secret: JIRA_CLIENT_SECRET,
                    refresh_token: refreshToken
                }),
                signal: controller.signal
            });

            if (!response.ok) {
                const errorText = await response.text();
                logger.error('Jira token refresh failed', { status: response.status, error: errorText });
                const error = new Error('Failed to refresh Jira access token');
                error.status = response.status;
                throw error;
            }

            const data = await response.json();
            return {
                accessToken: data.access_token,
                refreshToken: data.refresh_token || refreshToken,
                expiresIn: data.expires_in
            };
        } finally {
            clearTimeout(timer);
        }
    }

    async getAccessibleResources(accessToken) {
        return this.requestJson('https://api.atlassian.com/oauth/token/accessible-resources', accessToken);
    }

    async resolveWorkspace(accessToken, preferredWorkspaceId = null) {
        const resources = await this.getAccessibleResources(accessToken);
        const list = Array.isArray(resources) ? resources : [];
        if (list.length === 0) {
            const error = new Error('No Jira cloud resources are accessible for this account');
            error.status = 403;
            throw error;
        }

        const preferred = preferredWorkspaceId
            ? list.find((resource) => resource?.id === preferredWorkspaceId)
            : null;
        const workspace = preferred || list[0];

        return {
            cloudId: workspace?.id,
            name: workspace?.name || workspace?.url || 'Jira',
            url: workspace?.url || null
        };
    }

    async jiraRequest(accessToken, cloudId, endpoint, params = {}) {
        if (!cloudId) {
            throw new Error('Jira cloudId is required');
        }

        const url = new URL(`https://api.atlassian.com/ex/jira/${cloudId}/rest/api/3/${endpoint}`);
        Object.entries(params).forEach(([key, value]) => {
            if (value !== undefined && value !== null && value !== '') {
                url.searchParams.append(key, String(value));
            }
        });

        return this.requestJson(url.toString(), accessToken);
    }

    normalizeProject(project, baseUrl = null) {
        const notes = typeof project?.description === 'string'
            ? project.description
            : getAdfText(project?.description);

        return {
            gid: project?.id,
            id: project?.id,
            key: project?.key,
            name: project?.name || project?.key || 'Untitled project',
            notes: notes || '',
            archived: Boolean(project?.archived),
            completed: false,
            due_date: null,
            owner: project?.lead?.displayName ? { name: project.lead.displayName } : null,
            url: project?.key && baseUrl ? `${baseUrl.replace(/\/$/, '')}/projects/${project.key}` : null
        };
    }

    normalizeIssue(issue, baseUrl = null) {
        const fields = issue?.fields || {};
        const statusName = String(fields?.status?.name || '').toLowerCase();
        const statusCategory = String(fields?.status?.statusCategory?.key || '').toLowerCase();
        const completed = statusCategory === 'done'
            || Boolean(fields?.resolutiondate)
            || ['done', 'closed', 'resolved'].includes(statusName);

        const dueOn = fields?.duedate || null;
        const assigneeName = fields?.assignee?.displayName || fields?.assignee?.emailAddress || null;
        const issueKey = issue?.key || null;

        return {
            gid: issue?.id || issueKey,
            id: issue?.id || issueKey,
            key: issueKey,
            name: fields?.summary || `Issue ${issueKey || ''}`.trim(),
            notes: '',
            completed,
            due_on: dueOn,
            due_at: dueOn,
            assignee: assigneeName ? { name: assigneeName } : null,
            members: assigneeName ? [{ id: fields?.assignee?.accountId || null, name: assigneeName }] : [],
            project: {
                gid: fields?.project?.id || null,
                id: fields?.project?.id || null,
                key: fields?.project?.key || null,
                name: fields?.project?.name || 'Jira'
            },
            status_name: fields?.status?.name || null,
            status_category: fields?.status?.statusCategory?.key || null,
            priority: fields?.priority?.name || null,
            externalUrl: issueKey && baseUrl ? `${baseUrl.replace(/\/$/, '')}/browse/${issueKey}` : null,
            created_at: fields?.created || fields?.updated || new Date().toISOString(),
            updated_at: fields?.updated || fields?.created || new Date().toISOString()
        };
    }

    async getProjects(accessToken, cloudId, baseUrl = null) {
        const projects = [];
        let startAt = 0;
        const maxResults = 50;
        let total = null;

        while (total === null || startAt < total) {
            const data = await this.jiraRequest(accessToken, cloudId, 'project/search', {
                startAt,
                maxResults,
                orderBy: 'name'
            });

            const values = Array.isArray(data?.values) ? data.values : [];
            values.forEach((project) => projects.push(this.normalizeProject(project, baseUrl)));

            total = Number.isFinite(data?.total) ? data.total : values.length;
            startAt += values.length;

            if (values.length === 0) break;
            if (projects.length >= JIRA_PROJECT_LIMIT * 2) break;
        }

        return projects.slice(0, JIRA_PROJECT_LIMIT * 2);
    }

    async searchIssues(accessToken, cloudId, jql, options = {}) {
        const {
            maxResults = 50,
            startAt = 0,
            fields = ISSUE_FIELDS
        } = options;

        const fieldList = Array.isArray(fields) ? fields : String(fields || '').split(',').map((field) => field.trim()).filter(Boolean);
        const baseUrl = `https://api.atlassian.com/ex/jira/${cloudId}/rest/api/3`;

        try {
            // Preferred endpoint after Jira search API migration.
            return await this.requestJson(`${baseUrl}/search/jql`, accessToken, {
                method: 'POST',
                body: {
                    jql,
                    maxResults,
                    fields: fieldList
                }
            });
        } catch (enhancedError) {
            if (![400, 404, 405, 410].includes(enhancedError?.status)) {
                throw enhancedError;
            }
        }

        try {
            // Legacy endpoint fallback for older tenants.
            return await this.requestJson(`${baseUrl}/search`, accessToken, {
                method: 'POST',
                body: {
                    jql,
                    startAt,
                    maxResults,
                    fields: fieldList
                }
            });
        } catch (legacyError) {
            if (![404, 405, 410].includes(legacyError?.status)) {
                throw legacyError;
            }
        }

        // Final fallback.
        return this.jiraRequest(accessToken, cloudId, 'search/jql', {
            jql,
            maxResults,
            fields: fieldList.join(',')
        });
    }

    async getTasksForProject(accessToken, cloudId, projectId, baseUrl = null) {
        const jql = `${buildProjectJql(projectId)} ORDER BY updated DESC`;
        const data = await this.searchIssues(accessToken, cloudId, jql, {
            maxResults: JIRA_ISSUES_PER_PROJECT_LIMIT
        });
        const issues = Array.isArray(data?.issues) ? data.issues : [];
        return issues.map((issue) => this.normalizeIssue(issue, baseUrl));
    }

    async getIssueByKey(accessToken, cloudId, issueKey, baseUrl = null) {
        if (!issueKey) {
            throw new Error('issueKey is required');
        }

        const data = await this.jiraRequest(accessToken, cloudId, `issue/${encodeURIComponent(issueKey)}`, {
            fields: ISSUE_FIELDS.join(',')
        });

        return this.normalizeIssue(data, baseUrl);
    }

    async getIssueTransitions(accessToken, cloudId, issueKey) {
        if (!issueKey) {
            throw new Error('issueKey is required');
        }

        const data = await this.jiraRequest(accessToken, cloudId, `issue/${encodeURIComponent(issueKey)}/transitions`);
        const transitions = Array.isArray(data?.transitions) ? data.transitions : [];

        return transitions.map((transition) => ({
            id: transition?.id,
            name: transition?.name || null,
            to: {
                name: transition?.to?.name || null,
                statusCategory: transition?.to?.statusCategory?.key || null
            }
        }));
    }

    async transitionIssue(accessToken, cloudId, issueKey, transitionId) {
        if (!issueKey || !transitionId) {
            throw new Error('issueKey and transitionId are required');
        }

        await this.requestJson(
            `https://api.atlassian.com/ex/jira/${cloudId}/rest/api/3/issue/${encodeURIComponent(issueKey)}/transitions`,
            accessToken,
            {
                method: 'POST',
                body: {
                    transition: {
                        id: String(transitionId)
                    }
                }
            }
        );
    }

    async addComment(accessToken, cloudId, issueKey, text) {
        if (!issueKey || !text) {
            throw new Error('issueKey and comment text are required');
        }

        return this.requestJson(
            `https://api.atlassian.com/ex/jira/${cloudId}/rest/api/3/issue/${encodeURIComponent(issueKey)}/comment`,
            accessToken,
            {
                method: 'POST',
                body: {
                    body: this.toAdfDocument(text)
                }
            }
        );
    }

    toAdfDocument(text) {
        const lines = String(text || '')
            .split(/\r?\n/)
            .map((line) => line.trim())
            .filter(Boolean);

        if (lines.length === 0) {
            lines.push('');
        }

        return {
            type: 'doc',
            version: 1,
            content: lines.map((line) => ({
                type: 'paragraph',
                content: line
                    ? [{ type: 'text', text: line }]
                    : []
            }))
        };
    }

    async getAllTasksFromProjects(accessToken, cloudId, baseUrl = null) {
        const projects = await this.getProjects(accessToken, cloudId, baseUrl);
        const projectsToCheck = projects.slice(0, JIRA_PROJECT_LIMIT);

        const allTaskLists = await Promise.all(
            projectsToCheck.map(async (project) => {
                try {
                    return await this.getTasksForProject(accessToken, cloudId, project.id || project.key, baseUrl);
                } catch (error) {
                    logger.error(`Failed to fetch Jira issues for project ${project?.id || project?.key}:`, error);
                    return [];
                }
            })
        );

        const flattened = allTaskLists.flat();
        return flattened.filter((task, index, all) => index === all.findIndex((entry) => entry.gid === task.gid));
    }

    async getDeadlineSummary(accessToken, cloudId, baseUrl = null) {
        const allTasks = await this.getAllTasksFromProjects(accessToken, cloudId, baseUrl);
        const openTasksWithDueDates = allTasks.filter((task) => !task.completed && task.due_on);

        const now = new Date();
        const todayStart = new Date(now);
        todayStart.setHours(0, 0, 0, 0);
        const todayEnd = new Date(now);
        todayEnd.setHours(23, 59, 59, 999);
        const tomorrowEnd = new Date(todayEnd);
        tomorrowEnd.setDate(tomorrowEnd.getDate() + 1);
        const weekEnd = new Date(todayEnd);
        weekEnd.setDate(weekEnd.getDate() + 7);

        const overdue = [];
        const dueToday = [];
        const dueTomorrow = [];
        const dueThisWeek = [];

        openTasksWithDueDates.forEach((task) => {
            const dueDate = new Date(task.due_on);
            if (Number.isNaN(dueDate.getTime())) return;

            if (dueDate < todayStart) {
                overdue.push(task);
                return;
            }
            if (dueDate <= todayEnd) {
                dueToday.push(task);
                return;
            }
            if (dueDate <= tomorrowEnd) {
                dueTomorrow.push(task);
                return;
            }
            if (dueDate <= weekEnd) {
                dueThisWeek.push(task);
            }
        });

        const byDueDate = (first, second) => new Date(first.due_on) - new Date(second.due_on);
        overdue.sort(byDueDate);
        dueToday.sort(byDueDate);
        dueTomorrow.sort(byDueDate);
        dueThisWeek.sort(byDueDate);

        return {
            overdue: { count: overdue.length, tasks: overdue.slice(0, 10) },
            dueToday: { count: dueToday.length, tasks: dueToday },
            dueTomorrow: { count: dueTomorrow.length, tasks: dueTomorrow },
            dueThisWeek: { count: dueThisWeek.length, tasks: dueThisWeek.slice(0, 10) },
            totalAtRisk: overdue.length + dueToday.length
        };
    }

    async getWorkloadSummary(accessToken, cloudId, baseUrl = null) {
        const allTasks = await this.getAllTasksFromProjects(accessToken, cloudId, baseUrl);
        const workloadByPerson = {};

        allTasks.forEach((task) => {
            const assignees = Array.isArray(task.members) && task.members.length > 0
                ? task.members.map((member) => member.name)
                : ['Unassigned'];

            assignees.forEach((name) => {
                if (!workloadByPerson[name]) {
                    workloadByPerson[name] = {
                        name,
                        totalTasks: 0,
                        completedTasks: 0,
                        overdueTasks: 0,
                        upcomingTasks: 0
                    };
                }

                workloadByPerson[name].totalTasks += 1;
                if (task.completed) {
                    workloadByPerson[name].completedTasks += 1;
                    return;
                }

                if (!task.due_on) return;
                const dueDate = new Date(task.due_on);
                if (Number.isNaN(dueDate.getTime())) return;
                if (dueDate < new Date()) {
                    workloadByPerson[name].overdueTasks += 1;
                } else {
                    workloadByPerson[name].upcomingTasks += 1;
                }
            });
        });

        const workload = Object.values(workloadByPerson);
        const avgTasks = workload.length > 0
            ? workload.reduce((sum, member) => sum + member.totalTasks, 0) / workload.length
            : 0;

        workload.forEach((member) => {
            member.isOverloaded = member.totalTasks > avgTasks * 1.5;
            member.workloadPercent = avgTasks > 0
                ? Math.round((member.totalTasks / avgTasks) * 100)
                : 100;
        });

        return {
            workload,
            summary: {
                totalMembers: workload.length,
                overloadedMembers: workload.filter((member) => member.isOverloaded).length,
                avgTasksPerMember: Math.round(avgTasks)
            }
        };
    }

    calculateProjectHealth(tasks) {
        const taskList = Array.isArray(tasks) ? tasks : [];
        const total = taskList.length;
        const completed = taskList.filter((task) => task.completed).length;
        const overdue = taskList.filter((task) => {
            if (task.completed || !task.due_on) return false;
            return new Date(task.due_on) < new Date();
        }).length;
        const onTrack = taskList.filter((task) => {
            if (task.completed || !task.due_on) return false;
            return new Date(task.due_on) >= new Date();
        }).length;

        const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;
        const overdueRate = total > 0 ? Math.round((overdue / total) * 100) : 0;

        let healthStatus = 'healthy';
        if (overdueRate > 20) healthStatus = 'at-risk';
        if (overdueRate > 40) healthStatus = 'critical';

        return {
            total,
            completed,
            overdue,
            onTrack,
            completionRate,
            overdueRate,
            healthStatus
        };
    }
}

export default new JiraService();
