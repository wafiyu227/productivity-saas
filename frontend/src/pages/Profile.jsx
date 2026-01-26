import { useAuth } from '../contexts/AuthContext';
import { User, Mail, Calendar, Shield, Bell, Palette, Key } from 'lucide-react';

export default function Profile() {
    const { user } = useAuth();

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 to-indigo-50">
            <div className="p-8">
                <div className="max-w-4xl mx-auto">
                    {/* Header */}
                    <h1 className="text-4xl font-bold text-gray-900 mb-8">Profile Settings</h1>

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

                        <button className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition">
                            Edit Profile
                        </button>
                    </div>

                    {/* Settings Sections */}
                    <div className="space-y-6">
                        <SettingsSection
                            icon={<Bell className="text-blue-600" size={24} />}
                            title="Notifications"
                            description="Manage your notification preferences"
                        >
                            <ToggleSetting label="Email notifications" enabled={true} />
                            <ToggleSetting label="Slack notifications" enabled={true} />
                            <ToggleSetting label="Blocker alerts" enabled={false} />
                        </SettingsSection>

                        <SettingsSection
                            icon={<Palette className="text-purple-600" size={24} />}
                            title="Appearance"
                            description="Customize your dashboard experience"
                        >
                            <div className="flex gap-4">
                                <button className="px-4 py-2 bg-blue-600 text-white rounded-lg">Light</button>
                                <button className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200">Dark</button>
                                <button className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200">Auto</button>
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
                                <button className="flex items-center gap-2 text-blue-600 hover:text-blue-700 font-medium">
                                    <Key size={18} />
                                    Change Password
                                </button>
                            </div>
                        </SettingsSection>
                    </div>
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

function ToggleSetting({ label, enabled }) {
    return (
        <div className="flex items-center justify-between py-3">
            <span className="text-gray-700">{label}</span>
            <button
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