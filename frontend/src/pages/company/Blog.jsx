import React, { useState } from 'react';
import { Calendar, Clock, ArrowRight, Tag, Search, TrendingUp } from 'lucide-react';

const Blog = () => {
    const [selectedCategory, setSelectedCategory] = useState('all');
    const [searchQuery, setSearchQuery] = useState('');

    const categories = [
        { id: 'all', label: 'All Posts', count: 24 },
        { id: 'product', label: 'Product Updates', count: 8 },
        { id: 'engineering', label: 'Engineering', count: 6 },
        { id: 'productivity', label: 'Productivity', count: 7 },
        { id: 'ai', label: 'AI & ML', count: 3 }
    ];

    const featuredPost = {
        title: "How AI is Transforming Team Collaboration in 2026",
        excerpt: "We analyzed data from 10,000+ teams to understand how AI-powered tools are changing the way modern teams work together.",
        author: "Sarah Chen",
        date: "Feb 10, 2026",
        readTime: "8 min read",
        image: "https://images.unsplash.com/photo-1552664730-d307ca884978?w=800&auto=format&fit=crop",
        category: "AI & ML",
        featured: true
    };

    const posts = [
        {
            id: 1,
            title: "5 Ways to Reduce Context Switching in Your Team",
            excerpt: "Context switching costs teams up to 40% of their productivity. Here's how to minimize it.",
            author: "Marcus Rodriguez",
            date: "Feb 8, 2026",
            readTime: "5 min read",
            category: "Productivity",
            image: "https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=400&auto=format&fit=crop"
        },
        {
            id: 2,
            title: "Building Better Slack Workflows: A Developer's Guide",
            excerpt: "Learn how to structure your Slack workspace for maximum team efficiency and clarity.",
            author: "David Park",
            date: "Feb 5, 2026",
            readTime: "6 min read",
            category: "Engineering",
            image: "https://images.unsplash.com/photo-1553877522-43269d4ea984?w=400&auto=format&fit=crop"
        },
        {
            id: 3,
            title: "Announcing: Real-time Blocker Detection",
            excerpt: "We're excited to launch our most requested feature—AI that spots blockers before they slow you down.",
            author: "Sarah Chen",
            date: "Feb 1, 2026",
            readTime: "4 min read",
            category: "Product Updates",
            image: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=400&auto=format&fit=crop"
        },
        {
            id: 4,
            title: "The Hidden Cost of Status Meetings",
            excerpt: "Our research shows teams spend 23% of their week in status meetings. Here's a better way.",
            author: "Emily Watson",
            date: "Jan 28, 2026",
            readTime: "7 min read",
            category: "Productivity",
            image: "https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?w=400&auto=format&fit=crop"
        },
        {
            id: 5,
            title: "How We Built Teama AI's Natural Language Engine",
            excerpt: "A deep dive into the ML architecture powering our AI summaries and insights.",
            author: "Marcus Rodriguez",
            date: "Jan 25, 2026",
            readTime: "10 min read",
            category: "Engineering",
            image: "https://images.unsplash.com/photo-1555949963-aa79dcee981c?w=400&auto=format&fit=crop"
        },
        {
            id: 6,
            title: "Asana + AI: Automatic Project Health Scoring",
            excerpt: "See how our AI analyzes your Asana projects to predict delays and surface risks early.",
            author: "Sarah Chen",
            date: "Jan 20, 2026",
            readTime: "5 min read",
            category: "Product Updates",
            image: "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=400&auto=format&fit=crop"
        }
    ];

    const filteredPosts = posts.filter(post => {
        const matchesCategory = selectedCategory === 'all' || post.category === categories.find(c => c.id === selectedCategory)?.label;
        const matchesSearch = post.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            post.excerpt.toLowerCase().includes(searchQuery.toLowerCase());
        return matchesCategory && matchesSearch;
    });

    return (
        <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
            {/* Hero Section */}
            <div className="bg-gradient-to-br from-purple-600 via-blue-600 to-purple-700 text-white">
                <div className="max-w-6xl mx-auto px-8 py-20">
                    <div className="max-w-3xl">
                        <div className="flex items-center gap-2 text-purple-200 mb-4">
                            <TrendingUp size={20} />
                            <span className="font-medium">Teama AI Blog</span>
                        </div>
                        <h1 className="text-5xl font-bold mb-6 leading-tight">
                            Insights on AI, productivity, and the future of work
                        </h1>
                        <p className="text-xl text-purple-100">
                            Learn how leading teams are using AI to work smarter, stay aligned, and ship faster
                        </p>
                    </div>
                </div>
            </div>

            {/* Search & Filter Section */}
            <div className="max-w-6xl mx-auto px-8 -mt-8">
                <div className="bg-white rounded-2xl shadow-xl p-6 border border-slate-100">
                    <div className="flex flex-col lg:flex-row gap-4 items-center">
                        {/* Search */}
                        <div className="flex-1 w-full">
                            <div className="relative">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                                <input
                                    type="text"
                                    placeholder="Search articles..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full pl-12 pr-4 py-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
                                />
                            </div>
                        </div>

                        {/* Category Filter */}
                        <div className="flex gap-2 overflow-x-auto pb-2 lg:pb-0 w-full lg:w-auto">
                            {categories.map(category => (
                                <button
                                    key={category.id}
                                    onClick={() => setSelectedCategory(category.id)}
                                    className={`px-4 py-2 rounded-lg font-medium whitespace-nowrap transition-all ${selectedCategory === category.id
                                            ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white shadow-lg'
                                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                        }`}
                                >
                                    {category.label} ({category.count})
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Featured Post */}
            <div className="max-w-6xl mx-auto px-8 py-16">
                <div className="bg-white rounded-3xl shadow-xl overflow-hidden border border-slate-100 hover:shadow-2xl transition-shadow cursor-pointer group">
                    <div className="grid lg:grid-cols-2 gap-0">
                        <div className="relative h-64 lg:h-auto overflow-hidden">
                            <img
                                src={featuredPost.image}
                                alt={featuredPost.title}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                            />
                            <div className="absolute top-4 left-4">
                                <span className="bg-gradient-to-r from-purple-600 to-blue-600 text-white px-4 py-2 rounded-full text-sm font-semibold shadow-lg">
                                    Featured
                                </span>
                            </div>
                        </div>
                        <div className="p-8 lg:p-12 flex flex-col justify-center">
                            <div className="flex items-center gap-2 text-purple-600 font-medium mb-4">
                                <Tag size={16} />
                                <span className="text-sm">{featuredPost.category}</span>
                            </div>
                            <h2 className="text-3xl font-bold text-slate-900 mb-4 group-hover:text-purple-600 transition-colors">
                                {featuredPost.title}
                            </h2>
                            <p className="text-slate-600 mb-6 leading-relaxed">
                                {featuredPost.excerpt}
                            </p>
                            <div className="flex items-center gap-6 text-sm text-slate-500 mb-6">
                                <div className="flex items-center gap-2">
                                    <Calendar size={16} />
                                    <span>{featuredPost.date}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Clock size={16} />
                                    <span>{featuredPost.readTime}</span>
                                </div>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="font-medium text-slate-700">{featuredPost.author}</span>
                                <button className="flex items-center gap-2 text-purple-600 font-semibold hover:gap-4 transition-all">
                                    Read More <ArrowRight size={20} />
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Blog Grid */}
            <div className="max-w-6xl mx-auto px-8 pb-24">
                <h2 className="text-2xl font-bold text-slate-900 mb-8">Recent Posts</h2>
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {filteredPosts.map(post => (
                        <article
                            key={post.id}
                            className="bg-white rounded-2xl shadow-sm overflow-hidden border border-slate-100 hover:shadow-xl transition-shadow cursor-pointer group"
                        >
                            <div className="relative h-48 overflow-hidden">
                                <img
                                    src={post.image}
                                    alt={post.title}
                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                />
                            </div>
                            <div className="p-6">
                                <div className="flex items-center gap-2 text-purple-600 text-sm font-medium mb-3">
                                    <Tag size={14} />
                                    <span>{post.category}</span>
                                </div>
                                <h3 className="text-xl font-bold text-slate-900 mb-3 group-hover:text-purple-600 transition-colors line-clamp-2">
                                    {post.title}
                                </h3>
                                <p className="text-slate-600 mb-4 line-clamp-2">
                                    {post.excerpt}
                                </p>
                                <div className="flex items-center gap-4 text-xs text-slate-500 mb-4 pb-4 border-b border-slate-100">
                                    <div className="flex items-center gap-1">
                                        <Calendar size={14} />
                                        <span>{post.date}</span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <Clock size={14} />
                                        <span>{post.readTime}</span>
                                    </div>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-sm font-medium text-slate-700">{post.author}</span>
                                    <button className="text-purple-600 hover:text-purple-700 transition-colors">
                                        <ArrowRight size={20} />
                                    </button>
                                </div>
                            </div>
                        </article>
                    ))}
                </div>

                {filteredPosts.length === 0 && (
                    <div className="text-center py-16">
                        <p className="text-slate-500 text-lg">No posts found matching your criteria.</p>
                    </div>
                )}

                {/* Load More */}
                {filteredPosts.length > 0 && (
                    <div className="text-center mt-12">
                        <button className="px-8 py-3 border-2 border-purple-600 text-purple-600 rounded-lg font-semibold hover:bg-purple-600 hover:text-white transition-colors">
                            Load More Posts
                        </button>
                    </div>
                )}
            </div>

            {/* Newsletter CTA */}
            <div className="bg-gradient-to-br from-purple-600 to-blue-600 text-white">
                <div className="max-w-4xl mx-auto px-8 py-16 text-center">
                    <h2 className="text-3xl font-bold mb-4">Stay in the loop</h2>
                    <p className="text-xl text-purple-100 mb-8">
                        Get the latest posts, product updates, and productivity tips delivered to your inbox
                    </p>
                    <form className="flex flex-col sm:flex-row gap-4 max-w-md mx-auto">
                        <input
                            type="email"
                            placeholder="your@email.com"
                            className="flex-1 px-4 py-3 rounded-lg text-slate-900 outline-none focus:ring-2 focus:ring-purple-300"
                        />
                        <button
                            type="submit"
                            className="bg-white text-purple-600 px-6 py-3 rounded-lg font-semibold hover:shadow-xl transition-shadow whitespace-nowrap"
                        >
                            Subscribe
                        </button>
                    </form>
                    <p className="text-sm text-purple-200 mt-4">
                        No spam. Unsubscribe anytime.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default Blog;