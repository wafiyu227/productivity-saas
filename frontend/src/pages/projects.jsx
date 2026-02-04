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
    Activity
} from 'lucide-react';

const Projects = ({ userId }) => {
    const [projects, setProjects] = useState([]);
    const [selectedProject, setSelectedProject] = useState(null);
    const [projectHealth, setProjectHealth] = useState(null);
    const [workload, setWorkload] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeView, setActiveView] = useState('grid'); // 'grid' or 'list'
    const [error, setError] = useState(null);

    useEffect(() => {
        fetchProjects();
        fetchWorkload();
    }, [userId]);

    const fetchProjects = async () => {
        try {
            setLoading(true);
            const response = await fetch(`/api/asana/projects?userId=${userId}`);
            const data = await response.json();

            if (!response.ok) throw new Error(data.error || 'Failed to fetch projects');

            setProjects(data.projects);
            setError(null);
        } catch (err) {
            setError(err.message);
            console.error('Error fetching projects:', err);
        } finally {
            setLoading(false);
        }
    };

    const fetchWorkload = async () => {
        try {
            const response = await fetch(`/api/asana/workload?userId=${userId}`);
            const data = await response.json();

            if (!response.ok) throw new Error(data.error || 'Failed to fetch workload');

            setWorkload(data.workload);
        } catch (err) {
            console.error('Error fetching workload:', err);
        }
    };

    const fetchProjectHealth = async (projectId) => {
        try {
            const response = await fetch(`/api/asana/projects/${projectId}/health?userId=${userId}`);
            const data = await response.json();

            if (!response.ok) throw new Error(data.error || 'Failed to fetch project health');

            setProjectHealth(data);
            setSelectedProject(projects.find(p => p.gid === projectId));
        } catch (err) {
            console.error('Error fetching project health:', err);
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

    if (loading) {
        return (
            <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
                <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="text-center"
                >
                    <div className="w-16 h-16 border-4 border-[#00ff87] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-gray-400 font-mono">Loading projects...</p>
                </motion.div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center p-4">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-red-500/10 border border-red-500/30 rounded-2xl p-8 max-w-md text-center"
                >
                    <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
                    <h2 className="text-xl font-bold text-white mb-2">Connection Error</h2>
                    <p className="text-gray-400 mb-4">{error}</p>
                    <button
                        onClick={fetchProjects}
                        className="px-6 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors"
                    >
                        Try Again
                    </button>
                </motion.div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#0a0a0f] text-white">
            {/* Header */}
            <motion.header
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                className="border-b border-gray-800/50 backdrop-blur-xl bg-[#0a0a0f]/80 sticky top-0 z-40"
            >
                <div className="max-w-7xl mx-auto px-6 py-6">
                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <h1 className="text-4xl font-bold bg-gradient-to-r from-[#00ff87] via-[#00d9ff] to-[#a855f7] bg-clip-text text-transparent mb-2">
                                Projects Overview
                            </h1>
                            <p className="text-gray-400 font-mono text-sm">
                                AI-powered insights for {projects.length} active projects
                            </p>
                        </div>

                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => setActiveView('grid')}
                                className={`px-4 py-2 rounded-lg transition-all ${activeView === 'grid'
                                        ? 'bg-[#00ff87] text-black font-semibold'
                                        : 'bg-gray-800/50 text-gray-400 hover:bg-gray-800'
                                    }`}
                            >
                                Grid
                            </button>
                            <button
                                onClick={() => setActiveView('list')}
                                className={`px-4 py-2 rounded-lg transition-all ${activeView === 'list'
                                        ? 'bg-[#00ff87] text-black font-semibold'
                                        : 'bg-gray-800/50 text-gray-400 hover:bg-gray-800'
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
                            className="bg-gradient-to-br from-[#00ff87]/10 to-transparent border border-[#00ff87]/20 rounded-xl p-4"
                        >
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-gray-400 text-sm font-mono mb-1">Active Projects</p>
                                    <p className="text-3xl font-bold text-white">{projects.length}</p>
                                </div>
                                <Target className="w-8 h-8 text-[#00ff87]" />
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
                                    <p className="text-gray-400 text-sm font-mono mb-1">Team Members</p>
                                    <p className="text-3xl font-bold text-white">{workload.length}</p>
                                </div>
                                <Users className="w-8 h-8 text-blue-400" />
                            </div>
                        </motion.div>

                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.3 }}
                            className="bg-gradient-to-br from-purple-500/10 to-transparent border border-purple-500/20 rounded-xl p-4"
                        >
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-gray-400 text-sm font-mono mb-1">AI Insights</p>
                                    <p className="text-3xl font-bold text-white">
                                        {projects.filter(p => p.notes).length}
                                    </p>
                                </div>
                                <Sparkles className="w-8 h-8 text-purple-400" />
                            </div>
                        </motion.div>

                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.4 }}
                            className="bg-gradient-to-br from-orange-500/10 to-transparent border border-orange-500/20 rounded-xl p-4"
                        >
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-gray-400 text-sm font-mono mb-1">Avg Completion</p>
                                    <p className="text-3xl font-bold text-white">
                                        {projects.length > 0
                                            ? Math.round(projects.filter(p => p.completed).length / projects.length * 100)
                                            : 0}%
                                    </p>
                                </div>
                                <TrendingUp className="w-8 h-8 text-orange-400" />
                            </div>
                        </motion.div>
                    </div>
                </div>
            </motion.header>

            <div className="max-w-7xl mx-auto px-6 py-8">
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
                                className="group relative bg-gradient-to-br from-gray-900/50 to-gray-800/30 border border-gray-700/50 rounded-2xl p-6 hover:border-[#00ff87]/50 transition-all cursor-pointer hover:scale-[1.02] hover:shadow-xl hover:shadow-[#00ff87]/10"
                            >
                                {/* Project Header */}
                                <div className="flex items-start justify-between mb-4">
                                    <div className="flex-1">
                                        <h3 className="text-xl font-bold text-white mb-2 group-hover:text-[#00ff87] transition-colors line-clamp-2">
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
                                {project.owner && (
                                    <div className="flex items-center gap-2 mb-4">
                                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#00ff87] to-[#00d9ff] flex items-center justify-center text-black font-bold text-sm">
                                            {project.owner.name.charAt(0)}
                                        </div>
                                        <span className="text-sm text-gray-300">{project.owner.name}</span>
                                    </div>
                                )}

                                {/* Status Badge */}
                                <div className="flex items-center gap-2">
                                    {project.completed ? (
                                        <span className="px-3 py-1 bg-green-500/20 text-green-400 text-xs font-mono rounded-full border border-green-500/30">
                                            Completed
                                        </span>
                                    ) : (
                                        <span className="px-3 py-1 bg-blue-500/20 text-blue-400 text-xs font-mono rounded-full border border-blue-500/30">
                                            In Progress
                                        </span>
                                    )}
                                </div>

                                {/* Hover Effect */}
                                <div className="absolute inset-0 bg-gradient-to-br from-[#00ff87]/0 to-transparent group-hover:from-[#00ff87]/5 rounded-2xl transition-all pointer-events-none"></div>
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
                                className="bg-gradient-to-r from-gray-900/50 to-gray-800/30 border border-gray-700/50 rounded-xl p-4 hover:border-[#00ff87]/50 transition-all cursor-pointer group"
                            >
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-4 flex-1">
                                        {project.owner && (
                                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#00ff87] to-[#00d9ff] flex items-center justify-center text-black font-bold shrink-0">
                                                {project.owner.name.charAt(0)}
                                            </div>
                                        )}
                                        <div className="flex-1 min-w-0">
                                            <h3 className="text-lg font-semibold text-white group-hover:text-[#00ff87] transition-colors truncate">
                                                {project.name}
                                            </h3>
                                            <div className="flex items-center gap-4 mt-1">
                                                {project.owner && (
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
                                            <span className="px-3 py-1 bg-green-500/20 text-green-400 text-xs font-mono rounded-full border border-green-500/30">
                                                Completed
                                            </span>
                                        ) : (
                                            <span className="px-3 py-1 bg-blue-500/20 text-blue-400 text-xs font-mono rounded-full border border-blue-500/30">
                                                Active
                                            </span>
                                        )}
                                        <ChevronRight className="w-5 h-5 text-gray-500 group-hover:text-[#00ff87] group-hover:translate-x-1 transition-all" />
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
                        <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">
                            <Users className="w-6 h-6 text-[#00ff87]" />
                            Team Workload Distribution
                        </h2>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {workload.map((member, index) => (
                                <motion.div
                                    key={member.name}
                                    initial={{ opacity: 0, scale: 0.9 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    transition={{ delay: 0.6 + index * 0.05 }}
                                    className="bg-gradient-to-br from-gray-900/80 to-gray-800/50 border border-gray-700/50 rounded-xl p-5"
                                >
                                    <div className="flex items-center gap-3 mb-4">
                                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#00ff87] to-[#00d9ff] flex items-center justify-center text-black font-bold text-lg">
                                            {member.name.charAt(0)}
                                        </div>
                                        <div>
                                            <h3 className="font-semibold text-white">{member.name}</h3>
                                            <p className="text-sm text-gray-400">{member.totalTasks} tasks</p>
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <div className="flex justify-between text-sm">
                                            <span className="text-gray-400">Completed</span>
                                            <span className="text-green-400 font-mono">{member.completedTasks}</span>
                                        </div>
                                        <div className="w-full bg-gray-800 rounded-full h-2">
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
                                                    <span className="text-gray-400">Overdue</span>
                                                    <span className="text-red-400 font-mono">{member.overdueTasks}</span>
                                                </div>
                                                <div className="w-full bg-gray-800 rounded-full h-2">
                                                    <div
                                                        className="bg-gradient-to-r from-red-500 to-orange-400 h-2 rounded-full transition-all"
                                                        style={{
                                                            width: `${member.totalTasks > 0 ? (member.overdueTasks / member.totalTasks) * 100 : 0}%`
                                                        }}
                                                    ></div>
                                                </div>
                                            </>
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
                            className="bg-gradient-to-br from-gray-900 to-gray-800 border border-gray-700 rounded-2xl p-8 max-w-4xl w-full max-h-[90vh] overflow-y-auto"
                            onClick={(e) => e.stopPropagation()}
                        >
                            {/* Modal Header */}
                            <div className="flex items-start justify-between mb-6">
                                <div className="flex-1">
                                    <h2 className="text-3xl font-bold text-white mb-2">
                                        {selectedProject.name}
                                    </h2>
                                    {selectedProject.notes && (
                                        <p className="text-gray-400">{selectedProject.notes}</p>
                                    )}
                                </div>
                                <button
                                    onClick={() => {
                                        setSelectedProject(null);
                                        setProjectHealth(null);
                                    }}
                                    className="text-gray-400 hover:text-white transition-colors"
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

                                <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
                                    <p className="text-gray-400 text-sm mb-2">Total Tasks</p>
                                    <p className="text-2xl font-bold text-white">{projectHealth.health.total}</p>
                                </div>

                                <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
                                    <p className="text-gray-400 text-sm mb-2">Completed</p>
                                    <p className="text-2xl font-bold text-green-400">{projectHealth.health.completed}</p>
                                </div>

                                <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
                                    <p className="text-gray-400 text-sm mb-2">Overdue</p>
                                    <p className="text-2xl font-bold text-red-400">{projectHealth.health.overdue}</p>
                                </div>
                            </div>

                            {/* AI Analysis */}
                            {projectHealth.aiAnalysis && (
                                <div className="bg-gradient-to-br from-purple-500/10 to-transparent border border-purple-500/30 rounded-xl p-6 mb-8">
                                    <div className="flex items-center gap-2 mb-4">
                                        <Sparkles className="w-5 h-5 text-purple-400" />
                                        <h3 className="text-lg font-bold text-white">AI Insights</h3>
                                    </div>
                                    <div className="prose prose-invert max-w-none">
                                        <p className="text-gray-300 whitespace-pre-line">{projectHealth.aiAnalysis}</p>
                                    </div>
                                </div>
                            )}

                            {/* Recent Tasks */}
                            {projectHealth.tasks && projectHealth.tasks.length > 0 && (
                                <div>
                                    <h3 className="text-lg font-bold text-white mb-4">Recent Tasks</h3>
                                    <div className="space-y-2">
                                        {projectHealth.tasks.map((task, index) => (
                                            <motion.div
                                                key={task.gid}
                                                initial={{ opacity: 0, x: -20 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                transition={{ delay: index * 0.05 }}
                                                className="bg-gray-800/50 rounded-lg p-4 border border-gray-700/50"
                                            >
                                                <div className="flex items-start justify-between gap-4">
                                                    <div className="flex-1">
                                                        <h4 className={`font-medium mb-1 ${task.completed ? 'text-gray-500 line-through' : 'text-white'}`}>
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
                                                            <CheckCircle2 className="w-5 h-5 text-green-400" />
                                                        ) : (
                                                            <div className="w-5 h-5 rounded-full border-2 border-gray-600"></div>
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