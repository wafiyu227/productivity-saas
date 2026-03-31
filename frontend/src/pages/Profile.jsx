import { useAuth } from '../contexts/AuthContext';
import { User, Mail, Calendar, Shield, Bell, Key, Trash2 } from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';

const API_URL = import.meta.env.VITE_API_URL;
const DEFAULT_SETTINGS = {
    email_notifications: true,
    slack_notifications: true,
    blocker_alerts: false,
    daily_digest: false
};

export default function Profile() {
    const { user, signOut, supabase } = useAuth();
    const [settings, setSettings] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saved, setSaved] = useState(false);
    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState('');
    const [digestSending, setDigestSending] = useState(false);
    const [digestCooldown, setDigestCooldown] = useState(false);
    const [digestFeedback, setDigestFeedback] = useState('');

    const sanitizeSettings = useCallback((raw) => ({
        email_notifications: raw?.email_notifications ?? DEFAULT_SETTINGS.email_notifications,
        slack_notifications: raw?.slack_notifications ?? DEFAULT_SETTINGS.slack_notifications,
        blocker_alerts: raw?.blocker_alerts ?? DEFAULT_SETTINGS.blocker_alerts,
        daily_digest: raw?.daily_digest ?? DEFAULT_SETTINGS.daily_digest
    }), []);

    const fetchSettings = useCallback(async () => {
        if (!user) return;

        try {
            setLoading(true);
            const res = await fetch(`${API_URL}/api/auth/settings?userId=${user.id}`);
            const data = res.ok ? await res.json() : DEFAULT_SETTINGS;
            const safeSettings = sanitizeSettings(data);
            setSettings(safeSettings);
        } catch (error) {
            console.error('Failed to fetch settings:', error);
            setSettings(DEFAULT_SETTINGS);
        } finally {
            setLoading(false);
        }
    }, [user, sanitizeSettings]);

    useEffect(() => {
        fetchSettings();
    }, [fetchSettings]);

    const updateSettings = async (key, value) => {
        if (!settings || !user) return;

        const updatedSettings = { ...settings, [key]: value };

        // Keep digest + email settings consistent.
        if (key === 'email_notifications' && value === false) {
            updatedSettings.daily_digest = false;
        }
        if (key === 'daily_digest' && value === true) {
            updatedSettings.email_notifications = true;
        }

        const previousSettings = settings;
        setSettings(updatedSettings);
        setSaved(false);
        setSaveError('');
        setSaving(true);

        try {
            const res = await fetch(`${API_URL}/api/auth/settings`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: user.id,
                    settings: updatedSettings
                })
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || 'Failed to save settings');
            }

            setSaved(true);
            setTimeout(() => setSaved(false), 2000);
        } catch (error) {
            console.error('Failed to save settings:', error);
            setSettings(previousSettings);
            setSaveError(error.message || 'Failed to save settings');
        } finally {
            setSaving(false);
        }
    };

    const sendTestDigest = async () => {
        if (digestSending || digestCooldown) return;

        setDigestSending(true);
        setDigestFeedback('');
        try {
            const res = await fetch(`${API_URL}/api/email/daily-digest`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: user.id })
            });

            const data = await res.json();
            if (!res.ok) {
                throw new Error(data.error || 'Failed to send test digest');
            }

            setDigestFeedback('Test digest sent successfully.');
            setSaved(true);
            setTimeout(() => setSaved(false), 2000);
            setDigestCooldown(true);
            setTimeout(() => setDigestCooldown(false), 8000);
        } catch (error) {
            console.error('Failed to send test digest:', error);
            setDigestFeedback(error.message || 'Failed to send test digest');
        } finally {
            setDigestSending(false);
        }
    };

    const handleResetPassword = async () => {
        try {
            const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
                redirectTo: `${window.location.origin}/auth/callback?next=/auth/update-password`,
            });
            if (error) throw error;
            alert('Password reset email sent!');
        } catch (error) {
            console.error('Reset password error:', error);
            alert('Failed to send reset email: ' + error.message);
        }
    };

    const handleDeleteAccount = async () => {
        const confirmed = window.confirm(
            'CRITICAL WARNING\n\n' +
            'You are about to permanently delete your account and ALL associated data:\n\n' +
            '• Your profile and all settings\n' +
            '• All meetings, summaries, and analytics\n' +
            '• All integrations and API connections\n' +
            '• Team memberships and data\n\n' +
            'This action CANNOT be undone.\n\n' +
            'Click OK to continue with deletion steps.'
        );

        if (!confirmed) {
            return;
        }

        const confirmDelete = prompt(
            'To permanently delete your account, type DELETE (all caps):'
        );

        if (confirmDelete !== 'DELETE') {
            alert('Account deletion cancelled. You did not type DELETE correctly.');
            return;
        }

        try {
            const res = await fetch(`${API_URL}/api/auth/account?userId=${user.id}`, {
                method: 'DELETE'
            });

            if (res.ok) {
                alert('Your account and all data have been permanently deleted. You will now be logged out.');
                await signOut();
                window.location.href = '/';
            } else {
                const data = await res.json();
                throw new Error(data.error || 'Failed to delete account');
            }
        } catch (error) {
            console.error('Delete account error:', error);
            alert('Failed to delete account: ' + error.message);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 to-indigo-50">
            <div className="p-4 md:p-8">
                <div className="max-w-4xl mx-auto">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6 md:mb-8">
                        <h1 className="text-2xl md:text-4xl font-bold text-gray-900">Profile Settings</h1>
                        {saved && !saving && (
                            <div className="px-4 py-2 bg-green-100 text-green-700 rounded-lg text-sm font-medium">
                                Saved
                            </div>
                        )}
                    </div>

                    {saveError && (
                        <div className="mb-6 px-4 py-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
                            {saveError}
                        </div>
                    )}

                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 md:p-8 mb-6">
                        <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6 mb-6 md:mb-8">
                            <div className="w-20 h-20 md:w-24 md:h-24 bg-gradient-to-br from-blue-600 to-purple-600 rounded-full flex items-center justify-center">
                                <User className="text-white" size={40} />
                            </div>
                            <div>
                                <h2 className="text-2xl font-bold text-gray-900 mb-1">
                                    {user?.email?.split('@')[0] || 'User'}
                                </h2>
                                <p className="text-gray-600 flex items-center gap-2">
                                    <Mail size={16} />
                                    {user?.email}
                                </p>
                                <p className="text-sm text-gray-500 flex items-center gap-2 mt-1">
                                    <Calendar size={14} />
                                    Joined {new Date(user?.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                                </p>
                            </div>
                        </div>
                    </div>

                    {loading ? (
                        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center">
                            <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4" />
                            <p className="text-gray-600">Loading settings...</p>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            <SettingsSection
                                icon={<Bell className="text-blue-600" size={24} />}
                                title="Notifications"
                                description="Manage your notification preferences"
                            >
                                <ToggleSetting
                                    label="Email notifications"
                                    enabled={settings?.email_notifications}
                                    onChange={(val) => updateSettings('email_notifications', val)}
                                />
                                <ToggleSetting
                                    label="Slack notifications"
                                    enabled={settings?.slack_notifications}
                                    onChange={(val) => updateSettings('slack_notifications', val)}
                                />
                                <ToggleSetting
                                    label="Blocker alerts"
                                    enabled={settings?.blocker_alerts}
                                    onChange={(val) => updateSettings('blocker_alerts', val)}
                                />
                                <ToggleSetting
                                    label="Daily digest email"
                                    enabled={settings?.daily_digest}
                                    disabled={!settings?.email_notifications}
                                    onChange={(val) => updateSettings('daily_digest', val)}
                                />
                                {!settings?.email_notifications && (
                                    <p className="text-xs text-gray-500 mt-1">
                                        Enable Email notifications to receive digest emails.
                                    </p>
                                )}
                            </SettingsSection>

                            <SettingsSection
                                icon={<Shield className="text-red-600" size={24} />}
                                title="Account Management"
                                description="Secure your account or remove your data"
                            >
                                <div className="space-y-4">
                                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 bg-gray-50 rounded-xl border border-gray-100">
                                        <div>
                                            <h4 className="font-semibold text-gray-900">Reset Password</h4>
                                            <p className="text-sm text-gray-600">Receive an email to securely change your password</p>
                                        </div>
                                        <button
                                            onClick={handleResetPassword}
                                            className="px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition text-sm font-medium flex items-center gap-2"
                                        >
                                            <Key size={16} />
                                            Reset
                                        </button>
                                    </div>

                                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 bg-red-50 rounded-xl border border-red-100">
                                        <div>
                                            <h4 className="font-semibold text-red-900">Delete Account</h4>
                                            <p className="text-sm text-red-700">Permanently remove your account and all associated data</p>
                                        </div>
                                        <button
                                            onClick={handleDeleteAccount}
                                            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition text-sm font-medium flex items-center gap-2"
                                        >
                                            <Trash2 size={16} />
                                            Delete
                                        </button>
                                    </div>
                                </div>
                            </SettingsSection>

                            <SettingsSection
                                icon={<Mail className="text-orange-600" size={24} />}
                                title="Email"
                                description="Test your email settings"
                            >
                                <button
                                    onClick={sendTestDigest}
                                    disabled={!settings?.email_notifications || !settings?.daily_digest || digestSending || digestCooldown}
                                    className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {digestSending ? 'Sending...' : digestCooldown ? 'Sent - wait a few seconds' : 'Send Test Digest Email'}
                                </button>
                                <p className="text-sm text-gray-600 mt-3">
                                    Send a preview of your daily digest to test email delivery
                                </p>
                                {digestFeedback && (
                                    <p className={`text-sm mt-2 ${digestFeedback.toLowerCase().includes('success') ? 'text-green-600' : 'text-red-600'}`}>
                                        {digestFeedback}
                                    </p>
                                )}
                                {(!settings?.email_notifications || !settings?.daily_digest) && (
                                    <p className="text-xs text-gray-500 mt-2">
                                        Turn on both Email notifications and Daily digest email to test.
                                    </p>
                                )}
                            </SettingsSection>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

function SettingsSection({ icon, title, description, children }) {
    return (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-gray-50 rounded-lg">
                    {icon}
                </div>
                <div>
                    <h3 className="font-bold text-gray-900">{title}</h3>
                    <p className="text-sm text-gray-600">{description}</p>
                </div>
            </div>
            <div className="ml-0 sm:ml-14">
                {children}
            </div>
        </div>
    );
}

function ToggleSetting({ label, enabled, onChange, disabled = false }) {
    return (
        <div className="flex items-center justify-between py-3">
            <span className={`text-gray-700 ${disabled ? 'opacity-60' : ''}`}>{label}</span>
            <button
                disabled={disabled}
                onClick={() => onChange?.(!enabled)}
                className={`w-12 h-6 rounded-full transition disabled:opacity-50 disabled:cursor-not-allowed ${enabled ? 'bg-blue-600' : 'bg-gray-300'
                    }`}
            >
                <div
                    className={`w-5 h-5 bg-white rounded-full transition transform ${enabled ? 'translate-x-6' : 'translate-x-1'
                        }`}
                />
            </button>
        </div>
    );
}
