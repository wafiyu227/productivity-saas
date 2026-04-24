import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { RotateCcw, Clock, Mail, CheckCircle2, AlertCircle, ShieldCheck, ArrowLeft, Zap, Terminal, ChevronRight } from 'lucide-react';
import SEO from '../../components/common/SEO';

const RefundPolicy = () => {
    const navigate = useNavigate();
    const lastUpdated = "March 17, 2026";

    const sections = [
        {
            id: "overview",
            title: "Overview",
            content: [
                {
                    subtitle: "14-Day Money-Back Guarantee",
                    text: "Teama AI offers a full, unconditional 14-day money-back guarantee on all paid plans. If you're not satisfied with our service, you can request a refund within 14 days of your purchase - no questions asked."
                },
                {
                    subtitle: "Simple Process",
                    text: "Our refund policy applies to all customers. There are no hidden requirements or complex approval cycles. If you ask for a refund within the 10-day window, we will process it immediately."
                }
            ]
        },
        {
            id: "eligibility",
            title: "Eligibility",
            content: [
                {
                    subtitle: "Valid Transactions",
                    text: "Any payment made for a Teama AI subscription is eligible for a full refund if requested within 14 days of the charge. This includes new subscriptions, upgrades, and renewals."
                },
                {
                    subtitle: "Free Plans",
                    text: "Free plans do not involve any payments, so refunds do not apply. We recommend trying our free features before upgrading to a paid plan."
                }
            ]
        },
        {
            id: "how-to-request",
            title: "How to request",
            content: [
                {
                    subtitle: "Email Us",
                    text: "To request a refund, simply email us at team@mail.teamaai.xyz with the subject line 'Refund Request'. Please include the email address associated with your account."
                },
                {
                    subtitle: "Processing Time",
                    text: "Once we receive your request, we usually process it within 5-10 business days. The refund will be sent back to your original payment method."
                },
                {
                    subtitle: "Account Status",
                    text: "After your refund is processed, your account will be moved to the free tier. You will still have access to your data on the free version of Teama AI."
                }
            ]
        }
    ];

    return (
        <div className="min-h-screen bg-black text-white selection:bg-gray-800 font-sans">
            <SEO
                title="Refund Policy"
                description="Our simple 14-day money-back guarantee."
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
                            Refund <br /> <span className="text-gray-500">Policy</span>
                        </h1>
                        <p className="text-xl text-gray-400 max-w-2xl leading-relaxed">
                            We offer a simple, no-questions-asked refund policy for all our customers.
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

export default RefundPolicy;
