import React from 'react';
import { Shield, Lock, Eye, Database, FileText, Mail } from 'lucide-react';
import SEO from '../../components/common/SEO';

const Privacy = () => {
    const lastUpdated = "February 15, 2026";

    const sections = [
        {
            id: "information-we-collect",
            title: "Information We Collect",
            icon: <Database className="w-6 h-6" />,
            content: [
                {
                    subtitle: "Account Information",
                    text: "When you create a Teama AI account, we collect your name, email address, company name, and authentication credentials. This information is necessary to provide you with access to our services."
                },
                {
                    subtitle: "Workspace Data",
                    text: "We collect data from the integrations you connect (Slack, one project platform such as Jira/Asana/Trello, and Google Calendar) to provide AI-powered insights. This includes messages, tasks, projects, and calendar events as authorized by you."
                },
                {
                    subtitle: "Usage Information",
                    text: "We automatically collect information about how you use Teama AI, including features accessed, pages viewed, time spent, and interactions with our platform."
                },
                {
                    subtitle: "Technical Information",
                    text: "We collect device information, IP addresses, browser type, operating system, and other technical data to ensure platform security and improve performance."
                }
            ]
        },
        {
            id: "how-we-use-information",
            title: "How We Use Your Information",
            icon: <Eye className="w-6 h-6" />,
            content: [
                {
                    text: "We use the information we collect to:",
                    list: [
                        "Provide, maintain, and improve our AI-powered productivity services",
                        "Generate insights, summaries, and recommendations based on your workspace data",
                        "Send you service updates, security alerts, and support messages",
                        "Analyze usage patterns to enhance product features and user experience",
                        "Detect, prevent, and address technical issues and security threats",
                        "Comply with legal obligations and enforce our Terms of Service"
                    ]
                },
                {
                    subtitle: "AI Training",
                    text: "Your workspace data is NEVER used to train our AI models. We use only anonymized, aggregated usage patterns for product improvements. Your team's conversations, tasks, and documents remain private to your organization."
                }
            ]
        },
        {
            id: "third-party-integrations",
            title: "Third-Party Integrations & OAuth Scopes",
            icon: <Eye className="w-6 h-6" />,
            content: [
                {
                    subtitle: "Google Calendar Integration",
                    text: "When you connect Google Calendar to Teama AI, we request the following OAuth scopes to provide our services:"
                },
                {
                    subtitle: "Google Calendar Read Access (calendar.readonly)",
                    text: "We access your calendar events to: (1) Generate AI-powered meeting summaries and action items; (2) Identify scheduling conflicts and resource constraints impacting team productivity; (3) Provide insights on team availability and workload distribution; (4) Send you daily productivity reports and recommendations. We never modify your calendar or share event details with third parties."
                },
                {
                    subtitle: "How Your Calendar Data Is Protected",
                    text: "Calendar data is encrypted in transit and at rest. It is stored securely in our databases and accessed only when generating insights. You can revoke access at any time through your Google Account settings, and we will immediately stop accessing new events while securely deleting stored calendar data within 30 days."
                },
                {
                    subtitle: "Other Integrations",
                    text: "Similar protections apply to other integrations you authorize (Slack, Jira, Asana, Trello, GitHub, Paystack, etc.). We request only the minimum permissions necessary to provide our services and maintain the same security standards across all integrations."
                },
                {
                    subtitle: "No Data Resale or Secondary Use",
                    text: "Your integrated data from any third-party service is never sold, shared with advertisers, or used for purposes other than providing Teama AI services."
                }
            ]
        },
        {
            id: "data-sharing",
            title: "How We Share Information",
            icon: <Shield className="w-6 h-6" />,
            content: [
                {
                    subtitle: "We Do NOT Sell Your Data",
                    text: "We will never sell your personal information or workspace data to third parties. Period."
                },
                {
                    subtitle: "Service Providers",
                    text: "We share limited data with trusted service providers who help us operate our platform (hosting, analytics, support). These providers are contractually obligated to protect your data and use it only for specified purposes."
                },
                {
                    subtitle: "Legal Requirements",
                    text: "We may disclose information if required by law, court order, or government request, or if necessary to protect our rights, property, or safety."
                },
                {
                    subtitle: "Business Transfers",
                    text: "If Teama AI is acquired or merged, your information may be transferred to the new entity. We will notify you before your data is transferred and becomes subject to a different privacy policy."
                }
            ]
        },
        {
            id: "data-security",
            title: "Data Security",
            icon: <Lock className="w-6 h-6" />,
            content: [
                {
                    text: "We implement industry-standard security measures to protect your data:",
                    list: [
                        "Encryption in transit (TLS 1.3) and at rest (AES-256)",
                        "Regular security audits and penetration testing",
                        "SOC 2 Type II certification",
                        "Role-based access controls and multi-factor authentication",
                        "Automated threat detection and response systems",
                        "Regular employee security training"
                    ]
                },
                {
                    subtitle: "Data Breach Notification",
                    text: "In the unlikely event of a data breach, we will notify affected users within 72 hours and provide guidance on protective measures."
                }
            ]
        },
        {
            id: "your-rights",
            title: "Your Rights and Choices",
            icon: <FileText className="w-6 h-6" />,
            content: [
                {
                    text: "You have the following rights regarding your personal data:",
                    list: [
                        "Access: Request a copy of your personal data",
                        "Correction: Update inaccurate or incomplete information",
                        "Deletion: Request deletion of your account and associated data",
                        "Portability: Export your data in a machine-readable format",
                        "Opt-out: Unsubscribe from marketing communications",
                        "Restriction: Limit how we process your data"
                    ]
                },
                {
                    subtitle: "Exercising Your Rights",
                    text: "To exercise these rights, contact us at team@mail.teamaai.xyz or use the data management tools in your account settings. We will respond within 30 days."
                }
            ]
        },
        {
            id: "data-retention",
            title: "Data Retention",
            content: [
                {
                    text: "We retain your data for as long as your account is active or as needed to provide services. After account deletion:",
                    list: [
                        "Personal data is deleted within 30 days",
                        "Workspace data is deleted within 90 days",
                        "Backups are purged within 180 days",
                        "Anonymized analytics data may be retained indefinitely"
                    ]
                }
            ]
        },
        {
            id: "international-transfers",
            title: "International Data Transfers",
            content: [
                {
                    text: "Teama AI is based in the United States. If you access our services from outside the US, your data may be transferred to and processed in the US. We comply with applicable data protection laws and use Standard Contractual Clauses for EU data transfers."
                }
            ]
        },
        {
            id: "cookies",
            title: "Cookies and Tracking",
            content: [
                {
                    text: "We use cookies and similar technologies to:",
                    list: [
                        "Keep you logged in and remember your preferences",
                        "Understand how you use our platform",
                        "Improve platform performance and security",
                        "Provide personalized experiences"
                    ]
                },
                {
                    text: "You can control cookies through your browser settings. Note that disabling cookies may limit some platform functionality."
                }
            ]
        },
        {
            id: "children",
            title: "Children's Privacy",
            content: [
                {
                    text: "Teama AI is not intended for children under 16. We do not knowingly collect personal information from children. If you believe we have collected information from a child, please contact us immediately."
                }
            ]
        },
        {
            id: "changes",
            title: "Changes to This Policy",
            content: [
                {
                    text: "We may update this Privacy Policy periodically. We will notify you of material changes via email or prominent notice on our platform at least 30 days before changes take effect. Continued use of our services after changes constitutes acceptance."
                }
            ]
        }
    ];

    const quickLinks = [
        { label: "Information We Collect", href: "#information-we-collect" },
        { label: "How We Use Information", href: "#how-we-use-information" },
        { label: "Third-Party Integrations", href: "#third-party-integrations" },
        { label: "Data Sharing", href: "#data-sharing" },
        { label: "Data Security", href: "#data-security" },
        { label: "Your Rights", href: "#your-rights" },
        { label: "Data Retention", href: "#data-retention" }
    ];

    return (
        <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
            <SEO 
                title="Privacy Policy" 
                description="Our commitment to your privacy. Learn how Teama AI collects, uses, and protects your data."
            />
            {/* Hero Section */}
            <div className="bg-gradient-to-br from-purple-600 via-blue-600 to-purple-700 text-white">
                <div className="max-w-6xl mx-auto px-8 py-20">
                    <div className="max-w-3xl">
                        <div className="flex items-center gap-2 text-purple-200 mb-4">
                            <Shield size={24} />
                            <span className="font-medium">Privacy Policy</span>
                        </div>
                        <h1 className="text-5xl font-bold mb-6 leading-tight">
                            Your privacy is our priority
                        </h1>
                        <p className="text-xl text-purple-100 mb-4">
                            We believe in transparency. This policy explains how we collect, use, and protect your data.
                        </p>
                        <p className="text-sm text-purple-200">
                            Last Updated: {lastUpdated}
                        </p>
                    </div>
                </div>
            </div>

            {/* Quick Links */}
            <div className="max-w-6xl mx-auto px-8 -mt-8">
                <div className="bg-white rounded-2xl shadow-xl p-6 border border-slate-100">
                    <h2 className="font-semibold text-slate-900 mb-4">Quick Navigation</h2>
                    <div className="grid md:grid-cols-3 gap-3">
                        {quickLinks.map((link, index) => (
                            <a
                                key={index}
                                href={link.href}
                                className="text-sm text-purple-600 hover:text-purple-700 hover:underline"
                            >
                                → {link.label}
                            </a>
                        ))}
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="max-w-6xl mx-auto px-8 py-16">
                <div className="grid lg:grid-cols-4 gap-12">
                    {/* Sidebar */}
                    <div className="lg:col-span-1">
                        <div className="sticky top-8 space-y-6">
                            {/* Contact Card */}
                            <div className="bg-purple-50 border border-purple-100 rounded-2xl p-6">
                                <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center text-purple-600 mb-4">
                                    <Mail size={24} />
                                </div>
                                <h3 className="font-bold text-slate-900 mb-2">Questions?</h3>
                                <p className="text-sm text-slate-600 mb-4">
                                    Contact our privacy team
                                </p>
                                <a
                                    href="mailto:team@mail.teamaai.xyz"
                                    className="text-purple-600 font-semibold hover:text-purple-700 text-sm"
                                >
                                    team@mail.teamaai.xyz →
                                </a>
                            </div>

                            {/* Key Points */}
                            <div className="bg-slate-50 border border-slate-100 rounded-2xl p-6">
                                <h3 className="font-bold text-slate-900 mb-4">Key Points</h3>
                                <ul className="space-y-3 text-sm text-slate-600">
                                    <li className="flex items-start gap-2">
                                        <span className="text-green-600 mt-1">✓</span>
                                        <span>We never sell your data</span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <span className="text-green-600 mt-1">✓</span>
                                        <span>Your data isn't used for AI training</span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <span className="text-green-600 mt-1">✓</span>
                                        <span>SOC 2 Type II certified</span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <span className="text-green-600 mt-1">✓</span>
                                        <span>You can export or delete your data anytime</span>
                                    </li>
                                </ul>
                            </div>
                        </div>
                    </div>

                    {/* Content */}
                    <div className="lg:col-span-3 space-y-12">
                        {sections.map((section, index) => (
                            <section key={index} id={section.id} className="scroll-mt-8">
                                <div className="flex items-center gap-3 mb-6">
                                    {section.icon && (
                                        <div className="w-12 h-12 bg-gradient-to-br from-purple-100 to-blue-100 rounded-xl flex items-center justify-center text-purple-600">
                                            {section.icon}
                                        </div>
                                    )}
                                    <h2 className="text-3xl font-bold text-slate-900">{section.title}</h2>
                                </div>
                                <div className="space-y-6">
                                    {section.content.map((item, idx) => (
                                        <div key={idx} className="prose prose-slate max-w-none">
                                            {item.subtitle && (
                                                <h3 className="text-xl font-semibold text-slate-900 mb-3">
                                                    {item.subtitle}
                                                </h3>
                                            )}
                                            {item.text && (
                                                <p className="text-slate-600 leading-relaxed mb-4">
                                                    {item.text}
                                                </p>
                                            )}
                                            {item.list && (
                                                <ul className="space-y-2 ml-6">
                                                    {item.list.map((listItem, listIdx) => (
                                                        <li key={listIdx} className="text-slate-600 leading-relaxed">
                                                            {listItem}
                                                        </li>
                                                    ))}
                                                </ul>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </section>
                        ))}

                        {/* Contact Section */}
                        <section className="bg-gradient-to-br from-purple-50 to-blue-50 border border-purple-100 rounded-2xl p-8">
                            <h2 className="text-2xl font-bold text-slate-900 mb-4">Contact Us About Privacy</h2>
                            <p className="text-slate-600 mb-6 leading-relaxed">
                                If you have questions, concerns, or requests regarding this Privacy Policy or our data practices,
                                please contact our Data Protection Officer at:
                            </p>
                            <div className="space-y-2 text-slate-700">
                                <p className="font-medium">Email: <a href="mailto:team@mail.teamaai.xyz" className="text-purple-600 hover:underline">team@mail.teamaai.xyz</a></p>
                                <p className="font-medium">Mail: Teama AI, Inc. - Privacy Team</p>
                                <p className="text-sm text-slate-600">123 Market Street, Suite 400</p>
                                <p className="text-sm text-slate-600">San Francisco, CA 94103</p>
                            </div>
                        </section>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Privacy;
