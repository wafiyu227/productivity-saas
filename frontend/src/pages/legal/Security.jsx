import React from 'react';
import { Shield, Lock, Eye, Server, Key, AlertTriangle, Award, FileCheck, ArrowLeft, Terminal, ShieldCheck, Zap, Globe, ChevronRight, Activity, Download } from 'lucide-react';
import SEO from '../../components/common/SEO';
import { useNavigate } from 'react-router-dom';

const Security = () => {
    const navigate = useNavigate();

    const certifications = [
        {
            icon: <Award size={28} />,
            title: "SOC 2 Type II",
            description: "Independently audited for security, availability, and confidentiality.",
            status: "Certified"
        },
        {
            icon: <Shield size={28} />,
            title: "GDPR",
            description: "Compliant with European data protection and privacy regulations.",
            status: "Compliant"
        },
        {
            icon: <FileCheck size={28} />,
            title: "ISO 27001",
            description: "Information security management systems audit in progress.",
            status: "In Progress"
        },
        {
            icon: <Lock size={28} />,
            title: "CCPA",
            description: "Compliant with California's consumer privacy laws.",
            status: "Compliant"
        }
    ];

    const securityFeatures = [
        {
            id: "encryption",
            title: "Encryption",
            icon: <Lock size={24} />,
            features: [
                {
                    name: "Data in Transit",
                    description: "All data sent between your browser and our servers is protected with industry-standard encryption."
                },
                {
                    name: "Data at Rest",
                    description: "Your stored data is encrypted using high-level standards to ensure it's unreadable to unauthorized users."
                },
                {
                    name: "Workspace Privacy",
                    description: "Your team's data is isolated and protected throughout its lifecycle on our platform."
                }
            ]
        },
        {
            id: "infrastructure",
            title: "Cloud Security",
            icon: <Server size={24} />,
            features: [
                {
                    name: "Secure Hosting",
                    description: "We use trusted providers like AWS and Google Cloud that meet strict global security standards."
                },
                {
                    name: "Threat Prevention",
                    description: "We use multiple layers of firewalls and real-time monitoring to block potential attacks."
                },
                {
                    name: "Backups",
                    description: "We perform daily backups to ensure your data can be quickly recovered if needed."
                }
            ]
        },
        {
            id: "access-control",
            title: "Access Control",
            icon: <Key size={24} />,
            features: [
                {
                    name: "Two-Factor Auth",
                    description: "Protect your account with an extra layer of security beyond just a password."
                },
                {
                    name: "Company SSO",
                    description: "Connect your existing identity providers like Okta or Azure for easier, safer logins."
                },
                {
                    name: "Role Permissions",
                    description: "Define exactly who has access to which data within your organization."
                }
            ]
        }
    ];

    return (
        <div className="min-h-screen bg-black text-white selection:bg-gray-800 font-sans">
            <SEO 
                title="Security at Teama AI" 
                description="How we protect your organization's data."
            />
            
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
                            Security <br /> <span className="text-gray-500">at Teama AI</span>
                        </h1>
                        <p className="text-xl text-gray-400 max-w-2xl leading-relaxed">
                            We use enterprise-grade security to ensure your data stays private and protected.
                        </p>
                    </div>
                </div>
            </header>

            <div className="max-w-7xl mx-auto px-8 -mt-16 relative z-10 pb-20">
                <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {certifications.map((cert, index) => (
                        <div key={index} className="bg-white/[0.02] border border-white/5 rounded-3xl p-8 hover:border-white/10 transition-all">
                            <div className="w-12 h-12 bg-white/5 border border-white/5 rounded-xl flex items-center justify-center text-gray-400 mb-8">
                                {cert.icon}
                            </div>
                            <h3 className="text-xl font-bold text-white mb-4">{cert.title}</h3>
                            <p className="text-gray-500 text-sm mb-6 leading-relaxed">{cert.description}</p>
                            <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-bold border border-white/10 bg-white/5 text-gray-400">
                                {cert.status}
                            </span>
                        </div>
                    ))}
                </div>
            </div>

            <main className="max-w-7xl mx-auto px-8 py-20">
                <div className="grid lg:grid-cols-4 gap-16">
                    <aside className="lg:col-span-1">
                        <nav className="sticky top-32 space-y-4">
                            {securityFeatures.map((sec, i) => (
                                <a
                                    key={i}
                                    href={`#${sec.id}`}
                                    className="block p-4 rounded-xl border border-transparent hover:border-white/5 hover:bg-white/[0.02] text-sm font-medium text-gray-500 hover:text-white transition-all"
                                >
                                    {sec.title}
                                </a>
                            ))}
                        </nav>
                    </aside>

                    <div className="lg:col-span-3 space-y-32">
                        {securityFeatures.map((category, index) => (
                            <section key={index} id={category.id} className="scroll-mt-32">
                                <div className="flex items-center gap-6 mb-10">
                                    <div className="w-12 h-12 bg-white/5 border border-white/5 rounded-xl flex items-center justify-center text-gray-400">
                                        {category.icon}
                                    </div>
                                    <h2 className="text-3xl font-bold text-white">{category.title}</h2>
                                </div>
                                
                                <div className="grid md:grid-cols-1 gap-6">
                                    {category.features.map((feature, idx) => (
                                        <div key={idx} className="bg-white/[0.02] border border-white/5 rounded-3xl p-10 hover:border-white/10 transition-all">
                                            <h4 className="text-sm font-bold text-gray-500 uppercase tracking-widest mb-4">
                                                {feature.name}
                                            </h4>
                                            <p className="text-lg text-gray-400 leading-relaxed">{feature.description}</p>
                                        </div>
                                    ))}
                                </div>
                            </section>
                        ))}

                        <section className="bg-white/[0.02] border border-white/5 rounded-3xl p-12 text-center">
                             <h2 className="text-xl font-bold mb-4">Report a Vulnerability</h2>
                             <p className="text-gray-500 mb-8">
                                If you discover a security issue, please email us at team@mail.teamaai.xyz.
                             </p>
                        </section>
                    </div>
                </div>
            </main>
        </div>
    );
};

export default Security;