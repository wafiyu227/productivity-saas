import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
    GitBranch,
    Star,
    Search,
    ArrowLeft,
    ExternalLink,
    Loader
} from 'lucide-react';
import { Link } from 'react-router-dom';

const API_URL = import.meta.env.VITE_API_URL;

export default function Repositories() {
    const { user, profile } = useAuth();
    const [repos, setRepos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [error, setError] = useState(null);

    useEffect(() => {
        if (user) {
            fetchRepos();
        }
    }, [user, profile?.current_team_id]);

    const fetchRepos = async () => {
        setLoading(true);
        try {
            const teamId = profile?.current_team_id;
            const res = await fetch(`${API_URL}/api/github/repos?userId=${user.id}&teamId=${teamId}`);
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
            <div className="flex h-[calc(100vh-64px)] items-center justify-center">
                <Loader className="animate-spin text-blue-600" size={32} />
            </div>
        );
    }

    return (
        <div className="p-8 max-w-7xl mx-auto">
            <div className="mb-8">
                <Link to="/app/code" className="flex items-center text-gray-500 hover:text-gray-900 mb-4 transition">
                    <ArrowLeft size={18} className="mr-1" />
                    Back to Code Dashboard
                </Link>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900">Repositories</h1>
                        <p className="text-gray-600 mt-1">
                            {repos.length} repositories connected
                        </p>
                    </div>
                </div>
            </div>

            {/* Search */}
            <div className="mb-8 max-w-md">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                    <input
                        type="text"
                        placeholder="Search repositories..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                    />
                </div>
            </div>

            {error ? (
                <div className="bg-red-50 text-red-600 p-4 rounded-xl border border-red-100">
                    {error}
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredRepos.map(repo => (
                        <div key={repo.id} className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition group">
                            <div className="flex items-start justify-between mb-4">
                                <div className="p-3 bg-gray-50 rounded-xl group-hover:bg-blue-50 group-hover:text-blue-600 transition">
                                    <GitBranch size={24} />
                                </div>
                                <div className="flex items-center gap-1 text-gray-500">
                                    <Star size={16} className="text-orange-400" />
                                    <span className="text-sm font-medium">{repo.stargazers_count}</span>
                                </div>
                            </div>

                            <h3 className="text-lg font-bold text-gray-900 mb-1 truncate" title={repo.name}>
                                {repo.name}
                            </h3>
                            <p className="text-gray-500 text-sm mb-4 line-clamp-2 h-10">
                                {repo.description || 'No description available'}
                            </p>

                            <div className="flex items-center justify-between pt-4 border-t border-gray-50">
                                <span className="text-xs text-gray-400">
                                    Updated {new Date(repo.updated_at).toLocaleDateString()}
                                </span>
                                <a
                                    href={repo.html_url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="flex items-center text-sm font-medium text-gray-900 hover:text-blue-600 transition"
                                >
                                    View
                                    <ExternalLink size={16} className="ml-1" />
                                </a>
                            </div>
                        </div>
                    ))}

                    {filteredRepos.length === 0 && (
                        <div className="col-span-full text-center py-12 text-gray-500">
                            No repositories found matching your search.
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
