import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { X, Loader, CheckCircle, AlertCircle } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'https://api.teamaai.xyz';
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;

export default function InviteTeam() {
    const { user, profile } = useAuth();
    const navigate = useNavigate();
    const [emails, setEmails] = useState([]);
    const [emailInput, setEmailInput] = useState('');
    const [invalidEntries, setInvalidEntries] = useState([]);
    const [loading, setLoading] = useState(false);
    const [invitations, setInvitations] = useState([]);
    const [resentInvitations, setResentInvitations] = useState([]);
    const [errors, setErrors] = useState([]);

    const teamId = profile?.current_team_id || sessionStorage.getItem('onboarding_team_id');

    const parseEntries = (text) => (
        String(text || '')
            .split(/[\n,;]+/)
            .map((value) => value.trim())
            .filter(Boolean)
    );

    const addEmailsFromText = (text) => {
        const candidates = parseEntries(text);
        if (candidates.length === 0) return;

        const invalid = [];
        const valid = [];

        candidates.forEach((entry) => {
            const normalized = entry.toLowerCase();
            if (!EMAIL_REGEX.test(normalized)) {
                invalid.push(entry);
                return;
            }
            valid.push(normalized);
        });

        setEmails((previous) => {
            const deduped = new Set(previous);
            valid.forEach((value) => deduped.add(value));
            return Array.from(deduped);
        });

        setInvalidEntries((previous) => Array.from(new Set([...previous, ...invalid])));
    };

    const removeEmail = (emailToRemove) => {
        setEmails((previous) => previous.filter((email) => email !== emailToRemove));
    };

    const handleAddEmail = () => {
        if (!emailInput.trim()) return;
        addEmailsFromText(emailInput);
        setEmailInput('');
    };

    const handleInputKeyDown = (event) => {
        if (['Enter', 'Tab', ',', ';'].includes(event.key)) {
            event.preventDefault();
            handleAddEmail();
        }
    };

    const handleInputPaste = (event) => {
        const pastedText = event.clipboardData?.getData('text') || '';
        if (!pastedText) return;

        if (/[\n,;]+/.test(pastedText)) {
            event.preventDefault();
            addEmailsFromText(pastedText);
        }
    };

    const handleSendInvitations = async () => {
        const draftCandidates = parseEntries(emailInput);
        const draftValid = [];
        const draftInvalid = [];

        draftCandidates.forEach((entry) => {
            const normalized = entry.toLowerCase();
            if (EMAIL_REGEX.test(normalized)) {
                draftValid.push(normalized);
            } else {
                draftInvalid.push(entry);
            }
        });

        const mergedEmails = Array.from(new Set([...emails, ...draftValid]));

        if (draftInvalid.length > 0) {
            setInvalidEntries((previous) => Array.from(new Set([...previous, ...draftInvalid])));
        }

        if (mergedEmails.length === 0) {
            alert('Please enter at least one email address');
            return;
        }
        if (!user?.id) {
            alert('You need to be logged in to send invitations.');
            return;
        }
        if (!teamId) {
            alert('No active team found. Complete team setup first.');
            return;
        }

        setLoading(true);
        setInvitations([]);
        setResentInvitations([]);
        setErrors([]);
        setEmailInput('');
        if (draftValid.length > 0) {
            setEmails(mergedEmails);
        }

        try {
            const res = await fetch(`${API_URL}/api/invitations`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    teamId,
                    emails: mergedEmails,
                    invitedBy: user.id,
                    role: 'member'
                })
            });

            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                throw new Error(data.error || 'Failed to send invitations');
            }

            if (data.invitations) {
                setInvitations(data.invitations);
            }
            if (data.resent) {
                setResentInvitations(data.resent);
            }

            if (data.errors) {
                setErrors(data.errors);
            }

            // Clear input if at least one invitation was created.
            if (data.invitations && data.invitations.length > 0) {
                setEmails([]);
                setInvalidEntries([]);
            }
        } catch (error) {
            console.error('Failed to send invitations:', error);
            alert(error.message || 'Failed to send invitations. Please try again.');
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
                            Email addresses
                        </label>
                        <div className="w-full border border-gray-300 rounded-lg focus-within:ring-2 focus-within:ring-purple-500 focus-within:border-transparent px-3 py-2">
                            <div className="flex flex-wrap items-center gap-2 mb-2">
                                {emails.map((email) => (
                                    <span
                                        key={email}
                                        className="inline-flex items-center gap-1 rounded-full bg-purple-100 text-purple-800 text-xs px-2.5 py-1"
                                    >
                                        {email}
                                        <button
                                            type="button"
                                            onClick={() => removeEmail(email)}
                                            className="text-purple-700 hover:text-purple-900"
                                            aria-label={`Remove ${email}`}
                                        >
                                            <X size={12} />
                                        </button>
                                    </span>
                                ))}
                                <input
                                    type="text"
                                    value={emailInput}
                                    onChange={(event) => setEmailInput(event.target.value)}
                                    onKeyDown={handleInputKeyDown}
                                    onPaste={handleInputPaste}
                                    placeholder={emails.length === 0 ? 'Type email and press Enter' : 'Add another email'}
                                    className="flex-1 min-w-[220px] py-1 outline-none text-sm"
                                />
                            </div>
                            <div className="flex flex-wrap items-center justify-between gap-2">
                                <p className="text-xs text-gray-500">
                                    Press Enter, comma, or semicolon. You can also paste multiple emails.
                                </p>
                                <button
                                    type="button"
                                    onClick={handleAddEmail}
                                    className="px-3 py-1 text-xs rounded-md bg-gray-100 hover:bg-gray-200 text-gray-700"
                                >
                                    Add
                                </button>
                            </div>
                        </div>
                        <p className="text-xs text-gray-500 mt-2">
                            {emails.length} valid email{emails.length === 1 ? '' : 's'} ready to invite
                        </p>
                        {invalidEntries.length > 0 && (
                            <div className="mt-3 bg-amber-50 border border-amber-200 rounded-lg p-3">
                                <p className="text-xs font-medium text-amber-800 mb-1">Ignored invalid entries:</p>
                                <p className="text-xs text-amber-700 break-words">
                                    {invalidEntries.join(', ')}
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Send Button */}
                    <button
                        onClick={handleSendInvitations}
                        disabled={loading || emails.length === 0}
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
                    {resentInvitations.length > 0 && (
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                            <div className="flex items-center gap-2 text-blue-800 font-medium mb-2">
                                <CheckCircle size={20} />
                                Existing invitations resent
                            </div>
                            <ul className="text-sm text-blue-700 space-y-1">
                                {resentInvitations.map((inv, i) => (
                                    <li key={i}>• {inv.email}</li>
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
