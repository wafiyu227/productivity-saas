import express from 'express';
import trelloService from '../services/trello-service.js';
import aiProcessor from '../services/ai-processor.js';
import { db } from '../services/supabase-client.js';
import logger from '../utils/logger.js';
import { buildProjectInsightsFromTasks, mergeProjectInsights } from '../utils/project-insights.js';

const router = express.Router();

async function getTrelloIntegration(userId, teamId) {
    const integration = await db.getIntegration(userId, 'trello', teamId);
    if (!integration) {
        const error = new Error('Trello not connected');
        error.status = 401;
        throw error;
    }
    return integration;
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

        const integration = await getTrelloIntegration(userId, teamId);
        const projects = await trelloService.getProjects(integration.access_token, integration.workspace_id);

        return res.json({ projects });
    } catch (error) {
        logger.error('Failed to get Trello projects:', error);
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

        const integration = await getTrelloIntegration(userId, teamId);
        const tasks = await trelloService.getTasksForProject(integration.access_token, projectId);
        const health = trelloService.calculateProjectHealth(tasks);
        const projectName = tasks?.[0]?.project?.name || 'Trello Project';
        const dataInsights = buildProjectInsightsFromTasks(tasks, health, {
            platformLabel: 'Trello',
            projectName
        });

        let aiResponse = null;
        try {
            aiResponse = await aiProcessor.analyzeAsanaTasks(tasks, projectName);
        } catch (analysisError) {
            logger.warn('Skipping Trello AI analysis due to AI processor failure', {
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
        logger.error('Failed to get Trello project health:', error);
        return res.status(error.status || 500).json({ error: error.message });
    }
});

router.get('/workload', async (req, res) => {
    try {
        const { userId, teamId } = req.query;
        if (!userId) {
            return res.status(400).json({ error: 'userId required' });
        }

        const integration = await getTrelloIntegration(userId, teamId);
        const workload = await trelloService.getWorkloadSummary(integration.access_token, integration.workspace_id);

        return res.json(workload);
    } catch (error) {
        logger.error('Failed to get Trello workload:', error);
        return res.status(error.status || 500).json({ error: error.message });
    }
});

router.get('/deadlines', async (req, res) => {
    try {
        const { userId, teamId } = req.query;
        if (!userId) {
            return res.status(400).json({ error: 'userId required' });
        }

        const integration = await getTrelloIntegration(userId, teamId);
        const deadlines = await trelloService.getDeadlineSummary(integration.access_token, integration.workspace_id);

        return res.json(deadlines);
    } catch (error) {
        logger.error('Failed to get Trello deadlines:', error);
        return res.status(error.status || 500).json({ error: error.message });
    }
});

router.get('/tasks', async (req, res) => {
    try {
        const { userId, teamId, status, projectId } = req.query;
        if (!userId) {
            return res.status(400).json({ error: 'userId required' });
        }

        const integration = await getTrelloIntegration(userId, teamId);
        const tasks = await trelloService.getAllCardsFromBoards(integration.access_token, integration.workspace_id);
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
        logger.error('Failed to get Trello tasks:', error);
        return res.status(error.status || 500).json({ error: error.message });
    }
});

export default router;
