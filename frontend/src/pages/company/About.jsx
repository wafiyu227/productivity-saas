import React from 'react';
import { Users, Target, Zap, Heart, Award, TrendingUp } from 'lucide-react';

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

    const stats = [
        { number: "10K+", label: "Active Teams" },
        { number: "500K+", label: "AI Summaries Generated" },
        { number: "98%", label: "Customer Satisfaction" },
        { number: "45%", label: "Time Saved Weekly" }
    ];

    const team = [
        {
            name: "Sarah Chen",
            role: "Co-Founder & CEO",
            image: "https://api.dicebear.com/7.x/avataaars/svg?seed=sarah",
            bio: "Previously led product at Asana. MIT CS grad."
        },
        {
            name: "Marcus Rodriguez",
            role: "Co-Founder & CTO",
            image: "https://api.dicebear.com/7.x/avataaars/svg?seed=marcus",
            bio: "Ex-Google engineer. Built ML systems at scale."
        },
        {
            name: "Emily Watson",
            role: "Head of Design",
            image: "https://api.dicebear.com/7.x/avataaars/svg?seed=emily",
            bio: "Design lead from Figma. Stanford Design Program."
        },
        {
            name: "David Park",
            role: "Head of Engineering",
            image: "https://api.dicebear.com/7.x/avataaars/svg?seed=david",
            bio: "Previously at Stripe. Built developer tools for 10+ years."
        }
    ];

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

            {/* Stats Section */}
            <div className="max-w-6xl mx-auto px-8 -mt-12">
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
                    {stats.map((stat, index) => (
                        <div key={index} className="bg-white rounded-2xl shadow-lg p-6 text-center border border-slate-100">
                            <div className="text-4xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent mb-2">
                                {stat.number}
                            </div>
                            <div className="text-slate-600 font-medium">{stat.label}</div>
                        </div>
                    ))}
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
                                and not enough clarity. As engineering leaders, we watched our teams drown in
                                Slack threads, lose context between meetings, and struggle to identify blockers
                                before they became crises.
                            </p>
                            <p>
                                We knew AI could help—but only if it understood how teams actually work. So we
                                built Teama AI to connect the dots across your existing tools, surface insights
                                that matter, and give everyone a clear view of what's happening.
                            </p>
                            <p>
                                Today, thousands of teams use Teama AI to stay aligned, move faster, and spend
                                less time in status meetings. We're just getting started.
                            </p>
                        </div>
                    </div>
                    <div className="relative">
                        <div className="aspect-square bg-gradient-to-br from-purple-100 to-blue-100 rounded-3xl shadow-2xl overflow-hidden">
                            <div className="absolute inset-0 flex items-center justify-center">
                                <TrendingUp className="w-32 h-32 text-purple-300" />
                            </div>
                        </div>
                        <div className="absolute -bottom-6 -right-6 w-32 h-32 bg-gradient-to-br from-blue-600 to-purple-600 rounded-2xl shadow-xl flex items-center justify-center">
                            <Award className="w-16 h-16 text-white" />
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

            {/* Team Section */}
            <div className="max-w-6xl mx-auto px-8 py-24">
                <div className="text-center mb-16">
                    <h2 className="text-3xl font-bold text-slate-900 mb-4">Meet the Team</h2>
                    <p className="text-xl text-slate-600 max-w-2xl mx-auto">
                        We're a small team with big ambitions, backed by experience from the best product companies
                    </p>
                </div>
                <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
                    {team.map((member, index) => (
                        <div key={index} className="text-center group">
                            <div className="mb-4 relative">
                                <img
                                    src={member.image}
                                    alt={member.name}
                                    className="w-32 h-32 rounded-2xl mx-auto shadow-lg group-hover:shadow-2xl transition-shadow border-4 border-white"
                                />
                                <div className="absolute inset-0 bg-gradient-to-br from-purple-600/0 to-blue-600/0 group-hover:from-purple-600/10 group-hover:to-blue-600/10 rounded-2xl transition-all"></div>
                            </div>
                            <h3 className="font-bold text-slate-900 mb-1">{member.name}</h3>
                            <p className="text-sm text-purple-600 font-medium mb-2">{member.role}</p>
                            <p className="text-sm text-slate-500">{member.bio}</p>
                        </div>
                    ))}
                </div>
            </div>

            {/* CTA Section */}
            <div className="bg-gradient-to-br from-purple-600 to-blue-600 text-white">
                <div className="max-w-4xl mx-auto px-8 py-16 text-center">
                    <h2 className="text-3xl font-bold mb-4">Ready to transform your team's productivity?</h2>
                    <p className="text-xl text-purple-100 mb-8">
                        Join thousands of teams already using Teama AI
                    </p>
                    <div className="flex flex-col sm:flex-row gap-4 justify-center">
                        <button className="bg-white text-purple-600 px-8 py-3 rounded-lg font-semibold hover:shadow-xl transition-shadow">
                            Start Free Trial
                        </button>
                        <button className="bg-purple-500/30 backdrop-blur-sm border-2 border-white/20 text-white px-8 py-3 rounded-lg font-semibold hover:bg-purple-500/50 transition-colors">
                            Schedule Demo
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default About;