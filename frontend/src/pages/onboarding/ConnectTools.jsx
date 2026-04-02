import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { CheckCircle, Loader, ExternalLink, AlertCircle } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'https://api.teamaai.xyz';

export default function ConnectTools() {
    const { user, profile } = useAuth();
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const [statuses, setStatuses] = useState({
        slack: { connected: false, loading: true },
        asana: { connected: false, loading: true },
        jira: { connected: false, loading: true },
        trello: { connected: false, loading: true },
        google: { connected: false, loading: true }
    });
    const [notification, setNotification] = useState(null);
    const [oauthProcessed, setOauthProcessed] = useState(false);

    const teamId = profile?.current_team_id || sessionStorage.getItem('onboarding_team_id');

    const clearPaymentQueryParams = () => {
        const url = new URL(window.location.href);
        ['payment', 'reference', 'trxref', 'plan'].forEach((param) => {
            url.searchParams.delete(param);
        });
        window.history.replaceState({}, document.title, `${url.pathname}${url.search}${url.hash}`);
    };

    const clearIntegrationQueryParams = () => {
        const url = new URL(window.location.href);
        ['error', 'success', 'message', 'trello_oauth', 'state'].forEach((param) => {
            url.searchParams.delete(param);
        });
        window.history.replaceState({}, document.title, `${url.pathname}${url.search}`);
        setSearchParams(url.searchParams);
    };

    useEffect(() => {
        if (searchParams.get('payment') !== 'success') return;
        
        // Note: With Paddle, subscription updates happen via webhooks, not client-side verification
        // No need to verify payment on redirect like Paystack
        clearPaymentQueryParams();
    }, [searchParams]);

    useEffect(() => {
        if (user && teamId) {
            checkAllStatuses();
        }
    }, [user, teamId]);

    useEffect(() => {
        if (!user || !teamId || oauthProcessed) return;

        const error = searchParams.get('error');
        const success = searchParams.get('success');
        const trelloOauth = searchParams.get('trello_oauth');
        const trelloState = searchParams.get('state');

        if (trelloOauth === '1') {
            setOauthProcessed(true);

            const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
            const trelloToken = hashParams.get('token') || hashParams.get('access_token');

            if (!trelloToken || !trelloState) {
                setNotification({
                    type: 'error',
                    message: 'Trello authorization did not return a valid token. Please try again.'
                });
                clearIntegrationQueryParams();
                return;
            }

            const saveTrelloToken = async () => {
                try {
                    const response = await fetch(`${API_URL}/api/auth/trello/token`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            token: trelloToken,
                            state: trelloState
                        })
                    });

                    const data = await response.json().catch(() => ({}));
                    if (!response.ok) {
                        throw new Error(data.error || 'Failed to store Trello token');
                    }

                    setNotification({
                        type: 'success',
                        message: 'Trello workspace connected successfully!'
                    });

                    await checkAllStatuses();
                } catch (tokenError) {
                    setNotification({
                        type: 'error',
                        message: tokenError.message || 'Failed to complete Trello authentication.'
                    });
                } finally {
                    clearIntegrationQueryParams();
                }
            };

            saveTrelloToken();
            return;
        }

        if (error || success) {
            setOauthProcessed(true);

            if (error) {
                const errorMessages = {
                    oauth_failed: 'Failed to complete authentication. Please try again.',
                    slack_auth_failed: 'Slack authentication was denied. Please try again.',
                    asana_auth_failed: 'Asana authentication was denied. Please try again.',
                    jira_auth_failed: 'Jira authentication was denied. Please try again.',
                    trello_auth_failed: 'Trello authentication was denied. Please try again.',
                    google_auth_failed: 'Google authentication was denied. Please try again.',
                    missing_params: 'Missing required parameters. Please try again.'
                };

                let message = errorMessages[error] || 'An error occurred during authentication.';
                const debugMessage = searchParams.get('message');
                if (debugMessage && error === 'oauth_failed') {
                    message += ` (Error: ${decodeURIComponent(debugMessage)})`;
                }

                setNotification({
                    type: 'error',
                    message
                });
            } else if (success) {
                const successMessages = {
                    slack_connected: 'Slack workspace connected successfully!',
                    asana_connected: 'Asana workspace connected successfully!',
                    jira_connected: 'Jira workspace connected successfully!',
                    trello_connected: 'Trello workspace connected successfully!',
                    google_connected: 'Google Calendar connected successfully!'
                };

                setNotification({
                    type: 'success',
                    message: successMessages[success] || 'Connected successfully!'
                });

                checkAllStatuses();
            }

            clearIntegrationQueryParams();
        }
    }, [oauthProcessed, searchParams, setSearchParams, teamId, user]);

    const checkAllStatuses = async () => {
        const platforms = ['slack', 'asana', 'jira', 'trello', 'google'];

        for (const platform of platforms) {
            try {
                const res = await fetch(
                    `${API_URL}/api/auth/status?userId=${user.id}&platform=${platform}&teamId=${teamId}`
                );
                const data = await res.json();

                setStatuses(prev => ({
                    ...prev,
                    [platform]: { connected: data.connected, loading: false }
                }));
            } catch (error) {
                console.error(`Failed to check ${platform} status:`, error);
                setStatuses(prev => ({
                    ...prev,
                    [platform]: { connected: false, loading: false }
                }));
            }
        }
    };

    const handleConnect = (platform) => {
        if (!user || !teamId) {
            return;
        }

        if (!['slack', 'asana', 'jira', 'trello', 'google'].includes(platform)) {
            return;
        }

        const isProjectPlatform = ['asana', 'jira', 'trello'].includes(platform);
        if (isProjectPlatform && connectedProjectPlatform && connectedProjectPlatform.toLowerCase() !== platform) {
            alert(`Only one project platform can be connected at once. Disconnect ${connectedProjectPlatform} first from Integrations.`);
            return;
        }

        const url = new URL(`${API_URL}/api/auth/${platform}/connect`);
        url.searchParams.set('userId', user.id);
        url.searchParams.set('teamId', teamId);
        url.searchParams.set('scope', 'team');
        url.searchParams.set('returnTo', '/onboarding/connect-tools');
        window.location.href = url.toString();
    };

    const connectedProjectPlatform = statuses.jira.connected
        ? 'Jira'
        : statuses.asana.connected
            ? 'Asana'
            : statuses.trello.connected
                ? 'Trello'
                : null;

    const connectedCount = [
        statuses.slack.connected,
        !!connectedProjectPlatform,
        statuses.google.connected
    ].filter(Boolean).length;

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 flex items-center justify-center p-4">
            <div className="max-w-2xl w-full bg-white rounded-2xl shadow-xl p-8">
                <div className="flex flex-col items-center mb-8">
                    <img src="/logo.png" alt="Teama AI Logo" className="w-12 h-12 object-contain mb-4" />
                    <h1 className="text-3xl font-bold text-gray-900 mb-2">Connect Your Team's Tools</h1>
                </div>
                <p className="text-gray-600 mb-8 text-center sm:text-left">
                    These integrations will be shared with all team members. You can always add more later.
                </p>

                {notification && (
                    <div
                        className={`mb-6 rounded-lg border p-4 ${
                            notification.type === 'error'
                                ? 'border-red-200 bg-red-50 text-red-800'
                                : 'border-green-200 bg-green-50 text-green-800'
                        }`}
                    >
                        <div className="flex items-start gap-3">
                            {notification.type === 'error' ? (
                                <AlertCircle className="mt-0.5 flex-shrink-0" size={18} />
                            ) : (
                                <CheckCircle className="mt-0.5 flex-shrink-0" size={18} />
                            )}
                            <p className="text-sm">{notification.message}</p>
                        </div>
                    </div>
                )}

                <div className="space-y-4">
                    {/* Slack */}
                    <div className="border border-gray-200 rounded-xl p-6 hover:border-purple-300 transition">
                        <div className="flex items-start justify-between">
                            <div className="flex items-start gap-4 flex-1">
                                <img
                                    src="https://upload.wikimedia.org/wikipedia/commons/d/d5/Slack_icon_2019.svg"
                                    alt="Slack"
                                    className="w-12 h-12 rounded-lg"
                                />
                                <div className="flex-1">
                                    <h3 className="text-lg font-semibold text-gray-900">Slack</h3>
                                    <p className="text-sm text-gray-600 mt-1">
                                        Get AI summaries of your team channels and detect blockers
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-center gap-3">
                                {statuses.slack.loading ? (
                                    <Loader className="animate-spin text-gray-400" size={20} />
                                ) : statuses.slack.connected ? (
                                    <div className="flex items-center gap-2 text-green-600">
                                        <CheckCircle size={20} />
                                        <span className="text-sm font-medium">Connected</span>
                                    </div>
                                ) : (
                                    <button
                                        onClick={() => handleConnect('slack')}
                                        className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition flex items-center gap-2"
                                    >
                                        Connect
                                        <ExternalLink size={16} />
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Project Platform */}
                    <div className="border border-gray-200 rounded-xl p-6 hover:border-purple-300 transition">
                        <div className="flex items-start justify-between">
                            <div className="flex items-start gap-4 flex-1">
                                <img
                                    src="https://upload.wikimedia.org/wikipedia/commons/3/3b/Asana_logo.svg"
                                    alt="Project Platform"
                                    className="w-12 h-12 rounded-lg"
                                />
                                <div className="flex-1">
                                    <h3 className="text-lg font-semibold text-gray-900">Project Platform</h3>
                                    <p className="text-sm text-gray-600 mt-1">
                                        Use one platform at a time (Jira, Asana, or Trello)
                                    </p>
                                    <p className="text-xs text-gray-500 mt-2">
                                        Active: {connectedProjectPlatform || 'None'}
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-center gap-3">
                                {statuses.asana.loading || statuses.jira.loading || statuses.trello.loading ? (
                                    <Loader className="animate-spin text-gray-400" size={20} />
                                ) : connectedProjectPlatform ? (
                                    <div className="flex items-center gap-2 text-green-600">
                                        <CheckCircle size={20} />
                                        <span className="text-sm font-medium">{connectedProjectPlatform} Connected</span>
                                    </div>
                                ) : (
                                    <div className="flex flex-wrap items-center gap-2">
                                        <button
                                            onClick={() => handleConnect('jira')}
                                            className="px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition text-sm flex items-center gap-2"
                                        >
                                            Jira
                                            <ExternalLink size={14} />
                                        </button>
                                        <button
                                            onClick={() => handleConnect('asana')}
                                            className="px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition text-sm flex items-center gap-2"
                                        >
                                            Asana
                                            <ExternalLink size={14} />
                                        </button>
                                        <button
                                            onClick={() => handleConnect('trello')}
                                            className="px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition text-sm flex items-center gap-2"
                                        >
                                            Trello
                                            <ExternalLink size={14} />
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Google Calendar */}
                    <div className="border border-gray-200 rounded-xl p-6 hover:border-purple-300 transition">
                        <div className="flex items-start justify-between">
                            <div className="flex items-start gap-4 flex-1">
                                <img
                                    src="https://upload.wikimedia.org/wikipedia/commons/a/a5/Google_Calendar_icon_%282020%29.svg"
                                    alt="Google Calendar"
                                    className="w-12 h-12 rounded-lg"
                                />
                                <div className="flex-1">
                                    <h3 className="text-lg font-semibold text-gray-900">Google Calendar</h3>
                                    <p className="text-sm text-gray-600 mt-1">
                                        Sync meetings and team schedules
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-center gap-3">
                                {statuses.google.loading ? (
                                    <Loader className="animate-spin text-gray-400" size={20} />
                                ) : statuses.google.connected ? (
                                    <div className="flex items-center gap-2 text-green-600">
                                        <CheckCircle size={20} />
                                        <span className="text-sm font-medium">Connected</span>
                                    </div>
                                ) : (
                                    <button
                                        onClick={() => handleConnect('google')}
                                        className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition flex items-center gap-2"
                                    >
                                        Connect
                                        <ExternalLink size={16} />
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="mt-8 flex items-center justify-between">
                    <p className="text-sm text-gray-600">
                        Connected: {connectedCount}/3
                    </p>

                    <div className="flex gap-3">
                        <button
                            onClick={() => navigate('/onboarding/invite-team')}
                            className="px-6 py-3 text-gray-700 hover:text-gray-900 transition"
                        >
                            Skip for now
                        </button>
                        <button
                            onClick={() => navigate('/onboarding/invite-team')}
                            className="px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg font-semibold hover:shadow-lg transition"
                        >
                            Continue →
                        </button>
                    </div>
                </div>

                <p className="text-xs text-gray-500 mt-4 text-center">
                    💡 Tip: You can add more integrations later from Settings
                </p>
            </div>
        </div>
    );
}
