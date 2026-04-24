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
        google: { connected: false, loading: true }
    });
    const [notification, setNotification] = useState(null);
    const [oauthProcessed, setOauthProcessed] = useState(false);

    const clearPaymentQueryParams = () => {
        const url = new URL(window.location.href);
        ['payment', 'reference', 'trxref', 'plan'].forEach((param) => {
            url.searchParams.delete(param);
        });
        window.history.replaceState({}, document.title, `${url.pathname}${url.search}${url.hash}`);
    };

    const clearIntegrationQueryParams = () => {
        const url = new URL(window.location.href);
        ['error', 'success', 'message', 'state'].forEach((param) => {
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
        if (user && !oauthProcessed) {
            checkAllStatuses();
        }
    }, [user, oauthProcessed]);

    useEffect(() => {
        if (!user || oauthProcessed) return;

        const error = searchParams.get('error');
        const success = searchParams.get('success');


        if (error || success) {
            setOauthProcessed(true);

            if (error) {
                const errorMessages = {
                    oauth_failed: 'Failed to complete authentication. Please try again.',
                    slack_auth_failed: 'Slack authentication was denied. Please try again.',
                    asana_auth_failed: 'Asana authentication was denied. Please try again.',
                    jira_auth_failed: 'Jira authentication was denied. Please try again.',
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
    }, [oauthProcessed, searchParams, setSearchParams, user]);

    const checkAllStatuses = async () => {
        const platforms = ['slack', 'asana', 'jira', 'google'];

        for (const platform of platforms) {
            try {
                const res = await fetch(
                    `${API_URL}/api/auth/status?userId=${user.id}&platform=${platform}`
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
        if (!user) {
            return;
        }

        if (!['slack', 'asana', 'jira', 'google'].includes(platform)) {
            return;
        }

        const isProjectPlatform = ['asana', 'jira'].includes(platform);
        if (isProjectPlatform && connectedProjectPlatform && connectedProjectPlatform.toLowerCase() !== platform) {
            alert(`Only one project platform can be connected at once. Disconnect ${connectedProjectPlatform} first from Integrations.`);
            return;
        }

        const url = new URL(`${API_URL}/api/auth/${platform}/connect`);
        url.searchParams.set('userId', user.id);
        url.searchParams.set('returnTo', '/onboarding/connect-tools');
        window.location.href = url.toString();
    };

    const connectedProjectPlatform = statuses.jira.connected
        ? 'Jira'
        : statuses.asana.connected
            ? 'Asana'
            : null;

    const connectedCount = [
        statuses.slack.connected,
        !!connectedProjectPlatform,
        statuses.google.connected
    ].filter(Boolean).length;

    return (
        <div className="min-h-screen bg-black text-white selection:bg-gray-800 font-sans flex items-center justify-center p-4">
            <div className="max-w-2xl w-full bg-white/[0.02] border border-white/5 rounded-[2.5rem] p-8 md:p-12">
                <div className="flex flex-col items-center mb-10">
                    <h1 className="text-4xl font-bold text-white tracking-tight mb-4">Connect your tools</h1>
                    <p className="text-gray-500 text-lg text-center max-w-md">
                        Connect the tools you use daily to get summaries and insights.
                    </p>
                </div>

                {notification && (
                    <div
                        className={`mb-8 rounded-2xl border p-5 ${
                            notification.type === 'error'
                                ? 'border-red-500/20 bg-red-500/5 text-red-400'
                                : 'border-white/20 bg-white/5 text-white'
                        }`}
                    >
                        <div className="flex items-start gap-3">
                            {notification.type === 'error' ? (
                                <AlertCircle className="mt-0.5 flex-shrink-0" size={18} />
                            ) : (
                                <CheckCircle className="mt-0.5 flex-shrink-0" size={18} />
                            )}
                            <p className="text-sm font-medium">{notification.message}</p>
                        </div>
                    </div>
                )}

                <div className="space-y-4">
                    {/* Slack */}
                    <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-6 hover:border-white/10 transition-all">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-5">
                                <div className="w-12 h-12 bg-white/5 rounded-xl flex items-center justify-center text-gray-400">
                                    <Layers size={24} />
                                </div>
                                <div>
                                    <h3 className="text-sm font-bold text-white">Slack</h3>
                                    <p className="text-xs text-gray-500 mt-1">
                                        Summarize channels and identify blockers
                                    </p>
                                </div>
                            </div>

                            <div>
                                {statuses.slack.loading ? (
                                    <Loader className="animate-spin text-gray-700" size={20} />
                                ) : statuses.slack.connected ? (
                                    <div className="flex items-center gap-2 text-white/50 text-xs font-bold">
                                        <CheckCircle size={16} />
                                        Connected
                                    </div>
                                ) : (
                                    <button
                                        onClick={() => handleConnect('slack')}
                                        className="px-6 py-2 bg-white text-black rounded-lg text-xs font-bold hover:bg-gray-200 transition-all active:scale-95"
                                    >
                                        Connect
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Project Platform */}
                    <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-6 hover:border-white/10 transition-all">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-5">
                                <div className="w-12 h-12 bg-white/5 rounded-xl flex items-center justify-center text-gray-400">
                                    <Users size={24} />
                                </div>
                                <div>
                                    <h3 className="text-sm font-bold text-white">Project Management</h3>
                                    <p className="text-xs text-gray-500 mt-1">
                                        Connect Jira or Asana
                                    </p>
                                    {connectedProjectPlatform && (
                                        <p className="text-[10px] text-gray-600 mt-1 font-bold uppercase tracking-widest">
                                            Active: {connectedProjectPlatform}
                                        </p>
                                    )}
                                </div>
                            </div>

                            <div>
                                {statuses.asana.loading || statuses.jira.loading ? (
                                    <Loader className="animate-spin text-gray-700" size={20} />
                                ) : connectedProjectPlatform ? (
                                    <div className="flex items-center gap-2 text-white/50 text-xs font-bold">
                                        <CheckCircle size={16} />
                                        Connected
                                    </div>
                                ) : (
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => handleConnect('jira')}
                                            className="px-4 py-2 bg-white/5 border border-white/10 text-white rounded-lg text-xs font-bold hover:bg-white/10 transition-all active:scale-95"
                                        >
                                            Jira
                                        </button>
                                        <button
                                            onClick={() => handleConnect('asana')}
                                            className="px-4 py-2 bg-white/5 border border-white/10 text-white rounded-lg text-xs font-bold hover:bg-white/10 transition-all active:scale-95"
                                        >
                                            Asana
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Google Calendar */}
                    <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-6 hover:border-white/10 transition-all">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-5">
                                <div className="w-12 h-12 bg-white/5 rounded-xl flex items-center justify-center text-gray-400">
                                    <Calendar size={24} />
                                </div>
                                <div>
                                    <h3 className="text-sm font-bold text-white">Google Calendar</h3>
                                    <p className="text-xs text-gray-500 mt-1">
                                        Sync meetings and schedules
                                    </p>
                                </div>
                            </div>

                            <div>
                                {statuses.google.loading ? (
                                    <Loader className="animate-spin text-gray-700" size={20} />
                                ) : statuses.google.connected ? (
                                    <div className="flex items-center gap-2 text-white/50 text-xs font-bold">
                                        <CheckCircle size={16} />
                                        Connected
                                    </div>
                                ) : (
                                    <button
                                        onClick={() => handleConnect('google')}
                                        className="px-6 py-2 bg-white text-black rounded-lg text-xs font-bold hover:bg-gray-200 transition-all active:scale-95"
                                    >
                                        Connect
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="mt-12 flex items-center justify-between">
                    <p className="text-xs font-bold text-gray-700 uppercase tracking-widest">
                        {connectedCount}/3 Connected
                    </p>

                    <div className="flex gap-4">
                        <button
                            onClick={() => navigate('/app/dashboard')}
                            className="text-xs font-bold text-gray-600 hover:text-white transition-colors"
                        >
                            Skip for now
                        </button>
                        <button
                            onClick={() => navigate('/app/dashboard')}
                            className="px-8 py-3 bg-white text-black rounded-xl text-sm font-bold hover:bg-gray-200 transition-all active:scale-95 flex items-center gap-2"
                        >
                            Continue
                            <ArrowRight size={18} />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
