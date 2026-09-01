const DEFAULT_SLACK_USER_SCOPES = [
  'channels:history',
  'channels:read',
  'channels:write',
  'chat:write',
  'groups:history',
  'groups:read',
  'groups:write',
  'im:history',
  'im:read',
  'im:write',
  'mpim:history',
  'mpim:read',
  'mpim:write',
  'users:read',
  'users.profile:read',
  'files:read',
  'files:write'
];

const DEFAULT_GITHUB_SCOPES = [
  'repo',
  'read:user',
  'read:org'
];

const DEFAULT_JIRA_SCOPES = (process.env.JIRA_SCOPES || 'read:jira-user read:jira-work write:jira-work offline_access')
  .split(/[,\s]+/)
  .filter(Boolean);

const DEFAULT_GOOGLE_WORKSPACE_SCOPES = [
  'https://www.googleapis.com/auth/drive',
  'https://www.googleapis.com/auth/presentations',
  'https://www.googleapis.com/auth/documents',
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/calendar.events',
  'https://mail.google.com/'
];

const DEFAULT_ASANA_SCOPES = ['default'];

const SLACK_SCOPE_LABELS = {
  'channels:history': 'Read public channel history',
  'channels:read': 'Browse public channels',
  'channels:write': 'Create or manage public channels',
  'chat:write': 'Send Slack messages',
  'groups:history': 'Read private channel history',
  'groups:read': 'Browse private channels',
  'groups:write': 'Create or manage private channels',
  'im:history': 'Read direct message history',
  'im:read': 'Access direct message channels',
  'im:write': 'Write in direct messages',
  'mpim:history': 'Read group direct message history',
  'mpim:read': 'Access group direct messages',
  'mpim:write': 'Write in group direct messages',
  'users:read': 'Read Slack members',
  'users.profile:read': 'Read member profiles',
  'files:read': 'Read Slack files',
  'files:write': 'Write Slack files'
};

const SLACK_AGENT_CAPABILITY_DEFINITIONS = [
  {
    id: 'browse_channels',
    label: 'Browse channels',
    access: 'read',
    description: 'List public and private Slack channels the connected user can access.',
    toolNames: ['getChannels'],
    requiredScopes: ['channels:read', 'groups:read'],
    optionalScopes: [],
    match: 'any'
  },
  {
    id: 'read_messages',
    label: 'Read message history',
    access: 'read',
    description: 'Read recent Slack conversations so the agent can summarize, detect blockers, and draft with context.',
    toolNames: ['getMessages'],
    requiredScopes: ['channels:history', 'groups:history', 'im:history', 'mpim:history'],
    optionalScopes: [],
    match: 'any'
  },
  {
    id: 'read_people',
    label: 'Read people and profiles',
    access: 'read',
    description: 'Look up active Slack members and basic profile details before drafting or routing work.',
    toolNames: ['getUsers'],
    requiredScopes: ['users:read'],
    optionalScopes: ['users.profile:read'],
    match: 'all'
  },
  {
    id: 'send_messages',
    label: 'Send messages',
    access: 'write',
    description: 'Post messages to Slack channels on the user\'s behalf after approval.',
    toolNames: ['requestSlackMessageApproval'],
    requiredScopes: ['chat:write'],
    optionalScopes: [],
    match: 'all'
  },
  {
    id: 'create_channels',
    label: 'Create channels',
    access: 'write',
    description: 'Create new public or private Slack channels after approval.',
    toolNames: ['requestSlackChannelApproval'],
    requiredScopes: ['channels:write', 'groups:write'],
    optionalScopes: [],
    match: 'any'
  }
];

const GITHUB_AGENT_CAPABILITY_DEFINITIONS = [
  {
    id: 'read_code',
    label: 'Analyze code and PRs',
    access: 'read',
    description: 'Read repositories, pull requests, and issue context.',
    toolNames: ['getGithubRepos', 'getGithubPulls', 'getGithubIssue'],
    requiredScopes: ['repo', 'public_repo'],
    match: 'any'
  },
  {
    id: 'manage_issues',
    label: 'Track issues',
    access: 'write',
    description: 'Create issues, add comments, and update issue state after approval.',
    toolNames: ['requestGithubIssueApproval', 'requestGithubCommentApproval', 'requestGithubIssueStateApproval'],
    requiredScopes: ['repo', 'public_repo'],
    match: 'any'
  },
  {
    id: 'user_collaboration',
    label: 'User collaboration',
    access: 'read',
    description: 'Access organizational collaboration context and ownership info.',
    toolNames: ['getGithubRepos'],
    requiredScopes: ['read:user', 'read:org'],
    match: 'any'
  }
];

const JIRA_AGENT_CAPABILITY_DEFINITIONS = [
  {
    id: 'read_issues',
    label: 'Read Jira issues',
    access: 'read',
    description: 'Fetch issues, transitions, and backlog context from connected Jira projects.',
    toolNames: ['getJiraProjects', 'getJiraTasks', 'getJiraIssue', 'getJiraTransitions'],
    requiredScopes: ['read:jira-work'],
    match: 'any'
  },
  {
    id: 'manage_tasks',
    label: 'Update tickets',
    access: 'write',
    description: 'Transition Jira issues and add comments after approval.',
    toolNames: ['requestJiraTransitionApproval', 'requestJiraCommentApproval'],
    requiredScopes: ['write:jira-work'],
    match: 'any'
  },
  {
    id: 'project_insights',
    label: 'Project velocity analytics',
    access: 'read',
    description: 'Analyze sprint velocity and project health data.',
    toolNames: ['getJiraTasks'],
    requiredScopes: ['read:jira-work'],
    match: 'any'
  }
];

const GOOGLE_AGENT_CAPABILITY_DEFINITIONS = [
  {
    id: 'read_events',
    label: 'Meeting summaries',
    access: 'read',
    description: 'Read calendar events to summarize meetings and extract action items.',
    toolNames: ['getCalendarEvents', 'getCalendarEventDetails', 'getCalendarActionItems'],
    requiredScopes: [
      'https://www.googleapis.com/auth/calendar.readonly',
      'https://www.googleapis.com/auth/calendar.events.readonly',
      'https://www.googleapis.com/auth/calendar',
      'https://www.googleapis.com/auth/calendar.events'
    ],
    match: 'any',
    virtualTool: 'google_calendar'
  },
  {
    id: 'manage_schedule',
    label: 'Schedule optimization',
    access: 'write',
    description: 'Create or update calendar events after approval.',
    toolNames: ['requestCalendarEventApproval'],
    requiredScopes: ['https://www.googleapis.com/auth/calendar.events', 'https://www.googleapis.com/auth/calendar'],
    match: 'any',
    virtualTool: 'google_calendar'
  },
  {
    id: 'manage_drive',
    label: 'Drive access',
    access: 'read_write',
    description: 'Read and change Google Drive files when Drive tools are wired.',
    toolNames: ['getGoogleDriveFiles', 'getGoogleDriveFileInfo'],
    requiredScopes: ['https://www.googleapis.com/auth/drive', 'https://www.googleapis.com/auth/drive.readonly', 'https://www.googleapis.com/auth/drive.metadata.readonly'],
    match: 'any',
    virtualTool: 'google_drive'
  },
  {
    id: 'manage_docs',
    label: 'Docs access',
    access: 'read_write',
    description: 'Read and extract text from Google Documents.',
    toolNames: ['getGoogleDocContent'],
    requiredScopes: ['https://www.googleapis.com/auth/documents', 'https://www.googleapis.com/auth/documents.readonly'],
    match: 'any',
    virtualTool: 'google_docs'
  },
  {
    id: 'manage_sheets',
    label: 'Sheets access',
    access: 'read_write',
    description: 'Read rows and cell values from Google Sheets.',
    toolNames: ['getGoogleSheetData'],
    requiredScopes: ['https://www.googleapis.com/auth/spreadsheets', 'https://www.googleapis.com/auth/spreadsheets.readonly'],
    match: 'any',
    virtualTool: 'google_sheets'
  },
  {
    id: 'manage_slides',
    label: 'Slides access',
    access: 'read_write',
    description: 'Extract text content from Google Slides presentations.',
    toolNames: ['getGoogleSlidesText'],
    requiredScopes: ['https://www.googleapis.com/auth/presentations', 'https://www.googleapis.com/auth/presentations.readonly'],
    match: 'any',
    virtualTool: 'google_slides'
  },
  {
    id: 'manage_gmail',
    label: 'Gmail access',
    access: 'read_write',
    description: 'Read and send Gmail messages when Gmail tools are wired.',
    toolNames: ['searchGmailMessages', 'getGmailMessage', 'requestGmailSendApproval'],
    requiredScopes: ['https://mail.google.com/', 'https://www.googleapis.com/auth/gmail.readonly', 'https://www.googleapis.com/auth/gmail.send'],
    match: 'any',
    virtualTool: 'gmail'
  }
];

const ASANA_AGENT_CAPABILITY_DEFINITIONS = [
  {
    id: 'read_tasks',
    label: 'Task tracking',
    access: 'read',
    description: 'Read Asana tasks, projects, and sections.',
    toolNames: ['getAsanaProjects', 'getAsanaTasks', 'getAsanaTask'],
    requiredScopes: ['default'],
    match: 'any'
  },
  {
    id: 'manage_tasks',
    label: 'Update Asana tasks',
    access: 'write',
    description: 'Complete tasks, move tasks, and add comments after approval.',
    toolNames: ['requestAsanaCompleteApproval', 'requestAsanaMoveApproval', 'requestAsanaCommentApproval'],
    requiredScopes: ['default'],
    match: 'any'
  }
];

const PLATFORM_DEFINITIONS = {
  slack: SLACK_AGENT_CAPABILITY_DEFINITIONS,
  github: GITHUB_AGENT_CAPABILITY_DEFINITIONS,
  jira: JIRA_AGENT_CAPABILITY_DEFINITIONS,
  google_workspace: GOOGLE_AGENT_CAPABILITY_DEFINITIONS,
  google_calendar: GOOGLE_AGENT_CAPABILITY_DEFINITIONS,
  google: GOOGLE_AGENT_CAPABILITY_DEFINITIONS,
  asana: ASANA_AGENT_CAPABILITY_DEFINITIONS
};

const DEFAULT_PLATFORM_SCOPES = {
  slack: DEFAULT_SLACK_USER_SCOPES,
  github: DEFAULT_GITHUB_SCOPES,
  jira: DEFAULT_JIRA_SCOPES,
  google_workspace: DEFAULT_GOOGLE_WORKSPACE_SCOPES,
  google_calendar: DEFAULT_GOOGLE_WORKSPACE_SCOPES,
  google: DEFAULT_GOOGLE_WORKSPACE_SCOPES,
  asana: DEFAULT_ASANA_SCOPES
};

function uniqueStrings(values = []) {
  return [...new Set(values
    .filter((value) => typeof value === 'string' && value.trim())
    .map((value) => value.trim()))];
}

export function parseScopeList(value) {
  if (Array.isArray(value)) {
    return uniqueStrings(value);
  }

  if (typeof value === 'string') {
    return uniqueStrings(value.split(/[,\s]+/));
  }

  return [];
}

export function getSlackRequestedScopes() {
  const configuredScopes = parseScopeList(process.env.SLACK_USER_SCOPES);
  return configuredScopes.length > 0 ? configuredScopes : DEFAULT_SLACK_USER_SCOPES;
}

function normalizePlatform(platform) {
  if (platform === 'google' || platform === 'google_calendar' || platform === 'google_workspace') {
    return 'google_workspace';
  }
  return platform;
}

function hasRequiredScopes(grantedScopeSet, requiredScopes = [], match = 'all') {
  if (!Array.isArray(requiredScopes) || requiredScopes.length === 0) {
    return true;
  }

  if (match === 'any') {
    return requiredScopes.some((scope) => grantedScopeSet.has(scope));
  }

  return requiredScopes.every((scope) => grantedScopeSet.has(scope));
}

function isConnectionLevelScopeValue(value) {
  const normalized = String(value || '').trim().toLowerCase();
  return ['personal', 'team', 'user', 'workspace', 'org', 'organization'].includes(normalized);
}

function resolveStoredScopes(integration) {
  const integrationScope = integration?.scope;
  const integrationScopeList = isConnectionLevelScopeValue(integrationScope)
    ? []
    : parseScopeList(integrationScope);

  return uniqueStrings([
    ...parseScopeList(integration?.granted_scopes),
    ...parseScopeList(integration?.metadata?.grantedScopes),
    ...parseScopeList(integration?.metadata?.granted_scopes),
    ...parseScopeList(integration?.metadata?.scopeList),
    ...parseScopeList(integration?.metadata?.oauthScope),
    ...integrationScopeList
  ]);
}

function resolveGrantedScopes(platform, integration) {
  const normalizedPlatform = normalizePlatform(platform);
  const storedScopes = resolveStoredScopes(integration);

  if (storedScopes.length > 0) {
    return {
      grantedScopes: storedScopes,
      scopeSource: 'granted'
    };
  }

  if (!integration) {
    return {
      grantedScopes: [],
      scopeSource: 'unknown'
    };
  }

  const defaultScopes = DEFAULT_PLATFORM_SCOPES[normalizedPlatform] || [];
  return {
    grantedScopes: uniqueStrings(defaultScopes),
    scopeSource: defaultScopes.length > 0 ? 'configured' : 'unknown'
  };
}

function isDefinitionDisabled(definition, integration) {
  const disabledTools = parseScopeList(integration?.metadata?.disabled_tools);
  if (!definition?.virtualTool) return false;
  return disabledTools.includes(definition.virtualTool);
}

function buildToolAccess(capabilities = []) {
  return capabilities.reduce((acc, capability) => {
    (Array.isArray(capability?.toolNames) ? capability.toolNames : []).forEach((toolName) => {
      if (toolName) {
        acc[toolName] = true;
      }
    });
    return acc;
  }, {});
}

function buildCapabilitySummary(platform, integration, definitions = [], scopeLabelMap = {}) {
  const { grantedScopes, scopeSource } = resolveGrantedScopes(platform, integration);
  const grantedScopeSet = new Set(grantedScopes);

  const allCapabilities = definitions.map((definition) => {
    const enabledByScope = hasRequiredScopes(grantedScopeSet, definition.requiredScopes, definition.match);
    const enabled = enabledByScope && !isDefinitionDisabled(definition, integration);

    return {
      id: definition.id,
      label: definition.label,
      access: definition.access,
      description: definition.description,
      enabled,
      toolNames: definition.toolNames || [],
      requiredScopes: definition.requiredScopes || [],
      optionalScopes: definition.optionalScopes || [],
      matchedScopes: (definition.requiredScopes || []).filter((scope) => grantedScopeSet.has(scope)),
      virtualTool: definition.virtualTool || null
    };
  });

  const capabilities = allCapabilities.filter((capability) => capability.enabled && capability.toolNames.length > 0);
  const mappedScopes = new Set(
    definitions.flatMap((definition) => [
      ...(definition.requiredScopes || []),
      ...(definition.optionalScopes || [])
    ])
  );
  const scopeDetails = grantedScopes.map((scope) => ({
    scope,
    label: scopeLabelMap[scope] || scope
  }));
  const additionalScopes = scopeDetails.filter((item) => !mappedScopes.has(item.scope));

  return {
    platform: normalizePlatform(platform),
    workspace: integration?.workspace_name || integration?.team_name || null,
    scopeSource,
    grantedScopes,
    grantedScopeCount: grantedScopes.length,
    scopeDetails,
    capabilities,
    allCapabilities,
    agentActions: capabilities.map((capability) => capability.label),
    additionalScopes,
    toolAccess: buildToolAccess(capabilities),
    metadata: integration?.metadata || {}
  };
}

export function buildSlackCapabilitySummary(integration = null) {
  if (!integration) return null;
  return buildCapabilitySummary('slack', integration, SLACK_AGENT_CAPABILITY_DEFINITIONS, SLACK_SCOPE_LABELS);
}

export function buildIntegrationCapabilitySummary(platform, integration = null) {
  if (!integration) {
    return null;
  }

  const normalizedPlatform = normalizePlatform(platform);

  if (normalizedPlatform === 'slack') {
    return buildSlackCapabilitySummary(integration);
  }

  const definitions = PLATFORM_DEFINITIONS[normalizedPlatform] || [];
  return buildCapabilitySummary(normalizedPlatform, integration, definitions);
}

function buildCapabilityPrompt(summary) {
  if (!summary) return null;

  const capabilityLines = summary.capabilities.length > 0
    ? summary.capabilities.map((capability) => `- ${capability.label}: ${capability.description}`).join('\n')
    : '- No agent actions are enabled for this integration.';

  const scopeLine = summary.grantedScopes.length > 0
    ? summary.grantedScopes.join(', ')
    : 'none';

  return [
    `Connected ${summary.platform}: ${summary.workspace || 'Connected account'}.`,
    `Permissions available (${summary.scopeSource}): ${scopeLine}.`,
    `Enabled actions for ${summary.platform}:`,
    capabilityLines,
    'Only use tools that are actually enabled. If a user asks for something outside these enabled actions, explain the limitation clearly.'
  ].join('\n');
}

export function buildSlackCapabilityPrompt(slackCapabilitySummary) {
  if (!slackCapabilitySummary) {
    return 'No Slack capability context is available.';
  }

  return buildCapabilityPrompt(slackCapabilitySummary);
}

export function buildAgentCapabilityPrompt(capabilitySummaries = {}) {
  const sections = Object.values(capabilitySummaries || {})
    .map((summary) => buildCapabilityPrompt(summary))
    .filter(Boolean);

  if (!sections.length) {
    return 'No connected tool capabilities are available for this run. You can still help using the conversation context alone.';
  }

  return sections.join('\n\n');
}
