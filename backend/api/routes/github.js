import express from 'express';
import { Octokit } from '@octokit/rest';
import { db } from '../services/supabase-client.js';
import logger from '../utils/logger.js';

const router = express.Router();

// Helper to get Octokit client + stored integration metadata
async function getGithubClient(userId, teamId) {
    const integration = await db.getIntegration(userId, 'github', teamId);
    if (!integration) {
        throw new Error('GitHub not connected');
    }
    return {
        octokit: new Octokit({ auth: integration.access_token }),
        integration
    };
}

async function getConnectedLogin(octokit, integration) {
    const stored = integration?.workspace_name;
    if (typeof stored === 'string' && stored.trim()) {
        return stored.trim();
    }

    const { data } = await octokit.users.getAuthenticated();
    return data?.login || null;
}

function buildRepoScopeQuery(repoFullNames, maxQueryLength = 180) {
    const qualifiers = [];
    let currentLength = 0;

    for (const fullName of repoFullNames) {
        if (!fullName) continue;
        const qualifier = `repo:${fullName}`;
        const additionalLength = qualifiers.length === 0
            ? qualifier.length
            : qualifier.length + 4; // " OR "

        if (currentLength + additionalLength > maxQueryLength) {
            break;
        }

        qualifiers.push(qualifier);
        currentLength += additionalLength;
    }

    if (!qualifiers.length) {
        return null;
    }

    return {
        query: `(${qualifiers.join(' OR ')})`,
        count: qualifiers.length
    };
}

// Get Repositories
router.get('/repos', async (req, res) => {
    try {
        const { userId, teamId, all } = req.query;
        const requestedPerPage = Number.parseInt(req.query.perPage, 10);
        const perPage = Number.isFinite(requestedPerPage)
            ? Math.min(Math.max(requestedPerPage, 1), 100)
            : 10;

        if (!userId) return res.status(400).json({ error: 'userId required' });

        const { octokit } = await getGithubClient(userId, teamId);
        let repoData = [];

        if (all === 'true') {
            const maxPages = 10; // Soft cap to avoid long-running requests for very large accounts
            let page = 1;

            while (page <= maxPages) {
                const { data } = await octokit.repos.listForAuthenticatedUser({
                    affiliation: 'owner,organization_member',
                    sort: 'updated',
                    direction: 'desc',
                    per_page: 100,
                    page
                });

                repoData.push(...data);

                if (data.length < 100) {
                    break;
                }

                page += 1;
            }
        } else {
            const { data } = await octokit.repos.listForAuthenticatedUser({
                affiliation: 'owner,organization_member',
                sort: 'updated',
                direction: 'desc',
                per_page: perPage
            });
            repoData = data;
        }

        const repos = repoData.map(repo => ({
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

        res.json({
            repos,
            meta: {
                fetched_all: all === 'true',
                limit: all === 'true' ? repos.length : perPage
            }
        });
    } catch (error) {
        logger.error('Failed to fetch repos:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get Pull Requests (Global or Repo specific)
router.get('/pulls', async (req, res) => {
    try {
        const { userId, teamId, repo } = req.query;
        const requestedLimit = Number.parseInt(req.query.limit, 10);
        const requestedStaleDays = Number.parseInt(req.query.staleDays, 10);
        const limit = Number.isFinite(requestedLimit)
            ? Math.min(Math.max(requestedLimit, 1), 25)
            : 10;
        const staleDays = Number.isFinite(requestedStaleDays)
            ? Math.min(Math.max(requestedStaleDays, 1), 30)
            : 7;

        if (!userId) return res.status(400).json({ error: 'userId required' });

        const { octokit, integration } = await getGithubClient(userId, teamId);
        const connectedLogin = await getConnectedLogin(octokit, integration);
        const staleCutoffDate = new Date(Date.now() - staleDays * 24 * 60 * 60 * 1000)
            .toISOString()
            .split('T')[0];
        let scopeQuery = repo ? `repo:${repo}` : null;
        let scopeLabel = repo ? `repo:${repo}` : 'team-visible';

        if (!scopeQuery) {
            const { data: accessibleRepos } = await octokit.repos.listForAuthenticatedUser({
                affiliation: 'owner,organization_member',
                sort: 'updated',
                direction: 'desc',
                per_page: 50
            });

            const repoScope = buildRepoScopeQuery(
                (accessibleRepos || []).map((repoData) => repoData.full_name),
                180
            );

            if (repoScope) {
                scopeQuery = repoScope.query;
                scopeLabel = `repos:${repoScope.count}`;
            } else if (connectedLogin) {
                // Fallback if we cannot build a repo-scoped query.
                scopeQuery = `user:${connectedLogin}`;
                scopeLabel = `user:${connectedLogin}`;
            }
        }

        const baseQuery = ['is:pr', 'is:open', 'archived:false', scopeQuery]
            .filter(Boolean)
            .join(' ');

        const [openSearch, needsReviewSearch, staleSearch, needsReviewListSearch, staleListSearch] = await Promise.all([
            octokit.search.issuesAndPullRequests({
                q: baseQuery,
                sort: 'updated',
                order: 'desc',
                per_page: limit
            }),
            octokit.search.issuesAndPullRequests({
                q: `${baseQuery} review:none`,
                per_page: 1
            }),
            octokit.search.issuesAndPullRequests({
                q: `${baseQuery} updated:<${staleCutoffDate}`,
                per_page: 1
            }),
            octokit.search.issuesAndPullRequests({
                q: `${baseQuery} review:none`,
                sort: 'updated',
                order: 'desc',
                per_page: limit
            }),
            octokit.search.issuesAndPullRequests({
                q: `${baseQuery} updated:<${staleCutoffDate}`,
                sort: 'updated',
                order: 'desc',
                per_page: limit
            })
        ]);

        const pulls = openSearch.data.items || [];
        const needsReviewPullKeys = new Set(
            (needsReviewListSearch.data.items || []).map((pr) => {
                const fullName = pr.repository_url ? pr.repository_url.split('repos/')[1] : 'unknown';
                return `${fullName}#${pr.number}`;
            })
        );
        const stalePullKeys = new Set(
            (staleListSearch.data.items || []).map((pr) => {
                const fullName = pr.repository_url ? pr.repository_url.split('repos/')[1] : 'unknown';
                return `${fullName}#${pr.number}`;
            })
        );

        const formattedPulls = pulls.map((pr) => {
            const fullName = pr.repository_url ? pr.repository_url.split('repos/')[1] : (repo || 'unknown');
            const key = `${fullName}#${pr.number}`;
            const needsReview = needsReviewPullKeys.has(key);
            const isStale = stalePullKeys.has(key);

            return {
                id: pr.id,
                number: pr.number,
                title: pr.title,
                html_url: pr.html_url,
                state: pr.state,
                user: {
                    login: pr.user?.login || 'unknown',
                    avatar_url: pr.user?.avatar_url || ''
                },
                created_at: pr.created_at,
                updated_at: pr.updated_at,
                repo: fullName,
                needs_review: needsReview,
                is_stale: isStale,
                blocker_reasons: [
                    ...(needsReview ? ['needs_review'] : []),
                    ...(isStale ? ['stale'] : [])
                ]
            };
        });

        res.json({
            pulls: formattedPulls,
            meta: {
                total_open: openSearch.data.total_count || formattedPulls.length,
                needs_review: needsReviewSearch.data.total_count || 0,
                stale: staleSearch.data.total_count || 0,
                stale_days: staleDays,
                limit,
                scope: scopeLabel
            }
        });
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

        const { octokit } = await getGithubClient(userId, teamId);

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
