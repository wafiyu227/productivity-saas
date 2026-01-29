import { useAuth } from '../contexts/AuthContext';
import { User, Mail, Calendar, Shield, Bell, Palette, Key } from 'lucide-react';
import { useState, useEffect } from 'react';

const API_URL = import.meta.env.VITE_API_URL;

export default function Profile() {
    const { user } = useAuth();
    const [settings, setSettings] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saved, setSaved] = useState(false);

    useEffect(() => {
        if (user) {
            fetchSettings();
        }
    }, [user]);

    const fetchSettings = async () => {
        try {
            setLoading(true);
            const res = await fetch(`${API_URL}/api/auth/settings?userId=${user.id}`);
            const data = await res.json();
            setSettings(data);
        } catch (error) {
            console.error('Failed to fetch settings:', error);
            // Set defaults on error
            setSettings({
                email_notifications: true,
                slack_notifications: true,
                blocker_alerts: false,
                daily_digest: true,
                appearance: 'light'
            });
        } finally {
            setLoading(false);
        }
    };

    const updateSettings = async (key, value) => {
        const updatedSettings = { ...settings, [key]: value };
        setSettings(updatedSettings);
        setSaved(false);

        try {
            const res = await fetch(`${API_URL}/api/auth/settings`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: user.id,
                    settings: updatedSettings
                })
            });

            if (res.ok) {
                setSaved(true);
                setTimeout(() => setSaved(false), 2000);
            }
        } catch (error) {
            console.error('Failed to save settings:', error);
        }
    };

    const sendTestDigest = async () => {
        try {
            const res = await fetch(`${API_URL}/api/email/daily-digest`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: user.id })
            });

            const data = await res.json();
            if (res.ok) {
                setSaved(true);
                setTimeout(() => setSaved(false), 2000);
            }
        } catch (error) {
            console.error('Failed to send test digest:', error);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 to-indigo-50">
            <div className="p-8">
                <div className="max-w-4xl mx-auto">
                    {/* Header */}
                    <div className="flex items-center justify-between mb-8">
                        <h1 className="text-4xl font-bold text-gray-900">Profile Settings</h1>
                        {saved && (
                            <div className="px-4 py-2 bg-green-100 text-green-700 rounded-lg text-sm font-medium">
                                ✓ Saved
                            </div>
                        )}
                    </div>

                    {/* Profile Card */}
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 mb-6">
                        <div className="flex items-center gap-6 mb-8">
                            <div className="w-24 h-24 bg-gradient-to-br from-blue-600 to-purple-600 rounded-full flex items-center justify-center">
                                <User className="text-white" size={48} />
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

                    {/* Settings Sections */}
                    {loading ? (
                        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center">
                            <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4"></div>
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
                                    onChange={(val) => updateSettings('daily_digest', val)}
                                />
                            </SettingsSection>

                            <SettingsSection
                                icon={<Palette className="text-purple-600" size={24} />}
                                title="Appearance"
                                description="Customize your dashboard experience"
                            >
                                <div className="flex gap-4">
                                    <button 
                                        onClick={() => updateSettings('appearance', 'light')}
                                        className={`px-4 py-2 rounded-lg font-medium transition ${
                                            settings?.appearance === 'light' 
                                                ? 'bg-blue-600 text-white' 
                                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                        }`}
                                    >
                                        Light
                                    </button>
                                    <button 
                                        onClick={() => updateSettings('appearance', 'dark')}
                                        className={`px-4 py-2 rounded-lg font-medium transition ${
                                            settings?.appearance === 'dark' 
                                                ? 'bg-blue-600 text-white' 
                                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                        }`}
                                    >
                                        Dark
                                    </button>
                                    <button 
                                        onClick={() => updateSettings('appearance', 'auto')}
                                        className={`px-4 py-2 rounded-lg font-medium transition ${
                                            settings?.appearance === 'auto' 
                                                ? 'bg-blue-600 text-white' 
                                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                        }`}
                                    >
                                        Auto
                                    </button>
                                </div>
                            </SettingsSection>

                            <SettingsSection
                                icon={<Shield className="text-green-600" size={24} />}
                                title="Security"
                                description="Keep your account secure"
                            >
                                <div className="space-y-3">
                                    <InfoRow label="User ID" value={user?.id?.slice(0, 8) + '...'} />
                                    <InfoRow label="Last login" value="Just now" />
                                </div>
                            </SettingsSection>

                            <SettingsSection
                                icon={<Mail className="text-orange-600" size={24} />}
                                title="Email"
                                description="Test your email settings"
                            >
                                <button 
                                    onClick={sendTestDigest}
                                    className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition text-sm font-medium"
                                >
                                    Send Test Digest Email
                                </button>
                                <p className="text-sm text-gray-600 mt-3">
                                    Send a preview of your daily digest to test email delivery
                                </p>
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
            <div className="ml-14">
                {children}
            </div>
        </div>
    );
}

function ToggleSetting({ label, enabled, onChange }) {
    return (
        <div className="flex items-center justify-between py-3">
            <span className="text-gray-700">{label}</span>
            <button
                onClick={() => onChange?.(!enabled)}
                className={`w-12 h-6 rounded-full transition ${enabled ? 'bg-blue-600' : 'bg-gray-300'
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

function InfoRow({ label, value }) {
    return (
        <div className="flex justify-between py-2">
            <span className="text-gray-600">{label}</span>
            <span className="text-gray-900 font-medium">{value}</span>
        </div>
    );
}