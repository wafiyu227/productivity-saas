import Asana from 'asana';
import dotenv from 'dotenv';
import logger from '../utils/logger.js';

dotenv.config();

class AsanaService {
    constructor() {
        // Client will be created per-user with their token
    }

    createClient(accessToken) {
        try {
            if (!accessToken) {
                throw new Error('Access token is required');
            }
            return Asana.Client.create({ token: accessToken });
        } catch (error) {
            logger.error('Failed to create Asana client:', error);
            throw error;
        }
    }

    async getWorkspaces(accessToken) {
        try {
            const client = this.createClient(accessToken);
            const workspaces = await client.workspaces.getWorkspaces();
            return workspaces.data;
        } catch (error) {
            logger.error('Failed to get workspaces:', error);
            throw new Error(`Asana API Error: ${error.message}`);
        }
    }

    async getProjects(accessToken, workspaceId) {
        try {
            const client = this.createClient(accessToken);
            const projects = await client.projects.getProjectsForWorkspace(workspaceId, {
                opt_fields: 'name,due_date,completed,archived,notes,members,owner'
            });
            return projects.data;
        } catch (error) {
            logger.error('Failed to get projects:', error);
            throw new Error(`Asana API Error: ${error.message}`);
        }
    }

    async getTasksForProject(accessToken, projectId) {
        try {
            const client = this.createClient(accessToken);
            const tasks = await client.tasks.getTasksForProject(projectId, {
                opt_fields: 'name,completed,due_on,assignee,notes,tags,num_subtasks,completed_at,created_at'
            });
            return tasks.data;
        } catch (error) {
            logger.error('Failed to get tasks:', error);
            throw new Error(`Asana API Error: ${error.message}`);
        }
    }

    async getAllTasks(accessToken, workspaceId) {
        try {
            const client = this.createClient(accessToken);

            // FIXED: Get tasks assigned to the current user only
            // Getting ALL workspace tasks requires different API call and pagination
            const tasks = await client.tasks.getTasks({
                workspace: workspaceId,
                assignee: 'me', // Only get tasks assigned to authenticated user
                opt_fields: 'name,completed,due_on,assignee,notes,projects,tags',
                completed_since: 'now' // Only incomplete tasks and recently completed
            });

            return tasks.data;
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