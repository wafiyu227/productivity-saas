import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { X, Loader, CheckCircle, AlertCircle } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL;

export default function InviteTeam() {
    const { user, profile } = useAuth();
    const navigate = useNavigate();
    const [emailsText, setEmailsText] = useState('');
    const [loading, setLoading] = useState(false);
    const [invitations, setInvitations] = useState([]);
    const [errors, setErrors] = useState([]);

    const teamId = profile?.current_team_id || sessionStorage.getItem('onboarding_team_id');

    const parseEmails = (text) => {
        return text
            .split(/[\\n,;]+/)
            .map(email => email.trim())
            .filter(email => email && email.includes('@'));
    };

    const handleSendInvitations = async () => {
        const emails = parseEmails(emailsText);

        if (emails.length === 0) {
            alert('Please enter at least one email address');
            return;
        }

        setLoading(true);
        setInvitations([]);
        setErrors([]);

        try {
            const res = await fetch(`${API_URL}/api/invitations`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    teamId,
                    emails,
                    invitedBy: user.id,
                    role: 'member'
                })
            });

            const data = await res.json();

            if (data.invitations) {
                setInvitations(data.invitations);
            }

            if (data.errors) {
                setErrors(data.errors);
            }

            // Clear input if successful
            if (data.invitations && data.invitations.length > 0) {
                setEmailsText('');
            }
        } catch (error) {
            console.error('Failed to send invitations:', error);
            alert('Failed to send invitations. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const handleComplete = () => {
        sessionStorage.removeItem('onboarding_team_id');
        navigate('/onboarding/complete');
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 flex items-center justify-center p-4">
            <div className="max-w-2xl w-full bg-white rounded-2xl shadow-xl p-8">
                <h1 className="text-3xl font-bold text-gray-900 mb-2">Invite Your Team</h1>
                <p className="text-gray-600 mb-8">
                    Add team members via email. They'll get access to all connected integrations.
                </p>

                <div className="space-y-6">
                    {/* Email Input */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Email addresses (one per line)
                        </label>
                        <textarea
                            value={emailsText}
                            onChange={(e) => setEmailsText(e.target.value)}
                            placeholder="sarah@company.com\\nmike@company.com\\nlisa@company.com"
                            rows={6}
                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent font-mono text-sm"
                        />
                        <p className="text-xs text-gray-500 mt-2">
                            You can also paste emails separated by commas or semicolons
                        </p>
                    </div>

                    {/* Send Button */}
                    <button
                        onClick={handleSendInvitations}
                        disabled={loading || !emailsText.trim()}
                        className="w-full bg-purple-600 text-white py-3 rounded-lg font-semibold hover:bg-purple-700 transition disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                        {loading ? (
                            <>
                                <Loader className="animate-spin" size={20} />
                                Sending...
                            </>
                        ) : (
                            'Send Invitations'
                        )}
                    </button>

                    {/* Success Messages */}
                    {invitations.length > 0 && (
                        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                            <div className="flex items-center gap-2 text-green-800 font-medium mb-2">
                                <CheckCircle size={20} />
                                Invitations sent successfully!
                            </div>
                            <ul className="text-sm text-green-700 space-y-1">
                                {invitations.map((inv, i) => (
                                    <li key={i}>✓ {inv.email}</li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {/* Error Messages */}
                    {errors.length > 0 && (
                        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                            <div className="flex items-center gap-2 text-red-800 font-medium mb-2">
                                <AlertCircle size={20} />
                                Some invitations failed
                            </div>
                            <ul className="text-sm text-red-700 space-y-1">
                                {errors.map((err, i) => (
                                    <li key={i}>✗ {err.email}: {err.error}</li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {/* Navigation */}
                    <div className="flex justify-between pt-4">
                        <button
                            onClick={handleComplete}
                            className="px-6 py-3 text-gray-700 hover:text-gray-900 transition"
                        >
                            Skip for now
                        </button>
                        <button
                            onClick={handleComplete}
                            className="px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg font-semibold hover:shadow-lg transition"
                        >
                            Continue →
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
