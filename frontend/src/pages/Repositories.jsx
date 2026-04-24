import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
    GitBranch,
    Star,
    Search,
    ArrowLeft,
    ExternalLink,
    Loader2,
    Github,
    ChevronRight,
    Zap,
    Clock,
    Shield
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

const API_URL = import.meta.env.VITE_API_URL;

export default function Repositories() {
    const { user, profile } = useAuth();
    const navigate = useNavigate();
    const [repos, setRepos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [error, setError] = useState(null);

    useEffect(() => {
        if (user) {
            fetchRepos();
        }
    }, [user]);

    const fetchRepos = async () => {
        setLoading(true);
        try {
            const res = await fetch(`${API_URL}/api/github/repos?userId=${user.id}&all=true`);
            if (!res.ok) throw new Error('Failed to fetch repositories');
            const data = await res.json();
            setRepos(data.repos || []);
        } catch (err) {
            console.error(err);
            setError('Failed to load repositories');
        } finally {
            setLoading(false);
        }
    };

    const filteredRepos = repos.filter(repo =>
        repo.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        repo.description?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (loading) {
        return (
            <div className="min-h-screen bg-black flex flex-col items-center justify-center gap-8 text-white">
                <div className="w-12 h-12 border-4 border-white/5 border-t-white rounded-full animate-spin"></div>
                <p className="text-[10px] font-bold uppercase tracking-widest">Loading...</p>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-black text-white selection:bg-blue-500/30">

            <div className="relative mx-auto max-w-7xl px-4 pb-20 pt-4 md:px-8 md:pt-8">
                {/* Header */}
                <div className="mb-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
                    <button
                        onClick={() => navigate('/app/code')}
                        className="group mb-8 inline-flex items-center gap-3 text-[10px] font-bold uppercase tracking-widest text-gray-700 hover:text-white transition-all"
                    >
                        <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
                        Back to Code
                    </button>
                    
                    <div className="flex flex-col md:flex-row items-start md:items-end justify-between gap-8">
                        <div>
                            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-[10px] font-bold uppercase tracking-widest text-white">
                                Code
                            </div>
                            <h1 className="text-4xl font-bold text-white uppercase tracking-tight md:text-6xl">Repositories</h1>
                            <p className="mt-4 text-sm leading-relaxed text-gray-700 font-bold uppercase tracking-widest max-w-2xl">
                                A list of all your integrated repositories.
                            </p>
                        </div>
                        <div className="flex flex-col items-end">
                             <div className="text-[10px] font-bold text-white uppercase tracking-widest bg-white/5 border border-white/10 px-4 py-2 rounded-xl">
                                {repos.length} Repositories
                             </div>
                        </div>
                    </div>
                </div>

                {/* Search */}
                <div className="max-w-xl mb-12 animate-in fade-in slide-in-from-bottom-6 duration-700 delay-100">
                    <div className="relative">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-800" size={18} />
                        <input
                            type="text"
                            placeholder="Search..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-12 pr-6 py-4 bg-white/[0.03] border border-white/5 rounded-2xl text-[10px] font-bold uppercase tracking-widest text-white outline-none focus:bg-white/[0.06] focus:border-white/10 transition-all placeholder:text-gray-800"
                        />
                    </div>
                </div>

                {error ? (
                    <div className="rounded-[2.5rem] border border-white/10 bg-black p-12 text-center shadow-2xl animate-in fade-in duration-700">
                        <Shield className="w-16 h-16 text-white mx-auto mb-6" />
                        <h3 className="text-2xl font-bold text-white uppercase tracking-tight mb-2">Error</h3>
                        <p className="text-gray-700 text-xs font-bold uppercase tracking-widest">{error}</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-200">
                        {filteredRepos.map(repo => (
                            <div key={repo.id} className="group relative bg-white/[0.01] rounded-[2.5rem] border border-white/5 p-8 transition-all hover:bg-white/[0.02] hover:border-white/10 hover:shadow-2xl overflow-hidden">
                                <div className="relative">
                                    <div className="flex items-start justify-between mb-8">
                                        <div className="p-4 bg-white/5 border border-white/10 rounded-2xl text-white">
                                            <GitBranch size={24} />
                                        </div>
                                        <div className="flex items-center gap-2 px-3 py-1 bg-white/5 border border-white/10 rounded-lg">
                                            <Star size={14} className="text-white" />
                                            <span className="text-[10px] font-bold text-white">{repo.stargazers_count}</span>
                                        </div>
                                    </div>

                                    <h3 className="text-2xl font-bold text-white uppercase tracking-tight mb-4 truncate" title={repo.name}>
                                        {repo.name}
                                    </h3>
                                    
                                    <p className="text-gray-700 text-xs font-bold leading-relaxed mb-10 line-clamp-2 h-10 uppercase tracking-widest">
                                        {repo.description || 'No description.'}
                                    </p>

                                    <div className="pt-8 border-t border-white/5 flex items-center justify-between">
                                        <div className="flex flex-col gap-1">
                                            <span className="text-[8px] font-bold text-gray-800 uppercase tracking-widest">Updated</span>
                                            <div className="flex items-center gap-2 text-white">
                                                <Clock size={12} />
                                                <span className="text-[10px] font-bold">
                                                    {new Date(repo.updated_at).toLocaleDateString().toUpperCase()}
                                                </span>
                                            </div>
                                        </div>
                                        
                                        <a
                                            href={repo.html_url}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="flex items-center gap-3 px-6 py-3 bg-white text-black text-[9px] font-bold uppercase tracking-widest rounded-xl hover:bg-gray-200 transition-all active:scale-95"
                                        >
                                            View
                                            <ExternalLink size={14} />
                                        </a>
                                    </div>
                                </div>
                            </div>
                        ))}

                        {filteredRepos.length === 0 && (
                            <div className="col-span-full rounded-[3rem] border border-white/10 bg-black p-24 text-center shadow-2xl">
                                <Search className="mx-auto text-white mb-8" size={64} />
                                <h3 className="text-2xl font-bold text-white uppercase tracking-tight mb-4">No repositories found.</h3>
                                <p className="text-gray-700 font-bold uppercase tracking-widest text-xs">No repositories match your search.</p>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
