import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Users, Target, Zap, Heart, Linkedin, Twitter, ArrowLeft, Brain, Sparkles, Terminal, ChevronRight, Globe, Github } from 'lucide-react';
import SEO from '../../components/common/SEO';

const About = () => {
    const navigate = useNavigate();
    
    const values = [
        {
            icon: <Users size={24} />,
            title: "Team Collaboration",
            description: "Work together across different channels and tools without losing context."
        },
        {
            icon: <Zap size={24} />,
            title: "Speed",
            description: "Identify what's holding you back in real-time to keep your team moving forward."
        },
        {
            icon: <Heart size={24} />,
            title: "Transparency",
            description: "Build a culture of shared success through clear communication and shared goals."
        },
        {
            icon: <Target size={24} />,
            title: "Clarity",
            description: "Cut through the noise and focus on what matters most for your team's success."
        }
    ];

    const founder = {
        name: "Ibrahim Wafiyudeen",
        role: "Founder",
        image: "/founder.jpeg",
        twitter: "https://x.com/wafiyudeen5448",
        linkedin: "https://www.linkedin.com/in/ibrahim-wafiyudeen-b07135344/",
        bio: "Building Teama AI to help teams work better together by simplifying their digital workspace."
    };

    return (
        <div className="min-h-screen bg-black text-white selection:bg-gray-800 font-sans">
            <SEO 
                title="About Teama AI" 
                description="Learn about our mission to help teams work better together."
            />
            
            {/* Header */}
            <header className="relative pt-24 pb-32 border-b border-white/5">
                <div className="max-w-7xl mx-auto px-8">
                    <button
                        onClick={() => navigate('/')}
                        className="group mb-12 inline-flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-white transition-all"
                    >
                        <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
                        Back to Home
                    </button>

                    <div className="max-w-4xl">
                        <h1 className="text-5xl md:text-7xl font-bold text-white mb-8 tracking-tight">
                            Helping teams <br /> <span className="text-gray-500">work better.</span>
                        </h1>
                        <p className="text-xl text-gray-400 max-w-2xl leading-relaxed">
                            Teama AI simplifies your workspace by summarizing chat messages and meeting notes into clear, actionable steps.
                        </p>
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-8 py-32 space-y-48">
                {/* Story Section */}
                <section className="grid lg:grid-cols-2 gap-24 items-center">
                    <div>
                        <div className="mb-10">
                            <h2 className="text-3xl font-bold text-white mb-4">Our Story</h2>
                            <div className="w-12 h-1 bg-white/10"></div>
                        </div>
                        <div className="space-y-8 text-lg text-gray-400 leading-relaxed">
                            <p>
                                Teama AI was built to solve a simple problem: digital workspaces are too noisy. Teams are drowning in messages and losing track of what matters.
                            </p>
                            <p>
                                We realized that AI could be used to summarize these messages and help teams stay aligned without having to read every single thread.
                            </p>
                            <p>
                                We're currently in early access, helping teams around the world focus on their work instead of their tools.
                            </p>
                        </div>
                    </div>
                    <div className="relative aspect-square rounded-3xl overflow-hidden border border-white/5">
                        <img
                            src="https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?auto=format&fit=crop&w=1200&q=80"
                            alt="Team working"
                            className="w-full h-full object-cover grayscale opacity-50"
                        />
                    </div>
                </section>

                {/* Values Section */}
                <section>
                    <div className="text-center mb-24">
                        <h2 className="text-3xl md:text-5xl font-bold mb-4">What we believe</h2>
                    </div>
                    <div className="grid md:grid-cols-2 gap-8">
                        {values.map((value, index) => (
                            <div key={index} className="bg-white/[0.02] border border-white/5 rounded-3xl p-12">
                                <div className="w-12 h-12 bg-white/5 border border-white/5 rounded-xl flex items-center justify-center text-gray-400 mb-8">
                                    {value.icon}
                                </div>
                                <h3 className="text-2xl font-bold text-white mb-4">{value.title}</h3>
                                <p className="text-lg text-gray-500 leading-relaxed">{value.description}</p>
                            </div>
                        ))}
                    </div>
                </section>

                {/* Founder Section */}
                <section className="max-w-2xl mx-auto text-center">
                    <div className="mb-24">
                        <h2 className="text-3xl md:text-5xl font-bold mb-4">The Founder</h2>
                    </div>
                    <div className="bg-white/[0.02] border border-white/5 rounded-3xl p-16">
                        <img
                            src={founder.image}
                            alt={founder.name}
                            className="w-32 h-32 rounded-2xl mx-auto mb-8 border border-white/10 grayscale"
                        />
                        <h3 className="text-2xl font-bold text-white mb-2">{founder.name}</h3>
                        <p className="text-gray-500 font-medium mb-8">{founder.role}</p>
                        <p className="text-lg text-gray-400 mb-12">{founder.bio}</p>
                        <div className="flex items-center justify-center gap-6">
                            <a href={founder.twitter} target="_blank" rel="noreferrer" className="text-gray-500 hover:text-white transition-colors">
                                <Twitter size={20} />
                            </a>
                            <a href={founder.linkedin} target="_blank" rel="noreferrer" className="text-gray-500 hover:text-white transition-colors">
                                <Linkedin size={20} />
                            </a>
                        </div>
                    </div>
                </section>

                {/* Final Call */}
                <section className="py-32 text-center border-t border-white/5">
                     <h2 className="text-4xl md:text-6xl font-bold mb-10">Ready to get started?</h2>
                     <div className="flex flex-col sm:flex-row gap-4 justify-center">
                        <Link to="/signup" className="px-10 py-4 bg-white text-black font-bold rounded-xl hover:bg-gray-200 transition-all">
                            Join the Waitlist
                        </Link>
                        <Link to="/contact" className="px-10 py-4 border border-white/10 text-white font-bold rounded-xl hover:bg-white/5 transition-all">
                            Contact Us
                        </Link>
                     </div>
                </section>
            </main>

            <footer className="py-20 border-t border-white/5">
                <div className="max-w-7xl mx-auto px-8 text-center text-[10px] uppercase tracking-widest text-gray-800">
                    &copy; 2026 Teama AI. All rights reserved.
                </div>
            </footer>
        </div>
    );
};

export default About;
