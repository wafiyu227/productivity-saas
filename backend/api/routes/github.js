import express from 'express';
import { Octokit } from '@octokit/rest';
import { db } from '../services/supabase-client.js';
import logger from '../utils/logger.js';

const router = express.Router();

// Helper to get Octokit client
async function getOctokit(userId, teamId) {
    const integration = await db.getIntegration(userId, 'github', teamId);
    if (!integration) {
        throw new Error('GitHub not connected');
    }
    return new Octokit({ auth: integration.access_token });
}

// Get Repositories
router.get('/repos', async (req, res) => {
    try {
        const { userId, teamId } = req.query;
        if (!userId) return res.status(400).json({ error: 'userId required' });

        const octokit = await getOctokit(userId, teamId);

        // List repos for the authenticated user
        const { data } = await octokit.repos.listForAuthenticatedUser({
            sort: 'updated',
            direction: 'desc',
            per_page: 10
        });

        const repos = data.map(repo => ({
            id: repo.id,
            name: repo.name,
            full_name: repo.full_name,
            html_url: repo.html_url,
            description: repo.description,
            private: repo.private,
            updated_at: repo.updated_at,
            language: repo.language,
            stargazers_count: repo.stargazers_count
        }));

        res.json({ repos });
    } catch (error) {
        logger.error('Failed to fetch repos:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get Pull Requests (Global or Repo specific)
router.get('/pulls', async (req, res) => {
    try {
        const { userId, teamId, repo } = req.query;
        if (!userId) return res.status(400).json({ error: 'userId required' });

        const octokit = await getOctokit(userId, teamId);

        let pulls = [];

        if (repo) {
            // Get PRs for specific repo
            const [owner, name] = repo.split('/');
            const { data } = await octokit.pulls.list({
                owner,
                repo: name,
                state: 'open',
                per_page: 10
            });
            pulls = data;
        } else {
            // Get PRs involving the user (issues search is often better for "my PRs")
            const { data } = await octokit.search.issuesAndPullRequests({
                q: 'is:pr is:open author:@me archived:false',
                sort: 'updated',
                order: 'desc',
                per_page: 10
            });
            pulls = data.items;
        }

        const formattedPulls = pulls.map(pr => ({
            id: pr.id,
            number: pr.number,
            title: pr.title,
            html_url: pr.html_url,
            state: pr.state,
            user: {
                login: pr.user.login,
                avatar_url: pr.user.avatar_url
            },
            created_at: pr.created_at,
            repo: repo || (pr.repository_url ? pr.repository_url.split('repos/')[1] : 'unknown')
        }));

        res.json({ pulls: formattedPulls });
    } catch (error) {
        logger.error('Failed to fetch PRs:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get Recent Activity / Commits
router.get('/activity', async (req, res) => {
    try {
        const { userId, teamId, username } = req.query;
        if (!userId) return res.status(400).json({ error: 'userId required' });

        const octokit = await getOctokit(userId, teamId);

        // Get authenticated user's username if not provided
        let targetUser = username;
        if (!targetUser) {
            const { data: user } = await octokit.users.getAuthenticated();
            targetUser = user.login;
        }

        const { data } = await octokit.activity.listEventsForAuthenticatedUser({
            username: targetUser,
            per_page: 10
        });

        const activity = data.map(event => ({
            id: event.id,
            type: event.type,
            repo: event.repo.name,
            actor: {
                login: event.actor.login,
                avatar_url: event.actor.avatar_url,
                display_login: event.actor.display_login
            },
            created_at: event.created_at,
            payload: event.payload
        }));

        res.json({ activity });
    } catch (error) {
        logger.error('Failed to fetch activity:', error);
        res.status(500).json({ error: error.message });
    }
});

export default router;
