import React from 'react';
import { Link } from 'react-router-dom';
import { RotateCcw, Clock, Mail, CheckCircle2, AlertCircle, ShieldCheck } from 'lucide-react';
import SEO from '../../components/common/SEO';

const RefundPolicy = () => {
    const lastUpdated = "March 17, 2026";

    const sections = [
        {
            id: "overview",
            title: "Refund Policy Overview",
            content: [
                {
                    subtitle: "14-Day Money-Back Guarantee",
                    text: "We offer a full, unconditional 14-day money-back guarantee on all paid subscription plans. If you are not satisfied with Teama AI for any reason, you may request a full refund within 14 days of your initial purchase or any renewal payment — no questions asked."
                },
                {
                    subtitle: "No Conditions or Exceptions",
                    text: "Our 14-day refund window applies to all customers equally. There are no conditions, exceptions, or hidden requirements. You do not need to provide a reason, meet usage thresholds, or go through an approval process. Simply contact us and your refund will be processed."
                }
            ]
        },
        {
            id: "eligibility",
            title: "Refund Eligibility",
            content: [
                {
                    subtitle: "Eligible for Refund",
                    text: "Any payment made for a Teama AI subscription is eligible for a full refund if requested within 14 days of the charge date. This includes first-time purchases, plan upgrades, and renewal payments."
                },
                {
                    subtitle: "Free Plans",
                    text: "Free plans do not involve any payment, so no refund is applicable. If you are unsure about committing to a paid plan, we encourage you to start with our free tier."
                }
            ]
        },
        {
            id: "how-to-request",
            title: "How to Request a Refund",
            content: [
                {
                    subtitle: "Contact Us",
                    text: "To request a refund, simply email us at team@mail.teamaai.xyz with the subject line 'Refund Request'. Include the email address associated with your account. That's all we need."
                },
                {
                    subtitle: "Processing Time",
                    text: "Once your refund request is received, we will process it within 5–10 business days. The refund will be issued to the original payment method used at the time of purchase."
                },
                {
                    subtitle: "Account Status",
                    text: "After a refund is processed, your account will be downgraded to the free plan. You will retain access to your data and can continue using Teama AI on the free tier."
                }
            ]
        },
        {
            id: "cancellation",
            title: "Cancellation vs. Refund",
            content: [
                {
                    subtitle: "Cancellation",
                    text: "You may cancel your subscription at any time from your account settings. Cancellation stops future billing and your paid features remain active until the end of the current billing period."
                },
                {
                    subtitle: "Refund After Cancellation",
                    text: "If you cancel and also wish to receive a refund for the current billing period, you may still request one — as long as the request is made within 14 days of the most recent charge."
                }
            ]
        },
        {
            id: "contact",
            title: "Questions?",
            content: [
                {
                    subtitle: "Get in Touch",
                    text: "If you have any questions about our refund policy or need assistance with a refund request, please contact us at team@mail.teamaai.xyz. We typically respond within 24 hours on business days."
                }
            ]
        }
    ];

    const highlights = [
        { icon: <Clock className="w-5 h-5" />, text: "14-day unconditional refund window" },
        { icon: <CheckCircle2 className="w-5 h-5" />, text: "No questions asked, no conditions" },
        { icon: <RotateCcw className="w-5 h-5" />, text: "Full refund to original payment method" },
        { icon: <ShieldCheck className="w-5 h-5" />, text: "Processed within 5–10 business days" }
    ];

    return (
        <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
            <SEO
                title="Refund Policy"
                description="Teama AI offers a full, unconditional 14-day money-back guarantee on all paid plans. No questions asked."
            />

            {/* Hero */}
            <div className="bg-gradient-to-br from-purple-600 via-blue-600 to-purple-700 text-white">
                <div className="max-w-4xl mx-auto px-8 py-20">
                    <div className="flex items-center gap-3 mb-4">
                        <RotateCcw className="w-8 h-8 opacity-80" />
                        <span className="text-purple-200 text-sm font-medium uppercase tracking-wider">Refund Policy</span>
                    </div>
                    <h1 className="text-5xl font-bold mb-4">14-Day Money-Back Guarantee</h1>
                    <p className="text-xl text-purple-100">
                        Not satisfied? Get a full refund within 14 days — no questions asked, no conditions.
                    </p>
                    <p className="text-purple-200 text-sm mt-6">Last updated: {lastUpdated}</p>
                </div>
            </div>

            {/* Highlights Bar */}
            <div className="bg-white border-b border-slate-100">
                <div className="max-w-4xl mx-auto px-8 py-6">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {highlights.map((item, index) => (
                            <div key={index} className="flex items-center gap-3 text-sm text-slate-700">
                                <span className="text-purple-600">{item.icon}</span>
                                <span className="font-medium">{item.text}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="max-w-4xl mx-auto px-8 py-16">
                <div className="grid lg:grid-cols-4 gap-12">
                    {/* Sidebar Nav */}
                    <div className="lg:col-span-1">
                        <div className="sticky top-8">
                            <nav className="space-y-1">
                                {sections.map((section) => (
                                    <a
                                        key={section.id}
                                        href={`#${section.id}`}
                                        className="block px-3 py-2 text-sm text-slate-600 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                                    >
                                        {section.title}
                                    </a>
                                ))}
                            </nav>

                            <div className="mt-8 bg-purple-50 border border-purple-100 rounded-xl p-4">
                                <p className="text-xs text-slate-500 mb-1">
                                    Contact our support team
                                </p>
                                <a
                                    href="mailto:team@mail.teamaai.xyz"
                                    className="text-purple-600 font-semibold hover:text-purple-700 text-sm"
                                >
                                    team@mail.teamaai.xyz →
                                </a>
                            </div>
                        </div>
                    </div>

                    {/* Main Content */}
                    <div className="lg:col-span-3 space-y-12">
                        {sections.map((section) => (
                            <section key={section.id} id={section.id}>
                                <h2 className="text-2xl font-bold text-slate-900 mb-6 pb-3 border-b border-slate-100">
                                    {section.title}
                                </h2>
                                <div className="space-y-6">
                                    {section.content.map((item, index) => (
                                        <div key={index}>
                                            <h3 className="font-semibold text-slate-800 mb-2">{item.subtitle}</h3>
                                            <p className="text-slate-600 leading-relaxed">{item.text}</p>
                                        </div>
                                    ))}
                                </div>
                            </section>
                        ))}

                        {/* Important Notice */}
                        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-8">
                            <div className="flex items-start gap-4">
                                <AlertCircle className="w-6 h-6 text-blue-600 flex-shrink-0 mt-0.5" />
                                <div>
                                    <h3 className="font-bold text-blue-900 mb-2">Important</h3>
                                    <p className="text-blue-800 text-sm leading-relaxed">
                                        This refund policy applies to all Teama AI paid subscription plans without exception.
                                        If you believe you have been charged in error or have billing questions,
                                        please contact us immediately at{' '}
                                        <a href="mailto:team@mail.teamaai.xyz" className="font-semibold underline">
                                            team@mail.teamaai.xyz
                                        </a>.
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="border-t border-slate-200 pt-8 text-sm text-slate-500">
                            <p>
                                This Refund Policy is part of our{' '}
                                <Link to="/terms" className="text-purple-600 hover:underline">Terms of Service</Link>.
                                For privacy-related inquiries, see our{' '}
                                <Link to="/privacy" className="text-purple-600 hover:underline">Privacy Policy</Link>.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default RefundPolicy;
