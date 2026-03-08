import express from 'express';
import jiraService from '../services/jira-service.js';
import aiProcessor from '../services/ai-processor.js';
import { db } from '../services/supabase-client.js';
import logger from '../utils/logger.js';
import { buildProjectInsightsFromTasks, mergeProjectInsights } from '../utils/project-insights.js';

const router = express.Router();

function isUnauthorizedError(error) {
    return error?.status === 401 || error?.status === 403;
}

async function persistJiraIntegration(userId, integration, teamId, tokens = {}) {
    const scope = integration?.scope || (teamId ? 'team' : 'personal');
    const effectiveTeamId = teamId || integration?.team_id || null;

    const payload = {
        accessToken: tokens.accessToken || integration?.access_token,
        refreshToken: tokens.refreshToken !== undefined ? tokens.refreshToken : integration?.refresh_token,
        expiresAt: tokens.expiresAt !== undefined ? tokens.expiresAt : integration?.expires_at,
        workspaceId: tokens.workspaceId !== undefined ? tokens.workspaceId : integration?.workspace_id,
        workspaceName: tokens.workspaceName !== undefined ? tokens.workspaceName : integration?.workspace_name
    };

    if (scope === 'team') {
        payload.teamId = effectiveTeamId;
    }

    await db.saveIntegration(userId, 'jira', payload, scope);
}

async function resolveJiraContext(userId, teamId) {
    const integration = await db.getIntegration(userId, 'jira', teamId);
    if (!integration) {
        const error = new Error('Jira not connected');
        error.status = 401;
        throw error;
    }

    let accessToken = integration.access_token;
    let refreshToken = integration.refresh_token;
    let workspace;

    const resolveWorkspace = async () => jiraService.resolveWorkspace(accessToken, integration.workspace_id);

    try {
        workspace = await resolveWorkspace();
    } catch (error) {
        if (isUnauthorizedError(error) && refreshToken) {
            const refreshed = await jiraService.refreshAccessToken(refreshToken);
            accessToken = refreshed.accessToken;
            refreshToken = refreshed.refreshToken;

            await persistJiraIntegration(userId, integration, teamId, {
                accessToken,
                refreshToken,
                expiresAt: Number.isFinite(refreshed.expiresIn)
                    ? new Date(Date.now() + refreshed.expiresIn * 1000).toISOString()
                    : integration.expires_at
            });

            workspace = await resolveWorkspace();
        } else {
            throw error;
        }
    }

    const workspaceChanged = workspace?.cloudId
        && (workspace.cloudId !== integration.workspace_id || workspace.name !== integration.workspace_name);

    if (workspaceChanged) {
        await persistJiraIntegration(userId, integration, teamId, {
            accessToken,
            refreshToken,
            workspaceId: workspace.cloudId,
            workspaceName: workspace.name
        });
    }

    return {
        integration,
        accessToken,
        cloudId: workspace?.cloudId || integration.workspace_id,
        baseUrl: workspace?.url || null
    };
}

function filterTasks(tasks, status, projectId) {
    let filtered = Array.isArray(tasks) ? tasks : [];

    if (projectId) {
        filtered = filtered.filter((task) => task?.project?.gid === projectId || task?.project?.id === projectId);
    }

    if (status === 'completed') {
        filtered = filtered.filter((task) => task.completed);
    } else if (status === 'incomplete') {
        filtered = filtered.filter((task) => !task.completed);
    } else if (status === 'overdue') {
        filtered = filtered.filter((task) => !task.completed && task.due_on && new Date(task.due_on) < new Date());
    }

    filtered.sort((first, second) => {
        if (!first?.due_on) return 1;
        if (!second?.due_on) return -1;
        return new Date(first.due_on) - new Date(second.due_on);
    });

    return filtered;
}

router.get('/projects', async (req, res) => {
    try {
        const { userId, teamId } = req.query;
        if (!userId) {
            return res.status(400).json({ error: 'userId required' });
        }

        const { accessToken, cloudId, baseUrl } = await resolveJiraContext(userId, teamId);
        const projects = await jiraService.getProjects(accessToken, cloudId, baseUrl);
        return res.json({ projects });
    } catch (error) {
        logger.error('Failed to get Jira projects:', error);
        return res.status(error.status || 500).json({ error: error.message });
    }
});

router.get('/projects/:projectId/health', async (req, res) => {
    try {
        const { userId, teamId } = req.query;
        const { projectId } = req.params;
        if (!userId) {
            return res.status(400).json({ error: 'userId required' });
        }

        const { accessToken, cloudId, baseUrl } = await resolveJiraContext(userId, teamId);
        const tasks = await jiraService.getTasksForProject(accessToken, cloudId, projectId, baseUrl);
        const health = jiraService.calculateProjectHealth(tasks);
        const projectName = tasks?.[0]?.project?.name || 'Jira Project';
        const dataInsights = buildProjectInsightsFromTasks(tasks, health, {
            platformLabel: 'Jira',
            projectName
        });

        let aiResponse = null;
        try {
            aiResponse = await aiProcessor.analyzeAsanaTasks(tasks, projectName);
        } catch (analysisError) {
            logger.warn('Skipping Jira AI analysis due to AI processor failure', {
                projectId,
                error: analysisError.message
            });
        }

        const aiInsights = mergeProjectInsights(dataInsights, aiResponse);

        return res.json({
            health,
            aiAnalysis: aiInsights.summary,
            aiInsights,
            tasks: tasks.slice(0, 10)
        });
    } catch (error) {
        logger.error('Failed to get Jira project health:', error);
        return res.status(error.status || 500).json({ error: error.message });
    }
});

router.get('/workload', async (req, res) => {
    try {
        const { userId, teamId } = req.query;
        if (!userId) {
            return res.status(400).json({ error: 'userId required' });
        }

        const { accessToken, cloudId, baseUrl } = await resolveJiraContext(userId, teamId);
        const workloadData = await jiraService.getWorkloadSummary(accessToken, cloudId, baseUrl);
        return res.json(workloadData);
    } catch (error) {
        logger.error('Failed to get Jira workload:', error);
        return res.status(error.status || 500).json({ error: error.message });
    }
});

router.get('/deadlines', async (req, res) => {
    try {
        const { userId, teamId } = req.query;
        if (!userId) {
            return res.status(400).json({ error: 'userId required' });
        }

        const { accessToken, cloudId, baseUrl } = await resolveJiraContext(userId, teamId);
        const deadlines = await jiraService.getDeadlineSummary(accessToken, cloudId, baseUrl);
        return res.json(deadlines);
    } catch (error) {
        logger.error('Failed to get Jira deadlines:', error);
        return res.status(error.status || 500).json({ error: error.message });
    }
});

router.get('/tasks', async (req, res) => {
    try {
        const { userId, teamId, status, projectId } = req.query;
        if (!userId) {
            return res.status(400).json({ error: 'userId required' });
        }

        const { accessToken, cloudId, baseUrl } = await resolveJiraContext(userId, teamId);
        const tasks = await jiraService.getAllTasksFromProjects(accessToken, cloudId, baseUrl);
        const filteredTasks = filterTasks(tasks, status, projectId);

        return res.json({
            tasks: filteredTasks,
            total: filteredTasks.length,
            stats: {
                completed: tasks.filter((task) => task.completed).length,
                incomplete: tasks.filter((task) => !task.completed).length,
                overdue: tasks.filter((task) => !task.completed && task.due_on && new Date(task.due_on) < new Date()).length
            }
        });
    } catch (error) {
        logger.error('Failed to get Jira tasks:', error);
        return res.status(error.status || 500).json({ error: error.message });
    }
});

export default router;
