import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Mail, Copy, Check, Users, AlertCircle, CreditCard, RefreshCw, X, UserMinus, LogOut } from 'lucide-react';

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
    const [isBillingLoading, setIsBillingLoading] = useState(false);
    const [memberRole, setMemberRole] = useState(null);
    const [inviteActionId, setInviteActionId] = useState(null);
    const [memberActionId, setMemberActionId] = useState(null);
    const [leaving, setLeaving] = useState(false);

    const clearPaymentQueryParams = () => {
        const url = new URL(window.location.href);
        ['payment', 'reference', 'trxref'].forEach((param) => {
            url.searchParams.delete(param);
        });
        window.history.replaceState({}, document.title, `${url.pathname}${url.search}${url.hash}`);
    };

    const verifyPaymentFromRedirect = async () => {
        const searchParams = new URLSearchParams(window.location.search);
        if (searchParams.get('payment') !== 'success') return;

        const reference = searchParams.get('reference') || searchParams.get('trxref');
        if (!reference) {
            alert('Payment succeeded, but no transaction reference was returned. Please refresh in a few seconds.');
            clearPaymentQueryParams();
            return;
        }

        setIsBillingLoading(true);
        try {
            const res = await fetch(`${import.meta.env.VITE_API_URL}/api/paystack/verify`, {
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
            setIsBillingLoading(false);
            clearPaymentQueryParams();
        }
    };

    useEffect(() => {
        const initializePage = async () => {
            await verifyPaymentFromRedirect();
            if (user && profile) {
                await fetchTeamData();
            }
        };

        initializePage();
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
                fetch(`${apiUrl}/api/teams/${teamId}?userId=${user.id}`),
                fetch(`${apiUrl}/api/teams/${teamId}/members?userId=${user.id}`),
                fetch(`${apiUrl}/api/teams/${teamId}/invitations?userId=${user.id}`)
            ]);

            // 1. Get Team Details
            if (teamRes.ok) {
                const teamData = await teamRes.json();
                setTeam(teamData);
                setMemberRole(teamData.currentUserRole || null);
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
                if (!memberRole && Array.isArray(membersData)) {
                    const currentMember = membersData.find((member) => member.user_id === user.id);
                    if (currentMember?.role) setMemberRole(currentMember.role);
                }
            } else {
                console.error('Failed to fetch members:', membersRes.status);
            }

            // 3. Get Invitations
            if (invitesRes.ok) {
                const invitesData = await invitesRes.json();
                setInvitations(Array.isArray(invitesData) ? invitesData : []);
            } else if (invitesRes.status === 403 || invitesRes.status === 404) {
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

    const canManageTeam = memberRole === 'owner' || memberRole === 'admin';
    const canManageBilling = canManageTeam;

    const handleInvite = async (e) => {
        e.preventDefault();
        if (!inviteEmail || !team || !canManageTeam) return;

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
                return;
            } else {
                const errorData = await res.json();
                if (res.status === 409 && errorData.code === 'DUPLICATE_PENDING_INVITE' && errorData.invitation?.id) {
                    const shouldResend = window.confirm('An active invitation already exists. Resend it now?');
                    if (shouldResend) {
                        await handleResendInvite(errorData.invitation.id);
                    }
                    return;
                }
                if (res.status === 403 && errorData.error?.includes('Team size limit reached')) {
                    const wantsUpgrade = window.confirm(`🛑 ${errorData.error}\n\nPlease use the Subscription & Billing section above to upgrade your plan.`);
                    if (wantsUpgrade) {
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                    }
                } else {
                    alert(errorData.error || 'Failed to send invitation');
                }
            }
        } catch (error) {
            console.error('Invite error:', error);
            alert('Failed to send invitation');
        } finally {
            setInviteSending(false);
        }
    };

    const handleResendInvite = async (invitationId) => {
        if (!team || !canManageTeam || !invitationId) return;

        setInviteActionId(`resend-${invitationId}`);
        try {
            const res = await fetch(`${import.meta.env.VITE_API_URL}/api/invitations/${invitationId}/resend?userId=${user.id}`, {
                method: 'POST'
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to resend invitation');
            await fetchTeamData();
        } catch (error) {
            console.error('Resend invitation error:', error);
            alert(error.message || 'Failed to resend invitation');
        } finally {
            setInviteActionId(null);
        }
    };

    const handleCancelInvite = async (invitationId) => {
        if (!team || !canManageTeam || !invitationId) return;
        if (!window.confirm('Cancel this invitation?')) return;

        setInviteActionId(`cancel-${invitationId}`);
        try {
            const res = await fetch(`${import.meta.env.VITE_API_URL}/api/invitations/${invitationId}?userId=${user.id}`, {
                method: 'DELETE'
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to cancel invitation');
            await fetchTeamData();
        } catch (error) {
            console.error('Cancel invitation error:', error);
            alert(error.message || 'Failed to cancel invitation');
        } finally {
            setInviteActionId(null);
        }
    };

    const handleRemoveMember = async (memberUserId) => {
        if (!team || !canManageTeam || !memberUserId) return;
        if (!window.confirm('Remove this member from the team?')) return;

        setMemberActionId(memberUserId);
        try {
            const res = await fetch(`${import.meta.env.VITE_API_URL}/api/teams/${team.id}/members/${memberUserId}?userId=${user.id}`, {
                method: 'DELETE'
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to remove member');
            await fetchTeamData();
        } catch (error) {
            console.error('Remove member error:', error);
            alert(error.message || 'Failed to remove member');
        } finally {
            setMemberActionId(null);
        }
    };

    const handleLeaveTeam = async () => {
        if (!team || !user?.id) return;
        if (!window.confirm('Leave this team? You will lose access immediately.')) return;

        setLeaving(true);
        try {
            const res = await fetch(`${import.meta.env.VITE_API_URL}/api/teams/${team.id}/leave`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: user.id })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to leave team');
            await refreshProfile();
            await fetchTeamData();
        } catch (error) {
            console.error('Leave team error:', error);
            alert(error.message || 'Failed to leave team');
        } finally {
            setLeaving(false);
        }
    };

    const handleUpgrade = async (planName) => {
        if (!team || !canManageBilling) return;
        setIsBillingLoading(true);
        try {
            // Note: Users should provide these in their .env
            const planCode = planName === 'starter'
                ? import.meta.env.VITE_PAYSTACK_STARTER_PLAN
                : import.meta.env.VITE_PAYSTACK_GROWTH_PLAN;

            if (!planCode) {
                alert('Plan codes not configured in environment variables (.env)');
                setIsBillingLoading(false);
                return;
            }

            const res = await fetch(`${import.meta.env.VITE_API_URL}/api/paystack/initialize`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: user.email,
                    plan: planCode,
                    planName,
                    teamId: team.id,
                    userId: user.id
                })
            });
            const data = await res.json();
            if (res.ok && data.checkoutUrl) {
                window.location.href = data.checkoutUrl;
            } else {
                alert(data.error || 'Failed to initialize checkout');
            }
        } catch (error) {
            console.error('Upgrade error:', error);
            alert('Failed to start upgrade process');
        } finally {
            setIsBillingLoading(false);
        }
    };

    const handleManageSubscription = async () => {
        if (!team || !canManageBilling) return;
        setIsBillingLoading(true);
        try {
            const res = await fetch(`${import.meta.env.VITE_API_URL}/api/paystack/manage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    teamId: team.id,
                    userId: user.id
                })
            });
            const data = await res.json();
            if (res.ok && data.manageUrl) {
                window.location.href = data.manageUrl;
            } else {
                alert(data.error || 'Failed to get management link');
            }
        } catch (error) {
            console.error('Manage subscription error:', error);
            alert('Failed to get management link');
        } finally {
            setIsBillingLoading(false);
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
            <div className="p-4 md:p-8 max-w-4xl mx-auto">
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
            <div className="p-4 md:p-8 max-w-4xl mx-auto text-center">
                <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-12">
                    <Users className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                    <h2 className="text-2xl font-bold text-slate-900 mb-2">No Team Selected</h2>
                    <p className="text-slate-500 mb-6">Create a team in the onboarding flow to start collaborating.</p>
                </div>
            </div>
        );
    }

    const currentPlan = (team.plan || 'free').toLowerCase();
    const parsedUsageCount = Number(team.usageCount);
    const usageCount = Number.isFinite(parsedUsageCount) ? parsedUsageCount : 0;
    const fallbackSummaryLimit = currentPlan === 'starter' ? 1000 : (currentPlan === 'growth' ? null : 50);
    const summaryLimit = team.summaryLimit ?? fallbackSummaryLimit;
    const isSummaryUnlimited = team.isSummaryUnlimited ?? summaryLimit === null;
    const fallbackSeatLimit = currentPlan === 'starter' ? 20 : (currentPlan === 'growth' ? 75 : 5);
    const seatLimit = team.seatLimit ?? fallbackSeatLimit;
    const pendingInvitations = invitations.filter((invite) => invite.status === 'pending');
    const seatUsageCount = members.length + pendingInvitations.length;
    const usagePercent = isSummaryUnlimited
        ? 0
        : Math.min(100, (usageCount / Math.max(summaryLimit || 1, 1)) * 100);

    const subscriptionStatus = team.subscription_status || 'active';
    const isCancelAtPeriodEnd = subscriptionStatus === 'cancel_at_period_end';
    const statusBadgeClass = subscriptionStatus === 'active'
        ? 'bg-green-100 text-green-700'
        : isCancelAtPeriodEnd
            ? 'bg-amber-100 text-amber-700'
            : 'bg-gray-100 text-gray-700';
    const statusLabel = subscriptionStatus === 'active'
        ? 'Active'
        : isCancelAtPeriodEnd
            ? 'Cancels At Period End'
            : 'Free Tier';
    const periodEndLabel = team.current_period_end
        ? new Date(team.current_period_end).toLocaleDateString()
        : null;

    return (
        <div className="p-4 md:p-8 max-w-6xl mx-auto">
            <div className="mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 mb-2">{team.name}</h1>
                    <p className="text-gray-600">{members.length} Members {team.size_range && `• ${team.size_range}`}</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Main Content Area: Billing + Members */}
                <div className="lg:col-span-2 space-y-6">

                    {/* Billing Section */}
                    <div className="bg-white rounded-xl shadow-sm overflow-hidden border border-blue-100">
                        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-6 border-b border-blue-100 flex items-center justify-between">
                            <div>
                                <h2 className="font-semibold text-lg text-gray-900 flex items-center gap-2">
                                    <CreditCard size={20} className="text-blue-600" />
                                    Subscription & Billing
                                </h2>
                                <p className="text-sm text-gray-600 mt-1">
                                    Current Plan: <span className="font-semibold capitalize text-blue-700">{currentPlan}</span>
                                </p>
                            </div>
                            <div className="flex flex-col items-end">
                                <span className={`px-3 py-1 rounded-full text-xs font-semibold ${statusBadgeClass}`}>
                                    {statusLabel}
                                </span>
                            </div>
                        </div>
                        <div className="p-6">
                            {isCancelAtPeriodEnd && periodEndLabel && (
                                <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                                    Subscription cancellation is scheduled. Access remains active until {periodEndLabel}.
                                </div>
                            )}
                            <div className="mb-6">
                                <div className="flex justify-between items-end mb-2">
                                    <span className="text-sm font-medium text-gray-700">Monthly AI Summaries</span>
                                    <span className="text-sm font-semibold text-gray-900">
                                        {usageCount} / {isSummaryUnlimited ? 'Unlimited' : summaryLimit}
                                    </span>
                                </div>
                                <div className="w-full bg-gray-100 rounded-full h-2.5">
                                    <div
                                        className="bg-blue-600 h-2.5 rounded-full"
                                        style={{ width: `${usagePercent}%` }}
                                    ></div>
                                </div>
                                {isSummaryUnlimited && (
                                    <p className="text-xs text-gray-500 mt-2">Unlimited monthly summaries on Growth plan</p>
                                )}
                            </div>
                            <div className="mb-2 text-sm text-gray-700">
                                Team Seats Used: <span className="font-semibold text-gray-900">{seatUsageCount}</span> / <span className="font-semibold text-gray-900">{seatLimit}</span>
                                <span className="text-gray-500"> (includes pending invites)</span>
                            </div>

                            {canManageBilling ? (
                                <div className="flex gap-3 mt-8">
                                    {(currentPlan === 'free' || currentPlan === 'starter') && (
                                        <>
                                            {currentPlan === 'free' && (
                                                <button
                                                    onClick={() => handleUpgrade('starter')}
                                                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium text-sm transition disabled:opacity-50"
                                                    disabled={isBillingLoading}
                                                >
                                                    {isBillingLoading ? 'Loading...' : 'Upgrade to Starter'}
                                                </button>
                                            )}
                                            <button
                                                onClick={() => handleUpgrade('growth')}
                                                className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-medium text-sm transition disabled:opacity-50"
                                                disabled={isBillingLoading}
                                            >
                                                {isBillingLoading ? 'Loading...' : 'Upgrade to Growth'}
                                            </button>
                                        </>
                                    )}
                                    {currentPlan !== 'free' && (
                                        <button
                                            onClick={handleManageSubscription}
                                            className="bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 px-4 py-2 rounded-lg font-medium text-sm transition disabled:opacity-50"
                                            disabled={isBillingLoading}
                                        >
                                            {isBillingLoading ? 'Loading...' : 'Manage Subscription'}
                                        </button>
                                    )}
                                </div>
                            ) : (
                                <p className="mt-8 rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm text-gray-600">
                                    Subscription changes are restricted to team owners and admins.
                                </p>
                            )}
                        </div>
                    </div>

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
                                        {canManageTeam && member.user_id !== user.id && (
                                            <button
                                                onClick={() => handleRemoveMember(member.user_id)}
                                                disabled={memberActionId === member.user_id}
                                                className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded border border-red-200 text-red-700 hover:bg-red-50 disabled:opacity-50"
                                            >
                                                {memberActionId === member.user_id ? (
                                                    <RefreshCw size={12} className="animate-spin" />
                                                ) : (
                                                    <UserMinus size={12} />
                                                )}
                                                Remove
                                            </button>
                                        )}
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
                                <h2 className="font-semibold text-lg text-gray-900">Invitations</h2>
                            </div>
                            <div className="divide-y divide-gray-100">
                                {invitations.map((invite) => (
                                    <div key={invite.id} className={`p-4 flex items-center justify-between ${invite.status === 'expired' ? 'bg-gray-50' : 'bg-yellow-50/30'}`}>
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
                                                : invite.status === 'expired'
                                                    ? 'bg-red-100 text-red-700'
                                                    : invite.status === 'cancelled'
                                                        ? 'bg-gray-100 text-gray-700'
                                                        : 'bg-green-100 text-green-700'
                                                }`}>
                                                {invite.status}
                                            </span>
                                            {canManageTeam && invite.status !== 'accepted' && (
                                                <>
                                                    <button
                                                        onClick={() => handleResendInvite(invite.id)}
                                                        disabled={inviteActionId === `resend-${invite.id}`}
                                                        className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded border border-blue-200 text-blue-700 hover:bg-blue-50 disabled:opacity-50"
                                                    >
                                                        {inviteActionId === `resend-${invite.id}` ? (
                                                            <RefreshCw size={12} className="animate-spin" />
                                                        ) : (
                                                            <RefreshCw size={12} />
                                                        )}
                                                        Resend
                                                    </button>
                                                    {invite.status !== 'cancelled' && (
                                                        <button
                                                            onClick={() => handleCancelInvite(invite.id)}
                                                            disabled={inviteActionId === `cancel-${invite.id}`}
                                                            className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded border border-red-200 text-red-700 hover:bg-red-50 disabled:opacity-50"
                                                        >
                                                            {inviteActionId === `cancel-${invite.id}` ? (
                                                                <RefreshCw size={12} className="animate-spin" />
                                                            ) : (
                                                                <X size={12} />
                                                            )}
                                                            Cancel
                                                        </button>
                                                    )}
                                                </>
                                            )}
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
                        <div className="mb-4 flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 text-xs text-gray-600">
                            <span>Role: {(memberRole || 'member').toUpperCase()}</span>
                            <button
                                onClick={handleLeaveTeam}
                                disabled={leaving}
                                className="inline-flex items-center gap-1 text-red-700 hover:text-red-800 disabled:opacity-50"
                            >
                                {leaving ? <RefreshCw size={12} className="animate-spin" /> : <LogOut size={12} />}
                                Leave Team
                            </button>
                        </div>
                        {canManageTeam ? (
                            <>
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
                            </>
                        ) : (
                            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">
                                Invite management is read-only for members. Ask a team owner or admin to send or manage invites.
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Team;

