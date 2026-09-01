import { convertToModelMessages, stepCountIs, streamText, tool } from 'ai';
import { getWorkerModel } from './multi-model-router.js';
import { z } from 'zod';
import logger from '../utils/logger.js';
import { createApprovalRequest } from './agent-approval-actions.js';
import {
  resolveAsanaContext,
  resolveGithubContext,
  resolveGoogleWorkspaceContext,
  resolveJiraContext,
  resolveSlackContext,
  withGoogleCalendarAccess
} from './agent-platform-context.js';
import { SlackAgentTools } from './slack-tools.js';
import asanaService from './asana-service.js';
import jiraService from './jira-service.js';
import googleCalendarService from './google-calendar-service.js';
import { buildAgentCapabilityPrompt } from './integration-capabilities.js';
import googleWorkspaceService from './google-workspace-service.js';
import gmailService from './gmail-service.js';

function limitArray(items, max = 20) {
  return (Array.isArray(items) ? items : []).slice(0, max);
}

function buildSlackToolset(userId, toolAccess = {}) {
  const tools = {};

  if (toolAccess.getChannels) {
    tools.getChannels = tool({
      description: 'List public and private Slack channels the user can access.',
      inputSchema: z.object({}),
      execute: async () => {
        const context = await resolveSlackContext(userId);
        return await new SlackAgentTools(context.accessToken).getChannels();
      }
    });
  }

  if (toolAccess.getUsers) {
    tools.getUsers = tool({
      description: 'List active Slack users and their basic profile details.',
      inputSchema: z.object({}),
      execute: async () => {
        const context = await resolveSlackContext(userId);
        return await new SlackAgentTools(context.accessToken).getUsers();
      }
    });
  }

  if (toolAccess.getMessages) {
    tools.getMessages = tool({
      description: 'Get recent messages from a Slack channel so the agent can read context before making recommendations. Prefer channel names over raw IDs.',
      inputSchema: z.object({
        channelId: z.string().optional().describe('Optional Slack channel ID.'),
        channelName: z.string().optional().describe('Preferred Slack channel name, with or without #.'),
        limit: z.number().int().min(1).max(100).optional().describe('How many recent messages to load.')
      }),
      execute: async ({ channelId, channelName, limit }) => {
        const context = await resolveSlackContext(userId);
        const resolvedChannel = channelName || channelId || '';
        return await new SlackAgentTools(context.accessToken).getMessages(resolvedChannel, limit);
      }
    });
  }

  if (toolAccess.requestSlackMessageApproval) {
    tools.requestSlackMessageApproval = tool({
      description: 'Prepare a Slack message to send on the user’s behalf. This does not send the message immediately; it creates an approval request first.',
      inputSchema: z.object({
        channelId: z.string().optional().describe('Optional Slack channel ID to post into.'),
        channelName: z.string().optional().describe('Preferred Slack channel name, with or without #.'),
        text: z.string().describe('Message content to send after approval.')
      }),
      execute: async ({ channelId, channelName, text }) => {
        const normalizedId = typeof channelId === 'string' ? channelId.trim() : '';
        const normalizedName = typeof channelName === 'string' ? channelName.replace(/^#/, '').trim() : '';
        if (!normalizedId && !normalizedName) {
          throw new Error('Please provide a Slack channel name or channel ID.');
        }
        const destinationLabel = normalizedName
          ? `#${normalizedName}`
          : normalizedId;

        return createApprovalRequest({
        platform: 'slack',
        action: 'send_message',
        title: `Send Slack message to ${destinationLabel}`,
        summary: `Send a Slack message to ${destinationLabel}.`,
        description: 'Teama will send this message only after the user approves it.',
        params: { channelId: normalizedId || null, channelName: normalizedName || null, text }
      });
      }
    });
  }

  if (toolAccess.requestSlackChannelApproval) {
    tools.requestSlackChannelApproval = tool({
      description: 'Prepare a new Slack channel for approval. This only creates the approval request.',
      inputSchema: z.object({
        name: z.string().describe('Channel name to create.'),
        isPrivate: z.boolean().optional().describe('Whether the channel should be private.')
      }),
      execute: async ({ name, isPrivate }) => createApprovalRequest({
        platform: 'slack',
        action: 'create_channel',
        title: `Create Slack channel #${name}`,
        summary: `Create the Slack channel #${name}.`,
        description: 'Teama will create the channel only after the user approves it.',
        params: { name, isPrivate: Boolean(isPrivate) }
      })
    });
  }

  return tools;
}

function buildAsanaToolset(userId, toolAccess = {}) {
  const tools = {};

  if (toolAccess.getAsanaProjects) {
    tools.getAsanaProjects = tool({
      description: 'List active Asana projects for the connected workspace.',
      inputSchema: z.object({}),
      execute: async () => {
        const context = await resolveAsanaContext(userId);
        return await asanaService.getProjects(context.accessToken, context.workspaceId);
      }
    });
  }

  if (toolAccess.getAsanaTasks) {
    tools.getAsanaTasks = tool({
      description: 'Read Asana tasks either from a specific project or from the connected workspace.',
      inputSchema: z.object({
        projectId: z.string().optional().describe('Optional Asana project ID.'),
        limit: z.number().int().min(1).max(50).optional().describe('Maximum number of tasks to return.')
      }),
      execute: async ({ projectId, limit }) => {
        const context = await resolveAsanaContext(userId);
        const tasks = projectId
          ? await asanaService.getTasksForProject(context.accessToken, projectId)
          : await asanaService.getAllTasksFromProjects(context.accessToken, context.workspaceId);
        return limitArray(tasks, limit || 15);
      }
    });
  }

  if (toolAccess.getAsanaTask) {
    tools.getAsanaTask = tool({
      description: 'Read a single Asana task by ID.',
      inputSchema: z.object({
        taskId: z.string().describe('Asana task ID.')
      }),
      execute: async ({ taskId }) => {
        const context = await resolveAsanaContext(userId);
        return await asanaService.getTaskById(context.accessToken, taskId);
      }
    });
  }

  if (toolAccess.requestAsanaCompleteApproval) {
    tools.requestAsanaCompleteApproval = tool({
      description: 'Prepare an approval request to mark an Asana task complete.',
      inputSchema: z.object({
        taskId: z.string().describe('Asana task ID to complete.')
      }),
      execute: async ({ taskId }) => createApprovalRequest({
        platform: 'asana',
        action: 'complete_task',
        title: `Complete Asana task ${taskId}`,
        summary: `Mark the Asana task ${taskId} as complete.`,
        description: 'Teama will mark the task complete only after the user approves it.',
        params: { taskId }
      })
    });
  }

  if (toolAccess.requestAsanaMoveApproval) {
    tools.requestAsanaMoveApproval = tool({
      description: 'Prepare an approval request to move an Asana task into a named section.',
      inputSchema: z.object({
        taskId: z.string().describe('Asana task ID to move.'),
        sectionName: z.string().describe('Target Asana section name.'),
        projectId: z.string().optional().describe('Optional project ID if the task belongs to multiple projects.')
      }),
      execute: async ({ taskId, sectionName, projectId }) => createApprovalRequest({
        platform: 'asana',
        action: 'move_task',
        title: `Move Asana task ${taskId}`,
        summary: `Move the Asana task ${taskId} to ${sectionName}.`,
        description: 'Teama will move the task only after the user approves it.',
        params: { taskId, sectionName, projectId }
      })
    });
  }

  if (toolAccess.requestAsanaCommentApproval) {
    tools.requestAsanaCommentApproval = tool({
      description: 'Prepare an approval request to add a comment to an Asana task.',
      inputSchema: z.object({
        taskId: z.string().describe('Asana task ID to comment on.'),
        text: z.string().describe('Comment text to add.')
      }),
      execute: async ({ taskId, text }) => createApprovalRequest({
        platform: 'asana',
        action: 'add_comment',
        title: `Comment on Asana task ${taskId}`,
        summary: `Add a comment to Asana task ${taskId}.`,
        description: 'Teama will post the comment only after the user approves it.',
        params: { taskId, text }
      })
    });
  }

  return tools;
}

function buildJiraToolset(userId, toolAccess = {}) {
  const tools = {};

  if (toolAccess.getJiraProjects) {
    tools.getJiraProjects = tool({
      description: 'List Jira projects in the connected workspace.',
      inputSchema: z.object({}),
      execute: async () => {
        const context = await resolveJiraContext(userId);
        return await jiraService.getProjects(context.accessToken, context.cloudId, context.baseUrl);
      }
    });
  }

  if (toolAccess.getJiraTasks) {
    tools.getJiraTasks = tool({
      description: 'Read Jira issues for a project or across connected Jira projects.',
      inputSchema: z.object({
        projectId: z.string().optional().describe('Optional Jira project ID or key.'),
        limit: z.number().int().min(1).max(50).optional().describe('Maximum number of issues to return.')
      }),
      execute: async ({ projectId, limit }) => {
        const context = await resolveJiraContext(userId);
        const tasks = projectId
          ? await jiraService.getTasksForProject(context.accessToken, context.cloudId, projectId, context.baseUrl)
          : await jiraService.getAllTasksFromProjects(context.accessToken, context.cloudId, context.baseUrl);
        return limitArray(tasks, limit || 15);
      }
    });
  }

  if (toolAccess.getJiraIssue) {
    tools.getJiraIssue = tool({
      description: 'Read a single Jira issue by issue key.',
      inputSchema: z.object({
        issueKey: z.string().describe('Jira issue key, such as ENG-123.')
      }),
      execute: async ({ issueKey }) => {
        const context = await resolveJiraContext(userId);
        return await jiraService.getIssueByKey(context.accessToken, context.cloudId, issueKey, context.baseUrl);
      }
    });
  }

  if (toolAccess.getJiraTransitions) {
    tools.getJiraTransitions = tool({
      description: 'List the available Jira transitions for an issue so the agent can propose a valid status change.',
      inputSchema: z.object({
        issueKey: z.string().describe('Jira issue key, such as ENG-123.')
      }),
      execute: async ({ issueKey }) => {
        const context = await resolveJiraContext(userId);
        return await jiraService.getIssueTransitions(context.accessToken, context.cloudId, issueKey);
      }
    });
  }

  if (toolAccess.requestJiraTransitionApproval) {
    tools.requestJiraTransitionApproval = tool({
      description: 'Prepare an approval request to transition a Jira issue to a new status.',
      inputSchema: z.object({
        issueKey: z.string().describe('Jira issue key.'),
        desiredStatus: z.string().describe('Desired Jira status name.')
      }),
      execute: async ({ issueKey, desiredStatus }) => createApprovalRequest({
        platform: 'jira',
        action: 'transition_issue',
        title: `Move ${issueKey} to ${desiredStatus}`,
        summary: `Transition Jira issue ${issueKey} to ${desiredStatus}.`,
        description: 'Teama will update Jira only after the user approves it.',
        params: { issueKey, desiredStatus }
      })
    });
  }

  if (toolAccess.requestJiraCommentApproval) {
    tools.requestJiraCommentApproval = tool({
      description: 'Prepare an approval request to add a Jira comment.',
      inputSchema: z.object({
        issueKey: z.string().describe('Jira issue key.'),
        text: z.string().describe('Comment text to add.')
      }),
      execute: async ({ issueKey, text }) => createApprovalRequest({
        platform: 'jira',
        action: 'add_comment',
        title: `Comment on ${issueKey}`,
        summary: `Add a Jira comment to ${issueKey}.`,
        description: 'Teama will post the Jira comment only after the user approves it.',
        params: { issueKey, text }
      })
    });
  }

  return tools;
}

function buildGithubToolset(userId, toolAccess = {}) {
  const tools = {};

  if (toolAccess.getGithubRepos) {
    tools.getGithubRepos = tool({
      description: 'List the authenticated user’s most recently updated GitHub repositories.',
      inputSchema: z.object({
        limit: z.number().int().min(1).max(50).optional().describe('Maximum repositories to return.')
      }),
      execute: async ({ limit }) => {
        const context = await resolveGithubContext(userId);
        const result = await context.octokit.repos.listForAuthenticatedUser({
          affiliation: 'owner,organization_member',
          sort: 'updated',
          direction: 'desc',
          per_page: Math.min(limit || 15, 50)
        });
        return result.data.map((repo) => ({
          id: repo.id,
          full_name: repo.full_name,
          description: repo.description,
          private: repo.private,
          updated_at: repo.updated_at
        }));
      }
    });
  }

  if (toolAccess.getGithubPulls) {
    tools.getGithubPulls = tool({
      description: 'List open GitHub pull requests. If repoFullName is omitted, the agent should scan recently updated repositories.',
      inputSchema: z.object({
        repoFullName: z.string().optional().describe('Optional repository in owner/repo format.'),
        limit: z.number().int().min(1).max(25).optional().describe('Maximum pull requests to return.')
      }),
      execute: async ({ repoFullName, limit }) => {
        const context = await resolveGithubContext(userId);

        const maxPulls = Math.min(limit || 10, 25);

        if (repoFullName) {
          const [owner, repo] = repoFullName.split('/');
          const result = await context.octokit.pulls.list({
            owner,
            repo,
            state: 'open',
            per_page: maxPulls
          });
          return result.data.map((pr) => ({
            id: pr.id,
            number: pr.number,
            title: pr.title,
            html_url: pr.html_url,
            state: pr.state,
            user: pr.user?.login || 'unknown',
            updated_at: pr.updated_at,
            repository: repoFullName
          }));
        }

        const repositories = await context.octokit.repos.listForAuthenticatedUser({
          affiliation: 'owner,organization_member',
          sort: 'updated',
          direction: 'desc',
          per_page: 6
        });

        const repoList = repositories.data || [];
        const pullCollections = await Promise.all(repoList.map(async (repoItem) => {
          try {
            const pulls = await context.octokit.pulls.list({
              owner: repoItem.owner?.login,
              repo: repoItem.name,
              state: 'open',
              per_page: 5
            });

            return {
              repository: repoItem.full_name,
              pulls: (pulls.data || []).map((pr) => ({
                id: pr.id,
                number: pr.number,
                title: pr.title,
                html_url: pr.html_url,
                state: pr.state,
                user: pr.user?.login || 'unknown',
                updated_at: pr.updated_at
              }))
            };
          } catch {
            return null;
          }
        }));

        const flattened = pullCollections
          .filter(Boolean)
          .flatMap((entry) => entry.pulls.map((pull) => ({ ...pull, repository: entry.repository })))
          .slice(0, maxPulls);

        return flattened;
      }
    });
  }

  if (toolAccess.getGithubIssue) {
    tools.getGithubIssue = tool({
      description: 'Read a GitHub issue or pull request by repository and number.',
      inputSchema: z.object({
        repoFullName: z.string().describe('Repository in owner/repo format.'),
        issueNumber: z.number().int().describe('Issue or pull request number.')
      }),
      execute: async ({ repoFullName, issueNumber }) => {
        const context = await resolveGithubContext(userId);
        const [owner, repo] = repoFullName.split('/');
        const result = await context.octokit.issues.get({
          owner,
          repo,
          issue_number: issueNumber
        });
        return {
          id: result.data.id,
          number: result.data.number,
          title: result.data.title,
          state: result.data.state,
          html_url: result.data.html_url,
          body: result.data.body,
          assignees: (result.data.assignees || []).map((assignee) => assignee.login)
        };
      }
    });
  }

  if (toolAccess.requestGithubIssueApproval) {
    tools.requestGithubIssueApproval = tool({
      description: 'Prepare an approval request to create a GitHub issue.',
      inputSchema: z.object({
        repoFullName: z.string().describe('Repository in owner/repo format.'),
        title: z.string().describe('Issue title.'),
        body: z.string().optional().describe('Issue body markdown.')
      }),
      execute: async ({ repoFullName, title, body }) => createApprovalRequest({
        platform: 'github',
        action: 'create_issue',
        title: `Create GitHub issue in ${repoFullName}`,
        summary: `Create a GitHub issue in ${repoFullName}.`,
        description: 'Teama will create the issue only after the user approves it.',
        params: { repoFullName, title, body }
      })
    });
  }

  if (toolAccess.requestGithubCommentApproval) {
    tools.requestGithubCommentApproval = tool({
      description: 'Prepare an approval request to add a comment to a GitHub issue or pull request.',
      inputSchema: z.object({
        repoFullName: z.string().describe('Repository in owner/repo format.'),
        issueNumber: z.number().int().describe('Issue or pull request number.'),
        body: z.string().describe('Comment body markdown.')
      }),
      execute: async ({ repoFullName, issueNumber, body }) => createApprovalRequest({
        platform: 'github',
        action: 'add_issue_comment',
        title: `Comment on ${repoFullName}#${issueNumber}`,
        summary: `Add a GitHub comment to ${repoFullName}#${issueNumber}.`,
        description: 'Teama will post the comment only after the user approves it.',
        params: { repoFullName, issueNumber, body }
      })
    });
  }

  if (toolAccess.requestGithubIssueStateApproval) {
    tools.requestGithubIssueStateApproval = tool({
      description: 'Prepare an approval request to open or close a GitHub issue.',
      inputSchema: z.object({
        repoFullName: z.string().describe('Repository in owner/repo format.'),
        issueNumber: z.number().int().describe('Issue number.'),
        state: z.enum(['open', 'closed']).describe('Desired issue state.')
      }),
      execute: async ({ repoFullName, issueNumber, state }) => createApprovalRequest({
        platform: 'github',
        action: 'update_issue_state',
        title: `${state === 'closed' ? 'Close' : 'Reopen'} ${repoFullName}#${issueNumber}`,
        summary: `${state === 'closed' ? 'Close' : 'Reopen'} GitHub issue ${repoFullName}#${issueNumber}.`,
        description: 'Teama will update the GitHub issue state only after the user approves it.',
        params: { repoFullName, issueNumber, state }
      })
    });
  }

  return tools;
}

function buildGoogleCalendarToolset(userId, toolAccess = {}) {
  const tools = {};

  if (toolAccess.getCalendarEvents) {
    tools.getCalendarEvents = tool({
      description: 'Read upcoming calendar events from the connected Google Calendar.',
      inputSchema: z.object({
        days: z.number().int().min(1).max(30).optional().describe('How many days ahead to read.')
      }),
      execute: async ({ days }) => await withGoogleCalendarAccess(userId, async (accessToken) => (
        await googleCalendarService.getUpcomingEvents(accessToken, days || 7)
      ))
    });
  }

  if (toolAccess.getCalendarEventDetails) {
    tools.getCalendarEventDetails = tool({
      description: 'Read one Google Calendar event by ID.',
      inputSchema: z.object({
        eventId: z.string().describe('Google Calendar event ID.')
      }),
      execute: async ({ eventId }) => await withGoogleCalendarAccess(userId, async (accessToken) => (
        await googleCalendarService.getEventDetails(accessToken, eventId)
      ))
    });
  }

  if (toolAccess.getCalendarActionItems) {
    tools.getCalendarActionItems = tool({
      description: 'Extract action items from upcoming Google Calendar event descriptions.',
      inputSchema: z.object({
        days: z.number().int().min(1).max(30).optional().describe('How many days ahead to inspect.')
      }),
      execute: async ({ days }) => await withGoogleCalendarAccess(userId, async (accessToken) => {
        const result = await googleCalendarService.getMeetingsWithActionItems(accessToken, days || 7);
        return {
          actionItems: result.actionItems,
          totalActionItems: result.totalActionItems
        };
      })
    });
  }

  if (toolAccess.requestCalendarEventApproval) {
    tools.requestCalendarEventApproval = tool({
      description: 'Prepare an approval request to create a Google Calendar event.',
      inputSchema: z.object({
        summary: z.string().describe('Event title.'),
        description: z.string().optional().describe('Event description.'),
        start: z.object({
          dateTime: z.string().describe('RFC3339 start datetime, for example 2026-04-16T09:00:00Z.'),
          timeZone: z.string().optional().describe('Optional IANA timezone.')
        }),
        end: z.object({
          dateTime: z.string().describe('RFC3339 end datetime, for example 2026-04-16T09:30:00Z.'),
          timeZone: z.string().optional().describe('Optional IANA timezone.')
        }),
        attendees: z.array(z.string()).optional().describe('Optional attendee email addresses.'),
        location: z.string().optional().describe('Optional meeting location.')
      }),
      execute: async ({ summary, description, start, end, attendees, location }) => createApprovalRequest({
        platform: 'google_calendar',
        action: 'create_event',
        title: `Create calendar event "${summary}"`,
        summary: `Create the calendar event "${summary}".`,
        description: 'Teama will create the event only after the user approves it.',
        params: { summary, description, start, end, attendees, location }
      })
    });
  }

  return tools;
}

function buildGoogleWorkspaceToolset(userId, toolAccess = {}) {
  const tools = {};

  if (toolAccess.getGoogleDriveFiles) {
    tools.getGoogleDriveFiles = tool({
      description: 'Search or list files in the user\'s Google Drive.',
      inputSchema: z.object({
        query: z.string().optional().describe('Google Drive search query (e.g., "name contains \"report\"").')
      }),
      execute: async ({ query }) => {
        const context = await resolveGoogleWorkspaceContext(userId);
        return await googleWorkspaceService.listFiles(context.accessToken, query);
      }
    });
  }

  if (toolAccess.getGoogleDriveFileInfo) {
    tools.getGoogleDriveFileInfo = tool({
      description: 'Get detailed metadata for a specific Google Drive file.',
      inputSchema: z.object({
        fileId: z.string().describe('The ID of the file to inspect.')
      }),
      execute: async ({ fileId }) => {
        const context = await resolveGoogleWorkspaceContext(userId);
        return await googleWorkspaceService.getFileMetadata(context.accessToken, fileId);
      }
    });
  }

  if (toolAccess.getGoogleDocContent) {
    tools.getGoogleDocContent = tool({
      description: 'Read the full text content of a Google Document.',
      inputSchema: z.object({
        documentId: z.string().describe('The ID of the Google Doc.')
      }),
      execute: async ({ documentId }) => {
        const context = await resolveGoogleWorkspaceContext(userId);
        return await googleWorkspaceService.getDocumentContent(context.accessToken, documentId);
      }
    });
  }

  if (toolAccess.getGoogleSheetData) {
    tools.getGoogleSheetData = tool({
      description: 'Read rows and values from a Google Sheet.',
      inputSchema: z.object({
        spreadsheetId: z.string().describe('The ID of the spreadsheet.'),
        range: z.string().optional().describe('The A1 range to read (default is "A1:Z50").')
      }),
      execute: async ({ spreadsheetId, range }) => {
        const context = await resolveGoogleWorkspaceContext(userId);
        return await googleWorkspaceService.getSpreadsheetData(context.accessToken, spreadsheetId, range);
      }
    });
  }

  if (toolAccess.getGoogleSlidesText) {
    tools.getGoogleSlidesText = tool({
      description: 'Extract all text content from a Google Slides presentation.',
      inputSchema: z.object({
        presentationId: z.string().describe('The ID of the presentation.')
      }),
      execute: async ({ presentationId }) => {
        const context = await resolveGoogleWorkspaceContext(userId);
        return await googleWorkspaceService.getPresentationText(context.accessToken, presentationId);
      }
    });
  }

  return tools;
}

function buildGmailToolset(userId, toolAccess = {}) {
  const tools = {};

  if (toolAccess.searchGmailMessages) {
    tools.searchGmailMessages = tool({
      description: 'Search for emails in the user\'s Gmail inbox.',
      inputSchema: z.object({
        query: z.string().optional().describe('Gmail search query (e.g., "from:boss@company.com").')
      }),
      execute: async ({ query }) => {
        const context = await resolveGoogleWorkspaceContext(userId);
        return await gmailService.searchMessages(context.accessToken, query);
      }
    });
  }

  if (toolAccess.getGmailMessage) {
    tools.getGmailMessage = tool({
      description: 'Read the full content of a specific Gmail message.',
      inputSchema: z.object({
        messageId: z.string().describe('The ID of the Gmail message.')
      }),
      execute: async ({ messageId }) => {
        const context = await resolveGoogleWorkspaceContext(userId);
        return await gmailService.getMessageDetails(context.accessToken, messageId);
      }
    });
  }

  if (toolAccess.requestGmailSendApproval) {
    tools.requestGmailSendApproval = tool({
      description: 'Prepare a Gmail message to send on the user’s behalf. Requires approval.',
      inputSchema: z.object({
        to: z.string().describe('Recipient email address.'),
        subject: z.string().describe('Email subject line.'),
        body: z.string().describe('Email body text.')
      }),
      execute: async ({ to, subject, body }) => createApprovalRequest({
        platform: 'google_workspace',
        action: 'send_email',
        title: `Send email to ${to}`,
        summary: `Send an email to ${to} with subject "${subject}".`,
        description: 'Teama will send this email only after the user approves it.',
        params: { to, subject, body }
      })
    });
  }

  return tools;
}

function buildToolset(userId, capabilitySummaries = {}) {
  const tools = {};

  Object.assign(tools, buildSlackToolset(userId, capabilitySummaries?.slack?.toolAccess || {}));
  Object.assign(tools, buildAsanaToolset(userId, capabilitySummaries?.asana?.toolAccess || {}));
  Object.assign(tools, buildJiraToolset(userId, capabilitySummaries?.jira?.toolAccess || {}));
  Object.assign(tools, buildGithubToolset(userId, capabilitySummaries?.github?.toolAccess || {}));
  Object.assign(tools, buildGoogleCalendarToolset(userId, capabilitySummaries?.google_workspace?.toolAccess || {}));
  Object.assign(tools, buildGoogleWorkspaceToolset(userId, capabilitySummaries?.google_workspace?.toolAccess || {}));
  Object.assign(tools, buildGmailToolset(userId, capabilitySummaries?.google_workspace?.toolAccess || {}));

  return tools;
}

/**
 * Trim conversation history to the last N turns (user + assistant pairs)
 * before sending to the LLM. Keeps token costs down per the guide §3.
 */
function trimMessageHistory(messages, maxTurns = 5) {
  if (!Array.isArray(messages) || messages.length <= maxTurns * 2) return messages;
  // Always keep any leading system messages, then take the tail
  const systemMessages = messages.filter(m => m.role === 'system');
  const chatMessages   = messages.filter(m => m.role !== 'system');
  const trimmed        = chatMessages.slice(-maxTurns * 2);
  return [...systemMessages, ...trimmed];
}

export async function createAgentStream(messages, options = {}) {
  if (!options?.userId) {
    throw new Error('createAgentStream requires userId');
  }

  const capabilityPrompt = buildAgentCapabilityPrompt(options?.capabilitySummaries || {});
  const tools = buildToolset(options.userId, options?.capabilitySummaries || {});

  // Trim history to last 5 turns before sending to the LLM (guide §3)
  const trimmedMessages = trimMessageHistory(messages, 5);

  try {
    const systemSections = [
      `You are Teama AI, an intelligent work assistant.
You can read context from connected tools when read tools are available.
For any write action, you must use the approval-request tools instead of claiming the action already happened.
Never perform a write action without explicit user approval.
When an approval request tool returns a pending approval object, explain the action clearly and wait for the user to approve or reject it.
When a workflow seeded this conversation with options, treat the user's clicked option as the next instruction and continue from there.
Be concise, grounded, and honest about tool limits.`
    ];

    systemSections.push(`When reporting findings from tools:
- Prefer human-readable names (channel names, user names, issue keys, repo names) over raw IDs.
- Never expose raw internal IDs unless the user explicitly asks for them.
- Do not narrate tool function names like getChannels/getMessages in final user-facing answers. Summarize outcomes naturally.`);

    if (options?.conversationContext) {
      systemSections.push(`Workflow context:\n${options.conversationContext}`);
    }

    if (capabilityPrompt) {
      systemSections.push(capabilityPrompt);
    }

    // Worker model: Mistral Large → OpenRouter → Groq (fallback chain in router)
    const workerModel = getWorkerModel();

    const result = streamText({
      model: workerModel,
      system: systemSections.join('\n\n'),
      messages: await convertToModelMessages(trimmedMessages),
      stopWhen: stepCountIs(8),
      tools
    });

    return result;
  } catch (error) {
    logger.error('Error in AI Chat stream:', error);
    throw error;
  }
}

export async function createSlackAgentStream(messages, userToken, options = {}) {
  return createAgentStream(messages, options);
}
