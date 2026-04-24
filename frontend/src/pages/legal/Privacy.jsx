import React from 'react';
import { Shield, Lock, Eye, Database, FileText, Mail, ChevronRight, ArrowLeft, ShieldCheck, Zap, Globe, Terminal } from 'lucide-react';
import SEO from '../../components/common/SEO';
import { useNavigate } from 'react-router-dom';

const Privacy = () => {
    const navigate = useNavigate();
    const lastUpdated = "February 15, 2026";

    const sections = [
        {
            id: "information-we-collect",
            title: "What we collect",
            icon: <Database size={24} />,
            content: [
                {
                    subtitle: "Account Information",
                    text: "When you create an account, we collect your name, email address, and company name to provide access to our services."
                },
                {
                    subtitle: "Connected Tools",
                    text: "We access data from the tools you connect (like Slack, Jira, or Google Calendar) to generate summaries and insights for your team. This includes messages, tasks, and calendar events."
                },
                {
                    subtitle: "Usage Data",
                    text: "We collect information about how you use our platform to help us improve its performance and your experience."
                }
            ]
        },
        {
            id: "how-we-use-information",
            title: "How we use your data",
            icon: <Eye size={24} />,
            content: [
                {
                    text: "We use the information we collect to:",
                    list: [
                        "Provide and improve our AI features",
                        "Generate team summaries and insights",
                        "Send important service updates",
                        "Maintain the security of our platform",
                        "Comply with legal requirements"
                    ]
                },
                {
                    subtitle: "Your data is private",
                    text: "We do not use your private data to train shared AI models. Your information is kept isolated and secure within your organization."
                }
            ]
        },
        {
            id: "data-sharing",
            title: "How we share data",
            icon: <ShieldCheck size={24} />,
            content: [
                {
                    subtitle: "We don't sell data",
                    text: "We never sell your data to third parties for marketing or any other purpose."
                },
                {
                    subtitle: "Service Providers",
                    text: "We may share limited data with trusted partners (like our hosting provider) only as needed to run our services."
                }
            ]
        },
        {
            id: "security",
            title: "How we protect data",
            icon: <Lock size={24} />,
            content: [
                {
                    text: "We use modern security practices to keep your data safe:",
                    list: [
                        "Encryption for all data in transit and at rest",
                        "Secure authentication and access controls",
                        "Regular security audits and testing",
                        "Automated threat monitoring"
                    ]
                }
            ]
        }
    ];

    return (
        <div className="min-h-screen bg-black text-white selection:bg-gray-800 font-sans">
            <SEO 
                title="Privacy Policy" 
                description="Our commitment to protecting your team's data privacy."
            />
            
            {/* Header */}
            <header className="relative pt-24 pb-20 border-b border-white/5">
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
                            Privacy <br /> <span className="text-gray-500">Policy</span>
                        </h1>
                        <p className="text-xl text-gray-400 max-w-2xl leading-relaxed">
                            We believe that your team's data should be private and secure. This policy explains how we handle your information.
                        </p>
                        
                        <div className="mt-12 flex items-center gap-8">
                            <div className="flex flex-col gap-1">
                                <span className="text-[10px] font-bold text-gray-700 uppercase tracking-widest">Last Updated</span>
                                <span className="text-sm font-medium text-gray-300">{lastUpdated}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-8 py-20">
                <div className="grid lg:grid-cols-4 gap-16">
                    {/* Sidebar */}
                    <aside className="lg:col-span-1">
                        <nav className="sticky top-32 space-y-4">
                            {sections.map((section, i) => (
                                <a
                                    key={i}
                                    href={`#${section.id}`}
                                    className="block p-4 rounded-xl border border-transparent hover:border-white/5 hover:bg-white/[0.02] text-sm font-medium text-gray-500 hover:text-white transition-all"
                                >
                                    {section.title}
                                </a>
                            ))}
                        </nav>
                    </aside>

                    {/* Content */}
                    <div className="lg:col-span-3 space-y-32">
                        {sections.map((section, index) => (
                            <section key={index} id={section.id} className="scroll-mt-32">
                                <div className="flex items-center gap-6 mb-10">
                                    <div className="w-12 h-12 bg-white/5 border border-white/5 rounded-xl flex items-center justify-center text-gray-400">
                                        {section.icon}
                                    </div>
                                    <h2 className="text-3xl font-bold text-white">{section.title}</h2>
                                </div>
                                
                                <div className="bg-white/[0.02] border border-white/5 rounded-3xl p-10 md:p-14 space-y-12">
                                    {section.content.map((item, idx) => (
                                        <div key={idx}>
                                            {item.subtitle && (
                                                <h3 className="text-sm font-bold text-gray-500 uppercase tracking-widest mb-4">
                                                    {item.subtitle}
                                                </h3>
                                            )}
                                            {item.text && (
                                                <p className="text-lg text-gray-400 leading-relaxed mb-6">
                                                    {item.text}
                                                </p>
                                            )}
                                            {item.list && (
                                                <div className="grid md:grid-cols-2 gap-4">
                                                    {item.list.map((listItem, listIdx) => (
                                                        <div key={listIdx} className="p-4 bg-white/[0.02] border border-white/10 rounded-xl text-sm text-gray-400">
                                                            {listItem}
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </section>
                        ))}

                        <section className="bg-white/[0.02] border border-white/5 rounded-3xl p-12 text-center">
                             <h2 className="text-xl font-bold mb-4">Questions?</h2>
                             <p className="text-gray-500 mb-8">
                                Contact us at team@mail.teamaai.xyz for any privacy-related questions.
                             </p>
                        </section>
                    </div>
                </div>
            </main>
        </div>
    );
};

export default Privacy;
