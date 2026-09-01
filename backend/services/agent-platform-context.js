import { Octokit } from '@octokit/rest';
import asanaService from './asana-service.js';
import jiraService from './jira-service.js';
import googleCalendarService from './google-calendar-service.js';
import { db } from './supabase-client.js';

export function isUnauthorizedError(error) {
  return error?.status === 401 || error?.status === 403 || /unauthorized|forbidden|expired/i.test(String(error?.message || ''));
}

async function persistIntegration(userId, platform, integration, tokens = {}) {
  await db.saveIntegration(userId, platform, {
    accessToken: tokens.accessToken || integration?.access_token,
    refreshToken: tokens.refreshToken !== undefined ? tokens.refreshToken : integration?.refresh_token,
    expiresAt: tokens.expiresAt !== undefined ? tokens.expiresAt : integration?.expires_at,
    workspaceId: tokens.workspaceId !== undefined ? tokens.workspaceId : integration?.workspace_id,
    workspaceName: tokens.workspaceName !== undefined ? tokens.workspaceName : integration?.workspace_name
  });
}

export async function resolveSlackContext(userId) {
  const integration = await db.getIntegration(userId, 'slack');
  if (!integration?.access_token) {
    const error = new Error('Slack not connected');
    error.status = 401;
    throw error;
  }

  return {
    platform: 'slack',
    integration,
    accessToken: integration.access_token,
    workspaceName: integration.workspace_name || 'Slack'
  };
}

export async function resolveGithubContext(userId) {
  const integration = await db.getIntegration(userId, 'github');
  if (!integration?.access_token) {
    const error = new Error('GitHub not connected');
    error.status = 401;
    throw error;
  }

  return {
    platform: 'github',
    integration,
    octokit: new Octokit({ auth: integration.access_token }),
    workspaceName: integration.workspace_name || 'GitHub'
  };
}

export async function resolveJiraContext(userId) {
  const integration = await db.getIntegration(userId, 'jira');
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

      await persistIntegration(userId, 'jira', integration, {
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
    await persistIntegration(userId, 'jira', integration, {
      accessToken,
      refreshToken,
      workspaceId: workspace.cloudId,
      workspaceName: workspace.name
    });
  }

  return {
    platform: 'jira',
    integration,
    accessToken,
    cloudId: workspace?.cloudId || integration.workspace_id,
    baseUrl: workspace?.url || null,
    workspaceName: workspace?.name || integration.workspace_name || 'Jira'
  };
}

export async function resolveAsanaContext(userId) {
  const integration = await db.getIntegration(userId, 'asana');
  if (!integration) {
    const error = new Error('Asana not connected');
    error.status = 401;
    throw error;
  }

  let accessToken = integration.access_token;
  let refreshToken = integration.refresh_token;
  let workspaces;

  try {
    workspaces = await asanaService.getWorkspaces(accessToken);
  } catch (error) {
    if (isUnauthorizedError(error) && refreshToken) {
      const refreshed = await asanaService.refreshAccessToken(refreshToken);
      accessToken = refreshed.accessToken;
      refreshToken = refreshed.refreshToken;

      await persistIntegration(userId, 'asana', integration, {
        accessToken,
        refreshToken,
        expiresAt: Number.isFinite(refreshed.expiresIn)
          ? new Date(Date.now() + refreshed.expiresIn * 1000).toISOString()
          : integration.expires_at
      });

      workspaces = await asanaService.getWorkspaces(accessToken);
    } else {
      throw error;
    }
  }

  const selectedWorkspace = (Array.isArray(workspaces) ? workspaces : []).find((workspace) => (
    String(workspace?.gid || '') === String(integration.workspace_id || '')
  )) || workspaces?.[0];

  if (!selectedWorkspace?.gid) {
    const error = new Error('Asana workspace not available');
    error.status = 404;
    throw error;
  }

  if (
    String(selectedWorkspace.gid) !== String(integration.workspace_id || '')
    || selectedWorkspace.name !== integration.workspace_name
  ) {
    await persistIntegration(userId, 'asana', integration, {
      accessToken,
      refreshToken,
      workspaceId: selectedWorkspace.gid,
      workspaceName: selectedWorkspace.name
    });
  }

  return {
    platform: 'asana',
    integration,
    accessToken,
    workspaceId: String(selectedWorkspace.gid),
    workspaceName: selectedWorkspace.name || 'Asana'
  };
}

function isTokenNearExpiration(expiresAt) {
  if (!expiresAt) return false;
  const bufferMs = process.env.NODE_ENV === 'production' ? 10 * 60 * 1000 : 5 * 60 * 1000;
  return Date.now() + bufferMs > new Date(expiresAt).getTime();
}

async function refreshGoogleWorkspaceIntegration(userId, integration) {
  if (!integration?.refresh_token) {
    const error = new Error('Google Workspace authorization expired. Please reconnect.');
    error.status = 401;
    throw error;
  }

  const refreshed = await googleCalendarService.refreshAccessToken(integration.refresh_token);
  const expiresAt = Number.isFinite(refreshed.expiresIn)
    ? new Date(Date.now() + refreshed.expiresIn * 1000).toISOString()
    : integration.expires_at;

  await persistIntegration(userId, 'google_workspace', integration, {
    accessToken: refreshed.accessToken,
    refreshToken: refreshed.refreshToken ?? integration.refresh_token,
    expiresAt
  });

  return await db.getIntegration(userId, 'google_workspace');
}

export async function resolveGoogleWorkspaceContext(userId) {
  let integration = await db.getIntegration(userId, 'google_workspace');
  if (!integration) {
    const error = new Error('Google Workspace not connected');
    error.status = 401;
    throw error;
  }

  if (integration.metadata?.disabled_tools?.includes('google_calendar')) {
    const error = new Error('Google Calendar access has been disabled');
    error.status = 401;
    throw error;
  }

  if (isTokenNearExpiration(integration.expires_at)) {
    integration = await refreshGoogleWorkspaceIntegration(userId, integration);
  }

  return {
    platform: 'google_workspace',
    integration,
    accessToken: integration.access_token,
    workspaceName: integration.workspace_name || 'Google Workspace'
  };
}

export async function withGoogleCalendarAccess(userId, callback) {
  let context = await resolveGoogleWorkspaceContext(userId);

  try {
    return await callback(context.accessToken, context);
  } catch (error) {
    if (isUnauthorizedError(error)) {
      const refreshed = await refreshGoogleWorkspaceIntegration(userId, context.integration);
      context = {
        ...context,
        integration: refreshed,
        accessToken: refreshed.access_token
      };
      return await callback(context.accessToken, context);
    }
    throw error;
  }
}
