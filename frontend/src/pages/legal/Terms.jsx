import React from 'react';
import { FileText, AlertCircle, CheckCircle, XCircle, Scale, ArrowLeft, Shield, Zap, Terminal, ChevronRight, Gavel, ShieldAlert } from 'lucide-react';
import SEO from '../../components/common/SEO';
import { useNavigate } from 'react-router-dom';

const Terms = () => {
    const navigate = useNavigate();
    const lastUpdated = "February 15, 2026";

    const sections = [
        {
            id: "acceptance",
            title: "Acceptance of Terms",
            icon: <CheckCircle size={24} />,
            content: [
                {
                    text: "By using Teama AI, you agree to these terms. If you don't agree, please do not use our services."
                },
                {
                    text: "We may update these terms from time to time. If we make big changes, we'll let you know by email or through the app."
                }
            ]
        },
        {
            id: "service",
            title: "Our Service",
            icon: <Zap size={24} />,
            content: [
                {
                    text: "Teama AI helps your team by summarizing Slack messages, meetings, and tasks from your connected tools. We aim for 99.9% uptime, but we aren't responsible for issues with third-party tools like Slack or Google."
                }
            ]
        },
        {
            id: "accounts",
            title: "Your Account",
            icon: <Shield size={24} />,
            content: [
                {
                    subtitle: "Rules",
                    text: "To use Teama AI, you must be at least 16 years old and provide accurate information. You are responsible for keeping your account password safe."
                }
            ]
        },
        {
            id: "acceptable-use",
            title: "Acceptable Use",
            icon: <ShieldAlert size={24} />,
            content: [
                {
                    text: "You agree not to use our service for anything illegal, to send viruses, or to try and break into our systems. Any misuse can lead to your account being closed."
                }
            ]
        },
        {
            id: "ownership",
            title: "Ownership",
            icon: <FileText size={24} />,
            content: [
                {
                    subtitle: "Your Data",
                    text: "You own all the data you provide to Teama AI. We only use it to provide our service to you. We don't train our AI on your private data."
                },
                {
                    subtitle: "Our Property",
                    text: "We own the Teama AI software, logo, and website. You cannot copy or use them without our permission."
                }
            ]
        },
        {
            id: "billing",
            title: "Billing",
            icon: <Zap size={24} />,
            content: [
                {
                    text: "We charge a subscription fee for our premium features. You can find our refund policy at /refund-policy."
                }
            ]
        }
    ];

    return (
        <div className="min-h-screen bg-black text-white selection:bg-gray-800 font-sans">
            <SEO 
                title="Terms of Service" 
                description="The rules for using Teama AI."
            />
            
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
                            Terms of <br /> <span className="text-gray-500">Service</span>
                        </h1>
                        <p className="text-xl text-gray-400 max-w-2xl leading-relaxed">
                            These terms explain the rules for using Teama AI and how we work together.
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
                                                <p className="text-lg text-gray-400 leading-relaxed">
                                                    {item.text}
                                                </p>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </section>
                        ))}
                    </div>
                </div>
            </main>
        </div>
    );
};

export default Terms;
