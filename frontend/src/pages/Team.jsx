import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { UserPlus, Mail, Copy, Check, Users, AlertCircle } from 'lucide-react';

const Team = () => {
    const { user, profile, refreshProfile } = useAuth(); // ✅ Added refreshProfile
    const [team, setTeam] = useState(null);
    const [members, setMembers] = useState([]);
    const [invitations, setInvitations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null); // ✅ ADDED THIS - was missing!
    const [inviteEmail, setInviteEmail] = useState('');
    const [inviteSending, setInviteSending] = useState(false);
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        if (user && profile) {
            fetchTeamData();
        }
    }, [user, profile]);

    const fetchTeamData = async () => {
        setLoading(true);
        setError(null);

        try {
            // Get team ID from profile
            let teamId = profile?.current_team_id;

            // Fallback: If current_team_id is null but user has teams, use first team
            if (!teamId && profile?.teams && profile.teams.length > 0) {
                console.log('No current_team_id, using first team from list');
                teamId = profile.teams[0].team_id;

                // Update their current_team_id in the backend
                try {
                    const updateRes = await fetch(`${import.meta.env.VITE_API_URL}/api/user/me`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            userId: user.id,
                            current_team_id: teamId
                        })
                    });

                    if (updateRes.ok) {
                        await refreshProfile();
                    }
                } catch (error) {
                    console.error('Failed to update current_team_id:', error);
                }
            }

            // If still no team ID, show no team message
            if (!teamId) {
                console.log('User has no team');
                setLoading(false);
                return;
            }

            const apiUrl = import.meta.env.VITE_API_URL;

            // Fetch all data in parallel
            const [teamRes, membersRes, invitesRes] = await Promise.all([
                fetch(`${apiUrl}/api/teams/${teamId}`),
                fetch(`${apiUrl}/api/teams/${teamId}/members`),
                fetch(`${apiUrl}/api/teams/${teamId}/invitations?userId=${user.id}`)
            ]);

            // 1. Get Team Details
            if (teamRes.ok) {
                const teamData = await teamRes.json();
                setTeam(teamData);
            } else {
                const errorText = await teamRes.text();
                console.error('Failed to fetch team:', {
                    status: teamRes.status,
                    statusText: teamRes.statusText,
                    error: errorText
                });

                if (teamRes.status === 403) {
                    setError('Access denied - you are not a member of this team');
                } else if (teamRes.status === 500) {
                    setError('Server error loading team. Check if Row Level Security policies are configured.');
                } else {
                    setError('Failed to load team details');
                }
            }

            // 2. Get Members
            if (membersRes.ok) {
                const membersData = await membersRes.json();
                setMembers(Array.isArray(membersData) ? membersData : []);
            } else {
                console.error('Failed to fetch members:', membersRes.status);
            }

            // 3. Get Invitations
            if (invitesRes.ok) {
                const invitesData = await invitesRes.json();
                setInvitations(Array.isArray(invitesData) ? invitesData : []);
            } else if (invitesRes.status === 404) {
                // Invitations endpoint doesn't exist yet - that's okay
                console.log('Invitations endpoint not available');
                setInvitations([]);
            } else {
                console.error('Failed to fetch invitations:', invitesRes.status);
            }
        } catch (error) {
            console.error('Error fetching team data:', error);
            setError(error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleInvite = async (e) => {
        e.preventDefault();
        if (!inviteEmail || !team) return;

        setInviteSending(true);
        try {
            const res = await fetch(`${import.meta.env.VITE_API_URL}/api/teams/${team.id}/invite`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: user.id,
                    email: inviteEmail
                })
            });

            if (res.ok) {
                setInviteEmail('');
                await fetchTeamData();
                alert('Invitation sent!');
            } else {
                const errorData = await res.json();
                alert(errorData.error || 'Failed to send invitation');
            }
        } catch (error) {
            console.error('Invite error:', error);
            alert('Failed to send invitation');
        } finally {
            setInviteSending(false);
        }
    };

    const copyInviteLink = () => {
        navigator.clipboard.writeText(`${window.location.origin}/signup?teamId=${team?.id}`);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    if (loading) {
        return (
            <div className="flex h-screen items-center justify-center">
                <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    // ✅ ADDED: Error Display
    if (error) {
        return (
            <div className="p-8 max-w-4xl mx-auto">
                <div className="bg-red-50 border border-red-200 rounded-2xl p-8 flex items-start gap-4">
                    <AlertCircle className="text-red-600 flex-shrink-0" size={24} />
                    <div>
                        <h2 className="text-xl font-bold text-red-900 mb-2">Error Loading Team</h2>
                        <p className="text-red-700 mb-4">{error}</p>
                        <button
                            onClick={fetchTeamData}
                            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                        >
                            Try Again
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    if (!team) {
        return (
            <div className="p-8 max-w-4xl mx-auto text-center">
                <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-12">
                    <Users className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                    <h2 className="text-2xl font-bold text-slate-900 mb-2">No Team Selected</h2>
                    <p className="text-slate-500 mb-6">Create a team in the onboarding flow to start collaborating.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="p-8 max-w-6xl mx-auto">
            <div className="mb-8 flex justify-between items-end">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 mb-2">{team.name}</h1>
                    <p className="text-gray-600">{members.length} Members {team.size_range && `• ${team.size_range}`}</p>
                </div>
                <button
                    onClick={() => document.getElementById('invite-form')?.scrollIntoView({ behavior: 'smooth' })}
                    className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                >
                    <UserPlus size={18} />
                    Invite Member
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Members List */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                        <div className="p-6 border-b border-gray-100">
                            <h2 className="font-semibold text-lg text-gray-900">Team Members</h2>
                        </div>
                        <div className="divide-y divide-gray-100">
                            {members.map((member) => (
                                <div key={member.id} className="p-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-sm">
                                            {member.profiles?.full_name?.[0]?.toUpperCase() ||
                                                member.profiles?.email?.[0]?.toUpperCase() ||
                                                member.full_name?.[0]?.toUpperCase() ||
                                                member.email?.[0]?.toUpperCase() ||
                                                '?'}
                                        </div>
                                        <div>
                                            <p className="font-medium text-gray-900">
                                                {member.profiles?.full_name || member.full_name || 'Unnamed User'}
                                            </p>
                                            <p className="text-sm text-gray-500">
                                                {member.profiles?.email || member.email || 'No email'}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${member.role === 'owner'
                                                ? 'bg-purple-100 text-purple-700'
                                                : member.role === 'admin'
                                                    ? 'bg-blue-100 text-blue-700'
                                                    : 'bg-gray-100 text-gray-700'
                                            }`}>
                                            {member.role}
                                        </span>
                                    </div>
                                </div>
                            ))}
                            {members.length === 0 && (
                                <div className="p-8 text-center text-gray-500">No active members yet.</div>
                            )}
                        </div>
                    </div>

                    {invitations.length > 0 && (
                        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                            <div className="p-6 border-b border-gray-100">
                                <h2 className="font-semibold text-lg text-gray-900">Pending Invitations</h2>
                            </div>
                            <div className="divide-y divide-gray-100">
                                {invitations.map((invite) => (
                                    <div key={invite.id} className="p-4 flex items-center justify-between bg-yellow-50/30">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-500">
                                                <Mail size={18} />
                                            </div>
                                            <div>
                                                <p className="font-medium text-gray-900">{invite.email}</p>
                                                <p className="text-sm text-gray-500">
                                                    Invited {new Date(invite.created_at).toLocaleDateString()}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className={`px-2 py-1 text-xs font-medium rounded-full ${invite.status === 'pending'
                                                    ? 'bg-yellow-100 text-yellow-700'
                                                    : invite.status === 'accepted'
                                                        ? 'bg-green-100 text-green-700'
                                                        : 'bg-gray-100 text-gray-700'
                                                }`}>
                                                {invite.status}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Invite Sidebar */}
                <div className="space-y-6">
                    <div id="invite-form" className="bg-white rounded-xl shadow-sm p-6">
                        <h2 className="font-semibold text-lg text-gray-900 mb-4">Invite People</h2>
                        <form onSubmit={handleInvite} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Email Address
                                </label>
                                <input
                                    type="email"
                                    value={inviteEmail}
                                    onChange={(e) => setInviteEmail(e.target.value)}
                                    placeholder="colleague@company.com"
                                    className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
                                    required
                                />
                            </div>
                            <button
                                type="submit"
                                disabled={inviteSending}
                                className="w-full bg-blue-600 text-white font-medium py-2 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                            >
                                {inviteSending ? 'Sending...' : 'Send Invite'}
                            </button>
                        </form>

                        <div className="mt-6 pt-6 border-t border-gray-100">
                            <h3 className="text-sm font-medium text-gray-900 mb-2">Or share invite link</h3>
                            <div className="flex gap-2">
                                <input
                                    readOnly
                                    value={`${window.location.origin}/signup?ref=team_${team?.id}`}
                                    className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-600"
                                />
                                <button
                                    onClick={copyInviteLink}
                                    className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                    title="Copy invite link"
                                >
                                    {copied ? <Check size={20} /> : <Copy size={20} />}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Team;