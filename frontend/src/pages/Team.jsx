import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { UserPlus, Mail, Copy, Check, Users } from 'lucide-react';

const Team = () => {
    const { user } = useAuth();
    const [team, setTeam] = useState(null);
    const [members, setMembers] = useState([]);
    const [invitations, setInvitations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [inviteEmail, setInviteEmail] = useState('');
    const [inviteSending, setInviteSending] = useState(false);
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        fetchTeamData();
    }, [user]);

    const fetchTeamData = async () => {
        try {
            // Get user profile first to find team_id
            const profileRes = await fetch(`${import.meta.env.VITE_API_URL}/api/user/profile?userId=${user.id}`);
            const profile = await profileRes.json();

            if (profile.team_id) {
                // Get team members
                const membersRes = await fetch(`${import.meta.env.VITE_API_URL}/api/user/team/members?teamId=${profile.team_id}`);
                const membersData = await membersRes.json();
                if (Array.isArray(membersData)) {
                    setMembers(membersData);
                } else {
                    console.error('Invalid members data:', membersData);
                    setMembers([]);
                }

                // Get invitations
                const invitesRes = await fetch(`${import.meta.env.VITE_API_URL}/api/user/team/invitations?teamId=${profile.team_id}`);
                const invitesData = await invitesRes.json();
                if (Array.isArray(invitesData)) {
                    setInvitations(invitesData);
                } else {
                    setInvitations([]);
                }

                // Set team info
                if (profile.teams) {
                    setTeam(profile.teams);
                }
            }
        } catch (error) {
            console.error('Error fetching team data:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleInvite = async (e) => {
        e.preventDefault();
        if (!inviteEmail || !team) return;

        setInviteSending(true);
        try {
            const res = await fetch(`${import.meta.env.VITE_API_URL}/api/user/team/invite`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: user.id,
                    teamId: team.id,
                    email: inviteEmail
                })
            });

            if (res.ok) {
                setInviteEmail('');
                // Refresh invitations
                const invitesRes = await fetch(`${import.meta.env.VITE_API_URL}/api/user/team/invitations?teamId=${team.id}`);
                const invitesData = await invitesRes.json();
                setInvitations(invitesData);
                alert('Invitation sent!');
            } else {
                alert('Failed to send invitation');
            }
        } catch (error) {
            console.error('Invite error:', error);
        } finally {
            setInviteSending(false);
        }
    };

    const copyInviteLink = () => {
        // Mock invite link for now
        navigator.clipboard.writeText(`${window.location.origin}/signup?ref=team_${team?.id}`);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    if (loading) return <div className="p-8">Loading team data...</div>;

    if (!team) {
        return (
            <div className="p-8 max-w-4xl mx-auto text-center">
                <div className="bg-white rounded-xl shadow-sm p-12">
                    <Users className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                    <h2 className="text-2xl font-bold text-gray-900 mb-2">You haven't joined a team yet</h2>
                    <p className="text-gray-600 mb-6">Create a team or ask your manager for an invite link.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="p-8 max-w-6xl mx-auto">
            <div className="mb-8 flex justify-between items-end">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 mb-2">{team.name}</h1>
                    <p className="text-gray-600">{members.length} Members &bull; {team.size_range} Employees</p>
                </div>
                <button
                    onClick={() => document.getElementById('invite-form').scrollIntoView({ behavior: 'smooth' })}
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
                                        <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold">
                                            {member.full_name?.[0] || member.email?.[0]?.toUpperCase()}
                                        </div>
                                        <div>
                                            <p className="font-medium text-gray-900">{member.full_name || 'Unnamed User'}</p>
                                            <p className="text-sm text-gray-500">{member.job_title || 'No Title'}</p>
                                        </div>
                                    </div>
                                    <span className="text-xs font-medium px-2 py-1 bg-green-100 text-green-700 rounded-full">Active</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {invitations.length > 0 && (
                        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                            <div className="p-6 border-b border-gray-100">
                                <h2 className="font-semibold text-lg text-gray-900">Pending Invitations</h2>
                            </div>
                            <div className="divide-y divide-gray-100">
                                {invitations.map((invite) => (
                                    <div key={invite.id} className="p-4 flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-500">
                                                <Mail size={18} />
                                            </div>
                                            <div>
                                                <p className="font-medium text-gray-900">{invite.email}</p>
                                                <p className="text-sm text-gray-500">Invited by you</p>
                                            </div>
                                        </div>
                                        <span className="text-xs font-medium px-2 py-1 bg-yellow-100 text-yellow-700 rounded-full">Pending</span>
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
                                <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
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
