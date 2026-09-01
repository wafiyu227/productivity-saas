import crypto from 'node:crypto';
import { SlackAgentTools } from './slack-tools.js';
import asanaService from './asana-service.js';
import jiraService from './jira-service.js';
import googleCalendarService from './google-calendar-service.js';
import {
  resolveAsanaContext,
  resolveGithubContext,
  resolveJiraContext,
  resolveSlackContext,
  withGoogleCalendarAccess,
  resolveGoogleWorkspaceContext
} from './agent-platform-context.js';
import gmailService from './gmail-service.js';

function normalizeText(value) {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
}

function normalizeSearchText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function getStatusBucket(statusName) {
  const normalized = normalizeSearchText(statusName);
  if (!normalized) return 'todo';
  if (/(block|hold|paused|waiting)/.test(normalized)) return 'blocked';
  if (/(done|closed|resolved|complete|completed|shipped)/.test(normalized)) return 'done';
  if (/(qa|test|testing|staging|verification)/.test(normalized)) return 'qa';
  if (/(review|approve|approval)/.test(normalized)) return 'review';
  if (/(progress|doing|development|working)/.test(normalized)) return 'progress';
  return 'todo';
}

function findBestTransition(transitions, desiredStatus) {
  const normalizedDesired = normalizeSearchText(desiredStatus);
  const desiredBucket = getStatusBucket(desiredStatus);
  const items = Array.isArray(transitions) ? transitions : [];

  return items.find((item) => normalizeSearchText(item?.name) === normalizedDesired)
    || items.find((item) => normalizeSearchText(item?.to?.name) === normalizedDesired)
    || items.find((item) => getStatusBucket(item?.name) === desiredBucket)
    || items.find((item) => getStatusBucket(item?.to?.name) === desiredBucket)
    || null;
}

function findBestNamedTarget(items, desiredStatus, getName = (item) => item?.name) {
  const normalizedDesired = normalizeSearchText(desiredStatus);
  const desiredBucket = getStatusBucket(desiredStatus);
  const list = Array.isArray(items) ? items : [];

  return list.find((item) => normalizeSearchText(getName(item)) === normalizedDesired)
    || list.find((item) => getStatusBucket(getName(item)) === desiredBucket)
    || null;
}

function parseRepoFullName(fullName) {
  const normalized = normalizeText(fullName);
  const [owner, repo] = normalized.split('/');
  if (!owner || !repo) {
    throw new Error(`Invalid repo name "${fullName}". Expected "owner/repo".`);
  }
  return { owner, repo };
}

export function createApprovalRequest({
  platform,
  action,
  title,
  summary,
  description,
  params = {}
}) {
  return {
    kind: 'approval_request',
    approvalId: crypto.randomUUID(),
    platform,
    action,
    status: 'pending',
    requiresApproval: true,
    title: normalizeText(title),
    summary: normalizeText(summary),
    description: normalizeText(description),
    params,
    createdAt: new Date().toISOString()
  };
}

function extractApprovalRequestFromPart(part) {
  const output = part?.output;
  if (!output || output.kind !== 'approval_request' || !output.approvalId) {
    return null;
  }
  return output;
}

export function findApprovalRequestInMessageRows(rows = [], approvalId) {
  for (const row of rows) {
    const uiMessage = row?.metadata?.uiMessage;
    const parts = Array.isArray(uiMessage?.parts) ? uiMessage.parts : [];

    for (let index = 0; index < parts.length; index += 1) {
      const request = extractApprovalRequestFromPart(parts[index]);
      if (request?.approvalId === approvalId) {
        return {
          row,
          uiMessage,
          partIndex: index,
          request
        };
      }
    }
  }

  return null;
}

export function patchApprovalRequestUiMessage(uiMessage, approvalId, patch = {}) {
  const nextMessage = JSON.parse(JSON.stringify(uiMessage || {}));
  const parts = Array.isArray(nextMessage?.parts) ? nextMessage.parts : [];

  nextMessage.parts = parts.map((part) => {
    const request = extractApprovalRequestFromPart(part);
    if (!request || request.approvalId !== approvalId) {
      return part;
    }

    return {
      ...part,
      output: {
        ...request,
        ...patch
      }
    };
  });

  return nextMessage;
}

export async function executeApprovalRequest(userId, request) {
  switch (`${request.platform}:${request.action}`) {
    case 'slack:send_message': {
      const context = await resolveSlackContext(userId);
      const tools = new SlackAgentTools(context.accessToken);
      const destination = request.params.channelName || request.params.channelId;
      const result = await tools.sendMessage(destination, request.params.text);
      const channelLabel = result?.channel
        || (request.params.channelName ? `#${request.params.channelName}` : request.params.channelId);
      return {
        summary: `Sent the Slack message to ${channelLabel}.`,
        link: null,
        raw: result
      };
    }

    case 'slack:create_channel': {
      const context = await resolveSlackContext(userId);
      const tools = new SlackAgentTools(context.accessToken);
      const result = await tools.createChannel(request.params.name, request.params.isPrivate);
      return {
        summary: `Created the Slack channel #${result?.channel?.name || request.params.name}.`,
        link: null,
        raw: result
      };
    }

    case 'jira:transition_issue': {
      const context = await resolveJiraContext(userId);
      const transitions = await jiraService.getIssueTransitions(context.accessToken, context.cloudId, request.params.issueKey);
      const matchedTransition = findBestTransition(transitions, request.params.desiredStatus);
      if (!matchedTransition?.id) {
        throw new Error(`No Jira transition matched "${request.params.desiredStatus}".`);
      }
      await jiraService.transitionIssue(context.accessToken, context.cloudId, request.params.issueKey, matchedTransition.id);
      const issue = await jiraService.getIssueByKey(context.accessToken, context.cloudId, request.params.issueKey, context.baseUrl);
      return {
        summary: `Moved ${issue?.key || request.params.issueKey} to ${issue?.status_name || matchedTransition?.to?.name || request.params.desiredStatus}.`,
        link: issue?.externalUrl || null,
        raw: issue
      };
    }

    case 'jira:add_comment': {
      const context = await resolveJiraContext(userId);
      await jiraService.addComment(context.accessToken, context.cloudId, request.params.issueKey, request.params.text);
      const issue = await jiraService.getIssueByKey(context.accessToken, context.cloudId, request.params.issueKey, context.baseUrl);
      return {
        summary: `Added a comment to ${issue?.key || request.params.issueKey}.`,
        link: issue?.externalUrl || null,
        raw: issue
      };
    }

    case 'asana:complete_task': {
      const context = await resolveAsanaContext(userId);
      await asanaService.setTaskCompleted(context.accessToken, request.params.taskId, true);
      const task = await asanaService.getTaskById(context.accessToken, request.params.taskId);
      return {
        summary: `Marked ${task?.name || request.params.taskId} as complete in Asana.`,
        link: task?.externalUrl || null,
        raw: task
      };
    }

    case 'asana:move_task': {
      const context = await resolveAsanaContext(userId);
      const task = await asanaService.getTaskById(context.accessToken, request.params.taskId);
      const projectId = request.params.projectId || task?.project?.gid || task?.project?.id;
      if (!projectId) {
        throw new Error('The Asana task is not attached to a project section that can be moved.');
      }
      const sections = await asanaService.getSectionsForProject(context.accessToken, projectId);
      const matchedSection = findBestNamedTarget(sections, request.params.sectionName);
      if (!matchedSection?.gid && !matchedSection?.id) {
        throw new Error(`No Asana section matched "${request.params.sectionName}".`);
      }
      await asanaService.moveTaskToSection(context.accessToken, request.params.taskId, matchedSection.gid || matchedSection.id);
      const refreshedTask = await asanaService.getTaskById(context.accessToken, request.params.taskId);
      return {
        summary: `Moved ${refreshedTask?.name || request.params.taskId} to ${matchedSection.name || request.params.sectionName} in Asana.`,
        link: refreshedTask?.externalUrl || null,
        raw: refreshedTask
      };
    }

    case 'asana:add_comment': {
      const context = await resolveAsanaContext(userId);
      await asanaService.addCommentToTask(context.accessToken, request.params.taskId, request.params.text);
      const task = await asanaService.getTaskById(context.accessToken, request.params.taskId);
      return {
        summary: `Added a comment to ${task?.name || request.params.taskId} in Asana.`,
        link: task?.externalUrl || null,
        raw: task
      };
    }

    case 'github:create_issue': {
      const context = await resolveGithubContext(userId);
      const { owner, repo } = parseRepoFullName(request.params.repoFullName);
      const result = await context.octokit.issues.create({
        owner,
        repo,
        title: request.params.title,
        body: request.params.body || ''
      });
      return {
        summary: `Created GitHub issue #${result.data.number} in ${owner}/${repo}.`,
        link: result.data.html_url,
        raw: result.data
      };
    }

    case 'github:add_issue_comment': {
      const context = await resolveGithubContext(userId);
      const { owner, repo } = parseRepoFullName(request.params.repoFullName);
      const result = await context.octokit.issues.createComment({
        owner,
        repo,
        issue_number: Number(request.params.issueNumber),
        body: request.params.body
      });
      return {
        summary: `Added a GitHub comment to ${owner}/${repo}#${request.params.issueNumber}.`,
        link: result.data.html_url,
        raw: result.data
      };
    }

    case 'github:update_issue_state': {
      const context = await resolveGithubContext(userId);
      const { owner, repo } = parseRepoFullName(request.params.repoFullName);
      const result = await context.octokit.issues.update({
        owner,
        repo,
        issue_number: Number(request.params.issueNumber),
        state: request.params.state
      });
      return {
        summary: `Updated ${owner}/${repo}#${request.params.issueNumber} to ${request.params.state}.`,
        link: result.data.html_url,
        raw: result.data
      };
    }

    case 'google_calendar:create_event': {
      const created = await withGoogleCalendarAccess(userId, async (accessToken) => (
        await googleCalendarService.createEvent(accessToken, {
          summary: request.params.summary,
          description: request.params.description,
          start: request.params.start,
          end: request.params.end,
          attendees: request.params.attendees,
          location: request.params.location
        })
      ));

      return {
        summary: `Created the calendar event "${created?.title || request.params.summary}".`,
        link: created?.htmlLink || null,
        raw: created
      };
    }

    case 'google_workspace:send_email': {
      const context = await resolveGoogleWorkspaceContext(userId);
      const result = await gmailService.sendEmail(context.accessToken, {
        to: request.params.to,
        subject: request.params.subject,
        body: request.params.body
      });
      return {
        summary: `Sent the email to ${request.params.to} with subject "${request.params.subject}".`,
        link: null,
        raw: result
      };
    }

    default:
      throw new Error(`Unsupported approval action: ${request.platform}:${request.action}`);
  }
}

export function buildApprovalResolutionMessage(request, status, executionResult = null) {
  if (status === 'rejected') {
    return `I won't carry out **${request.title || request.summary || 'that action'}**. If you want, I can suggest a safer alternative or adjust the draft before we try again.`;
  }

  const lines = [
    '### Approved',
    executionResult?.summary || `Completed **${request.title || request.summary || 'the approved action'}**.`
  ];

  if (executionResult?.link) {
    lines.push(`Link: ${executionResult.link}`);
  }

  return lines.join('\n\n');
}
