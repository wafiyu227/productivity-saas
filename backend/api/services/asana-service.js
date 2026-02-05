import Asana from 'asana';
import dotenv from 'dotenv';
import logger from '../utils/logger.js';

dotenv.config();

class AsanaService {
    constructor() {
        // API Client instance is a singleton in Asana SDK v3
    }

    setupClient(accessToken) {
        const client = Asana.ApiClient.instance;
        const oauth2 = client.authentications['oauth2'];
        oauth2.accessToken = accessToken;
        return client;
    }

    async getWorkspaces(accessToken) {
        try {
            this.setupClient(accessToken);
            const apiInstance = new Asana.WorkspacesApi();
            const result = await apiInstance.getWorkspaces();
            return result.data;
        } catch (error) {
            logger.error('Failed to get workspaces:', error);
            throw error;
        }
    }

    async getProjects(accessToken, workspaceId) {
        try {
            this.setupClient(accessToken);
            const apiInstance = new Asana.ProjectsApi();
            const opts = {
                'opt_fields': 'name,due_date,completed,archived,notes,members,owner'
            };
            const result = await apiInstance.getProjectsForWorkspace(workspaceId, opts);
            return result.data;
        } catch (error) {
            logger.error('Failed to get projects:', error);
            throw error;
        }
    }

    async getTasksForProject(accessToken, projectId) {
        try {
            this.setupClient(accessToken);
            const apiInstance = new Asana.TasksApi();
            const opts = {
                'opt_fields': 'name,completed,due_on,assignee,notes,tags,num_subtasks,completed_at,created_at'
            };
            const result = await apiInstance.getTasksForProject(projectId, opts);
            return result.data;
        } catch (error) {
            logger.error('Failed to get tasks:', error);
            throw error;
        }
    }

    async getAllTasks(accessToken, workspaceId) {
        try {
            this.setupClient(accessToken);
            const apiInstance = new Asana.TasksApi();
            const opts = {
                'workspace': workspaceId,
                'opt_fields': 'name,completed,due_on,assignee,notes,projects,tags',
                'completed_since': 'now'
            };
            const result = await apiInstance.getTasks(opts);
            return result.data;
        } catch (error) {
            logger.error('Failed to get all tasks:', error);
            throw error;
        }
    }

    calculateProjectHealth(tasks) {
        if (!tasks || !Array.isArray(tasks)) {
            return {
                total: 0, completed: 0, overdue: 0, onTrack: 0,
                completionRate: 0, overdueRate: 0, healthStatus: 'healthy'
            };
        }

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