import { useAuth } from '../contexts/AuthContext';
import { User, Mail, Calendar, Shield, Bell, Key, Trash2, Zap, Settings, ArrowRight, ShieldAlert, Sparkles, ChevronRight, Check } from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'https://api.teamaai.xyz';
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
            '• All integrations and API connections\n\n' +

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
        <div className="min-h-screen bg-black text-gray-100 selection:bg-blue-500/30">

            <div className="relative mx-auto max-w-4xl px-4 pb-20 pt-4 md:px-8 md:pt-8">
                {/* Header */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 mb-10 md:mb-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
                    <div>
                        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-[10px] font-bold uppercase tracking-widest text-white">
                            Settings
                        </div>
                        <h1 className="text-4xl font-bold text-white uppercase tracking-tight md:text-5xl">Profile</h1>
                        <p className="mt-4 max-w-2xl text-sm leading-relaxed text-gray-400 font-bold uppercase tracking-widest">
                            Change your profile settings and notifications.
                        </p>
                    </div>
                    {saved && !saving && (
                        <div className="px-6 py-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center gap-3 animate-in fade-in zoom-in duration-300">
                            <Check size={14} />
                            Parameters Saved
                        </div>
                    )}
                </div>

                {saveError && (
                    <div className="mb-10 rounded-[2rem] border border-rose-500/20 bg-rose-500/10 px-8 py-6 text-[10px] font-black uppercase tracking-widest text-rose-400 animate-in fade-in slide-in-from-top-4 duration-500 flex items-center gap-4">
                        <div className="w-2 h-2 bg-rose-500 rounded-full animate-pulse"></div>
                        {saveError}
                    </div>
                )}

                <div className="rounded-[2.5rem] border border-white/5 bg-white/[0.01] p-8 md:p-10 shadow-2xl mb-8 animate-in fade-in slide-in-from-bottom-6 duration-700 delay-100 group transition-all hover:border-white/10">
                    <div className="flex flex-col sm:flex-row items-center gap-8 md:gap-10">
                        <div className="w-24 h-24 md:w-32 md:h-32 bg-white/5 border border-white/10 rounded-[2.5rem] flex items-center justify-center transition-transform duration-500">
                            <User className="text-white" size={48} />
                        </div>
                        <div className="text-center sm:text-left">
                            <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-2">
                                <h2 className="text-3xl font-bold text-white uppercase tracking-tight">
                                    {user?.email?.split('@')[0] || 'User'}
                                </h2>
                                <span className="inline-flex items-center gap-2 rounded-lg bg-white/5 border border-white/10 px-3 py-1 text-[9px] font-bold uppercase tracking-widest text-white">
                                    Active
                                </span>
                            </div>
                            <div className="flex flex-col gap-2">
                                <p className="text-gray-400 font-bold uppercase tracking-widest text-xs flex items-center justify-center sm:justify-start gap-3">
                                    {user?.email}
                                </p>
                                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest flex items-center justify-center sm:justify-start gap-3 mt-1">
                                    Joined {new Date(user?.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }).toUpperCase()}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {loading ? (
                    <div className="rounded-[2.5rem] border border-white/5 bg-[#09090b] p-20 text-center animate-in fade-in duration-500">
                        <div className="w-12 h-12 border-4 border-white/5 border-t-white rounded-full animate-spin mx-auto mb-6" />
                        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-300">Syncing Parameters...</p>
                    </div>
                ) : (
                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-200">
                        <SettingsSection
                            icon={<Bell size={20} />}
                            title="Notifications"
                            description="Manage how you receive updates."
                            accent="white"
                        >
                            <div className="space-y-2">
                                <ToggleSetting
                                    label="Emails"
                                    enabled={settings?.email_notifications}
                                    onChange={(val) => updateSettings('email_notifications', val)}
                                />
                                <ToggleSetting
                                    label="Slack"
                                    enabled={settings?.slack_notifications}
                                    onChange={(val) => updateSettings('slack_notifications', val)}
                                />
                                <ToggleSetting
                                    label="Alerts"
                                    enabled={settings?.blocker_alerts}
                                    onChange={(val) => updateSettings('blocker_alerts', val)}
                                />
                                <ToggleSetting
                                    label="Daily Email"
                                    enabled={settings?.daily_digest}
                                    disabled={!settings?.email_notifications}
                                    onChange={(val) => updateSettings('daily_digest', val)}
                                />
                                {!settings?.email_notifications && (
                                    <p className="text-[9px] font-bold uppercase tracking-widest text-white mt-4 ml-1 flex items-center gap-2">
                                        Email must be on for daily emails.
                                    </p>
                                )}
                            </div>
                        </SettingsSection>

                        <SettingsSection
                            icon={<Shield size={20} />}
                            title="Security"
                            description="Manage your password and account."
                            accent="white"
                        >
                            <div className="space-y-4">
                                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 p-6 bg-white/[0.02] border border-white/5 rounded-[1.5rem] hover:bg-white/[0.04] transition-all">
                                    <div className="min-w-0 flex-1">
                                        <h4 className="text-sm font-bold text-white uppercase tracking-widest mb-1.5 flex items-center gap-3">
                                            Reset Password
                                        </h4>
                                        <p className="text-xs text-gray-400 font-bold uppercase tracking-widest">Send a link to reset your password.</p>
                                    </div>
                                    <button
                                        onClick={handleResetPassword}
                                        className="w-full sm:w-auto px-8 py-3 bg-white text-black text-[10px] font-bold uppercase tracking-widest rounded-xl hover:bg-gray-200 transition-all active:scale-95 shadow-xl flex items-center justify-center gap-3"
                                    >
                                        Send Link
                                    </button>
                                </div>

                                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 p-6 bg-white/[0.01] border border-white/10 rounded-[1.5rem] transition-all">
                                    <div className="min-w-0 flex-1">
                                        <h4 className="text-sm font-bold text-white uppercase tracking-widest mb-1.5">
                                            Delete Account
                                        </h4>
                                        <p className="text-xs text-gray-400 font-bold uppercase tracking-widest">Permanently remove your account and data.</p>
                                    </div>
                                    <button
                                        onClick={handleDeleteAccount}
                                        className="w-full sm:w-auto px-8 py-3 bg-white/5 border border-white/10 text-white text-[10px] font-bold uppercase tracking-widest rounded-xl hover:bg-white/10 transition-all active:scale-95 shadow-xl flex items-center justify-center gap-3"
                                    >
                                        Delete
                                    </button>
                                </div>
                            </div>
                        </SettingsSection>

                        <SettingsSection
                            icon={<Zap size={20} />}
                            title="Test"
                            description="Send a test email to check your settings."
                            accent="white"
                        >
                            <div className="p-6 bg-white/[0.02] border border-white/5 rounded-[1.5rem] hover:bg-white/[0.04] transition-all">
                                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 mb-6">
                                    <div className="min-w-0 flex-1">
                                        <h4 className="text-sm font-bold text-white uppercase tracking-widest mb-1.5">
                                            Test Email
                                        </h4>
                                        <p className="text-xs text-gray-400 font-bold uppercase tracking-widest">Send a test email to your account.</p>
                                    </div>
                                    <button
                                        onClick={sendTestDigest}
                                        disabled={!settings?.email_notifications || !settings?.daily_digest || digestSending || digestCooldown}
                                        className="w-full sm:w-auto px-8 py-4 bg-white text-black text-[10px] font-bold uppercase tracking-widest rounded-2xl transition-all active:scale-95 shadow-2xl disabled:opacity-20 disabled:cursor-not-allowed group flex items-center justify-center gap-3"
                                    >
                                        {digestSending ? 'SENDING...' : digestCooldown ? 'WAITING' : 'SEND TEST'}
                                    </button>
                                </div>
                                
                                {digestFeedback && (
                                    <p className="text-[10px] font-bold uppercase tracking-widest mt-6 p-4 rounded-xl border border-white/10 bg-white/5 text-white">
                                        {digestFeedback.toUpperCase()}
                                    </p>
                                )}
                            </div>
                        </SettingsSection>
                    </div>
                )}
            </div>
        </div>
    );
}

function SettingsSection({ icon, title, description, accent, children }) {
    return (
        <section className="bg-white/[0.01] rounded-[2.5rem] border border-white/5 p-8 md:p-10 shadow-2xl transition-all hover:border-white/10 group">
            <div className="flex items-center gap-6 mb-10">
                <div className="p-4 rounded-2xl border border-white/10 bg-white/5 text-white">
                    {icon}
                </div>
                <div>
                    <h3 className="text-xl font-bold text-white uppercase tracking-tight group-hover:text-blue-400 transition-colors uppercase tracking-widest">{title}</h3>
                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-1">{description}</p>
                </div>
            </div>
            <div className="ml-0 sm:ml-[88px]">
                {children}
            </div>
        </section>
    );
}

function ToggleSetting({ label, enabled, onChange, disabled = false }) {
    return (
        <div className={`flex items-center justify-between py-5 border-b border-white/5 last:border-0 ${disabled ? 'opacity-30' : ''}`}>
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{label}</span>
            <button
                disabled={disabled}
                onClick={() => onChange?.(!enabled)}
                className={`w-14 h-7 rounded-full transition-all relative border border-white/10 ${enabled ? 'bg-white' : 'bg-white/5'}`}
            >
                <div
                    className={`absolute top-1 w-5 h-5 rounded transition-all transform ${enabled ? 'translate-x-8 bg-black' : 'translate-x-1 bg-gray-800'}`}
                />
            </button>
        </div>
    );
}
