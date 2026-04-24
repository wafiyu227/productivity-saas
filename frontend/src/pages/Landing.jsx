import { Link } from 'react-router-dom';
import { useState } from 'react';
import {
    Zap, ArrowRight, CheckCircle2, Target,
    MessageSquare, BarChart3, Shield, Users, Menu, X, Clock, Search, Globe, Code2, TrendingUp, BarChart, Sparkles, Activity, Calendar
} from 'lucide-react';
import Button from '../components/Button';
import SEO from '../components/common/SEO';
import Footer from '../components/Footer';

export default function Landing() {
    const [mobileNavOpen, setMobileNavOpen] = useState(false);

    const handleSmoothScroll = (event, sectionId) => {
        event.preventDefault();
        setMobileNavOpen(false);
        const section = document.getElementById(sectionId);
        if (!section) return;
        section.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    return (
        <>
        <div className="min-h-screen bg-black text-white selection:bg-gray-800 font-sans">
            <SEO 
                title="Teama AI - Simpler Team Productivity" 
                description="Teama AI helps your team stay aligned by summarizing Slack messages and meetings automatically."
            />

            {/* Simple Navigation */}
            <nav className="fixed w-full z-50 bg-black/80 backdrop-blur-md border-b border-white/5">
                <div className="max-w-7xl mx-auto px-6 py-5 flex items-center justify-between">
                    <div className="flex items-center gap-2 cursor-pointer" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
                        <img src="/logo.png" alt="Logo" className="w-8 h-8" />
                        <span className="text-lg font-bold tracking-tight">Teama AI</span>
                    </div>
                    
                    <div className="hidden md:flex items-center gap-10">
                        <a href="#features" onClick={(e) => handleSmoothScroll(e, 'features')} className="text-[10px] font-bold text-gray-400 hover:text-white transition-all uppercase tracking-widest">Features</a>
                        <Link to="/login" className="text-[10px] font-bold text-gray-400 hover:text-white transition-all uppercase tracking-widest">Login</Link>
                        <Link to="/signup" className="bg-white text-black px-5 py-2 rounded-lg text-[10px] font-bold hover:bg-gray-200 transition-all uppercase tracking-widest">
                            Sign Up
                        </Link>
                    </div>

                    <button className="md:hidden text-gray-400" onClick={() => setMobileNavOpen(!mobileNavOpen)}>
                        {mobileNavOpen ? <X size={24} /> : <Menu size={24} />}
                    </button>
                </div>
            </nav>

            {/* Mobile Menu */}
            {mobileNavOpen && (
                <div className="fixed inset-0 z-40 bg-black pt-24 px-6 md:hidden">
                    <div className="flex flex-col gap-8 items-center justify-center h-full">
                        <a href="#features" onClick={(e) => handleSmoothScroll(e, 'features')} className="text-lg font-bold uppercase tracking-widest">Features</a>
                        <Link to="/login" className="text-lg font-bold uppercase tracking-widest">Login</Link>
                        <Link to="/signup" className="text-lg font-bold text-white uppercase tracking-widest">Sign Up</Link>
                    </div>
                </div>
            )}

            <main>
                {/* Hero Section */}
                <section className="pt-40 pb-32 px-6">
                    <div className="max-w-4xl mx-auto text-center">
                        <div className="inline-flex items-center gap-2 bg-white/5 border border-white/10 px-4 py-1.5 rounded-full text-gray-400 mb-8 text-[10px] font-bold uppercase tracking-widest">
                            Your AI Co-Worker
                        </div>
                        <h1 className="text-4xl md:text-6xl font-bold mb-8 leading-tight tracking-tight uppercase">
                            Surfaces what matters. Acts after you approve.
                        </h1>
                        <p className="text-sm md:text-base text-gray-400 mb-6 max-w-2xl mx-auto font-bold uppercase tracking-widest leading-relaxed">
                            Teama finds what needs to be done across all your connected tools. It surfaces blockers, meeting prep, AI insights, and actionable suggestions—so you spend more time doing instead of reading or searching.
                        </p>
                        <p className="text-xs text-gray-500 mb-12 max-w-2xl mx-auto font-bold uppercase tracking-widest leading-relaxed">
                            Slack channel summaries • Next meeting prep • Blockers from Jira & Asana • AI task insights • Smart suggestions
                        </p>
                        <div className="flex flex-col sm:flex-row gap-4 justify-center">
                            <Link to="/signup" className="bg-white text-black px-10 py-4 rounded-xl font-bold text-[10px] uppercase tracking-widest hover:bg-gray-200 transition-all text-center">
                                Get Started
                            </Link>
                            <Link to="/demo" className="bg-white/5 border border-white/10 text-white px-10 py-4 rounded-xl font-bold text-[10px] uppercase tracking-widest hover:bg-white/10 transition-all text-center">
                                See Demo
                            </Link>
                        </div>
                    </div>
                </section>

                {/* Features Section */}
                <section id="features" className="py-32 px-6 border-t border-white/5 bg-black">
                    <div className="max-w-6xl mx-auto">
                        <div className="text-center mb-20">
                            <h2 className="text-3xl md:text-5xl font-bold mb-6 uppercase tracking-tight">What Teama Does</h2>
                            <p className="text-gray-400 text-[10px] font-bold uppercase tracking-widest">Makes your work simpler by surfacing what matters from your connected tools.</p>
                        </div>
                        
                        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
                            <SimpleCard 
                                icon={<MessageSquare size={24} />}
                                title="Slack Summaries"
                                desc="Daily summaries of important channel discussions so you stay informed without reading every message."
                            />
                            <SimpleCard 
                                icon={<Calendar size={24} />}
                                title="Meeting Prep"
                                desc="Automatic standup prep and next meeting preview with context from your calendar and tools."
                            />
                            <SimpleCard 
                                icon={<Target size={24} />}
                                title="Blocked Tasks"
                                desc="Identify blockers from Jira and Asana instantly. See what's stuck and who needs help."
                            />
                            <SimpleCard 
                                icon={<Sparkles size={24} />}
                                title="AI Insights"
                                desc="Smart analysis of tasks, projects, and team velocity. Actionable insights on what matters most."
                            />
                            <SimpleCard 
                                icon={<Zap size={24} />}
                                title="Smart Suggestions"
                                desc="AI suggests what should be done next based on priorities, deadlines, and blocker patterns."
                            />
                            <SimpleCard 
                                icon={<CheckCircle2 size={24} />}
                                title="Approval & Action"
                                desc="Review suggestions and approve actions. Teama executes on your behalf across all tools."
                            />
                        </div>
                    </div>
                </section>

                {/* Security Section */}
                <section className="py-32 px-6 border-t border-white/5">
                    <div className="max-w-4xl mx-auto text-center">
                        <Shield size={48} className="mx-auto mb-8 text-white" />
                        <h2 className="text-3xl md:text-5xl font-bold mb-8 uppercase tracking-tight">Secure and Private</h2>
                        <p className="text-sm text-gray-400 font-bold uppercase tracking-widest mb-12">
                            Your data is never shared or used for training. Everything is processed securely and kept private to your team.
                        </p>
                        <div className="flex flex-wrap justify-center gap-8 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                            <span>SOC 2 Ready</span>
                            <span>GDPR Compliant</span>
                            <span>AES-256 Encryption</span>
                        </div>
                    </div>
                </section>

                {/* Final CTA */}
                <section className="py-40 px-6 bg-white/[0.01] border-t border-white/5">
                    <div className="max-w-3xl mx-auto text-center">
                        <h2 className="text-4xl md:text-6xl font-bold mb-10 tracking-tight uppercase">Start doing more, reading less</h2>
                        <Link to="/signup" className="inline-block bg-white text-black px-12 py-5 rounded-2xl font-bold text-[10px] uppercase tracking-widest hover:bg-gray-200 transition-all">
                            Get Started
                        </Link>
                        <p className="mt-8 text-gray-400 text-[9px] font-bold uppercase tracking-widest">No credit card required. Cancel anytime.</p>
                    </div>
                </section>
            </main>

        </div>

        <Footer />
        </>
    );
}

function SimpleCard({ icon, title, desc }) {
    return (
        <div className="p-10 rounded-3xl bg-white/[0.01] border border-white/5 hover:border-white/10 transition-all group cursor-pointer">
            <div className="w-12 h-12 bg-white/5 rounded-xl flex items-center justify-center mb-8 text-white group-hover:bg-white/10 transition-all">
                {icon}
            </div>
            <h3 className="text-base font-bold mb-4 uppercase tracking-widest text-white">{title}</h3>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest leading-relaxed">{desc}</p>
        </div>
    );
}
