import Asana from 'asana';
import dotenv from 'dotenv';
import logger from '../utils/logger.js';

dotenv.config();

class AsanaService {
    constructor() {
        // Client will be created per-user with their token
    }

    createClient(accessToken) {
        return Asana.ApiClient.instance.authentications['oauth2'].accessToken = accessToken;
    }

    async getWorkspaces(accessToken) {
        try {
            const client = Asana.Client.create({ token: accessToken });
            const workspaces = await client.workspaces.getWorkspaces();
            return workspaces.data;
        } catch (error) {
            logger.error('Failed to get workspaces:', error);
            throw error;
        }
    }

    async getProjects(accessToken, workspaceId) {
        try {
            const client = Asana.Client.create({ token: accessToken });
            const projects = await client.projects.getProjectsForWorkspace(workspaceId, {
                opt_fields: 'name,due_date,completed,archived,notes,members,owner'
            });
            return projects.data;
        } catch (error) {
            logger.error('Failed to get projects:', error);
            throw error;
        }
    }

    async getTasksForProject(accessToken, projectId) {
        try {
            const client = Asana.Client.create({ token: accessToken });
            const tasks = await client.tasks.getTasksForProject(projectId, {
                opt_fields: 'name,completed,due_on,assignee,notes,tags,num_subtasks,completed_at,created_at'
            });
            return tasks.data;
        } catch (error) {
            logger.error('Failed to get tasks:', error);
            throw error;
        }
    }

    async getAllTasks(accessToken, workspaceId) {
        try {
            const client = Asana.Client.create({ token: accessToken });
            const tasks = await client.tasks.getTasks({
                workspace: workspaceId,
                opt_fields: 'name,completed,due_on,assignee,notes,projects,tags',
                completed_since: 'now'
            });
            return tasks.data;
        } catch (error) {
            logger.error('Failed to get all tasks:', error);
            throw error;
        }
    }

    calculateProjectHealth(tasks) {
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
    }
}

export default new AsanaService();