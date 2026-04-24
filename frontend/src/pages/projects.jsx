import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    TrendingUp,
    AlertCircle,
    CheckCircle2,
    Clock,
    Users,
    Sparkles,
    Calendar,
    Target,
    Activity,
    RefreshCw,
    AlertTriangle,
    Bell,
    Filter,
    ChevronDown,
    ChevronUp,
    LayoutGrid,
    List,
    ArrowLeft,
    Zap,
    ChevronRight,
    ShieldAlert,
    BarChart3
} from 'lucide-react';
import { api } from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

const PROJECT_PLATFORM_PRIORITY = ['jira', 'asana'];
const PROJECT_PLATFORM_LABELS = {
    jira: 'Jira',
    asana: 'Asana'
};
const PROJECT_PLATFORM_EXTRACTORS = {
    jira: {
        fetchProjects: (apiClient) => apiClient.getJiraProjects(),
        fetchWorkload: (apiClient) => apiClient.getJiraWorkload(),
        fetchDeadlines: (apiClient) => apiClient.getJiraDeadlines(),
        fetchProjectHealth: (apiClient, projectId) => apiClient.getJiraProjectHealth(projectId)
    },
    asana: {
        fetchProjects: (apiClient) => apiClient.getAsanaProjects(),
        fetchWorkload: (apiClient) => apiClient.getAsanaWorkload(),
        fetchDeadlines: (apiClient) => apiClient.getAsanaDeadlines(),
        fetchProjectHealth: (apiClient, projectId) => apiClient.getAsanaProjectHealth(projectId)
    }
};

const Projects = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
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
    const [activeProjectPlatform, setActiveProjectPlatform] = useState(null);
    const [connectedProjectPlatforms, setConnectedProjectPlatforms] = useState([]);
    const [showDeadlines, setShowDeadlines] = useState(true);
    const [taskFilter, setTaskFilter] = useState('all');
    const [loadingProjectInsightsId, setLoadingProjectInsightsId] = useState(null);

    useEffect(() => {
        if (user) {
            fetchAllData();
        }
    }, [user]);

    const getPlatformLabel = (platform) => PROJECT_PLATFORM_LABELS[platform] || platform;

    const fetchProjectPlatformStatus = async () => {
        const statuses = await Promise.all(
            PROJECT_PLATFORM_PRIORITY.map(async (platform) => {
                const status = await api.getIntegrationStatus(platform);
                return {
                    platform,
                    connected: !!status?.connected
                };
            })
        );

        const connected = statuses
            .filter((status) => status.connected)
            .map((status) => status.platform);

        setConnectedProjectPlatforms(connected);
        return connected;
    };

    const resetProjectData = () => {
        setProjects([]);
        setSelectedProject(null);
        setProjectHealth(null);
        setWorkload([]);
        setWorkloadSummary(null);
        setDeadlines(null);
    };

    const fetchAllData = async () => {
        setLoading(true);
        try {
            const connectedPlatforms = await fetchProjectPlatformStatus();

            if (connectedPlatforms.length === 0) {
                setActiveProjectPlatform(null);
                resetProjectData();
                setError(null);
                return;
            }

            // Using 'mixed' as active platform to show we support both
            setActiveProjectPlatform('mixed');

            let mergedProjects = [];
            let mergedWorkload = [];
            let mergedDeadlines = { overdue: { count: 0, tasks: [] }, dueToday: { count: 0, tasks: [] }, dueTomorrow: { count: 0, tasks: [] }, dueThisWeek: { count: 0, tasks: [] }, totalAtRisk: 0 };

            await Promise.all(connectedPlatforms.map(async (platform) => {
                const extractor = PROJECT_PLATFORM_EXTRACTORS[platform];
                if (!extractor) return;

                const [pData, wData, dData] = await Promise.all([
                    extractor.fetchProjects(api).catch(() => ({ projects: [] })),
                    extractor.fetchWorkload(api).catch(() => ({ workload: [], summary: null })),
                    extractor.fetchDeadlines(api).catch(() => (null))
                ]);

                // Tag projects
                const platformProjects = (pData.projects || []).map(p => ({ ...p, _platform: platform }));
                mergedProjects = [...mergedProjects, ...platformProjects];

                // Merge Workload
                const platformWorkload = wData.workload || [];
                platformWorkload.forEach(member => {
                    const existing = mergedWorkload.find(m => m.name === member.name);
                    if (existing) {
                        existing.totalTasks += member.totalTasks;
                        existing.isOverloaded = existing.isOverloaded || member.isOverloaded;
                    } else {
                        mergedWorkload.push({ ...member });
                    }
                });

                // Merge Deadlines
                if (dData) {
                    const tagTasks = (tasks) => (tasks || []).map(t => ({ ...t, _platform: platform }));
                    
                    mergedDeadlines.overdue.tasks = [...mergedDeadlines.overdue.tasks, ...tagTasks(dData.overdue?.tasks)];
                    mergedDeadlines.overdue.count += dData.overdue?.count || 0;
                    
                    mergedDeadlines.dueToday.tasks = [...mergedDeadlines.dueToday.tasks, ...tagTasks(dData.dueToday?.tasks)];
                    mergedDeadlines.dueToday.count += dData.dueToday?.count || 0;

                    mergedDeadlines.dueTomorrow.tasks = [...mergedDeadlines.dueTomorrow.tasks, ...tagTasks(dData.dueTomorrow?.tasks)];
                    mergedDeadlines.dueTomorrow.count += dData.dueTomorrow?.count || 0;

                    mergedDeadlines.dueThisWeek.tasks = [...mergedDeadlines.dueThisWeek.tasks, ...tagTasks(dData.dueThisWeek?.tasks)];
                    mergedDeadlines.dueThisWeek.count += dData.dueThisWeek?.count || 0;

                    mergedDeadlines.totalAtRisk += dData.totalAtRisk || 0;
                }
            }));

            // Calc summarized workload
            const totalTasksAllMembers = mergedWorkload.reduce((sum, m) => sum + m.totalTasks, 0);
            const overallSummary = mergedWorkload.length > 0 ? {
                avgTasksPerMember: Math.round(totalTasksAllMembers / mergedWorkload.length),
                overloadedMembers: mergedWorkload.filter(m => m.isOverloaded).length
            } : null;

            // Sort deadline tasks
            const sortByDue = (a, b) => new Date(a.due_on || a.due_date || 0) - new Date(b.due_on || b.due_date || 0);
            mergedDeadlines.overdue.tasks.sort(sortByDue);
            mergedDeadlines.dueToday.tasks.sort(sortByDue);
            mergedDeadlines.dueTomorrow.tasks.sort(sortByDue);
            mergedDeadlines.dueThisWeek.tasks.sort(sortByDue);

            setProjects(mergedProjects);
            setWorkload(mergedWorkload);
            setWorkloadSummary(overallSummary);
            setDeadlines(mergedDeadlines);

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



    const fetchProjectHealth = async (projectOrId) => {
        const platformHint = typeof projectOrId === 'object' ? projectOrId?._platform : null;
        let platformToUse = platformHint;
        
        // If no hint, and projects are loaded, we can find the project
        if (!platformToUse) {
            const idStr = typeof projectOrId === 'object' ? String(projectOrId?.gid || projectOrId?.id) : String(projectOrId);
            const loadedPrj = projects.find(p => String(p.gid || p.id) === idStr);
            platformToUse = loadedPrj?._platform || activeProjectPlatform;
        }

        const extractor = PROJECT_PLATFORM_EXTRACTORS[platformToUse];
        if (!extractor) return;
        
        const projectId = typeof projectOrId === 'object'
            ? (projectOrId?.gid || projectOrId?.id)
            : projectOrId;
        if (!projectId) return;
        const normalizedProjectId = String(projectId);

        try {
            setLoadingProjectInsightsId(normalizedProjectId);
            const data = await extractor.fetchProjectHealth(api, projectId);
            setProjectHealth(data);
            if (typeof projectOrId === 'object' && projectOrId) {
                setSelectedProject(projectOrId);
            } else {
                setSelectedProject(
                    projects.find((project) => String(project.gid || project.id) === normalizedProjectId) || null
                );
            }
        } catch (err) {
            console.error('Health cycle failure:', err);
            alert('Calibration Error: ' + err.message);
        } finally {
            setLoadingProjectInsightsId(null);
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
            case 'healthy': return <CheckCircle2 size={16} />;
            case 'at-risk': return <AlertTriangle size={16} />;
            case 'critical': return <ShieldAlert size={16} />;
            default: return <Activity size={16} />;
        }
    };

    const formatDueDate = (dateStr) => {
        const date = new Date(dateStr);
        const now = new Date();
        const diffDays = Math.ceil((date - now) / (1000 * 60 * 60 * 24));

        if (diffDays < 0) return `${Math.abs(diffDays)}D_OVERDUE`;
        if (diffDays === 0) return 'DUE_TODAY';
        if (diffDays === 1) return 'DUE_TOMORROW';
        return `IN_${diffDays}D`;
    };

    const getDaysOverdue = (dateStr) => {
        const date = new Date(dateStr);
        const now = new Date();
        return Math.ceil((now - date) / (1000 * 60 * 60 * 24));
    };

    const getNormalizedInsights = (details) => {
        const rawInsights = details?.aiInsights ?? details?.aiAnalysis;
        if (!rawInsights) return null;

        if (typeof rawInsights === 'string') {
            return {
                summary: rawInsights,
                blockers: [],
                overdueHighlight: [],
                recommendations: [],
                evidence: null
            };
        }

        if (typeof rawInsights !== 'object') return null;

        return {
            summary: typeof rawInsights.summary === 'string'
                ? rawInsights.summary
                : (typeof details?.aiAnalysis === 'string' ? details.aiAnalysis : ''),
            blockers: Array.isArray(rawInsights.blockers) ? rawInsights.blockers : [],
            overdueHighlight: Array.isArray(rawInsights.overdueHighlight) ? rawInsights.overdueHighlight : [],
            recommendations: Array.isArray(rawInsights.recommendations) ? rawInsights.recommendations : [],
            evidence: rawInsights.evidence && typeof rawInsights.evidence === 'object'
                ? rawInsights.evidence
                : null
        };
    };

    const projectInsights = getNormalizedInsights(projectHealth);

    if (loading) {
        return (
            <div className="min-h-screen bg-black flex flex-col items-center justify-center gap-8">
                <div className="w-10 h-10 border-4 border-white/5 border-t-white rounded-full animate-spin"></div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Loading projects...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen bg-black flex items-center justify-center p-4">
                <div className="bg-black border border-white/10 rounded-3xl p-12 max-w-lg text-center shadow-2xl">
                    <h2 className="text-3xl font-bold text-white uppercase tracking-tight mb-4">Error</h2>
                    <p className="text-gray-400 font-bold uppercase tracking-widest text-xs mb-10 leading-relaxed">{error}</p>
                    <button
                        onClick={fetchAllData}
                        className="w-full py-4 bg-white text-black text-[10px] font-bold uppercase tracking-widest rounded-2xl hover:bg-gray-200 transition-all active:scale-95"
                    >
                        Retry
                    </button>
                </div>
            </div>
        );
    }

    if (!activeProjectPlatform) {
        return (
            <div className="min-h-screen bg-black flex items-center justify-center p-4">
                <div className="bg-black border border-white/10 rounded-3xl p-16 max-w-3xl w-full text-center">
                    <h2 className="text-4xl font-bold text-white uppercase tracking-tight mb-4">Connect a project tool</h2>
                    <p className="text-gray-400 font-bold uppercase tracking-widest text-xs mb-12 max-w-md mx-auto leading-relaxed">
                        To view your projects, you need to connect Jira or Asana in your settings.
                    </p>

                    <button
                        onClick={() => navigate('/app/integrations')}
                        className="px-12 py-5 bg-white text-black text-[10px] font-bold uppercase tracking-widest rounded-2xl hover:bg-gray-200 transition-all active:scale-95"
                    >
                        Go to Settings
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-black text-white selection:bg-blue-500/30">
            {/* Background elements */}

            {/* Header */}
            <header className="relative border-b border-white/5 bg-black/50 backdrop-blur-2xl sticky top-0 z-40">
                <div className="max-w-7xl mx-auto px-4 md:px-8 py-8">
                    <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-8">
                        <div>
                            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-[10px] font-bold uppercase tracking-widest text-gray-400">
                                Team
                            </div>
                            <h1 className="text-4xl font-bold text-white uppercase tracking-tight md:text-5xl lg:text-6xl">Projects</h1>
                            <div className="mt-4 flex flex-wrap items-center gap-6">
                                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                                    MIXED POOL • {projects.length} ACTIVE
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center gap-2 bg-[#09090b] p-2 rounded-[1.5rem] border border-white/5 shadow-2xl">
                             <button
                                onClick={handleRefresh}
                                disabled={refreshing}
                                className="p-3 bg-white/[0.03] border border-white/5 hover:bg-white/[0.06] rounded-xl transition-all disabled:opacity-50 text-gray-400 hover:text-white"
                                title="Execute Refresh"
                            >
                                <RefreshCw size={18} className={refreshing ? 'animate-spin' : ''} />
                            </button>
                            <div className="w-[1px] h-8 bg-white/5 mx-1"></div>
                            <button
                                onClick={() => setActiveView('grid')}
                                className={`px-5 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeView === 'grid'
                                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20'
                                    : 'text-gray-600 hover:text-white hover:bg-white/5'
                                    }`}
                            >
                                <LayoutGrid size={18} />
                            </button>
                            <button
                                onClick={() => setActiveView('list')}
                                className={`px-5 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeView === 'list'
                                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20'
                                    : 'text-gray-600 hover:text-white hover:bg-white/5'
                                    }`}
                            >
                                <List size={18} />
                            </button>
                        </div>
                    </div>
                </div>
            </header>

            <main className="relative max-w-7xl mx-auto px-4 md:px-8 py-12">
                {/* Metric Summary Area */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-16 animate-in fade-in duration-700">
                    <MetricStat 
                        label="Projects" 
                        value={projects.length} 
                        icon={<Target className="text-white" size={24} />} 
                    />
                    <MetricStat 
                        label="Members" 
                        value={workload.length} 
                        icon={<Users className="text-white" size={24} />} 
                    />
                    <MetricStat 
                        label="Alerts" 
                        value={deadlines?.totalAtRisk || 0} 
                        icon={<AlertTriangle className="text-white" size={24} />} 
                    />
                    <MetricStat 
                        label="Due Soon" 
                        value={(deadlines?.dueToday?.count || 0) + (deadlines?.dueThisWeek?.count || 0)} 
                        icon={<Calendar className="text-white" size={24} />} 
                    />
                </div>

                {/* Critical Intervention Section */}
                {deadlines && (deadlines.overdue?.count > 0 || deadlines.dueToday?.count > 0) && (
                    <div className="mb-16 animate-in fade-in">
                        <button
                            onClick={() => setShowDeadlines(!showDeadlines)}
                            className="w-full flex items-center justify-between p-8 bg-white/[0.02] border border-white/10 rounded-3xl hover:bg-white/[0.04] transition-all"
                        >
                            <div className="flex flex-wrap items-center gap-6">
                                <div className="text-left">
                                    <h3 className="text-2xl font-bold text-white uppercase tracking-tight">Issues</h3>
                                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-1">These items need attention.</p>
                                </div>
                                <div className="flex gap-2">
                                    <span className="px-4 py-2 bg-white/5 border border-white/10 text-white text-[10px] font-bold uppercase tracking-widest rounded-xl">
                                        {deadlines.overdue?.count || 0} Overdue
                                    </span>
                                    {deadlines.dueToday?.count > 0 && (
                                        <span className="px-4 py-2 bg-white/5 border border-white/10 text-white text-[10px] font-bold uppercase tracking-widest rounded-xl">
                                            {deadlines.dueToday.count} Due Today
                                        </span>
                                    )}
                                </div>
                            </div>
                            <div className={`p-2 rounded-full transition-transform duration-500 ${showDeadlines ? '' : 'rotate-180'}`}>
                                <ChevronUp size={24} className="text-gray-400" />
                            </div>
                        </button>

                        <AnimatePresence>
                            {showDeadlines && (
                                <motion.div
                                    initial={{ opacity: 0, height: 0, marginTop: 0 }}
                                    animate={{ opacity: 1, height: 'auto', marginTop: 24 }}
                                    exit={{ opacity: 0, height: 0, marginTop: 0 }}
                                    className="overflow-hidden space-y-4"
                                >
                                    {/* Overdue Matrix */}
                                    {deadlines.overdue?.tasks?.length > 0 && (
                                        <div className="bg-rose-500/[0.02] border border-rose-500/10 rounded-[2rem] p-8">
                                            <h3 className="text-rose-500 text-[11px] font-black uppercase tracking-[0.3em] mb-6 flex items-center gap-3">
                                                <div className="w-1.5 h-1.5 bg-rose-500 rounded-full animate-pulse"></div>
                                                IDENTIFIED OVERDUE COMPONENTS
                                            </h3>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                {deadlines.overdue.tasks.map((task) => (
                                                    <InterventionCard key={task.gid} task={task} type="overdue" func={getDaysOverdue} />
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Today Matrix */}
                                    {deadlines.dueToday?.tasks?.length > 0 && (
                                        <div className="bg-amber-500/[0.02] border border-amber-500/10 rounded-[2rem] p-8">
                                            <h3 className="text-amber-500 text-[11px] font-black uppercase tracking-[0.3em] mb-6 flex items-center gap-3">
                                                <div className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-pulse"></div>
                                                IMMEDIATE PRIORITY UNITS
                                            </h3>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                {deadlines.dueToday.tasks.map((task) => (
                                                    <InterventionCard key={task.gid} task={task} type="today" />
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                )}

                {/* Projects Registry */}
                <div className="mb-20 animate-in fade-in duration-700 delay-200">
                    <div className="flex items-center gap-4 mb-10">
                        <div>
                            <h2 className="text-2xl font-bold text-white uppercase tracking-tight">Projects</h2>
                        </div>
                    </div>

                    {activeView === 'grid' ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                             {projects.map((project, index) => (
                                <ProjectGridCard 
                                    key={project.gid || project.id} 
                                    project={project} 
                                    index={index} 
                                    onSelect={fetchProjectHealth}
                                    loadingId={loadingProjectInsightsId}
                                />
                             ))}
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {projects.map((project, index) => (
                                <ProjectListRow 
                                    key={project.gid || project.id} 
                                    project={project} 
                                    index={index}
                                    onSelect={fetchProjectHealth}
                                    loadingId={loadingProjectInsightsId}
                                />
                            ))}
                        </div>
                    )}
                </div>

                {/* Distribution Matrix */}
                {workload.length > 0 && (
                    <div className="animate-in fade-in duration-700 delay-300">
                        <div className="flex flex-col lg:flex-row items-start lg:items-end justify-between gap-8 mb-10">
                            <div className="flex items-center gap-6">
                                <div className="text-left">
                                    <h3 className="text-3xl font-bold text-white uppercase tracking-tight">Team Load</h3>
                                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-1">How tasks are spread across the team.</p>
                                </div>
                            </div>
                            {workloadSummary && (
                                <div className="flex items-center gap-8 bg-white/[0.01] px-10 py-6 rounded-3xl border border-white/5">
                                    <div className="text-center">
                                        <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest block mb-2">Throughput</span>
                                        <span className="text-3xl font-bold text-white">{workloadSummary.avgTasksPerMember}</span>
                                    </div>
                                    <div className="w-[1px] h-12 bg-white/5"></div>
                                    <div className="text-center">
                                        <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest block mb-2">Busy Nodes</span>
                                        <span className="text-3xl font-bold text-white">
                                            {workloadSummary.overloadedMembers}
                                        </span>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {workload.map((member, index) => (
                                <WorkloadCard key={member.name} member={member} index={index} />
                            ))}
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
};

/* Sub-components for cleaner structure */

const MetricStat = ({ label, value, icon }) => {
    return (
        <div className="bg-white/[0.02] rounded-2xl border border-white/5 p-8 transition-all hover:bg-white/[0.03]">
            <div className="flex items-center justify-between mb-6">
                <div className="p-4 rounded-xl border border-white/10 bg-white/5">
                    {icon}
                </div>
            </div>
            <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-1">{label}</p>
            <p className="text-4xl font-bold text-white tracking-tight">{value}</p>
        </div>
    );
};

const InterventionCard = ({ task, type, func }) => (
    <div className="flex items-center justify-between p-6 bg-black rounded-2xl border border-white/10 hover:bg-white/5 transition-all">
        <div className="flex items-center gap-4">
            <div className={`w-1.5 h-1.5 rounded-full ${type === 'overdue' ? 'bg-white' : 'bg-gray-600'}`}></div>
            <div>
                <p className="text-white text-sm font-bold uppercase tracking-tight flex items-center gap-2">
                    {task.name}
                    {task._platform && (
                        <span className="text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-white/10 text-white border border-white/20">
                            {PROJECT_PLATFORM_LABELS[task._platform]}
                        </span>
                    )}
                </p>
                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-1 italic">
                    {task.project?.name} • {task.assignee?.name || 'Unassigned'}
                </p>
            </div>
        </div>
        <span className="text-[10px] font-bold text-white">
            {type === 'overdue' ? (func ? func(task.due_on) + 'D' : 'Overdue') : 'Due today'}
        </span>
    </div>
);

const ProjectGridCard = ({ project, index, onSelect, loadingId }) => {
    const isNodeLoading = loadingId === String(project.gid || project.id);
    
    return (
        <div className="bg-white/[0.02] border border-white/5 rounded-3xl p-8 transition-all hover:bg-white/[0.04]">
            <div className="relative">
                <div className="flex items-center justify-between mb-8">
                     <div className="px-4 py-1.5 rounded-lg border border-white/10 bg-white/5 text-[9px] font-bold uppercase tracking-widest text-white">
                        {project.completed ? 'Finalized' : 'Active'}
                     </div>
                </div>

                <h3 className="text-2xl font-bold text-white uppercase tracking-tight mb-4 line-clamp-2">
                    {project.name}
                    {project._platform && (
                        <span className="ml-3 inline-block align-middle text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full bg-white/10 text-white border border-white/20">
                            {PROJECT_PLATFORM_LABELS[project._platform]}
                        </span>
                    )}
                </h3>

                {project.notes && (
                    <p className="text-gray-400 text-xs font-bold leading-relaxed mb-8 line-clamp-2 uppercase tracking-wide">
                        {project.notes}
                    </p>
                )}

                <div className="flex flex-col gap-8">
                    <div className="flex items-center gap-12">
                         {project.owner?.name && (
                            <div className="flex flex-col gap-1">
                                <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Owner</span>
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-lg bg-white/5 text-white flex items-center justify-center font-bold text-xs border border-white/10">
                                        {project.owner.name.charAt(0)}
                                    </div>
                                    <span className="text-[11px] font-bold text-gray-400">{project.owner.name.toUpperCase()}</span>
                                </div>
                            </div>
                        )}
                        {project.due_date && (
                             <div className="flex flex-col gap-1">
                                <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Deadline</span>
                                <div className="flex items-center gap-3 text-gray-400">
                                    <Calendar size={14} />
                                    <span className="text-[11px] font-bold">{new Date(project.due_date).toLocaleDateString()}</span>
                                </div>
                            </div>
                        )}
                    </div>

                    <button
                        onClick={() => onSelect(project)}
                        disabled={isNodeLoading}
                        className="w-full flex items-center justify-center gap-3 py-4 bg-white text-black text-[10px] font-bold uppercase tracking-widest rounded-2xl hover:bg-gray-200 transition-all active:scale-95 disabled:opacity-50"
                    >
                        {isNodeLoading ? (
                            <RefreshCw size={16} className="animate-spin" />
                        ) : (
                            'Get Summary'
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

const ProjectListRow = ({ project, index, onSelect, loadingId }) => {
    const isNodeLoading = loadingId === String(project.gid || project.id);

    return (
        <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-6 hover:bg-white/[0.04] transition-all">
            <div className="flex flex-col lg:flex-row items-center justify-between gap-6">
                <div className="flex items-center gap-6 flex-1 min-w-0">
                    {project.owner?.name && (
                        <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-white font-bold text-xl shrink-0">
                            {project.owner.name.charAt(0)}
                        </div>
                    )}
                    <div className="flex-1 min-w-0">
                        <h3 className="text-xl font-bold text-white uppercase tracking-tight truncate">
                            {project.name}
                            {project._platform && (
                                <span className="ml-3 inline-block align-middle text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full bg-white/10 text-white border border-white/20">
                                    {PROJECT_PLATFORM_LABELS[project._platform]}
                                </span>
                            )}
                        </h3>
                        <div className="flex items-center gap-8 mt-2">
                            {project.owner?.name && (
                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">By {project.owner.name.toUpperCase()}</span>
                            )}
                            {project.due_date && (
                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                                    <Clock size={14} />
                                    {new Date(project.due_date).toLocaleDateString()}
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-6 w-full lg:w-auto">
                    <button
                        onClick={() => onSelect(project)}
                        disabled={isNodeLoading}
                        className="flex-1 lg:flex-none inline-flex items-center justify-center gap-3 px-8 py-4 bg-white text-black text-[10px] font-bold uppercase tracking-widest rounded-2xl hover:bg-gray-200 transition-all active:scale-95 disabled:opacity-50"
                    >
                        {isNodeLoading ? <RefreshCw className="w-16 animate-spin" /> : 'Get Summary'}
                    </button>
                    <div className="px-6 py-4 rounded-2xl text-[10px] font-bold uppercase tracking-widest border border-white/10 bg-white/5 text-white">
                        {project.completed ? 'Finalized' : 'Active'}
                    </div>
                </div>
            </div>
        </div>
    );
};

const WorkloadCard = ({ member, index }) => (
    <div className={`bg-white/[0.01] border ${member.isOverloaded ? 'border-white/20' : 'border-white/5'} rounded-3xl p-8 transition-all hover:bg-white/[0.02]`}>
        <div className="flex items-center gap-6 mb-10">
            <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-white font-bold text-2xl">
                {member.name.charAt(0)}
            </div>
            <div>
                <h3 className="text-xl font-bold text-white uppercase tracking-tight flex items-center gap-3">
                    {member.name}
                    {member.isOverloaded && (
                        <AlertTriangle className="text-white" size={20} />
                    )}
                </h3>
                <p className="text-[10px] font-bold uppercase tracking-widest mt-1 text-gray-400">
                    Tasks: {member.totalTasks}
                </p>
            </div>
        </div>

        <div className="space-y-6">
            <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-widest">
                <span className="text-gray-800">Status</span>
                <span className="text-white">
                    {member.isOverloaded ? 'Busy' : 'Available'}
                </span>
            </div>
            <div className="h-2 w-full bg-white/[0.03] rounded-full overflow-hidden border border-white/5">
                <div 
                    className="h-full bg-white rounded-full transition-all duration-1000"
                    style={{ width: `${Math.min((member.totalTasks / 15) * 100, 100)}%`, opacity: member.isOverloaded ? 1 : 0.4 }}
                ></div>
            </div>
        </div>
    </div>
);

export default Projects;
