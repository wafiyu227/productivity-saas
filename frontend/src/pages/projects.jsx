import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    TrendingUp,
    AlertCircle,
    CheckCircle2,
    Clock,
    Users,
    Sparkles,
    ChevronRight,
    Calendar,
    Target,
    Activity,
    RefreshCw,
    AlertTriangle,
    Bell,
    Filter,
    ChevronDown,
    ChevronUp
} from 'lucide-react';
import { api } from '../api/client';
import { useAuth } from '../contexts/AuthContext';

const Projects = () => {
    const { user, profile } = useAuth();
    const [projects, setProjects] = useState([]);
    const [selectedProject, setSelectedProject] = useState(null);
    const [projectHealth, setProjectHealth] = useState(null);
    const [workload, setWorkload] = useState([]);
    const [workloadSummary, setWorkloadSummary] = useState(null);
    const [deadlines, setDeadlines] = useState(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [activeView, setActiveView] = useState('grid');
    const [error, setError] = useState(null);
    const [showDeadlines, setShowDeadlines] = useState(true);
    const [taskFilter, setTaskFilter] = useState('all');

    useEffect(() => {
        if (user && profile) {
            fetchAllData();
        }
    }, [user, profile?.current_team_id]);

    const fetchAllData = async () => {
        setLoading(true);
        try {
            await Promise.all([
                fetchProjects(),
                fetchWorkload(),
                fetchDeadlines()
            ]);
            setError(null);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleRefresh = async () => {
        setRefreshing(true);
        await fetchAllData();
        setRefreshing(false);
    };

    const fetchProjects = async () => {
        try {
            const data = await api.getAsanaProjects(profile?.current_team_id);
            if (data.error) throw new Error(data.error);
            setProjects(data.projects || []);
        } catch (err) {
            console.error('Error fetching projects:', err);
            throw err;
        }
    };

    const fetchWorkload = async () => {
        try {
            const data = await api.getAsanaWorkload(profile?.current_team_id);
            if (data.error) {
                console.error('Error fetching workload:', data.error);
                setWorkload([]);
                return;
            }
            setWorkload(data.workload || []);
            setWorkloadSummary(data.summary || null);
        } catch (err) {
            console.error('Error fetching workload:', err);
            setWorkload([]);
        }
    };

    const fetchDeadlines = async () => {
        try {
            const data = await api.getAsanaDeadlines(profile?.current_team_id);
            if (data.error) {
                console.error('Error fetching deadlines:', data.error);
                setDeadlines(null);
                return;
            }
            setDeadlines(data);
        } catch (err) {
            console.error('Error fetching deadlines:', err);
            setDeadlines(null);
        }
    };

    const fetchProjectHealth = async (projectId) => {
        try {
            const data = await api.getAsanaProjectHealth(projectId, profile?.current_team_id);
            setProjectHealth(data);
            setSelectedProject(projects.find(p => p.gid === projectId));
        } catch (err) {
            console.error('Error fetching project health:', err);
            alert('Failed to fetch project details: ' + err.message);
        }
    };

    const getHealthColor = (status) => {
        switch (status) {
            case 'healthy': return '#10b981';
            case 'at-risk': return '#f59e0b';
            case 'critical': return '#ef4444';
            default: return '#6b7280';
        }
    };

    const getHealthIcon = (status) => {
        switch (status) {
            case 'healthy': return <CheckCircle2 className="w-5 h-5" />;
            case 'at-risk': return <AlertCircle className="w-5 h-5" />;
            case 'critical': return <AlertCircle className="w-5 h-5" />;
            default: return <Activity className="w-5 h-5" />;
        }
    };

    const formatDueDate = (dateStr) => {
        const date = new Date(dateStr);
        const now = new Date();
        const diffDays = Math.ceil((date - now) / (1000 * 60 * 60 * 24));

        if (diffDays < 0) return `${Math.abs(diffDays)} days overdue`;
        if (diffDays === 0) return 'Due today';
        if (diffDays === 1) return 'Due tomorrow';
        return `Due in ${diffDays} days`;
    };

    const getDaysOverdue = (dateStr) => {
        const date = new Date(dateStr);
        const now = new Date();
        return Math.ceil((now - date) / (1000 * 60 * 60 * 24));
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 flex items-center justify-center">
                <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="text-center"
                >
                    <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-gray-600 font-mono">Loading projects...</p>
                </motion.div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 flex items-center justify-center p-4">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-red-500/10 border border-red-500/30 rounded-2xl p-8 max-w-md text-center"
                >
                    <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
                    <h2 className="text-xl font-bold text-gray-900 mb-2">Connection Error</h2>
                    <p className="text-gray-600 mb-4">{error}</p>
                    <button
                        onClick={fetchAllData}
                        className="px-6 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors"
                    >
                        Try Again
                    </button>
                </motion.div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 text-gray-900">
            {/* Header */}
            <motion.header
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                className="border-b border-gray-200 backdrop-blur-xl bg-white/80 sticky top-0 z-40"
            >
                <div className="max-w-7xl mx-auto px-6 py-6">
                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <h1 className="text-4xl font-bold text-gray-900 mb-2">
                                Projects Overview
                            </h1>
                            <p className="text-gray-600 font-mono text-sm">
                                AI-powered insights for {projects.length} active projects
                            </p>
                        </div>

                        <div className="flex items-center gap-3">
                            <button
                                onClick={handleRefresh}
                                disabled={refreshing}
                                className="p-2 bg-white border border-gray-200 hover:bg-gray-50 rounded-lg transition-all disabled:opacity-50"
                                title="Refresh data"
                            >
                                <RefreshCw className={`w-5 h-5 text-gray-400 ${refreshing ? 'animate-spin' : ''}`} />
                            </button>
                            <button
                                onClick={() => setActiveView('grid')}
                                className={`px-4 py-2 rounded-lg transition-all ${activeView === 'grid'
                                    ? 'bg-blue-600 text-white font-semibold'
                                    : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
                                    }`}
                            >
                                Grid
                            </button>
                            <button
                                onClick={() => setActiveView('list')}
                                className={`px-4 py-2 rounded-lg transition-all ${activeView === 'list'
                                    ? 'bg-blue-600 text-white font-semibold'
                                    : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
                                    }`}
                            >
                                List
                            </button>
                        </div>
                    </div>

                    {/* Stats Bar */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.1 }}
                            className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm"
                        >
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-gray-500 text-sm font-mono mb-1">Active Projects</p>
                                    <p className="text-3xl font-bold text-gray-900">{projects.length}</p>
                                </div>
                                <Target className="w-8 h-8 text-blue-600" />
                            </div>
                        </motion.div>

                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.2 }}
                            className="bg-gradient-to-br from-blue-500/10 to-transparent border border-blue-500/20 rounded-xl p-4"
                        >
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-gray-500 text-sm font-mono mb-1">Team Members</p>
                                    <p className="text-3xl font-bold text-gray-900">{workload.length}</p>
                                </div>
                                <Users className="w-8 h-8 text-blue-400" />
                            </div>
                        </motion.div>

                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.3 }}
                            className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm"
                        >
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-gray-500 text-sm font-mono mb-1">At Risk Tasks</p>
                                    <p className={`text-3xl font-bold ${deadlines?.totalAtRisk > 0 ? 'text-red-600' : 'text-gray-900'}`}>
                                        {deadlines?.totalAtRisk || 0}
                                    </p>
                                </div>
                                <AlertTriangle className={`w-8 h-8 ${deadlines?.totalAtRisk > 0 ? 'text-red-400' : 'text-orange-400'}`} />
                            </div>
                        </motion.div>

                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.4 }}
                            className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm"
                        >
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-gray-500 text-sm font-mono mb-1">Due This Week</p>
                                    <p className="text-3xl font-bold text-gray-900">
                                        {(deadlines?.dueToday?.count || 0) + (deadlines?.dueTomorrow?.count || 0) + (deadlines?.dueThisWeek?.count || 0)}
                                    </p>
                                </div>
                                <Calendar className="w-8 h-8 text-purple-400" />
                            </div>
                        </motion.div>
                    </div>
                </div>
            </motion.header>

            <div className="max-w-7xl mx-auto px-6 py-8">
                {/* Deadline Alerts Section */}
                {deadlines && (deadlines.overdue?.count > 0 || deadlines.dueToday?.count > 0) && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mb-8"
                    >
                        <button
                            onClick={() => setShowDeadlines(!showDeadlines)}
                            className="w-full flex items-center justify-between p-4 bg-white border border-red-100 rounded-xl hover:shadow-md transition-all shadow-sm"
                        >
                            <div className="flex items-center gap-3">
                                <Bell className="w-6 h-6 text-red-500" />
                                <span className="text-lg font-bold text-gray-900">
                                    Deadline Alerts
                                </span>
                                <span className="px-3 py-1 bg-red-500/20 text-red-400 text-sm font-mono rounded-full">
                                    {deadlines.overdue?.count || 0} overdue
                                </span>
                                {deadlines.dueToday?.count > 0 && (
                                    <span className="px-3 py-1 bg-orange-500/20 text-orange-400 text-sm font-mono rounded-full">
                                        {deadlines.dueToday.count} due today
                                    </span>
                                )}
                            </div>
                            {showDeadlines ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
                        </button>

                        <AnimatePresence>
                            {showDeadlines && (
                                <motion.div
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                    exit={{ opacity: 0, height: 0 }}
                                    className="mt-4 space-y-4"
                                >
                                    {/* Overdue Tasks */}
                                    {deadlines.overdue?.tasks?.length > 0 && (
                                        <div className="bg-red-50 border border-red-100 rounded-xl p-4 shadow-sm">
                                            <h3 className="text-red-400 font-bold mb-3 flex items-center gap-2">
                                                <AlertCircle className="w-5 h-5" />
                                                Overdue Tasks ({deadlines.overdue.count})
                                            </h3>
                                            <div className="space-y-2">
                                                {deadlines.overdue.tasks.map((task) => (
                                                    <div key={task.gid} className="flex items-center justify-between p-3 bg-white rounded-lg border border-gray-100">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-2 h-2 rounded-full bg-red-500"></div>
                                                            <div>
                                                                <p className="text-gray-900 font-medium">{task.name}</p>
                                                                <p className="text-sm text-gray-500">
                                                                    {task.project?.name} • {task.assignee?.name || 'Unassigned'}
                                                                </p>
                                                            </div>
                                                        </div>
                                                        <span className="text-red-400 text-sm font-mono">
                                                            {getDaysOverdue(task.due_on)} days overdue
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Due Today */}
                                    {deadlines.dueToday?.tasks?.length > 0 && (
                                        <div className="bg-orange-50 border border-orange-100 rounded-xl p-4 shadow-sm">
                                            <h3 className="text-orange-400 font-bold mb-3 flex items-center gap-2">
                                                <Clock className="w-5 h-5" />
                                                Due Today ({deadlines.dueToday.count})
                                            </h3>
                                            <div className="space-y-2">
                                                {deadlines.dueToday.tasks.map((task) => (
                                                    <div key={task.gid} className="flex items-center justify-between p-3 bg-white rounded-lg border border-gray-100">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-2 h-2 rounded-full bg-orange-500"></div>
                                                            <div>
                                                                <p className="text-gray-900 font-medium">{task.name}</p>
                                                                <p className="text-sm text-gray-500">
                                                                    {task.project?.name} • {task.assignee?.name || 'Unassigned'}
                                                                </p>
                                                            </div>
                                                        </div>
                                                        <span className="text-orange-400 text-sm font-mono">Due today</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Due Tomorrow */}
                                    {deadlines.dueTomorrow?.tasks?.length > 0 && (
                                        <div className="bg-yellow-50 border border-yellow-100 rounded-xl p-4 shadow-sm">
                                            <h3 className="text-yellow-400 font-bold mb-3 flex items-center gap-2">
                                                <Calendar className="w-5 h-5" />
                                                Due Tomorrow ({deadlines.dueTomorrow.count})
                                            </h3>
                                            <div className="space-y-2">
                                                {deadlines.dueTomorrow.tasks.map((task) => (
                                                    <div key={task.gid} className="flex items-center justify-between p-3 bg-white rounded-lg border border-gray-100">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-2 h-2 rounded-full bg-yellow-500"></div>
                                                            <div>
                                                                <p className="text-gray-900 font-medium">{task.name}</p>
                                                                <p className="text-sm text-gray-500">
                                                                    {task.project?.name} • {task.assignee?.name || 'Unassigned'}
                                                                </p>
                                                            </div>
                                                        </div>
                                                        <span className="text-yellow-400 text-sm font-mono">Due tomorrow</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </motion.div>
                )}

                {/* Projects Grid/List */}
                {activeView === 'grid' ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {projects.map((project, index) => (
                            <motion.div
                                key={project.gid}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: index * 0.05 }}
                                onClick={() => fetchProjectHealth(project.gid)}
                                className="group relative bg-white border border-gray-100 rounded-2xl p-6 hover:border-blue-500/50 transition-all cursor-pointer hover:scale-[1.02] hover:shadow-xl hover:shadow-blue-500/10"
                            >
                                {/* Project Header */}
                                <div className="flex items-start justify-between mb-4">
                                    <div className="flex-1">
                                        <h3 className="text-xl font-bold text-gray-900 mb-2 group-hover:text-blue-600 transition-colors line-clamp-2">
                                            {project.name}
                                        </h3>
                                        {project.due_date && (
                                            <div className="flex items-center gap-2 text-sm text-gray-400">
                                                <Calendar className="w-4 h-4" />
                                                <span>{new Date(project.due_date).toLocaleDateString()}</span>
                                            </div>
                                        )}
                                    </div>

                                    <ChevronRight className="w-5 h-5 text-gray-500 group-hover:text-[#00ff87] group-hover:translate-x-1 transition-all" />
                                </div>

                                {/* Project Info */}
                                {project.notes && (
                                    <p className="text-gray-400 text-sm mb-4 line-clamp-2">
                                        {project.notes}
                                    </p>
                                )}

                                {/* Owner */}
                                {project.owner?.name && (
                                    <div className="flex items-center gap-2 mb-4">
                                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center text-white font-bold text-sm">
                                            {project.owner.name.charAt(0)}
                                        </div>
                                        <span className="text-sm text-gray-600">{project.owner.name}</span>
                                    </div>
                                )}

                                {/* Status Badge */}
                                <div className="flex items-center gap-2">
                                    {project.completed ? (
                                        <span className="px-3 py-1 bg-green-100 text-green-700 text-xs font-mono rounded-full border border-green-200">
                                            Completed
                                        </span>
                                    ) : (
                                        <span className="px-3 py-1 bg-blue-100 text-blue-700 text-xs font-mono rounded-full border border-blue-200">
                                            In Progress
                                        </span>
                                    )}
                                </div>

                                {/* Hover Effect */}
                                <div className="absolute inset-0 bg-gradient-to-br from-blue-600/0 to-transparent group-hover:from-blue-600/5 rounded-2xl transition-all pointer-events-none"></div>
                            </motion.div>
                        ))}
                    </div>
                ) : (
                    <div className="space-y-3">
                        {projects.map((project, index) => (
                            <motion.div
                                key={project.gid}
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: index * 0.03 }}
                                onClick={() => fetchProjectHealth(project.gid)}
                                className="bg-white border border-gray-100 rounded-xl p-4 hover:border-blue-500/50 transition-all cursor-pointer group shadow-sm"
                            >
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-4 flex-1">
                                        {project.owner?.name && (
                                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center text-white font-bold shrink-0">
                                                {project.owner.name.charAt(0)}
                                            </div>
                                        )}
                                        <div className="flex-1 min-w-0">
                                            <h3 className="text-lg font-semibold text-gray-900 group-hover:text-blue-600 transition-colors truncate">
                                                {project.name}
                                            </h3>
                                            <div className="flex items-center gap-4 mt-1">
                                                {project.owner?.name && (
                                                    <span className="text-sm text-gray-400">{project.owner.name}</span>
                                                )}
                                                {project.due_date && (
                                                    <span className="text-sm text-gray-500 flex items-center gap-1">
                                                        <Clock className="w-3 h-3" />
                                                        {new Date(project.due_date).toLocaleDateString()}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-3">
                                        {project.completed ? (
                                            <span className="px-3 py-1 bg-green-100 text-green-700 text-xs font-mono rounded-full border border-green-200">
                                                Completed
                                            </span>
                                        ) : (
                                            <span className="px-3 py-1 bg-blue-100 text-blue-700 text-xs font-mono rounded-full border border-blue-200">
                                                Active
                                            </span>
                                        )}
                                        <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-blue-600 group-hover:translate-x-1 transition-all" />
                                    </div>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                )}

                {/* Team Workload Section */}
                {workload.length > 0 && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.5 }}
                        className="mt-12"
                    >
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-2xl font-bold flex items-center gap-3">
                                <Users className="w-6 h-6 text-blue-600" />
                                Team Workload Distribution
                            </h2>
                            {workloadSummary && (
                                <div className="flex items-center gap-4">
                                    <span className="text-sm text-gray-500">
                                        Avg: <span className="text-gray-900 font-mono">{workloadSummary.avgTasksPerMember}</span> tasks/member
                                    </span>
                                    {workloadSummary.overloadedMembers > 0 && (
                                        <span className="px-3 py-1 bg-red-500/20 text-red-400 text-sm rounded-full">
                                            {workloadSummary.overloadedMembers} overloaded
                                        </span>
                                    )}
                                </div>
                            )}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {workload.map((member, index) => (
                                <motion.div
                                    key={member.name}
                                    initial={{ opacity: 0, scale: 0.9 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    transition={{ delay: 0.6 + index * 0.05 }}
                                    className={`bg-white border ${member.isOverloaded ? 'border-red-500/50' : 'border-gray-100'} rounded-xl p-5 shadow-sm`}
                                >
                                    <div className="flex items-center gap-3 mb-4">
                                        <div className={`w-12 h-12 rounded-full bg-gradient-to-br ${member.isOverloaded ? 'from-red-500 to-orange-500' : 'from-blue-600 to-purple-600'} flex items-center justify-center text-white font-bold text-lg`}>
                                            {member.name.charAt(0)}
                                        </div>
                                        <div>
                                            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                                                {member.name}
                                                {member.isOverloaded && (
                                                    <AlertTriangle className="w-4 h-4 text-red-400" />
                                                )}
                                            </h3>
                                            <p className="text-sm text-gray-500">{member.totalTasks} tasks</p>
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <div className="flex justify-between text-sm">
                                            <span className="text-gray-500">Completed</span>
                                            <span className="text-green-600 font-mono">{member.completedTasks}</span>
                                        </div>
                                        <div className="w-full bg-gray-100 rounded-full h-2">
                                            <div
                                                className="bg-gradient-to-r from-green-500 to-emerald-400 h-2 rounded-full transition-all"
                                                style={{
                                                    width: `${member.totalTasks > 0 ? (member.completedTasks / member.totalTasks) * 100 : 0}%`
                                                }}
                                            ></div>
                                        </div>

                                        {member.overdueTasks > 0 && (
                                            <>
                                                <div className="flex justify-between text-sm mt-3">
                                                    <span className="text-gray-500">Overdue</span>
                                                    <span className="text-red-500 font-mono">{member.overdueTasks}</span>
                                                </div>
                                                <div className="w-full bg-gray-100 rounded-full h-2">
                                                    <div
                                                        className="bg-gradient-to-r from-red-500 to-orange-400 h-2 rounded-full transition-all"
                                                        style={{
                                                            width: `${member.totalTasks > 0 ? (member.overdueTasks / member.totalTasks) * 100 : 0}%`
                                                        }}
                                                    ></div>
                                                </div>
                                            </>
                                        )}

                                        {member.upcomingTasks > 0 && (
                                            <div className="flex justify-between text-sm mt-2">
                                                <span className="text-gray-500">Upcoming</span>
                                                <span className="text-blue-600 font-mono">{member.upcomingTasks}</span>
                                            </div>
                                        )}
                                    </div>
                                </motion.div>
                            ))}
                        </div>
                    </motion.div>
                )}
            </div>

            {/* Project Detail Modal */}
            <AnimatePresence>
                {selectedProject && projectHealth && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
                        onClick={() => {
                            setSelectedProject(null);
                            setProjectHealth(null);
                        }}
                    >
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            className="bg-white border border-gray-200 rounded-2xl p-8 max-w-4xl w-full max-h-[90vh] overflow-y-auto"
                            onClick={(e) => e.stopPropagation()}
                        >
                            {/* Modal Header */}
                            <div className="flex items-start justify-between mb-6">
                                <div className="flex-1">
                                    <h2 className="text-3xl font-bold text-gray-900 mb-2">
                                        {selectedProject.name}
                                    </h2>
                                    {selectedProject.notes && (
                                        <p className="text-gray-600">{selectedProject.notes}</p>
                                    )}
                                </div>
                                <button
                                    onClick={() => {
                                        setSelectedProject(null);
                                        setProjectHealth(null);
                                    }}
                                    className="text-gray-400 hover:text-gray-600 transition-colors"
                                >
                                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>

                            {/* Health Status */}
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
                                <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
                                    <div className="flex items-center gap-2 mb-2" style={{ color: getHealthColor(projectHealth.health.healthStatus) }}>
                                        {getHealthIcon(projectHealth.health.healthStatus)}
                                        <span className="font-mono text-sm uppercase">{projectHealth.health.healthStatus}</span>
                                    </div>
                                    <p className="text-2xl font-bold text-white">{projectHealth.health.completionRate}%</p>
                                    <p className="text-xs text-gray-400">Completion Rate</p>
                                </div>

                                <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                                    <p className="text-gray-500 text-sm mb-2">Total Tasks</p>
                                    <p className="text-2xl font-bold text-gray-900">{projectHealth.health.total}</p>
                                </div>

                                <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                                    <p className="text-gray-500 text-sm mb-2">Completed</p>
                                    <p className="text-2xl font-bold text-green-600">{projectHealth.health.completed}</p>
                                </div>

                                <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                                    <p className="text-gray-500 text-sm mb-2">Overdue</p>
                                    <p className="text-2xl font-bold text-red-600">{projectHealth.health.overdue}</p>
                                </div>
                            </div>

                            {/* AI Analysis */}
                            {projectHealth.aiAnalysis && (
                                <div className="bg-purple-50 border border-purple-100 rounded-xl p-6 mb-8">
                                    <div className="flex items-center gap-2 mb-4">
                                        <Sparkles className="w-5 h-5 text-purple-600" />
                                        <h3 className="text-lg font-bold text-gray-900">AI Insights</h3>
                                    </div>
                                    <div className="prose max-w-none">
                                        <p className="text-gray-700 whitespace-pre-line">{projectHealth.aiAnalysis}</p>
                                    </div>
                                </div>
                            )}

                            {/* Recent Tasks */}
                            {projectHealth.tasks && projectHealth.tasks.length > 0 && (
                                <div>
                                    <h3 className="text-lg font-bold text-gray-900 mb-4">Recent Tasks</h3>
                                    <div className="space-y-2">
                                        {projectHealth.tasks.map((task, index) => (
                                            <motion.div
                                                key={task.gid}
                                                initial={{ opacity: 0, x: -20 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                transition={{ delay: index * 0.05 }}
                                                className="bg-gray-50 rounded-lg p-4 border border-gray-100"
                                            >
                                                <div className="flex items-start justify-between gap-4">
                                                    <div className="flex-1">
                                                        <h4 className={`font-medium mb-1 ${task.completed ? 'text-gray-400 line-through' : 'text-gray-900'}`}>
                                                            {task.name}
                                                        </h4>
                                                        {task.assignee && (
                                                            <p className="text-sm text-gray-400">
                                                                Assigned to: {task.assignee.name}
                                                            </p>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        {task.due_on && (
                                                            <span className="text-xs text-gray-500 flex items-center gap-1">
                                                                <Clock className="w-3 h-3" />
                                                                {new Date(task.due_on).toLocaleDateString()}
                                                            </span>
                                                        )}
                                                        {task.completed ? (
                                                            <CheckCircle2 className="w-5 h-5 text-green-500" />
                                                        ) : (
                                                            <div className="w-5 h-5 rounded-full border-2 border-gray-300"></div>
                                                        )}
                                                    </div>
                                                </div>
                                            </motion.div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default Projects;