import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { CheckCircle, Loader, ExternalLink, AlertCircle, X, Shield, Activity, Link2 } from 'lucide-react';
import { useSearchParams, useNavigate } from 'react-router-dom';

const API_URL = import.meta.env.VITE_API_URL || 'https://api.teamaai.xyz';
const PROJECT_PLATFORMS = ['jira', 'asana'];
const PROJECT_PLATFORM_LABELS = {
    jira: 'Jira',
    asana: 'Asana'
};
const CONNECTABLE_PROJECT_PLATFORMS = new Set(['jira', 'asana']);
const EXTRACTOR_READY_PROJECT_PLATFORMS = new Set(['jira', 'asana']);

export default function Integrations() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [slackStatus, setSlackStatus] = useState({ connected: false, loading: true });
    const [asanaStatus, setAsanaStatus] = useState({ connected: false, loading: true });
    const [jiraStatus, setJiraStatus] = useState({ connected: false, loading: true });
    const [googleWorkspaceStatus, setGoogleWorkspaceStatus] = useState({ connected: false, loading: true });
    const [githubStatus, setGithubStatus] = useState({ connected: false, loading: true });
    
    // Virtual statuses for placeholders
    const [placeholderStatuses, setPlaceholderStatuses] = useState({
        linear: { connected: false, loading: false },
        notion: { connected: false, loading: false },
        dropbox: { connected: false, loading: false },
        figma: { connected: false, loading: false },
        airtable: { connected: false, loading: false },
        clickup: { connected: false, loading: false },
        sentry: { connected: false, loading: false },
        vercel: { connected: false, loading: false },
        intercom: { connected: false, loading: false },
        monday: { connected: false, loading: false },
        miro: { connected: false, loading: false },
        granola: { connected: false, loading: false }
    });

    const [notification, setNotification] = useState(null);
    const [searchParams, setSearchParams] = useSearchParams();
    const [oauthProcessed, setOauthProcessed] = useState(false);
    const [manageModal, setManageModal] = useState({ isOpen: false, integration: null });
    const canManageIntegrations = true;

    const integrationMetadata = {
        slack: {
            name: 'Slack',
            description: 'Manage Slack messages and insights',
            icon: 'https://upload.wikimedia.org/wikipedia/commons/d/d5/Slack_icon_2019.svg',
            category: 'Productivity',
            status: slackStatus,
            onConnect: () => handleConnect('slack'),
            onManage: () => handleManage('slack', slackStatus)
        },
        jira: {
            name: 'Jira',
            description: 'Project management and issue tracking',
            icon: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/jira/jira-original.svg',
            category: 'Productivity',
            status: jiraStatus,
            onConnect: () => handleConnect('jira'),
            onManage: () => handleManage('jira', jiraStatus)
        },
        asana: {
            name: 'Asana',
            description: 'Manage tasks and projects',
            icon: 'https://www.google.com/s2/favicons?domain=asana.com&sz=128',
            category: 'Productivity',
            status: asanaStatus,
            onConnect: () => handleConnect('asana'),
            onManage: () => handleManage('asana', asanaStatus)
        },
        google_drive: {
            name: 'Google Drive',
            description: 'Access and manage Google Drive files',
            icon: 'https://upload.wikimedia.org/wikipedia/commons/1/12/Google_Drive_icon_%282020%29.svg',
            category: 'Productivity',
            status: { ...googleWorkspaceStatus, connected: googleWorkspaceStatus.connected && !googleWorkspaceStatus.metadata?.disabled_tools?.includes('google_drive') },
            onConnect: () => handleVirtualConnect('google_drive'),
            onManage: () => handleManage('google_drive', googleWorkspaceStatus, true)
        },
        google_docs: {
            name: 'Google Docs',
            description: 'Create and edit Google Docs',
            icon: 'https://upload.wikimedia.org/wikipedia/commons/0/01/Google_Docs_logo_%282014-2020%29.svg',
            category: 'Productivity',
            status: { ...googleWorkspaceStatus, connected: googleWorkspaceStatus.connected && !googleWorkspaceStatus.metadata?.disabled_tools?.includes('google_docs') },
            onConnect: () => handleVirtualConnect('google_docs'),
            onManage: () => handleManage('google_docs', googleWorkspaceStatus, true)
        },
        google_sheets: {
            name: 'Google Sheets',
            description: 'Work with Google Sheets',
            icon: 'https://upload.wikimedia.org/wikipedia/commons/3/30/Google_Sheets_logo_%282014-2020%29.svg',
            category: 'Productivity',
            status: { ...googleWorkspaceStatus, connected: googleWorkspaceStatus.connected && !googleWorkspaceStatus.metadata?.disabled_tools?.includes('google_sheets') },
            onConnect: () => handleVirtualConnect('google_sheets'),
            onManage: () => handleManage('google_sheets', googleWorkspaceStatus, true)
        },
        google_slides: {
            name: 'Google Slides',
            description: 'Create and edit Google Slides',
            icon: 'https://upload.wikimedia.org/wikipedia/commons/1/1e/Google_Slides_logo_%282014-2020%29.svg',
            category: 'Productivity',
            status: { ...googleWorkspaceStatus, connected: googleWorkspaceStatus.connected && !googleWorkspaceStatus.metadata?.disabled_tools?.includes('google_slides') },
            onConnect: () => handleVirtualConnect('google_slides'),
            onManage: () => handleManage('google_slides', googleWorkspaceStatus, true)
        },
        google_calendar: {
            name: 'Google Calendar',
            description: 'Manage calendar and schedules',
            icon: 'https://upload.wikimedia.org/wikipedia/commons/a/a5/Google_Calendar_icon_%282020%29.svg',
            category: 'Productivity',
            status: { ...googleWorkspaceStatus, connected: googleWorkspaceStatus.connected && !googleWorkspaceStatus.metadata?.disabled_tools?.includes('google_calendar') },
            onConnect: () => handleVirtualConnect('google_calendar'),
            onManage: () => handleManage('google_calendar', googleWorkspaceStatus, true)
        },
        gmail: {
            name: 'Gmail',
            description: 'Manage Gmail emails and threads',
            icon: 'https://upload.wikimedia.org/wikipedia/commons/7/7e/Gmail_icon_%282020%29.svg',
            category: 'Productivity',
            status: { ...googleWorkspaceStatus, connected: googleWorkspaceStatus.connected && !googleWorkspaceStatus.metadata?.disabled_tools?.includes('gmail') },
            onConnect: () => handleVirtualConnect('gmail'),
            onManage: () => handleManage('gmail', googleWorkspaceStatus, true)
        },
        github: {
            name: 'GitHub',
            description: 'Source control and project monitoring',
            icon: 'https://github.githubassets.com/images/modules/logos_page/GitHub-Mark.png',
            category: 'Engineering',
            status: githubStatus,
            onConnect: () => handleConnect('github'),
            onManage: () => handleManage('github', githubStatus)
        },
        sentry: {
            name: 'Sentry',
            description: 'Intelligent error tracking and AI triage',
            icon: 'https://www.google.com/s2/favicons?domain=sentry.io&sz=128',
            category: 'Engineering',
            status: placeholderStatuses.sentry,
            onConnect: () => handleConnect('sentry')
        },
        vercel: {
            name: 'Vercel',
            description: 'Deployment health and build insight',
            icon: 'https://www.google.com/s2/favicons?domain=vercel.com&sz=128',
            category: 'Engineering',
            status: placeholderStatuses.vercel,
            onConnect: () => handleConnect('vercel')
        },
        linear: {
            name: 'Linear',
            description: 'Issue tracking for modern dev teams',
            icon: 'https://www.google.com/s2/favicons?domain=linear.app&sz=128',
            category: 'Engineering',
            status: placeholderStatuses.linear,
            onConnect: () => handleConnect('linear')
        },
        figma: {
            name: 'Figma',
            description: 'Project design and collaboration',
            icon: 'https://upload.wikimedia.org/wikipedia/commons/3/33/Figma-logo.svg',
            category: 'Engineering',
            status: placeholderStatuses.figma,
            onConnect: () => handleConnect('figma'),
            comingSoon: true
        },
        notion: {
            name: 'Notion',
            description: 'Documentation and knowledge base',
            icon: 'https://upload.wikimedia.org/wikipedia/commons/4/45/Notion_app_logo.png',
            category: 'Productivity',
            status: placeholderStatuses.notion,
            onConnect: () => handleConnect('notion')
        },
        airtable: {
            name: 'Airtable',
            description: 'Connected databases and datasets',
            icon: 'https://upload.wikimedia.org/wikipedia/commons/4/4b/Airtable_Logo.svg',
            category: 'Productivity',
            status: placeholderStatuses.airtable,
            onConnect: () => handleConnect('airtable')
        },
        clickup: {
            name: 'ClickUp',
            description: 'Task management and all-in-one suite',
            icon: 'https://upload.wikimedia.org/wikipedia/commons/d/d4/ClickUp_icon.svg',
            category: 'Productivity',
            status: placeholderStatuses.clickup,
            onConnect: () => handleConnect('clickup')
        },
        intercom: {
            name: 'Intercom',
            description: 'AI-assisted customer ops and support',
            icon: 'https://www.google.com/s2/favicons?domain=intercom.com&sz=128',
            category: 'Productivity',
            status: placeholderStatuses.intercom,
            onConnect: () => handleConnect('intercom')
        },
        monday: {
            name: 'Monday.com',
            description: 'Workflow automation and tracking',
            icon: 'https://www.google.com/s2/favicons?domain=monday.com&sz=128',
            category: 'Productivity',
            status: placeholderStatuses.monday,
            onConnect: () => handleConnect('monday')
        },
        miro: {
            name: 'Miro',
            description: 'Visual strategy and online boards',
            icon: 'https://upload.wikimedia.org/wikipedia/commons/3/33/Miro_logo.svg',
            category: 'Productivity',
            status: placeholderStatuses.miro,
            onConnect: () => handleConnect('miro')
        },
        dropbox: {
            name: 'Dropbox',
            description: 'File storage and workspace backup',
            icon: 'https://upload.wikimedia.org/wikipedia/commons/7/78/Dropbox_Icon.svg',
            category: 'Productivity',
            status: placeholderStatuses.dropbox,
            onConnect: () => handleConnect('dropbox')
        },
        granola: {
            name: 'Granola',
            description: 'AI meeting notes and transcript insights',
            icon: 'https://www.google.com/s2/favicons?domain=granola.ai&sz=128',
            category: 'Productivity',
            status: placeholderStatuses.granola,
            onConnect: () => handleConnect('granola')
        },
    };

    async function checkStatus(platform) {
        if (!user) return;
        try {
            const url = new URL(`${API_URL}/api/auth/status`);
            url.searchParams.append('userId', user.id);
            url.searchParams.append('platform', platform);

            const res = await fetch(url.toString());
            const data = await res.json();

            if (platform === 'slack') setSlackStatus({ ...data, loading: false });
            if (platform === 'asana') setAsanaStatus({ ...data, loading: false });
            if (platform === 'jira') setJiraStatus({ ...data, loading: false });
            if (platform === 'google_workspace') setGoogleWorkspaceStatus({ ...data, loading: false });
            if (platform === 'github') setGithubStatus({ ...data, loading: false });
        } catch (error) {
            console.error(`Failed to check ${platform} status:`, error);
            const fallback = { connected: false, loading: false };
            if (platform === 'slack') setSlackStatus(fallback);
            if (platform === 'asana') setAsanaStatus(fallback);
            if (platform === 'jira') setJiraStatus(fallback);
            if (platform === 'google_workspace') setGoogleWorkspaceStatus(fallback);
            if (platform === 'github') setGithubStatus(fallback);
        }
    }

    useEffect(() => {
        if (user) {
            checkStatus('slack');
            checkStatus('asana');
            checkStatus('jira');
            checkStatus('google_workspace');
            checkStatus('github');
        }
    }, [user]);

    useEffect(() => {
        const error = searchParams.get('error');
        const success = searchParams.get('success');

        if (error || success) {
            setOauthProcessed(true);

            if (error) {
                const errorMessages = {
                    'oauth_failed': 'Failed to complete authentication. Please try again.',
                    'slack_auth_failed': 'Slack authentication was denied. Please try again.',
                    'asana_auth_failed': 'Asana authentication was denied. Please try again.',
                    'jira_auth_failed': 'Jira authentication was denied. Please try again.',
                    'google_auth_failed': 'Google Workspace authentication was denied. Please try again.',
                    'github_auth_failed': 'GitHub authentication was denied. Please try again.',
                    'missing_params': 'Missing required parameters. Please try again.'
                };

                let message = errorMessages[error] || 'An error occurred during authentication.';
                const debugMessage = searchParams.get('message');
                if (debugMessage && error === 'oauth_failed') {
                    message += ` (Error: ${decodeURIComponent(debugMessage)})`;
                }

                setNotification({
                    type: 'error',
                    message: message
                });
            } else if (success) {
                const successMessages = {
                    'slack_connected': 'Slack workspace connected successfully!',
                    'asana_connected': 'Asana workspace connected successfully!',
                    'jira_connected': 'Jira workspace connected successfully!',
                    'google_workspace_connected': 'Google Workspace connected successfully!',
                    'github_connected': 'GitHub account connected successfully!'
                };
                setNotification({
                    type: 'success',
                    message: successMessages[success] || 'Connected successfully!',
                    action: 'dashboard'
                });
                if (user) {
                    checkStatus('slack');
                    checkStatus('asana');
                    checkStatus('jira');
                    checkStatus('google_workspace');
                    checkStatus('github');
                }
            }
            setSearchParams({});
        }
    }, []);

    const handleConnect = (platform) => {
        if (!user) return;

        if (PROJECT_PLATFORMS.includes(platform) && !CONNECTABLE_PROJECT_PLATFORMS.has(platform)) {
            alert(`${PROJECT_PLATFORM_LABELS[platform]} integration is coming soon.`);
            return;
        }



        const url = new URL(`${API_URL}/api/auth/${platform}/connect`);
        url.searchParams.append('userId', user.id);
        url.searchParams.append('scope', 'user');

        window.location.href = url.toString();
    };

    const handleDisconnect = async (platform) => {
        if (!user) return;

        if (PROJECT_PLATFORMS.includes(platform) && !CONNECTABLE_PROJECT_PLATFORMS.has(platform)) {
            alert(`${PROJECT_PLATFORM_LABELS[platform]} disconnect endpoint is not wired yet.`);
            return;
        }
        if (!confirm(`Disconnect ${platform}?`)) return;
        try {
            const url = new URL(`${API_URL}/api/auth/${platform}/disconnect`);
            url.searchParams.append('userId', user.id);

            const res = await fetch(url.toString(), {
                method: 'DELETE'
            });
            if (res.ok) {
                checkStatus(platform);
                if (PROJECT_PLATFORMS.includes(platform)) {
                    checkStatus('asana');
                    checkStatus('jira');
                }
                if (platform === 'google_workspace') {
                    checkStatus('google_workspace');
                }
            }
        } catch (error) {
            console.error(`Failed to disconnect ${platform}:`, error);
        }
    };

    const ALL_GOOGLE_VIRTUAL_TOOLS = ['google_drive', 'google_docs', 'google_sheets', 'google_slides', 'google_calendar', 'gmail'];

    const handleVirtualConnect = async (tool) => {
        if (!googleWorkspaceStatus.connected) {
            // First time connecting — go through full OAuth with all tools enabled
            handleConnect('google_workspace');
        } else {
            // Re-enable a previously disabled tool by going through OAuth
            // with the tool removed from the disabled list
            const currentDisabled = googleWorkspaceStatus.metadata?.disabled_tools || [];
            const newDisabled = currentDisabled.filter(t => t !== tool);

            const url = new URL(`${API_URL}/api/auth/google_workspace/connect`);
            url.searchParams.append('userId', user.id);
            if (newDisabled.length > 0) {
                url.searchParams.append('disabledTools', newDisabled.join(','));
            }
            window.location.href = url.toString();
        }
    };

    const handleVirtualDisconnect = async (tool) => {
        if (!confirm(`Disconnect ${integrationMetadata[tool]?.name || tool.replace(/_/g, ' ')}? You'll be redirected to Google to update your permissions.`)) return;

        // Add this tool to the disabled list
        const currentDisabled = googleWorkspaceStatus.metadata?.disabled_tools || [];
        const newDisabled = [...new Set([...currentDisabled, tool])];

        // Check if all tools would be disabled — if so, just disconnect entirely
        if (newDisabled.length >= ALL_GOOGLE_VIRTUAL_TOOLS.length) {
            handleDisconnect('google_workspace');
            return;
        }

        // Redirect to OAuth with the updated disabled tools list
        const url = new URL(`${API_URL}/api/auth/google_workspace/connect`);
        url.searchParams.append('userId', user.id);
        url.searchParams.append('disabledTools', newDisabled.join(','));
        window.location.href = url.toString();
    };

    const handleManage = (platform, status, isVirtual = false) => {
        let displayName = platform.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
        setManageModal({
            isOpen: true,
            integration: {
                name: displayName,
                platform: platform,
                status: status,
                isVirtual: isVirtual
            }
        });
    };



    const connectedIntegrations = Object.keys(integrationMetadata).filter(key => integrationMetadata[key].status?.connected);
    const engineeringIntegrations = Object.keys(integrationMetadata).filter(key => integrationMetadata[key].category === 'Engineering' && !integrationMetadata[key].status?.connected);
    const productivityIntegrations = Object.keys(integrationMetadata).filter(key => integrationMetadata[key].category === 'Productivity' && !integrationMetadata[key].status?.connected);

    return (
        <div className="min-h-screen bg-black text-gray-100 selection:bg-blue-500/30">
            <div className="p-4 md:p-8 lg:p-12">
                <div className="max-w-6xl mx-auto space-y-12">
                    {/* Header */}
                    <header className="flex flex-col items-center md:items-start md:flex-row md:justify-between gap-6 pb-8 border-b border-white/5">
                        <div className="flex items-center gap-4">
                            <div>
                                <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-white uppercase">Settings</h1>
                                <p className="text-gray-400 mt-1 font-bold uppercase tracking-widest text-[10px]">Connected Tools</p>
                            </div>
                        </div>
                    </header>

                    {notification && (
                        <div className={`p-4 rounded-xl flex items-center justify-between gap-3 animate-in fade-in slide-in-from-top-2 duration-300 ${notification.type === 'error'
                            ? 'bg-red-500/10 border border-red-500/20 text-red-200'
                            : 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-200'
                            }`}>
                            <div className="flex items-center gap-3 text-sm">
                                {notification.type === 'error' ? (
                                    <AlertCircle size={18} />
                                ) : (
                                    <CheckCircle size={18} />
                                )}
                                <p>{notification.message}</p>
                            </div>
                            <button onClick={() => setNotification(null)} className="text-white/40 hover:text-white transition">
                                <X size={16} />
                            </button>
                        </div>
                    )}

                    {/* Connected Section */}
                    {connectedIntegrations.length > 0 && (
                        <div className="space-y-6">
                            <div className="flex items-center justify-between px-1">
                                <h2 className="text-lg font-bold text-white uppercase tracking-tight">
                                    Connected
                                </h2>
                                <span className="text-[10px] text-white font-bold px-3 py-1 rounded-lg border border-white/10">
                                    {connectedIntegrations.length} Active
                                </span>
                            </div>
                            <div className="bg-black rounded-3xl border border-white/5 p-6 shadow-2xl">
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                    {connectedIntegrations.map(key => (
                                        <IntegrationCompactCard 
                                            key={key}
                                            {...integrationMetadata[key]}
                                            isPrimary
                                        />
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                    {/* Engineering Section */}
                    {engineeringIntegrations.length > 0 && (
                        <div className="space-y-6">
                            <h2 className="text-lg font-bold text-white px-1 uppercase tracking-tight">Engineering</h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {engineeringIntegrations.map(key => (
                                    <IntegrationCompactCard 
                                        key={key}
                                        {...integrationMetadata[key]}
                                    />
                                ))}
                            </div>
                        </div>
                    )}
 
                    {/* Productivity Section */}
                    {productivityIntegrations.length > 0 && (
                        <div className="space-y-6">
                            <h2 className="text-lg font-bold text-white px-1 uppercase tracking-tight">Productivity</h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {productivityIntegrations.map(key => (
                                    <IntegrationCompactCard 
                                        key={key}
                                        {...integrationMetadata[key]}
                                    />
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Special Notices */}
                    <div className="mt-12 flex flex-col md:flex-row gap-4">
                        <div className="flex-1 rounded-2xl border border-white/5 bg-white/[0.01] p-6">
                            <h3 className="text-sm font-bold text-white mb-2 uppercase tracking-wide">
                                Privacy
                            </h3>
                            <p className="text-xs text-gray-700 leading-relaxed font-bold uppercase tracking-widest">
                                We only sync the data needed to give you insights. Your data is private and secure.
                            </p>
                        </div>

                    </div>
                </div>
            </div>

            {manageModal.isOpen && manageModal.integration && (
                <IntegrationManageModal
                    integration={manageModal.integration}
                    onClose={() => setManageModal({ isOpen: false, integration: null })}
                    onDisconnect={() => {
                        const { platform, isVirtual } = manageModal.integration;
                        setManageModal({ isOpen: false, integration: null });
                        if (isVirtual) {
                            handleVirtualDisconnect(platform);
                        } else {
                            handleDisconnect(platform);
                        }
                    }}
                />
            )}
        </div>
    );
}

function IntegrationCompactCard({ name, description, icon, status, onConnect, onManage, isPrimary = false, comingSoon = false }) {
    return (
        <div className="group relative rounded-2xl border border-white/5 bg-white/[0.02] p-4 transition-all hover:bg-white/[0.04]">
            <div className="flex items-center justify-between gap-4 h-full">
                <div className="flex items-center gap-4 flex-1 min-w-0">
                    <div className="flex-shrink-0 w-12 h-12 bg-white/5 rounded-xl flex items-center justify-center border border-white/10 overflow-hidden">
                        <img src={icon} alt={name} className="w-8 h-8 object-contain" />
                    </div>
                    <div className="min-w-0">
                        <h3 className="text-sm font-bold text-white tracking-wide truncate uppercase">{name}</h3>
                        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest truncate mt-0.5">{description}</p>
                    </div>
                </div>

                <div className="flex-shrink-0">
                    {status?.loading ? (
                        <div className="flex items-center justify-center w-8 h-8">
                            <Loader className="animate-spin text-gray-400" size={18} />
                        </div>
                    ) : status?.connected ? (
                        <button
                            onClick={onManage}
                            className="inline-flex items-center justify-center px-4 py-2 bg-white text-black rounded-xl transition-all text-xs font-bold active:scale-95"
                        >
                            Manage
                        </button>
                    ) : comingSoon ? (
                        <span className="inline-flex items-center justify-center px-3 py-1.5 bg-white/5 text-gray-400 rounded-lg text-[10px] uppercase tracking-widest font-bold border border-white/10">
                            Soon
                        </span>
                    ) : (
                        <button
                            onClick={onConnect}
                            className="inline-flex items-center justify-center px-4 py-2 bg-white/5 hover:bg-white text-gray-400 hover:text-black rounded-xl transition-all text-xs font-bold border border-white/10 active:scale-95"
                        >
                            Connect
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}

function IntegrationManageModal({ integration, onClose, onDisconnect }) {
    const platform = integration.platform;
    const platformConfig = {
        slack: {
            name: 'Slack',
            icon: 'https://upload.wikimedia.org/wikipedia/commons/d/d5/Slack_icon_2019.svg',
            type: 'Workspace Integration',
            color: 'from-purple-600 to-blue-600'
        },
        github: {
            name: 'GitHub',
            icon: 'https://github.githubassets.com/images/modules/logos_page/GitHub-Mark.png',
            type: 'Source Control',
            color: 'from-gray-700 to-gray-900'
        },
        jira: {
            name: 'Jira',
            icon: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/jira/jira-original.svg',
            type: 'Project Management',
            color: 'from-blue-500 to-indigo-600'
        },
        asana: {
            name: 'Asana',
            icon: 'https://www.google.com/s2/favicons?domain=asana.com&sz=128',
            type: 'Project Management',
            color: 'from-red-400 to-pink-500'
        },
        google_drive: {
            name: 'Google Drive',
            icon: 'https://upload.wikimedia.org/wikipedia/commons/1/12/Google_Drive_icon_%282020%29.svg',
            type: 'Productivity Suite',
            color: 'from-blue-500 to-green-500'
        },
        google_docs: {
            name: 'Google Docs',
            icon: 'https://upload.wikimedia.org/wikipedia/commons/0/01/Google_Docs_logo_%282014-2020%29.svg',
            type: 'Productivity Suite',
            color: 'from-blue-500 to-green-500'
        },
        google_sheets: {
            name: 'Google Sheets',
            icon: 'https://upload.wikimedia.org/wikipedia/commons/3/30/Google_Sheets_logo_%282014-2020%29.svg',
            type: 'Productivity Suite',
            color: 'from-blue-500 to-green-500'
        },
        google_slides: {
            name: 'Google Slides',
            icon: 'https://upload.wikimedia.org/wikipedia/commons/1/1e/Google_Slides_logo_%282014-2020%29.svg',
            type: 'Productivity Suite',
            color: 'from-blue-500 to-green-500'
        },
        google_calendar: {
            name: 'Google Calendar',
            icon: 'https://upload.wikimedia.org/wikipedia/commons/a/a5/Google_Calendar_icon_%282020%29.svg',
            type: 'Productivity Suite',
            color: 'from-blue-500 to-green-500'
        },
        gmail: {
            name: 'Gmail',
            icon: 'https://upload.wikimedia.org/wikipedia/commons/7/7e/Gmail_icon_%282020%29.svg',
            type: 'Productivity Suite',
            color: 'from-blue-500 to-green-500'
        }
    };

    const config = platformConfig[platform] || {
        name: integration.name || platform,
        icon: '',
        type: 'Integration',
        color: 'from-blue-600 to-purple-600'
    };

    // Account name from the integration status (GitHub username, Google email, Slack workspace, etc.)
    const accountName = integration.status?.workspace || integration.status?.team || null;

    const connectionDate = integration.status?.createdAt 
        ? new Date(integration.status.createdAt).toLocaleDateString('en-US', { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
          })
        : 'Recently';

    const fallbackCapabilities = [
        { icon: '💬', label: 'Send Updates', description: 'Post activity to connected tools' },
        { icon: '📖', label: 'Read Data', description: 'Analyze history and current state' },
        { icon: '⚙️', label: 'Manage Settings', description: 'Configure tool integration' }
    ];
    
    const displayedCapabilities = Array.isArray(integration.status?.capabilities) && integration.status.capabilities.length > 0
        ? integration.status.capabilities
        : fallbackCapabilities;

    return (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 z-50">
            <div className="bg-black border border-white/10 rounded-3xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                <div className="relative p-8 border-b border-white/10">
                    <button
                        onClick={onClose}
                        className="absolute top-4 right-4 p-2 hover:bg-white/10 rounded-lg transition"
                    >
                        <X size={24} className="text-white" />
                    </button>
                    
                    <div className="flex items-center gap-4">
                        <div className="bg-white/5 border border-white/10 rounded-2xl p-2 w-16 h-16 flex items-center justify-center">
                            {config.icon ? (
                                <img 
                                    src={config.icon}
                                    alt={config.name}
                                    className="w-12 h-12 object-contain"
                                />
                            ) : (
                                <Activity className="text-white" size={32} />
                            )}
                        </div>
                        <div>
                            <h2 className="text-3xl font-bold tracking-tight text-white uppercase">{config.name}</h2>
                            <p className="text-gray-400 mt-1 uppercase tracking-widest text-[10px] font-bold">Connected Tools</p>
                        </div>
                    </div>
                </div>

                <div className="p-8 space-y-8">
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
                        <div className="flex items-start justify-between">
                            <div>
                                <div className="flex items-center gap-2 mb-3">
                                    <div className="w-1.5 h-1.5 bg-white rounded-full"></div>
                                    <span className="font-bold text-white text-xs tracking-widest uppercase">Connected</span>
                                </div>
                                <p className="text-sm text-gray-400 font-bold uppercase tracking-widest leading-relaxed">
                                    Teama is connected to {accountName ? <span className="text-white">{accountName}</span> : `your ${config.name} account`}.
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="rounded-2xl border border-white/5 bg-white/[0.01] p-4">
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">Account</p>
                            <p className="text-sm text-white font-bold truncate">
                                {accountName || config.name}
                            </p>
                        </div>
                        <div className="rounded-2xl border border-white/5 bg-white/[0.01] p-4">
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">Joined</p>
                            <p className="text-sm text-white font-bold uppercase">{connectionDate}</p>
                        </div>
                    </div>

                    <div>
                        <h3 className="text-sm font-bold text-white mb-4 uppercase tracking-wide">
                            How it works
                        </h3>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                            {displayedCapabilities.map((cap, idx) => (
                                <div key={idx} className="rounded-xl border border-white/5 bg-white/[0.01] p-4">
                                    <p className="text-xs font-bold text-white uppercase mb-1">{cap.label}</p>
                                    <p className="text-[10px] text-gray-400 mt-1 leading-relaxed font-bold uppercase tracking-widest">{cap.description}</p>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="rounded-2xl border border-white/10 bg-white/5 p-6 flex gap-4">
                        <div>
                            <h4 className="font-bold text-white text-sm mb-2 uppercase tracking-wide">Privacy</h4>
                            <p className="text-xs text-gray-700 leading-relaxed font-bold uppercase tracking-widest">
                                Your data is encrypted. We process data to give you insights and keep everything secure.
                            </p>
                        </div>
                    </div>

                    <div className="border-t border-white/5 pt-6 flex gap-4">
                        <button
                            onClick={onClose}
                            className="flex-1 px-4 py-4 bg-white/5 text-gray-400 rounded-xl hover:bg-white/10 transition font-bold text-xs uppercase tracking-widest border border-white/10"
                        >
                            Close
                        </button>
                        <button
                            onClick={onDisconnect}
                            className="flex-1 px-4 py-4 bg-white text-black rounded-xl hover:bg-gray-200 transition font-bold text-xs uppercase tracking-widest"
                        >
                            Disconnect
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
