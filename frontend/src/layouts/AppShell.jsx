import { useEffect, useState } from 'react';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { LayoutDashboard, AlertCircle, Calendar, User, LogOut, Settings, Users, Building2, Code, BarChart3, Menu, X, Mail } from 'lucide-react';
import OfflineBanner from '../components/OfflineBanner';

export default function AppShell() {
    const { user, profile, signOut, isOffline } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const [mobileNavOpen, setMobileNavOpen] = useState(false);

    const team = profile?.teams?.[0]?.teams || null;

    useEffect(() => {
        // Skip the onboarding redirect when offline — the profile may be
        // stale/empty due to a failed network fetch, not because the user
        // genuinely has no team.
        if (isOffline) return;
        if (profile) {
            if (!profile.full_name && !profile.current_team_id) {
                console.warn('Redirecting to onboarding. Missing data:', {
                    hasName: !!profile.full_name,
                    hasTeam: !!profile.current_team_id
                });
                navigate('/onboarding/team-setup');
            }
        }
    }, [profile, navigate, isOffline]);

    const handleSignOut = async () => {
        await signOut();
        navigate('/login');
    };

    useEffect(() => {
        setMobileNavOpen(false);
    }, [location.pathname]);

    // Show loader while checking authentication/profile
    if (!profile) {
        return (
            <div className="flex h-screen items-center justify-center bg-gray-50">
                <div className="text-center">
                    <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-gray-500 font-medium">Loading workspace...</p>
                </div>
            </div>
        );
    }

    // Double check constraints before rendering content (skip when offline)
    if (!isOffline && !profile.full_name && !profile.current_team_id) {
        return null; // Will trigger redirect in useEffect
    }

    const SidebarContent = () => (
        <>
            <div className="p-6 pb-2 flex items-center gap-2">
                <img src="/logo.png" alt="Teama AI Logo" className="w-8 h-8 object-contain" />
                <h1 className="text-2xl font-bold text-slate-900 mb-1">Teama AI</h1>
            </div>

            <div className="px-3 mb-6">
                <div className="flex items-center gap-3 p-2">
                    <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white shrink-0">
                        <Building2 size={18} />
                    </div>
                    <div className="text-left overflow-hidden">
                        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Your Team</p>
                        <p className="text-sm font-bold text-slate-900 truncate">{team?.name || 'No Team'}</p>
                    </div>
                </div>
            </div>

            <nav className="flex-1 px-3 space-y-1">
                <NavLink to="/app/dashboard" icon={<LayoutDashboard size={20} />}>
                    Dashboard
                </NavLink>
                <NavLink to="/app/code" icon={<Code size={20} />}>
                    Code
                </NavLink>
                <NavLink to="/app/summaries" icon={<Calendar size={20} />}>
                    Summaries
                </NavLink>
                <NavLink to="/app/blockers" icon={<AlertCircle size={20} />}>
                    Blockers
                </NavLink>
                <NavLink to="/app/analytics" icon={<BarChart3 size={20} />}>
                    Analytics
                </NavLink>
                <NavLink to="/app/meetings" icon={<Calendar size={20} />}>
                    Meetings
                </NavLink>
                <NavLink to="/app/integrations" icon={<Settings size={20} />}>
                    Integrations
                </NavLink>
                <NavLink to="/app/team" icon={<Users size={20} />}>
                    Team
                </NavLink>
                <NavLink to="/app/profile" icon={<User size={20} />}>
                    Profile
                </NavLink>
            </nav>

            <div className="p-4 border-t border-slate-200 bg-slate-50/50">
                <div className="flex items-center justify-between gap-3">
                    <div className="flex-1 min-w-0">
                        <p className="text-xs text-slate-400 font-medium uppercase truncate">Signed in as</p>
                        <p className="text-sm font-semibold text-slate-700 truncate">{user?.email}</p>
                    </div>
                    <button
                        onClick={handleSignOut}
                        className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                        title="Sign Out"
                    >
                        <LogOut size={20} />
                    </button>
                </div>
            </div>
        </>
    );

    return (
        <div className="flex h-screen bg-gray-50">
            <div className="lg:hidden fixed top-0 left-0 right-0 z-20 bg-white border-b border-slate-200">
                <div className="h-14 px-4 flex items-center justify-between">
                    <button
                        onClick={() => setMobileNavOpen(true)}
                        className="p-2 rounded-lg text-slate-700 hover:bg-slate-100"
                        aria-label="Open navigation menu"
                    >
                        <Menu size={22} />
                    </button>
                    <p className="text-sm font-semibold text-slate-900 truncate">{team?.name || 'Teama AI'}</p>
                    <button
                        onClick={handleSignOut}
                        className="p-2 rounded-lg text-slate-500 hover:text-red-500 hover:bg-red-50"
                        aria-label="Sign out"
                    >
                        <LogOut size={20} />
                    </button>
                </div>
            </div>

            {mobileNavOpen && (
                <div className="lg:hidden fixed inset-0 z-30">
                    <button
                        className="absolute inset-0 bg-black/30"
                        onClick={() => setMobileNavOpen(false)}
                        aria-label="Close navigation menu"
                    />
                    <aside className="absolute left-0 top-0 h-full w-72 max-w-[85vw] bg-white border-r border-slate-200 flex flex-col">
                        <div className="h-14 px-4 border-b border-slate-200 flex items-center justify-between">
                            <span className="font-semibold text-slate-900">Navigation</span>
                            <button
                                onClick={() => setMobileNavOpen(false)}
                                className="p-2 rounded-lg text-slate-600 hover:bg-slate-100"
                                aria-label="Close navigation menu"
                            >
                                <X size={20} />
                            </button>
                        </div>
                        <SidebarContent />
                    </aside>
                </div>
            )}

            {/* Sidebar */}
            <aside className="hidden lg:flex w-64 bg-white border-r border-slate-200 flex-col">
                <SidebarContent />
            </aside>

            {/* Main Content */}
            <main className="flex-1 overflow-y-auto relative pt-14 lg:pt-0">
                <OfflineBanner isOffline={isOffline} />
                <Outlet />
            </main>
        </div>
    );
}

function NavLink({ to, icon, children }) {
    const location = useLocation();
    const isActive = location.pathname === to;

    return (
        <Link
            to={to}
            className={`flex items-center gap-3 px-3 py-2 rounded-xl transition-all font-medium ${isActive
                ? 'bg-blue-50 text-blue-600'
                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
        >
            <span className={isActive ? 'text-blue-600' : 'text-slate-400'}>{icon}</span>
            <span>{children}</span>
        </Link>
    );
}
