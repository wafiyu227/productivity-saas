import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { CheckCircle, Loader, ExternalLink } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL;

export default function ConnectTools() {
    const { user, profile } = useAuth();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const [statuses, setStatuses] = useState({
        slack: { connected: false, loading: true },
        asana: { connected: false, loading: true },
        google: { connected: false, loading: true }
    });

    const teamId = profile?.current_team_id || sessionStorage.getItem('onboarding_team_id');

    const clearPaymentQueryParams = () => {
        const url = new URL(window.location.href);
        ['payment', 'reference', 'trxref', 'plan'].forEach((param) => {
            url.searchParams.delete(param);
        });
        window.history.replaceState({}, document.title, `${url.pathname}${url.search}${url.hash}`);
    };

    useEffect(() => {
        if (searchParams.get('payment') !== 'success') return;
        const reference = searchParams.get('reference') || searchParams.get('trxref');
        if (!reference) {
            alert('Payment succeeded, but no transaction reference was returned. Please refresh in a few seconds.');
            clearPaymentQueryParams();
            return;
        }

        const verifyPaymentFromRedirect = async () => {
            try {
                const res = await fetch(`${API_URL}/api/paystack/verify`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ reference })
                });

                const data = await res.json();
                if (!res.ok) {
                    throw new Error(data.error || 'Failed to verify payment');
                }

                alert('Your subscription was updated successfully!');
            } catch (error) {
                console.error('Payment verification error:', error);
                alert(`Payment succeeded, but plan update is still processing: ${error.message}`);
            } finally {
                clearPaymentQueryParams();
            }
        };

        verifyPaymentFromRedirect();
    }, [searchParams]);

    useEffect(() => {
        if (user && teamId) {
            checkAllStatuses();
        }
    }, [user, teamId]);

    const checkAllStatuses = async () => {
        const platforms = ['slack', 'asana', 'google'];

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
        // Note: oauth callback should lead back here or to next onboarding step
        window.location.href = `${API_URL}/api/auth/${platform}/connect?userId=${user.id}&teamId=${teamId}&scope=team`;
    };

    const connectedCount = Object.values(statuses).filter(s => s.connected).length;

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 flex items-center justify-center p-4">
            <div className="max-w-2xl w-full bg-white rounded-2xl shadow-xl p-8">
                <h1 className="text-3xl font-bold text-gray-900 mb-2">Connect Your Team's Tools</h1>
                <p className="text-gray-600 mb-8">
                    These integrations will be shared with all team members. You can always add more later.
                </p>

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

                    {/* Asana */}
                    <div className="border border-gray-200 rounded-xl p-6 hover:border-purple-300 transition">
                        <div className="flex items-start justify-between">
                            <div className="flex items-start gap-4 flex-1">
                                <img
                                    src="https://upload.wikimedia.org/wikipedia/commons/3/3b/Asana_logo.svg"
                                    alt="Asana"
                                    className="w-12 h-12 rounded-lg"
                                />
                                <div className="flex-1">
                                    <h3 className="text-lg font-semibold text-gray-900">Asana</h3>
                                    <p className="text-sm text-gray-600 mt-1">
                                        Track tasks and project progress with AI insights
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-center gap-3">
                                {statuses.asana.loading ? (
                                    <Loader className="animate-spin text-gray-400" size={20} />
                                ) : statuses.asana.connected ? (
                                    <div className="flex items-center gap-2 text-green-600">
                                        <CheckCircle size={20} />
                                        <span className="text-sm font-medium">Connected</span>
                                    </div>
                                ) : (
                                    <button
                                        onClick={() => handleConnect('asana')}
                                        className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition flex items-center gap-2"
                                    >
                                        Connect
                                        <ExternalLink size={16} />
                                    </button>
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
