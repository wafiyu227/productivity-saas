import dotenv from 'dotenv';
import logger from '../utils/logger.js';

dotenv.config();

const TRELLO_API_KEY = process.env.TRELLO_API_KEY;
const MAX_BOARDS = Number.parseInt(process.env.TRELLO_PROJECT_BOARD_LIMIT || '10', 10);
const DEFAULT_REQUEST_TIMEOUT_MS = Number.parseInt(process.env.TRELLO_REQUEST_TIMEOUT_MS || '15000', 10);

class TrelloService {
    ensureConfigured() {
        if (!TRELLO_API_KEY) {
            throw new Error('Trello API key is not configured');
        }
    }

    async request(endpoint, accessToken, params = {}, options = {}) {
        this.ensureConfigured();

        if (!accessToken) {
            throw new Error('Trello access token is required');
        }

        const {
            method = 'GET',
            body = null
        } = options;

        const url = new URL(`https://api.trello.com/1/${endpoint}`);
        url.searchParams.append('key', TRELLO_API_KEY);
        url.searchParams.append('token', accessToken);

        Object.entries(params).forEach(([key, value]) => {
            if (value !== undefined && value !== null && value !== '') {
                url.searchParams.append(key, String(value));
            }
        });

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), DEFAULT_REQUEST_TIMEOUT_MS);

        try {
            const response = await fetch(url.toString(), {
                method,
                signal: controller.signal,
                headers: body ? { 'Content-Type': 'application/json' } : undefined,
                body: body ? JSON.stringify(body) : undefined
            });
            if (!response.ok) {
                const errorText = await response.text();
                logger.error('Trello API request failed', {
                    endpoint,
                    status: response.status,
                    error: errorText
                });
                const error = new Error(`Trello API Error: ${response.status}`);
                error.status = response.status;
                throw error;
            }

            return await response.json();
        } catch (error) {
            if (error.name === 'AbortError') {
                const timeoutError = new Error('Trello API request timed out');
                timeoutError.status = 504;
                throw timeoutError;
            }
            throw error;
        } finally {
            clearTimeout(timeout);
        }
    }

    async getBoards(accessToken, memberId = null) {
        const member = memberId || 'me';
        const boards = await this.request(`members/${member}/boards`, accessToken, {
            fields: 'name,desc,closed,url,dateLastActivity',
            filter: 'open'
        });

        return (Array.isArray(boards) ? boards : []).filter((board) => !board?.closed);
    }

    async getCardsForBoard(accessToken, board) {
        const [cards, lists] = await Promise.all([
            this.request(`boards/${board.id}/cards`, accessToken, {
                fields: 'name,desc,due,dueComplete,idMembers,closed,url,dateLastActivity,idList,shortLink,idBoard',
                filter: 'visible',
                members: 'true',
                member_fields: 'fullName,username'
            }),
            this.getListsForBoard(accessToken, board.id)
        ]);

        const listsById = new Map(
            (Array.isArray(lists) ? lists : []).map((list) => [String(list.id || list.gid || ''), list])
        );

        return (Array.isArray(cards) ? cards : []).map((card) => (
            this.normalizeCard(card, board, listsById.get(String(card?.idList || '')))
        ));
    }

    normalizeCard(card, board, list = null) {
        const members = Array.isArray(card?.members) ? card.members : [];
        const primaryAssignee = members[0];
        const dueDate = card?.due ? new Date(card.due) : null;
        const normalizedDueDate = dueDate && !Number.isNaN(dueDate.getTime())
            ? dueDate.toISOString().slice(0, 10)
            : null;

        return {
            gid: card?.id,
            id: card?.id,
            name: card?.name || 'Untitled card',
            notes: card?.desc || '',
            completed: Boolean(card?.dueComplete || card?.closed),
            due_on: normalizedDueDate,
            due_at: card?.due || null,
            assignee: primaryAssignee
                ? { name: primaryAssignee.fullName || primaryAssignee.username || 'Unknown' }
                : null,
            members: members.map((member) => ({
                id: member?.id,
                name: member?.fullName || member?.username || 'Unknown'
            })),
            project: {
                gid: board?.id,
                id: board?.id,
                name: board?.name || 'Trello Board'
            },
            list: list
                ? {
                    gid: list?.id || list?.gid || null,
                    id: list?.id || list?.gid || null,
                    name: list?.name || 'Unknown list'
                }
                : null,
            status_name: list?.name || (card?.dueComplete || card?.closed ? 'Done' : 'Open'),
            shortLink: card?.shortLink || null,
            externalUrl: card?.url || null,
            created_at: card?.dateLastActivity || new Date().toISOString()
        };
    }

    normalizeBoard(board) {
        return {
            gid: board?.id,
            id: board?.id,
            name: board?.name || 'Untitled board',
            notes: board?.desc || '',
            archived: Boolean(board?.closed),
            completed: Boolean(board?.closed),
            due_date: null,
            owner: null,
            url: board?.url || null
        };
    }

    async getProjects(accessToken, memberId = null) {
        const boards = await this.getBoards(accessToken, memberId);
        return boards.map((board) => this.normalizeBoard(board));
    }

    async getAllCardsFromBoards(accessToken, memberId = null) {
        const boards = await this.getBoards(accessToken, memberId);
        const boardsToCheck = boards.slice(0, Number.isFinite(MAX_BOARDS) ? MAX_BOARDS : 10);

        const cardLists = await Promise.all(
            boardsToCheck.map(async (board) => {
                try {
                    return await this.getCardsForBoard(accessToken, board);
                } catch (error) {
                    logger.error(`Failed to get cards for Trello board ${board?.id}:`, error);
                    return [];
                }
            })
        );

        const flattened = cardLists.flat();
        const uniqueCards = flattened.filter((task, index, all) => (
            index === all.findIndex((candidate) => candidate.gid === task.gid)
        ));

        return uniqueCards;
    }

    async getTasksForProject(accessToken, projectId) {
        if (!projectId) {
            throw new Error('projectId is required');
        }

        const board = await this.request(`boards/${projectId}`, accessToken, {
            fields: 'name,desc,closed,url,dateLastActivity'
        });

        return this.getCardsForBoard(accessToken, board);
    }

    async getListsForBoard(accessToken, boardId) {
        if (!boardId) {
            throw new Error('boardId is required');
        }

        const lists = await this.request(`boards/${boardId}/lists`, accessToken, {
            fields: 'name,closed',
            filter: 'open'
        });

        return (Array.isArray(lists) ? lists : []).filter((list) => !list?.closed);
    }

    async getCard(accessToken, cardId) {
        if (!cardId) {
            throw new Error('cardId is required');
        }

        const card = await this.request(`cards/${cardId}`, accessToken, {
            fields: 'name,desc,due,dueComplete,idMembers,closed,url,dateLastActivity,idList,shortLink,idBoard',
            members: 'true',
            member_fields: 'fullName,username'
        });
        const [board, lists] = await Promise.all([
            this.request(`boards/${card.idBoard}`, accessToken, {
                fields: 'name,desc,closed,url,dateLastActivity'
            }),
            this.getListsForBoard(accessToken, card.idBoard)
        ]);

        const currentList = (Array.isArray(lists) ? lists : []).find((list) => String(list?.id) === String(card?.idList));
        return this.normalizeCard(card, board, currentList);
    }

    async moveCardToList(accessToken, cardId, listId) {
        if (!cardId || !listId) {
            throw new Error('cardId and listId are required');
        }

        return this.request(`cards/${cardId}`, accessToken, {
            idList: listId
        }, {
            method: 'PUT'
        });
    }

    async addCommentToCard(accessToken, cardId, text) {
        if (!cardId || !String(text || '').trim()) {
            throw new Error('cardId and comment text are required');
        }

        return this.request(`cards/${cardId}/actions/comments`, accessToken, {
            text: String(text).trim()
        }, {
            method: 'POST'
        });
    }

    async getDeadlineSummary(accessToken, memberId = null) {
        const allTasks = await this.getAllCardsFromBoards(accessToken, memberId);
        const openTasksWithDueDates = allTasks.filter((task) => !task.completed && task.due_on);

        const now = new Date();
        const todayStart = new Date(now);
        todayStart.setHours(0, 0, 0, 0);

        const todayEnd = new Date(now);
        todayEnd.setHours(23, 59, 59, 999);

        const tomorrowEnd = new Date(todayEnd);
        tomorrowEnd.setDate(tomorrowEnd.getDate() + 1);

        const weekEnd = new Date(todayEnd);
        weekEnd.setDate(weekEnd.getDate() + 7);

        const overdue = [];
        const dueToday = [];
        const dueTomorrow = [];
        const dueThisWeek = [];

        openTasksWithDueDates.forEach((task) => {
            const dueDate = new Date(task.due_on);
            if (Number.isNaN(dueDate.getTime())) return;

            if (dueDate < todayStart) {
                overdue.push(task);
                return;
            }
            if (dueDate <= todayEnd) {
                dueToday.push(task);
                return;
            }
            if (dueDate <= tomorrowEnd) {
                dueTomorrow.push(task);
                return;
            }
            if (dueDate <= weekEnd) {
                dueThisWeek.push(task);
            }
        });

        const sortByDueDate = (a, b) => {
            const first = new Date(a.due_on).getTime();
            const second = new Date(b.due_on).getTime();
            return first - second;
        };

        overdue.sort(sortByDueDate);
        dueToday.sort(sortByDueDate);
        dueTomorrow.sort(sortByDueDate);
        dueThisWeek.sort(sortByDueDate);

        return {
            overdue: {
                count: overdue.length,
                tasks: overdue.slice(0, 10)
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
                tasks: dueThisWeek.slice(0, 10)
            },
            totalAtRisk: overdue.length + dueToday.length
        };
    }

    async getWorkloadSummary(accessToken, memberId = null) {
        const allTasks = await this.getAllCardsFromBoards(accessToken, memberId);
        const workloadByPerson = {};

        allTasks.forEach((task) => {
            const assignees = Array.isArray(task.members) && task.members.length > 0
                ? task.members.map((member) => member.name)
                : ['Unassigned'];

            assignees.forEach((name) => {
                if (!workloadByPerson[name]) {
                    workloadByPerson[name] = {
                        name,
                        totalTasks: 0,
                        completedTasks: 0,
                        overdueTasks: 0,
                        upcomingTasks: 0
                    };
                }

                workloadByPerson[name].totalTasks += 1;

                if (task.completed) {
                    workloadByPerson[name].completedTasks += 1;
                    return;
                }

                if (!task.due_on) return;

                const dueDate = new Date(task.due_on);
                if (Number.isNaN(dueDate.getTime())) return;

                if (dueDate < new Date()) {
                    workloadByPerson[name].overdueTasks += 1;
                } else {
                    workloadByPerson[name].upcomingTasks += 1;
                }
            });
        });

        const workload = Object.values(workloadByPerson);
        const avgTasks = workload.length > 0
            ? workload.reduce((sum, member) => sum + member.totalTasks, 0) / workload.length
            : 0;

        workload.forEach((member) => {
            member.isOverloaded = member.totalTasks > avgTasks * 1.5;
            member.workloadPercent = avgTasks > 0
                ? Math.round((member.totalTasks / avgTasks) * 100)
                : 100;
        });

        return {
            workload,
            summary: {
                totalMembers: workload.length,
                overloadedMembers: workload.filter((member) => member.isOverloaded).length,
                avgTasksPerMember: Math.round(avgTasks)
            }
        };
    }

    calculateProjectHealth(tasks) {
        const taskList = Array.isArray(tasks) ? tasks : [];
        const total = taskList.length;
        const completed = taskList.filter((task) => task.completed).length;
        const overdue = taskList.filter((task) => {
            if (task.completed || !task.due_on) return false;
            return new Date(task.due_on) < new Date();
        }).length;
        const onTrack = taskList.filter((task) => {
            if (task.completed || !task.due_on) return false;
            return new Date(task.due_on) >= new Date();
        }).length;

        const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;
        const overdueRate = total > 0 ? Math.round((overdue / total) * 100) : 0;

        let healthStatus = 'healthy';
        if (overdueRate > 20) healthStatus = 'at-risk';
        if (overdueRate > 40) healthStatus = 'critical';

        return {
            total,
            completed,
            overdue,
            onTrack,
            completionRate,
            overdueRate,
            healthStatus
        };
    }
}

export default new TrelloService();
