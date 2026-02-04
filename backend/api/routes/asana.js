import express from 'express';
import asanaService from '../services/asana-service.js';
import aiProcessor from '../services/ai-processor.js';
import { db } from '../services/supabase-client.js';
import logger from '../utils/logger.js';

const router = express.Router();

// Get all projects for user
router.get('/projects', async (req, res) => {
    try {
        const { userId } = req.query;

        if (!userId) {
            return res.status(400).json({ error: 'userId required' });
        }

        const integration = await db.getIntegration(userId, 'asana');

        if (!integration) {
            return res.status(401).json({ error: 'Asana not connected' });
        }

        const projects = await asanaService.getProjects(
            integration.access_token,
            integration.workspace_id
        );

        // Filter out archived projects
        const activeProjects = projects.filter(p => !p.archived);

        res.json({ projects: activeProjects });
    } catch (error) {
        logger.error('Failed to get projects:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get project health for a specific project
router.get('/projects/:projectId/health', async (req, res) => {
    try {
        const { userId } = req.query;
        const { projectId } = req.params;

        if (!userId) {
            return res.status(400).json({ error: 'userId required' });
        }

        const integration = await db.getIntegration(userId, 'asana');

        if (!integration) {
            return res.status(401).json({ error: 'Asana not connected' });
        }

        // Get tasks for project
        const tasks = await asanaService.getTasksForProject(
            integration.access_token,
            projectId
        );

        // Calculate health metrics
        const health = asanaService.calculateProjectHealth(tasks);

        // Get AI analysis
        const aiAnalysis = await aiProcessor.analyzeAsanaTasks(tasks, 'Project');

        res.json({
            health,
            aiAnalysis,
            tasks: tasks.slice(0, 10) // Return first 10 tasks
        });
    } catch (error) {
        logger.error('Failed to get project health:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get team workload insights
router.get('/workload', async (req, res) => {
    try {
        const { userId } = req.query;

        if (!userId) {
            return res.status(400).json({ error: 'userId required' });
        }

        const integration = await db.getIntegration(userId, 'asana');

        if (!integration) {
            return res.status(401).json({ error: 'Asana not connected' });
        }

        // Get all active tasks
        const tasks = await asanaService.getAllTasks(
            integration.access_token,
            integration.workspace_id
        );

        // Group by assignee
        const workloadByPerson = {};

        tasks.forEach(task => {
            const assignee = task.assignee?.name || 'Unassigned';
            if (!workloadByPerson[assignee]) {
                workloadByPerson[assignee] = {
                    name: assignee,
                    totalTasks: 0,
                    completedTasks: 0,
                    overdueTasks: 0
                };
            }

            workloadByPerson[assignee].totalTasks++;

            if (task.completed) {
                workloadByPerson[assignee].completedTasks++;
            }

            if (!task.completed && task.due_on && new Date(task.due_on) < new Date()) {
                workloadByPerson[assignee].overdueTasks++;
            }
        });

        const workload = Object.values(workloadByPerson);

        res.json({ workload });
    } catch (error) {
        logger.error('Failed to get workload:', error);
        res.status(500).json({ error: error.message });
    }
});

export default router;