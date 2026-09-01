import express from 'express';
import asanaService from '../services/asana-service.js';
import aiProcessor from '../services/ai-processor.js';
import { db } from '../services/supabase-client.js';
import logger from '../utils/logger.js';
import { buildProjectInsightsFromTasks, mergeProjectInsights } from '../utils/project-insights.js';

const router = express.Router();

// Helper function to get valid access token (refreshes if needed)
async function getValidAccessToken(integration, userId) {
    try {
        // Try to use the current access token first
        return integration.access_token;
    } catch (error) {
        // If it fails, try refreshing the token
        if (integration.refresh_token) {
            logger.info('Attempting to refresh Asana token for user:', userId);
            const newTokens = await asanaService.refreshAccessToken(integration.refresh_token);

            // Update the tokens in the database
            await db.saveIntegration(userId, 'asana', {
                accessToken: newTokens.accessToken,
                refreshToken: newTokens.refreshToken,
                workspaceId: integration.workspace_id,
                workspaceName: integration.workspace_name
            });

            return newTokens.accessToken;
        }
        throw error;
    }
}

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

        let accessToken = integration.access_token;
        let projects;

        try {
            projects = await asanaService.getProjects(accessToken, integration.workspace_id);
        } catch (error) {
            // Check if it's an authorization error
            if (error.message.includes('Unauthorized') || error.status === 401) {
                logger.info('Access token expired, attempting refresh for user:', userId);

                if (!integration.refresh_token) {
                    return res.status(401).json({
                        error: 'Asana session expired. Please reconnect your Asana account.',
                        needsReauth: true
                    });
                }

                // Refresh the token
                const newTokens = await asanaService.refreshAccessToken(integration.refresh_token);

                // Update the tokens in the database
                await db.saveIntegration(userId, 'asana', {
                    accessToken: newTokens.accessToken,
                    refreshToken: newTokens.refreshToken,
                    workspaceId: integration.workspace_id,
                    workspaceName: integration.workspace_name
                });

                // Retry with the new token
                accessToken = newTokens.accessToken;
                projects = await asanaService.getProjects(accessToken, integration.workspace_id);
            } else {
                throw error;
            }
        }

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

        const projectName = tasks?.[0]?.project?.name || 'Project';
        const dataInsights = buildProjectInsightsFromTasks(tasks, health, {
            platformLabel: 'Asana',
            projectName
        });

        let aiResponse = null;
        try {
            aiResponse = await aiProcessor.analyzeAsanaTasks(tasks, projectName);
        } catch (analysisError) {
            logger.warn('Asana AI analysis failed, falling back to data-derived insights', {
                projectId,
                error: analysisError.message
            });
        }

        const aiInsights = mergeProjectInsights(dataInsights, aiResponse);

        res.json({
            health,
            aiAnalysis: aiInsights.summary,
            aiInsights,
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

        let accessToken = integration.access_token;
        let tasks;

        try {
            tasks = await asanaService.getAllTasks(accessToken, integration.workspace_id);
        } catch (error) {
            // Check if it's an authorization error
            if (error.message.includes('Unauthorized') || error.status === 401) {
                if (!integration.refresh_token) {
                    return res.status(401).json({
                        error: 'Asana session expired. Please reconnect.',
                        needsReauth: true
                    });
                }

                const newTokens = await asanaService.refreshAccessToken(integration.refresh_token);
                await db.saveIntegration(userId, 'asana', {
                    accessToken: newTokens.accessToken,
                    refreshToken: newTokens.refreshToken,
                    workspaceId: integration.workspace_id,
                    workspaceName: integration.workspace_name
                });

                accessToken = newTokens.accessToken;
                tasks = await asanaService.getAllTasks(accessToken, integration.workspace_id);
            } else {
                throw error;
            }
        }

        // Group by assignee
        const workloadByPerson = {};

        tasks.forEach(task => {
            const assignee = task.assignee?.name || 'Unassigned';
            if (!workloadByPerson[assignee]) {
                workloadByPerson[assignee] = {
                    name: assignee,
                    totalTasks: 0,
                    completedTasks: 0,
                    overdueTasks: 0,
                    upcomingTasks: 0
                };
            }

            workloadByPerson[assignee].totalTasks++;

            if (task.completed) {
                workloadByPerson[assignee].completedTasks++;
            }

            if (!task.completed && task.due_on) {
                const dueDate = new Date(task.due_on);
                const now = new Date();
                if (dueDate < now) {
                    workloadByPerson[assignee].overdueTasks++;
                } else {
                    workloadByPerson[assignee].upcomingTasks++;
                }
            }
        });

        const workload = Object.values(workloadByPerson);

        // Calculate overload status
        const avgTasks = workload.length > 0
            ? workload.reduce((sum, w) => sum + w.totalTasks, 0) / workload.length
            : 0;

        workload.forEach(member => {
            member.isOverloaded = member.totalTasks > avgTasks * 1.5;
            member.workloadPercent = avgTasks > 0
                ? Math.round((member.totalTasks / avgTasks) * 100)
                : 100;
        });

        res.json({
            workload,
            summary: {
                totalMembers: workload.length,
                overloadedMembers: workload.filter(w => w.isOverloaded).length,
                avgTasksPerMember: Math.round(avgTasks)
            }
        });
    } catch (error) {
        logger.error('Failed to get workload:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get deadline alerts (overdue and upcoming tasks)
router.get('/deadlines', async (req, res) => {
    try {
        const { userId } = req.query;

        if (!userId) {
            return res.status(400).json({ error: 'userId required' });
        }

        const integration = await db.getIntegration(userId, 'asana');

        if (!integration) {
            return res.status(401).json({ error: 'Asana not connected' });
        }

        let accessToken = integration.access_token;
        let deadlines;

        try {
            deadlines = await asanaService.getDeadlineSummary(accessToken, integration.workspace_id);
        } catch (error) {
            if (error.message.includes('Unauthorized') || error.status === 401) {
                if (!integration.refresh_token) {
                    return res.status(401).json({
                        error: 'Asana session expired. Please reconnect.',
                        needsReauth: true
                    });
                }

                const newTokens = await asanaService.refreshAccessToken(integration.refresh_token);
                await db.saveIntegration(userId, 'asana', {
                    accessToken: newTokens.accessToken,
                    refreshToken: newTokens.refreshToken,
                    workspaceId: integration.workspace_id,
                    workspaceName: integration.workspace_name
                });

                accessToken = newTokens.accessToken;
                deadlines = await asanaService.getDeadlineSummary(accessToken, integration.workspace_id);
            } else {
                throw error;
            }
        }

        res.json(deadlines);
    } catch (error) {
        logger.error('Failed to get deadlines:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get all tasks with filtering
router.get('/tasks', async (req, res) => {
    try {
        const { userId, status, projectId } = req.query;

        if (!userId) {
            return res.status(400).json({ error: 'userId required' });
        }

        const integration = await db.getIntegration(userId, 'asana');

        if (!integration) {
            return res.status(401).json({ error: 'Asana not connected' });
        }

        let accessToken = integration.access_token;
        let tasks;

        try {
            tasks = await asanaService.getAllTasksFromProjects(accessToken, integration.workspace_id);
        } catch (error) {
            if (error.message.includes('Unauthorized') || error.status === 401) {
                if (!integration.refresh_token) {
                    return res.status(401).json({
                        error: 'Asana session expired. Please reconnect.',
                        needsReauth: true
                    });
                }

                const newTokens = await asanaService.refreshAccessToken(integration.refresh_token);
                await db.saveIntegration(userId, 'asana', {
                    accessToken: newTokens.accessToken,
                    refreshToken: newTokens.refreshToken,
                    workspaceId: integration.workspace_id,
                    workspaceName: integration.workspace_name
                });

                accessToken = newTokens.accessToken;
                tasks = await asanaService.getAllTasksFromProjects(accessToken, integration.workspace_id);
            } else {
                throw error;
            }
        }

        // Apply filters
        let filteredTasks = tasks;

        if (status === 'completed') {
            filteredTasks = tasks.filter(t => t.completed);
        } else if (status === 'incomplete') {
            filteredTasks = tasks.filter(t => !t.completed);
        } else if (status === 'overdue') {
            const now = new Date();
            filteredTasks = tasks.filter(t => !t.completed && t.due_on && new Date(t.due_on) < now);
        }

        if (projectId) {
            filteredTasks = filteredTasks.filter(t => t.project?.gid === projectId);
        }

        // Sort by due date
        filteredTasks.sort((a, b) => {
            if (!a.due_on) return 1;
            if (!b.due_on) return -1;
            return new Date(a.due_on) - new Date(b.due_on);
        });

        res.json({
            tasks: filteredTasks,
            total: filteredTasks.length,
            stats: {
                completed: tasks.filter(t => t.completed).length,
                incomplete: tasks.filter(t => !t.completed).length,
                overdue: tasks.filter(t => !t.completed && t.due_on && new Date(t.due_on) < new Date()).length
            }
        });
    } catch (error) {
        logger.error('Failed to get tasks:', error);
        res.status(500).json({ error: error.message });
    }
});

export default router;
