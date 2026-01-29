import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { CheckCircle, XCircle, Loader, ExternalLink, AlertCircle } from 'lucide-react';
import { useSearchParams, useNavigate } from 'react-router-dom';

const API_URL = import.meta.env.VITE_API_URL;

export default function Integrations() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [slackStatus, setSlackStatus] = useState({ connected: false, loading: true });
    const [notification, setNotification] = useState(null);
    const [searchParams, setSearchParams] = useSearchParams();
    const [oauthProcessed, setOauthProcessed] = useState(false);

    useEffect(() => {
        if (user) {
            checkSlackStatus();
        }
    }, [user]);

    useEffect(() => {
        if (oauthProcessed) return;

        const error = searchParams.get('error');
        const success = searchParams.get('success');

        if (error || success) {
            setOauthProcessed(true);

            if (error) {
                const errorMessages = {
                    'oauth_failed': 'Failed to complete Slack authentication. Please try again.',
                    'slack_auth_failed': 'Slack authentication was denied. Please try again.',
                    'missing_params': 'Missing required parameters. Please try again.'
                };
                setNotification({
                    type: 'error',
                    message: errorMessages[error] || 'An error occurred during authentication.'
                });
            } else if (success) {
                const successMessages = {
                    'slack_connected': 'Slack workspace connected successfully!'
                };
                setNotification({
                    type: 'success',
                    message: successMessages[success] || 'Connected successfully!',
                    action: 'dashboard'
                });
                // Refresh Slack status
                if (user) {
                    checkSlackStatus();
                }
                // Clear the URL parameters
                setSearchParams({});
            }

            // Clear the URL parameters
            setSearchParams({});
        }
    }, []);

    const checkSlackStatus = async () => {
        if (!user) return;

        try {
            const res = await fetch(`${API_URL}/api/auth/slack/status?userId=${user.id}`);
            const data = await res.json();
            setSlackStatus({ ...data, loading: false });
        } catch (error) {
            console.error('Failed to check Slack status:', error);
            setSlackStatus({ connected: false, loading: false });
        }
    };

    const connectSlack = () => {
        if (!user) return;
        window.location.href = `${API_URL}/api/auth/slack/connect?userId=${user.id}`;
    };

    const disconnectSlack = async () => {
        if (!user || !confirm('Disconnect Slack workspace?')) return;

        try {
            const res = await fetch(`${API_URL}/api/auth/slack/disconnect?userId=${user.id}`, {
                method: 'DELETE'
            });

            if (res.ok) {
                setSlackStatus({ connected: false, loading: false, team: null });
            }
        } catch (error) {
            console.error('Failed to disconnect:', error);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50">
            <div className="p-8">
                <div className="max-w-4xl mx-auto">
                    {notification && (
                        <div className={`mb-6 p-4 rounded-lg flex items-center justify-between gap-3 ${
                            notification.type === 'error' 
                                ? 'bg-red-50 border border-red-200' 
                                : 'bg-green-50 border border-green-200'
                        }`}>
                            <div className="flex items-center gap-3">
                                {notification.type === 'error' ? (
                                    <AlertCircle className="text-red-600 flex-shrink-0" size={20} />
                                ) : (
                                    <CheckCircle className="text-green-600 flex-shrink-0" size={20} />
                                )}
                                <p className={notification.type === 'error' ? 'text-red-800' : 'text-green-800'}>
                                    {notification.message}
                                </p>
                            </div>
                            {notification.action === 'dashboard' && (
                                <button
                                    onClick={() => navigate('/app/dashboard')}
                                    className="ml-4 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition text-sm font-medium whitespace-nowrap flex-shrink-0"
                                >
                                    Go to Dashboard
                                </button>
                            )}
                        </div>
                    )}
                    
                    <h1 className="text-4xl font-bold text-gray-900 mb-2">Integrations</h1>
                    <p className="text-lg text-gray-600 mb-8">
                        Connect your tools to unlock AI-powered insights
                    </p>

                    <div className="space-y-6">
                        {/* Slack Integration */}
                        <IntegrationCard
                            name="Slack"
                            description="Connect your Slack workspace to generate AI summaries and detect blockers"
                            icon="https://upload.wikimedia.org/wikipedia/commons/d/d5/Slack_icon_2019.svg"
                            status={slackStatus}
                            onConnect={connectSlack}
                            onDisconnect={disconnectSlack}
                            features={[
                                'AI-powered channel summaries',
                                'Automatic blocker detection',
                                'Real-time message analysis',
                                'Multi-channel support'
                            ]}
                        />

                        {/* Asana Integration (Coming Soon) */}
                        <IntegrationCard
                            name="Asana"
                            description="Track tasks and project progress with AI insights"
                            icon="https://upload.wikimedia.org/wikipedia/commons/3/3b/Asana_logo.svg"
                            status={{ connected: false, loading: false, comingSoon: true }}
                            features={[
                                'Project health monitoring',
                                'Deadline tracking',
                                'Task dependency analysis',
                                'Team workload insights'
                            ]}
                        />

                        {/* Google Calendar (Coming Soon) */}
                        <IntegrationCard
                            name="Google Calendar"
                            description="Automatically summarize meetings and extract action items"
                            icon="https://upload.wikimedia.org/wikipedia/commons/a/a5/Google_Calendar_icon_%282020%29.svg"
                            status={{ connected: false, loading: false, comingSoon: true }}
                            features={[
                                'Meeting transcription',
                                'Action item extraction',
                                'Schedule optimization',
                                'Time analytics'
                            ]}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}

function IntegrationCard({ name, description, icon, status, onConnect, onDisconnect, features }) {
    return (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition">
            <div className="flex items-start justify-between mb-4">
                <div className="flex items-start gap-4">
                    <img src={icon} alt={name} className="w-12 h-12" />
                    <div>
                        <h3 className="text-xl font-bold text-gray-900 mb-1">{name}</h3>
                        <p className="text-gray-600">{description}</p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    {status.loading ? (
                        <Loader className="animate-spin text-gray-400" size={20} />
                    ) : status.comingSoon ? (
                        <span className="px-4 py-2 bg-gray-100 text-gray-600 rounded-lg text-sm font-medium">
                            Coming Soon
                        </span>
                    ) : status.connected ? (
                        <>
                            <div className="flex items-center gap-2 text-green-600">
                                <CheckCircle size={20} />
                                <span className="text-sm font-medium">Connected</span>
                            </div>
                            <button
                                onClick={onDisconnect}
                                className="px-4 py-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition text-sm font-medium"
                            >
                                Disconnect
                            </button>
                        </>
                    ) : (
                        <button
                            onClick={onConnect}
                            className="px-6 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:shadow-lg transition flex items-center gap-2"
                        >
                            Connect {name}
                            <ExternalLink size={16} />
                        </button>
                    )}
                </div>
            </div>

            {status.connected && status.team && (
                <div className="mb-4 p-3 bg-green-50 rounded-lg border border-green-200">
                    <p className="text-sm text-green-800">
                        <strong>Connected workspace:</strong> {status.team}
                    </p>
                </div>
            )}

            <div className="border-t border-gray-100 pt-4">
                <p className="text-sm font-semibold text-gray-900 mb-2">Features:</p>
                <ul className="grid md:grid-cols-2 gap-2">
                    {features.map((feature, i) => (
                        <li key={i} className="flex items-center gap-2 text-sm text-gray-700">
                            <CheckCircle size={16} className="text-blue-600 flex-shrink-0" />
                            {feature}
                        </li>
                    ))}
                </ul>
            </div>
        </div>
    );
}