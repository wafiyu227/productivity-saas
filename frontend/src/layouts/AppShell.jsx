import { useEffect, useState } from 'react';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { LayoutDashboard, AlertCircle, Calendar, User, LogOut, Settings, Code, BarChart3, Menu, X, Sparkles, Target, MessageSquare } from 'lucide-react';
import OfflineBanner from '../components/OfflineBanner';

export default function AppShell() {
    const { user, profile, signOut, isOffline } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const [mobileNavOpen, setMobileNavOpen] = useState(false);

    useEffect(() => {
        // Profile is loaded, continue to dashboard
        // No onboarding steps needed anymore
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
    if (!isOffline && !profile.id) {
        return null; // Will wait for profile to load
    }

    const SidebarContent = () => (
        <div className="flex flex-col h-full bg-black border-r border-white/5 selection:bg-gray-800">
            <div className="p-6 pb-6">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-white/5 border border-white/10 rounded-lg flex items-center justify-center text-white">
                        <Sparkles size={16} />
                    </div>
                    <h1 className="text-xl font-bold text-white tracking-tight">Teama AI</h1>
                </div>
            </div>

            <div className="px-3 mb-6">
                <div className="rounded-2xl bg-white/[0.02] border border-white/5 p-4">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center text-white border border-white/10">
                            <User size={18} />
                        </div>
                        <div className="text-left overflow-hidden">
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest leading-none mb-1.5">User Account</p>
                            <p className="text-sm font-bold text-white truncate">{profile?.full_name || 'User'}</p>
                        </div>
                    </div>
                </div>
            </div>

            <nav className="flex-1 px-3 overflow-y-auto space-y-8 pb-8">
                <div>
                    <h3 className="px-4 pb-3 text-[10px] font-bold uppercase tracking-widest text-gray-400">
                        Workspace
                    </h3>
                    <div className="space-y-1">
                        <NavLink to="/app/dashboard" icon={<LayoutDashboard size={18} />}>
                            Dashboard
                        </NavLink>
                        <NavLink to="/app/insights" icon={<Sparkles size={18} />}>
                            Approvals
                        </NavLink>
                        <NavLink to="/app/meetings" icon={<Calendar size={18} />}>
                            Meetings
                        </NavLink>
                        <NavLink to="/app/projects" icon={<Target size={18} />}>
                            Projects
                        </NavLink>
                        <NavLink to="/app/integrations" icon={<Settings size={18} />}>
                            Integrations
                        </NavLink>
                    </div>
                </div>

                <div>
                    <h3 className="px-4 pb-3 text-[10px] font-bold uppercase tracking-widest text-gray-400">
                        Analysis
                    </h3>
                    <div className="space-y-1">
                        <NavLink to="/app/chat" icon={<MessageSquare size={18} />}>
                            Agent Chat
                        </NavLink>
                        <NavLink to="/app/blockers" icon={<AlertCircle size={18} />}>
                            Blockers
                        </NavLink>
                        <NavLink to="/app/code" icon={<Code size={18} />}>
                            Code
                        </NavLink>
                        <NavLink to="/app/analytics" icon={<BarChart3 size={18} />}>
                            Analytics
                        </NavLink>
                    </div>
                </div>

                <div>
                    <h3 className="px-4 pb-3 text-[10px] font-bold uppercase tracking-widest text-gray-400">
                        Settings
                    </h3>
                    <div className="space-y-1">
                        <NavLink to="/app/profile" icon={<User size={18} />}>
                            Profile
                        </NavLink>
                    </div>
                </div>
            </nav>

            <div className="p-4 border-t border-white/5">
                <div className="flex items-center justify-between gap-3 px-2">
                    <div className="flex-1 min-w-0">
                        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest truncate mb-0.5">Signed In</p>
                        <p className="text-xs font-medium text-gray-400 truncate">{user?.email}</p>
                    </div>
                    <button
                        onClick={handleSignOut}
                        className="p-2 text-gray-600 hover:text-white transition-colors"
                        title="Sign Out"
                    >
                        <LogOut size={18} />
                    </button>
                </div>
            </div>
        </div>
    );

    return (
        <div className="flex h-screen bg-black text-white selection:bg-gray-800">
            {/* Mobile Header */}
            <div className="lg:hidden fixed top-0 left-0 right-0 z-20 bg-black border-b border-white/5">
                <div className="h-14 px-4 flex items-center justify-between">
                    <button
                        onClick={() => setMobileNavOpen(true)}
                        className="p-2 rounded-xl text-gray-400 hover:bg-white/5"
                    >
                        <Menu size={22} />
                    </button>
                    <p className="text-sm font-bold text-white tracking-tight">Teama AI</p>
                    <button
                        onClick={handleSignOut}
                        className="p-2 rounded-xl text-gray-500 hover:text-white"
                    >
                        <LogOut size={20} />
                    </button>
                </div>
            </div>

            {/* Mobile Navigation Sidebar Overlay */}
            {mobileNavOpen && (
                <div className="lg:hidden fixed inset-0 z-30">
                    <div 
                        className="absolute inset-0 bg-black/80 backdrop-blur-sm transition-opacity duration-300"
                        onClick={() => setMobileNavOpen(false)}
                    />
                    <aside className="absolute left-0 top-0 h-full w-80 max-w-[85vw] bg-black border-r border-white/5 flex flex-col transition-transform duration-300">
                        <div className="h-14 px-4 border-b border-white/5 flex items-center justify-between">
                            <span className="text-[10px] font-bold text-gray-700 uppercase tracking-widest">Navigation</span>
                            <button
                                onClick={() => setMobileNavOpen(false)}
                                className="p-2 rounded-xl text-gray-400 hover:bg-white/5"
                            >
                                <X size={20} />
                            </button>
                        </div>
                        <div className="flex-1 overflow-hidden">
                            <SidebarContent />
                        </div>
                    </aside>
                </div>
            )}

            {/* Desktop Sidebar */}
            <aside className="hidden lg:flex w-64 flex-col h-full sticky top-0">
                <SidebarContent />
            </aside>

            {/* Main Content Area */}
            <main className="flex-1 overflow-y-auto relative pt-14 lg:pt-0 bg-black">
                <OfflineBanner isOffline={isOffline} />
                <div className="min-h-full">
                    <Outlet />
                </div>
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
            className={`flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all font-semibold text-[13px] relative group ${isActive
                ? 'text-white bg-white/5'
                : 'text-gray-500 hover:text-gray-300 hover:bg-white/[0.02]'
                }`}
        >
            <span className={`transition-colors duration-300 ${isActive ? 'text-white' : 'text-gray-600 group-hover:text-gray-400'}`}>
                {icon}
            </span>
            <span>{children}</span>
            
            {isActive && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-4 bg-white rounded-r-full" />
            )}
        </Link>
    );
}

