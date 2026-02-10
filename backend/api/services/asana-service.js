import { ApiClient, WorkspacesApi, ProjectsApi, TasksApi } from 'asana';
import dotenv from 'dotenv';
import logger from '../utils/logger.js';

dotenv.config();

const ASANA_CLIENT_ID = process.env.ASANA_CLIENT_ID;
const ASANA_CLIENT_SECRET = process.env.ASANA_CLIENT_SECRET;

class AsanaService {
    constructor() {
        // Client will be created per-user with their token
    }

    createApiClient(accessToken) {
        try {
            if (!accessToken) {
                throw new Error('Access token is required');
            }
            // Create a new ApiClient instance for each request to avoid token conflicts
            const apiClient = new ApiClient();
            apiClient.authentications['token'].accessToken = accessToken;
            return apiClient;
        } catch (error) {
            logger.error('Failed to create Asana API client:', error);
            throw error;
        }
    }

    // Refresh the access token using the refresh token
    async refreshAccessToken(refreshToken) {
        try {
            if (!refreshToken) {
                throw new Error('Refresh token is required');
            }

            const response = await fetch('https://app.asana.com/-/oauth_token', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                body: new URLSearchParams({
                    grant_type: 'refresh_token',
                    client_id: ASANA_CLIENT_ID,
                    client_secret: ASANA_CLIENT_SECRET,
                    refresh_token: refreshToken
                })
            });

            if (!response.ok) {
                const errorData = await response.text();
                logger.error('Failed to refresh token:', errorData);
                throw new Error('Failed to refresh access token');
            }

            const tokenData = await response.json();
            logger.info('Successfully refreshed Asana access token');

            return {
                accessToken: tokenData.access_token,
                refreshToken: tokenData.refresh_token || refreshToken, // Some OAuth providers return a new refresh token
                expiresIn: tokenData.expires_in
            };
        } catch (error) {
            logger.error('Token refresh failed:', error);
            throw error;
        }
    }

    async getWorkspaces(accessToken) {
        try {
            const apiClient = this.createApiClient(accessToken);
            const workspacesApi = new WorkspacesApi(apiClient);
            const result = await workspacesApi.getWorkspaces();
            return result.data;
        } catch (error) {
            logger.error('Failed to get workspaces:', error);
            throw new Error(`Asana API Error: ${error.message}`);
        }
    }

    async getProjects(accessToken, workspaceId) {
        try {
            const apiClient = this.createApiClient(accessToken);
            const projectsApi = new ProjectsApi(apiClient);
            const result = await projectsApi.getProjectsForWorkspace(workspaceId, {
                opt_fields: 'name,due_date,completed,archived,notes,members,owner'
            });
            return result.data;
        } catch (error) {
            logger.error('Failed to get projects:', error);
            throw new Error(`Asana API Error: ${error.message}`);
        }
    }

    async getTasksForProject(accessToken, projectId) {
        try {
            const apiClient = this.createApiClient(accessToken);
            const tasksApi = new TasksApi(apiClient);
            const result = await tasksApi.getTasksForProject(projectId, {
                opt_fields: 'name,completed,due_on,assignee,notes,tags,num_subtasks,completed_at,created_at'
            });
            return result.data;
        } catch (error) {
            logger.error('Failed to get tasks:', error);
            throw new Error(`Asana API Error: ${error.message}`);
        }
    }

    async getAllTasks(accessToken, workspaceId) {
        try {
            const apiClient = this.createApiClient(accessToken);
            const tasksApi = new TasksApi(apiClient);

            // Get tasks assigned to the current user only
            // Getting ALL workspace tasks requires different API call and pagination
            const result = await tasksApi.getTasks({
                workspace: workspaceId,
                assignee: 'me', // Only get tasks assigned to authenticated user
                opt_fields: 'name,completed,due_on,assignee,assignee.name,notes,projects,projects.name,tags',
                completed_since: 'now' // Only incomplete tasks and recently completed
            });

            return result.data;
        } catch (error) {
            logger.error('Failed to get all tasks:', error);

            // If the above fails, try getting projects and their tasks instead
            try {
                logger.info('Falling back to project-based task collection');
                const projects = await this.getProjects(accessToken, workspaceId);
                const allTasks = [];

                // Get tasks from first 5 projects only (to avoid rate limits)
                const projectsToCheck = projects.slice(0, 5);

                for (const project of projectsToCheck) {
                    try {
                        const projectTasks = await this.getTasksForProject(accessToken, project.gid);
                        allTasks.push(...projectTasks);
                    } catch (err) {
                        logger.error(`Failed to get tasks for project ${project.gid}:`, err);
                        // Continue with other projects
                    }
                }

                return allTasks;
            } catch (fallbackError) {
                logger.error('Fallback method also failed:', fallbackError);
                throw new Error(`Asana API Error: ${error.message}`);
            }
        }
    }

    // Get tasks with upcoming deadlines (due within X days)
    async getUpcomingDeadlines(accessToken, workspaceId, days = 7) {
        try {
            const allTasks = await this.getAllTasksFromProjects(accessToken, workspaceId);
            const now = new Date();
            const futureDate = new Date();
            futureDate.setDate(now.getDate() + days);

            const upcomingTasks = allTasks.filter(task => {
                if (!task.due_on || task.completed) return false;
                const dueDate = new Date(task.due_on);
                return dueDate >= now && dueDate <= futureDate;
            });

            // Sort by due date (earliest first)
            upcomingTasks.sort((a, b) => new Date(a.due_on) - new Date(b.due_on));

            return upcomingTasks;
        } catch (error) {
            logger.error('Failed to get upcoming deadlines:', error);
            throw new Error(`Asana API Error: ${error.message}`);
        }
    }

    // Get overdue tasks
    async getOverdueTasks(accessToken, workspaceId) {
        try {
            const allTasks = await this.getAllTasksFromProjects(accessToken, workspaceId);
            const now = new Date();
            now.setHours(0, 0, 0, 0); // Start of today

            const overdueTasks = allTasks.filter(task => {
                if (!task.due_on || task.completed) return false;
                const dueDate = new Date(task.due_on);
                return dueDate < now;
            });

            // Sort by due date (most overdue first)
            overdueTasks.sort((a, b) => new Date(a.due_on) - new Date(b.due_on));

            return overdueTasks;
        } catch (error) {
            logger.error('Failed to get overdue tasks:', error);
            throw new Error(`Asana API Error: ${error.message}`);
        }
    }

    // Get all tasks from all projects (for deadline/overdue calculations)
    async getAllTasksFromProjects(accessToken, workspaceId) {
        try {
            const projects = await this.getProjects(accessToken, workspaceId);
            const allTasks = [];

            // Get tasks from all active (non-archived) projects
            const activeProjects = projects.filter(p => !p.archived);

            // Limit to first 10 projects to avoid rate limits
            const projectsToCheck = activeProjects.slice(0, 10);

            for (const project of projectsToCheck) {
                try {
                    const apiClient = this.createApiClient(accessToken);
                    const tasksApi = new TasksApi(apiClient);
                    const result = await tasksApi.getTasksForProject(project.gid, {
                        opt_fields: 'name,completed,due_on,assignee,assignee.name,notes,projects,projects.name,tags,created_at'
                    });

                    // Add project info to each task
                    const tasksWithProject = result.data.map(task => ({
                        ...task,
                        project: { gid: project.gid, name: project.name }
                    }));

                    allTasks.push(...tasksWithProject);
                } catch (err) {
                    logger.error(`Failed to get tasks for project ${project.gid}:`, err);
                    // Continue with other projects
                }
            }

            // Remove duplicates (tasks can be in multiple projects)
            const uniqueTasks = allTasks.filter((task, index, self) =>
                index === self.findIndex(t => t.gid === task.gid)
            );

            return uniqueTasks;
        } catch (error) {
            logger.error('Failed to get all tasks from projects:', error);
            throw new Error(`Asana API Error: ${error.message}`);
        }
    }

    // Get deadline summary (combines overdue and upcoming)
    async getDeadlineSummary(accessToken, workspaceId) {
        try {
            const [overdue, upcoming] = await Promise.all([
                this.getOverdueTasks(accessToken, workspaceId),
                this.getUpcomingDeadlines(accessToken, workspaceId, 7)
            ]);

            // Categorize upcoming by urgency
            const now = new Date();
            const dueTodayEnd = new Date();
            dueTodayEnd.setHours(23, 59, 59, 999);

            const tomorrowEnd = new Date();
            tomorrowEnd.setDate(now.getDate() + 1);
            tomorrowEnd.setHours(23, 59, 59, 999);

            const thisWeekEnd = new Date();
            thisWeekEnd.setDate(now.getDate() + 7);

            const dueToday = upcoming.filter(t => new Date(t.due_on) <= dueTodayEnd);
            const dueTomorrow = upcoming.filter(t => {
                const due = new Date(t.due_on);
                return due > dueTodayEnd && due <= tomorrowEnd;
            });
            const dueThisWeek = upcoming.filter(t => {
                const due = new Date(t.due_on);
                return due > tomorrowEnd && due <= thisWeekEnd;
            });

            return {
                overdue: {
                    count: overdue.length,
                    tasks: overdue.slice(0, 10) // Limit to first 10
                },
                dueToday: {
                    count: dueToday.length,
                    tasks: dueToday
                },
                dueTomorrow: {
                    count: dueTomorrow.length,
                    tasks: dueTomorrow
                },
                dueThisWeek: {
                    count: dueThisWeek.length,
                    tasks: dueThisWeek.slice(0, 10) // Limit to first 10
                },
                totalAtRisk: overdue.length + dueToday.length
            };
        } catch (error) {
            logger.error('Failed to get deadline summary:', error);
            throw new Error(`Asana API Error: ${error.message}`);
        }
    }

    calculateProjectHealth(tasks) {
        try {
            const total = tasks.length;
            const completed = tasks.filter(t => t.completed).length;
            const overdue = tasks.filter(t => {
                if (!t.due_on || t.completed) return false;
                return new Date(t.due_on) < new Date();
            }).length;

            const onTrack = tasks.filter(t => {
                if (!t.due_on || t.completed) return false;
                const daysUntilDue = Math.floor((new Date(t.due_on) - new Date()) / (1000 * 60 * 60 * 24));
                return daysUntilDue >= 0;
            }).length;

            const completionRate = total > 0 ? (completed / total) * 100 : 0;
            const overdueRate = total > 0 ? (overdue / total) * 100 : 0;

            let healthStatus = 'healthy';
            if (overdueRate > 20) healthStatus = 'at-risk';
            if (overdueRate > 40) healthStatus = 'critical';

            return {
                total,
                completed,
                overdue,
                onTrack,
                completionRate: Math.round(completionRate),
                overdueRate: Math.round(overdueRate),
                healthStatus
            };
        } catch (error) {
            logger.error('Failed to calculate project health:', error);
            // Return default health object
            return {
                total: 0,
                completed: 0,
                overdue: 0,
                onTrack: 0,
                completionRate: 0,
                overdueRate: 0,
                healthStatus: 'unknown'
            };
        }
    }
}

export default new AsanaService();