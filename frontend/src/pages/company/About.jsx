import React from 'react';
import { Users, Target, Zap, Heart, Linkedin, Twitter } from 'lucide-react';

const About = () => {
    const values = [
        {
            icon: <Users className="w-6 h-6" />,
            title: "Team First",
            description: "We believe in empowering teams with AI-driven insights that make collaboration seamless and productive."
        },
        {
            icon: <Zap className="w-6 h-6" />,
            title: "Move Fast",
            description: "Speed matters. We help teams identify blockers instantly and keep projects moving forward."
        },
        {
            icon: <Heart className="w-6 h-6" />,
            title: "Build Together",
            description: "Great products come from great collaboration. We foster a culture of shared success."
        },
        {
            icon: <Target className="w-6 h-6" />,
            title: "Stay Focused",
            description: "Cut through the noise. Our AI surfaces what matters most so teams can focus on impact."
        }
    ];

    const founder = {
        name: "Ibrahim Wafiyudeen",
        role: "Solo Builder",
        image: "/founder.jpeg",
        twitter: "https://x.com/wafiyudeen5448",
        linkedin: "https://www.linkedin.com/in/ibrahim-wafiyudeen-b07135344/",
        bio: "Building Teama AI end-to-end with a focus on practical productivity, clear insights, and sustainable growth."
    };

    return (
        <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
            {/* Hero Section */}
            <div className="bg-gradient-to-br from-purple-600 via-blue-600 to-purple-700 text-white">
                <div className="max-w-6xl mx-auto px-8 py-24">
                    <div className="max-w-3xl">
                        <h1 className="text-5xl font-bold mb-6 leading-tight">
                            We're building the future of team productivity
                        </h1>
                        <p className="text-xl text-purple-100 leading-relaxed">
                            Teama AI helps teams cut through the noise with AI-powered insights from Slack, Asana, and more.
                            No more endless meetings or lost context—just clarity and focus.
                        </p>
                    </div>
                </div>
            </div>

            {/* Story Section */}
            <div className="max-w-6xl mx-auto px-8 py-24">
                <div className="grid lg:grid-cols-2 gap-16 items-center">
                    <div>
                        <h2 className="text-3xl font-bold text-slate-900 mb-6">Our Story</h2>
                        <div className="space-y-4 text-slate-600 leading-relaxed">
                            <p>
                                Teama AI was born from a simple frustration: too many tools, too much noise,
                                and not enough clarity. Watching teams drown in Slack threads, lose context
                                between meetings, and struggle to identify blockers before they became
                                crises — that pain was real.
                            </p>
                            <p>
                                We knew AI could help — but only if it understood how teams actually work. So we
                                built Teama AI to connect the dots across your existing tools, surface insights
                                that matter, and give everyone a clear view of what's happening.
                            </p>
                            <p>
                                Teama AI is just launching — and we're inviting early teams to help shape what
                                it becomes. If you've felt the pain of too many tools and too little clarity,
                                this is built for you.
                            </p>
                        </div>
                    </div>
                    <div className="relative">
                        <div className="aspect-square rounded-3xl shadow-2xl overflow-hidden">
                            <img
                                src="https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?auto=format&fit=crop&w=1200&q=80"
                                alt="Professional planning work and productivity goals"
                                className="w-full h-full object-cover"
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* Values Section */}
            <div className="bg-slate-50 py-24">
                <div className="max-w-6xl mx-auto px-8">
                    <div className="text-center mb-16">
                        <h2 className="text-3xl font-bold text-slate-900 mb-4">Our Values</h2>
                        <p className="text-xl text-slate-600 max-w-2xl mx-auto">
                            These principles guide everything we build and every decision we make
                        </p>
                    </div>
                    <div className="grid md:grid-cols-2 gap-8">
                        {values.map((value, index) => (
                            <div key={index} className="bg-white rounded-2xl p-8 shadow-sm border border-slate-100 hover:shadow-lg transition-shadow">
                                <div className="w-12 h-12 bg-gradient-to-br from-purple-100 to-blue-100 rounded-xl flex items-center justify-center text-purple-600 mb-4">
                                    {value.icon}
                                </div>
                                <h3 className="text-xl font-bold text-slate-900 mb-3">{value.title}</h3>
                                <p className="text-slate-600 leading-relaxed">{value.description}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Founder Section */}
            <div className="max-w-6xl mx-auto px-8 py-24">
                <div className="text-center mb-16">
                    <h2 className="text-3xl font-bold text-slate-900 mb-4">Meet the Founder</h2>
                    <p className="text-xl text-slate-600 max-w-2xl mx-auto">
                        Teama AI is currently built by one person, with a focus on shipping useful features fast.
                    </p>
                </div>
                <div className="max-w-md mx-auto">
                    <div className="text-center group">
                        <div className="mb-4 relative">
                            <img
                                src={founder.image}
                                alt={founder.name}
                                className="w-32 h-32 rounded-2xl mx-auto shadow-lg group-hover:shadow-2xl transition-shadow border-4 border-white"
                            />
                            <div className="absolute inset-0 bg-gradient-to-br from-purple-600/0 to-blue-600/0 group-hover:from-purple-600/10 group-hover:to-blue-600/10 rounded-2xl transition-all" />
                        </div>
                        <h3 className="font-bold text-slate-900 mb-1">{founder.name}</h3>
                        <p className="text-sm text-purple-600 font-medium mb-2">{founder.role}</p>
                        <p className="text-sm text-slate-500">{founder.bio}</p>
                        <div className="mt-4 flex items-center justify-center gap-3">
                            <a
                                href={founder.twitter}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 text-sm"
                            >
                                <Twitter size={14} />
                                X
                            </a>
                            <a
                                href={founder.linkedin}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 text-sm"
                            >
                                <Linkedin size={14} />
                                LinkedIn
                            </a>
                        </div>
                    </div>
                </div>
            </div>

            {/* CTA Section */}
            <div className="bg-gradient-to-br from-purple-600 to-blue-600 text-white">
                <div className="max-w-4xl mx-auto px-8 py-16 text-center">
                    <h2 className="text-3xl font-bold mb-4">Ready to transform your team's productivity?</h2>
                    <p className="text-xl text-purple-100 mb-8">
                        Be among the first teams to experience AI-powered clarity.
                    </p>
                    <div className="flex flex-col sm:flex-row gap-4 justify-center">
                        <a href="/signup" className="bg-white text-purple-600 px-8 py-3 rounded-lg font-semibold hover:shadow-xl transition-shadow">
                            Get Started
                        </a>
                        <a href="/contact" className="bg-purple-500/30 backdrop-blur-sm border-2 border-white/20 text-white px-8 py-3 rounded-lg font-semibold hover:bg-purple-500/50 transition-colors">
                            Get in Touch
                        </a>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default About;
