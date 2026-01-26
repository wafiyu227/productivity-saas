import { Outlet, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { LayoutDashboard, AlertCircle, Calendar, User, LogOut, Settings } from 'lucide-react';
export default function AppShell() {
    const { user, signOut } = useAuth();
    const navigate = useNavigate();

    const handleSignOut = async () => {
        await signOut();
        navigate('/login');
    };

    return (
        <div className="flex h-screen bg-gray-50">
            {/* Sidebar */}
            <aside className="w-64 bg-white border-r border-gray-200">
                <div className="p-6">
                    <h1 className="text-2xl font-bold text-gray-900">ProductivityAI</h1>
                </div>

                <nav className="px-3">
                    <NavLink to="/app" icon={<LayoutDashboard size={20} />}>
                        Dashboard
                    </NavLink>
                    <NavLink to="/app/blockers" icon={<AlertCircle size={20} />}>
                        Blockers
                    </NavLink>
                    <NavLink to="/app/meetings" icon={<Calendar size={20} />}>
                        Meetings
                    </NavLink>
                    <NavLink to="/app/integrations" icon={<Settings size={20} />}>
                        Integrations
                    </NavLink>
                    <NavLink to="/app/profile" icon={<User size={20} />}>
                        Profile
                    </NavLink>
                </nav>

                <div className="absolute bottom-0 w-64 p-4 border-t border-gray-200">
                    <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">{user?.email}</span>
                        <button
                            onClick={handleSignOut}
                            className="text-gray-400 hover:text-gray-600"
                        >
                            <LogOut size={20} />
                        </button>
                    </div>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 overflow-y-auto">
                <Outlet />
            </main>
        </div>
    );
}

function NavLink({ to, icon, children }) {
    return (
        <Link
            to={to}
            className="flex items-center gap-3 px-3 py-2 mb-1 text-gray-700 rounded-lg hover:bg-gray-100"
        >
            {icon}
            <span>{children}</span>
        </Link>
    );
}