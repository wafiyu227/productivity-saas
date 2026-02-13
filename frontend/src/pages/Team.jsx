import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { UserPlus, Mail, Copy, Check, Users } from 'lucide-react';

const Team = () => {
    const { user, profile } = useAuth();
    const [team, setTeam] = useState(null);
    const [members, setMembers] = useState([]);
    const [invitations, setInvitations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [inviteEmail, setInviteEmail] = useState('');
    const [inviteSending, setInviteSending] = useState(false);
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        if (profile) {
            fetchTeamData();
        }
    }, [user, profile]);

    const fetchTeamData = async () => {
        let teamId = profile?.current_team_id;

        // Fallback to first team if current_team_id is missing but teams exist
        if (!teamId && profile?.teams?.length > 0) {
            teamId = profile.teams[0].team_id;
        }

        if (!teamId) {
            setLoading(false);
            return;
        }

        try {
            const teamId = profile.current_team_id;
            const apiUrl = import.meta.env.VITE_API_URL;

            // 1. Get Team Details
            const teamRes = await fetch(`${apiUrl}/api/teams/${teamId}`);
            if (teamRes.ok) {
                const teamData = await teamRes.json();
                setTeam(teamData);
            }

            // 2. Get Members
            const membersRes = await fetch(`${apiUrl}/api/teams/${teamId}/members`);
            if (membersRes.ok) {
                const membersData = await membersRes.json();
                setMembers(Array.isArray(membersData) ? membersData : []);
            }

            // 3. Get Invitations
            // Note: We use the existing user route for now or update to native invitations route
            const invitesRes = await fetch(`${apiUrl}/api/user/team/invitations?teamId=${teamId}`);
            if (invitesRes.ok) {
                const invitesData = await invitesRes.json();
                setInvitations(Array.isArray(invitesData) ? invitesData : []);
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
                alert('Failed to send invitation');
            }
        } catch (error) {
            console.error('Invite error:', error);
        } finally {
            setInviteSending(false);
        }
    };

    const copyInviteLink = () => {
        // Updated to use the standard invitation token logic if possible, 
        // but for a general "join link" we can use this format
        navigator.clipboard.writeText(`${window.location.origin}/signup?teamId=${team?.id}`);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    if (loading) return (
        <div className="flex h-screen items-center justify-center">
            <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
        </div>
    );

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
                                        <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-sm">
                                            {member.full_name?.[0] || member.email?.[0]?.toUpperCase()}
                                        </div>
                                        <div>
                                            <p className="font-medium text-gray-900">{member.full_name || 'Unnamed User'}</p>
                                            <p className="text-sm text-gray-500">{member.job_title || 'No Title'}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="w-2 h-2 rounded-full bg-green-500"></div>
                                        <span className="text-xs font-medium text-green-700">Active</span>
                                    </div>
                                </div>
                            ))}
                            {members.length === 0 && <div className="p-8 text-center text-gray-500">No active members yet.</div>}
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
                                                <p className="text-sm text-gray-500">Invited on {new Date(invite.created_at).toLocaleDateString()}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <div className="w-2 h-2 rounded-full bg-yellow-500"></div>
                                            <span className="text-xs font-medium text-yellow-700 italic">Pending</span>
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
