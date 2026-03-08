import React from 'react';
import { FileText, AlertCircle, CheckCircle, XCircle, Scale } from 'lucide-react';

const Terms = () => {
    const lastUpdated = "February 15, 2026";

    const sections = [
        {
            id: "acceptance",
            title: "Acceptance of Terms",
            icon: <CheckCircle className="w-6 h-6" />,
            content: [
                {
                    text: "By accessing or using Teama AI ('Service'), you agree to be bound by these Terms of Service ('Terms'). If you disagree with any part of these terms, you may not access the Service."
                },
                {
                    text: "We reserve the right to modify these Terms at any time. We will notify you of material changes at least 30 days in advance via email or prominent notice on our platform. Continued use of the Service after changes take effect constitutes acceptance of the new Terms."
                }
            ]
        },
        {
            id: "description",
            title: "Description of Service",
            icon: <FileText className="w-6 h-6" />,
            content: [
                {
                    text: "Teama AI provides AI-powered productivity tools that integrate with your existing workplace applications (Slack, one project platform such as Jira/Asana/Trello, and Google Calendar) to deliver insights, summaries, and analytics. The Service includes:",
                    list: [
                        "AI-generated summaries of Slack conversations",
                        "Project health monitoring and blocker detection",
                        "Team workload analysis and recommendations",
                        "Calendar integration and meeting insights",
                        "Productivity analytics and reporting"
                    ]
                },
                {
                    subtitle: "Service Availability",
                    text: "We strive for 99.9% uptime but cannot guarantee uninterrupted service. We may perform scheduled maintenance with advance notice. We are not liable for service interruptions beyond our control."
                }
            ]
        },
        {
            id: "accounts",
            title: "Account Registration and Security",
            content: [
                {
                    subtitle: "Account Requirements",
                    text: "To use Teama AI, you must:",
                    list: [
                        "Be at least 16 years old",
                        "Provide accurate, current, and complete information",
                        "Maintain the security of your account credentials",
                        "Have authority to bind your organization if using for business purposes",
                        "Comply with all applicable laws and regulations"
                    ]
                },
                {
                    subtitle: "Account Responsibility",
                    text: "You are responsible for all activity under your account. Notify us immediately of any unauthorized access. We are not liable for losses resulting from unauthorized use of your account."
                },
                {
                    subtitle: "Account Termination",
                    text: "We reserve the right to suspend or terminate accounts that violate these Terms, engage in fraudulent activity, or pose security risks. You may terminate your account at any time through account settings."
                }
            ]
        },
        {
            id: "acceptable-use",
            title: "Acceptable Use Policy",
            icon: <AlertCircle className="w-6 h-6" />,
            content: [
                {
                    text: "You agree NOT to use the Service to:",
                    list: [
                        "Violate any laws, regulations, or third-party rights",
                        "Transmit malware, viruses, or malicious code",
                        "Attempt to gain unauthorized access to our systems",
                        "Reverse engineer, decompile, or disassemble the Service",
                        "Scrape, spider, or crawl the Service using automated means",
                        "Share access credentials with unauthorized users",
                        "Use the Service to harass, abuse, or harm others",
                        "Interfere with or disrupt Service operations",
                        "Remove or modify any proprietary notices or labels",
                        "Use the Service for competitive analysis or benchmarking"
                    ]
                },
                {
                    subtitle: "Enforcement",
                    text: "Violations may result in immediate account suspension or termination without refund. We may report illegal activity to law enforcement."
                }
            ]
        },
        {
            id: "data-ownership",
            title: "Data Ownership and Intellectual Property",
            content: [
                {
                    subtitle: "Your Data",
                    text: "You retain all ownership rights to the data you provide to Teama AI ('Customer Data'). You grant us a limited license to process Customer Data solely to provide the Service. We will never use your data to train AI models or share it with third parties except as described in our Privacy Policy."
                },
                {
                    subtitle: "Our Intellectual Property",
                    text: "The Service, including all software, algorithms, designs, trademarks, and content, is owned by Teama AI and protected by copyright, trademark, and other intellectual property laws. You may not copy, modify, distribute, or create derivative works based on our intellectual property."
                },
                {
                    subtitle: "Feedback",
                    text: "If you provide feedback, suggestions, or ideas about the Service, you grant us an unlimited, perpetual license to use such feedback without compensation or attribution."
                }
            ]
        },
        {
            id: "payment",
            title: "Payment and Billing",
            content: [
                {
                    subtitle: "Subscription Plans",
                    text: "Teama AI offers subscription-based pricing. By subscribing, you agree to pay all applicable fees according to the selected plan. Fees are billed in advance on a monthly or annual basis."
                },
                {
                    subtitle: "Payment Method",
                    text: "You must provide valid payment information. You authorize us to charge your payment method for all fees incurred. We use third-party payment processors and do not store credit card numbers."
                },
                {
                    subtitle: "Price Changes",
                    text: "We may change pricing with 30 days' notice. Changes take effect at the start of your next billing cycle. Continued use constitutes acceptance of new pricing."
                },
                {
                    subtitle: "Refunds",
                    text: "Fees are non-refundable except as required by law or as stated in our refund policy."
                },
                {
                    subtitle: "Cancellation",
                    text: "You may cancel your subscription at any time. Cancellation takes effect at the end of the current billing period. You will retain access until that time. No refunds for partial periods."
                },
                {
                    subtitle: "Overdue Payments",
                    text: "We may suspend Service access for accounts with overdue payments. A late fee of 1.5% per month (or maximum allowed by law) may be charged on overdue amounts."
                }
            ]
        },
        {
            id: "confidentiality",
            title: "Confidentiality",
            content: [
                {
                    text: "Both parties agree to maintain the confidentiality of any confidential information disclosed during the course of using the Service. This includes technical specifications, business information, and Customer Data."
                },
                {
                    text: "Confidentiality obligations do not apply to information that is: (a) publicly available through no breach of this agreement, (b) independently developed, (c) rightfully received from a third party, or (d) required to be disclosed by law."
                }
            ]
        },
        {
            id: "warranties",
            title: "Warranties and Disclaimers",
            icon: <XCircle className="w-6 h-6" />,
            content: [
                {
                    subtitle: "Service Warranty",
                    text: "We warrant that the Service will perform substantially as described in our documentation. This warranty is void if issues result from misuse, modifications, or factors beyond our control."
                },
                {
                    subtitle: "Disclaimers",
                    text: "EXCEPT AS EXPRESSLY STATED, THE SERVICE IS PROVIDED 'AS IS' WITHOUT WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT."
                },
                {
                    text: "We do not warrant that:",
                    list: [
                        "The Service will be uninterrupted, error-free, or completely secure",
                        "Results obtained from the Service will be accurate or reliable",
                        "AI-generated insights will be error-free or suitable for your purposes",
                        "Defects will be corrected within any specific timeframe"
                    ]
                }
            ]
        },
        {
            id: "limitation-of-liability",
            title: "Limitation of Liability",
            content: [
                {
                    text: "TO THE MAXIMUM EXTENT PERMITTED BY LAW, TEAMA AI SHALL NOT BE LIABLE FOR:",
                    list: [
                        "Indirect, incidental, special, consequential, or punitive damages",
                        "Loss of profits, revenue, data, or business opportunities",
                        "Cost of procurement of substitute services",
                        "Service interruptions or errors in AI-generated content"
                    ]
                },
                {
                    text: "OUR TOTAL LIABILITY FOR ALL CLAIMS RELATED TO THE SERVICE SHALL NOT EXCEED THE AMOUNT PAID BY YOU IN THE 12 MONTHS PRECEDING THE CLAIM."
                },
                {
                    text: "Some jurisdictions do not allow limitation of liability, so these limitations may not apply to you."
                }
            ]
        },
        {
            id: "indemnification",
            title: "Indemnification",
            content: [
                {
                    text: "You agree to indemnify, defend, and hold harmless Teama AI and its officers, directors, employees, and agents from any claims, damages, losses, liabilities, and expenses (including legal fees) arising from:",
                    list: [
                        "Your use or misuse of the Service",
                        "Violation of these Terms or applicable laws",
                        "Infringement of third-party rights",
                        "Content or data you provide to the Service",
                        "Actions of users accessing the Service through your account"
                    ]
                }
            ]
        },
        {
            id: "third-party",
            title: "Third-Party Services",
            content: [
                {
                    text: "The Service integrates with third-party platforms (Slack, Jira, Asana, Trello, Google). Use of these integrations is subject to their respective terms of service. We are not responsible for third-party services, their availability, or their data practices."
                },
                {
                    text: "You are responsible for maintaining valid credentials and permissions for integrated services. We are not liable for issues arising from third-party service changes or interruptions."
                }
            ]
        },
        {
            id: "termination",
            title: "Termination",
            content: [
                {
                    subtitle: "Termination by You",
                    text: "You may terminate your account at any time through account settings. Termination is effective immediately, but you retain access until the end of your billing period."
                },
                {
                    subtitle: "Termination by Us",
                    text: "We may terminate or suspend your account immediately if you:",
                    list: [
                        "Violate these Terms or our policies",
                        "Fail to pay fees when due",
                        "Engage in fraudulent or illegal activity",
                        "Pose a security risk to the Service or other users"
                    ]
                },
                {
                    subtitle: "Effect of Termination",
                    text: "Upon termination: (a) your right to use the Service ceases immediately, (b) we will delete or anonymize your data within 90 days (unless retention is required by law), and (c) you remain liable for any accrued fees or obligations."
                }
            ]
        },
        {
            id: "dispute-resolution",
            title: "Dispute Resolution",
            icon: <Scale className="w-6 h-6" />,
            content: [
                {
                    subtitle: "Informal Resolution",
                    text: "Before filing any legal claim, you agree to contact us at legal@teama.ai to resolve the dispute informally. We commit to good-faith efforts to resolve disputes within 60 days."
                },
                {
                    subtitle: "Arbitration",
                    text: "If informal resolution fails, disputes will be resolved through binding arbitration under the American Arbitration Association rules, rather than in court. Arbitration will be conducted individually, not as a class action."
                },
                {
                    subtitle: "Exceptions",
                    text: "Either party may seek injunctive relief in court for intellectual property disputes or violations of confidentiality obligations."
                },
                {
                    subtitle: "Governing Law",
                    text: "These Terms are governed by the laws of the State of California, USA, without regard to conflict of law principles."
                }
            ]
        },
        {
            id: "general",
            title: "General Provisions",
            content: [
                {
                    subtitle: "Entire Agreement",
                    text: "These Terms, together with our Privacy Policy and any additional agreements, constitute the entire agreement between you and Teama AI regarding the Service."
                },
                {
                    subtitle: "Severability",
                    text: "If any provision is found unenforceable, the remaining provisions will remain in full effect."
                },
                {
                    subtitle: "Waiver",
                    text: "Failure to enforce any provision does not constitute a waiver of that provision or any other provision."
                },
                {
                    subtitle: "Assignment",
                    text: "You may not assign these Terms without our written consent. We may assign these Terms to any successor or affiliate."
                },
                {
                    subtitle: "Force Majeure",
                    text: "We are not liable for failures or delays caused by circumstances beyond our reasonable control, including natural disasters, wars, pandemics, or infrastructure failures."
                },
                {
                    subtitle: "Export Compliance",
                    text: "You agree to comply with all applicable export and import laws. You represent that you are not located in a country subject to U.S. embargo or on any U.S. prohibited party list."
                }
            ]
        }
    ];

    const quickLinks = [
        { label: "Acceptance of Terms", href: "#acceptance" },
        { label: "Acceptable Use", href: "#acceptable-use" },
        { label: "Payment & Billing", href: "#payment" },
        { label: "Warranties", href: "#warranties" },
        { label: "Limitation of Liability", href: "#limitation-of-liability" },
        { label: "Dispute Resolution", href: "#dispute-resolution" }
    ];

    return (
        <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
            {/* Hero Section */}
            <div className="bg-gradient-to-br from-purple-600 via-blue-600 to-purple-700 text-white">
                <div className="max-w-6xl mx-auto px-8 py-20">
                    <div className="max-w-3xl">
                        <div className="flex items-center gap-2 text-purple-200 mb-4">
                            <FileText size={24} />
                            <span className="font-medium">Terms of Service</span>
                        </div>
                        <h1 className="text-5xl font-bold mb-6 leading-tight">
                            Terms of Service
                        </h1>
                        <p className="text-xl text-purple-100 mb-4">
                            Please read these terms carefully before using Teama AI. By using our service, you agree to these terms.
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
                                <h3 className="font-bold text-slate-900 mb-2">Questions?</h3>
                                <p className="text-sm text-slate-600 mb-4">
                                    Contact our legal team
                                </p>
                                <a
                                    href="mailto:legal@teama.ai"
                                    className="text-purple-600 font-semibold hover:text-purple-700 text-sm"
                                >
                                    legal@teama.ai →
                                </a>
                            </div>

                            {/* Key Terms */}
                            <div className="bg-slate-50 border border-slate-100 rounded-2xl p-6">
                                <h3 className="font-bold text-slate-900 mb-4">Key Terms</h3>
                                <ul className="space-y-3 text-sm text-slate-600">
                                    <li className="flex items-start gap-2">
                                        <span className="text-blue-600 mt-1">•</span>
                                        <span>Refund terms are covered by our refund policy</span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <span className="text-blue-600 mt-1">•</span>
                                        <span>Cancel anytime, no long-term contracts</span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <span className="text-blue-600 mt-1">•</span>
                                        <span>You own your data</span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <span className="text-blue-600 mt-1">•</span>
                                        <span>Binding arbitration for disputes</span>
                                    </li>
                                </ul>
                            </div>

                            {/* Important Notice */}
                            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6">
                                <div className="flex items-start gap-2 mb-2">
                                    <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                                    <h3 className="font-bold text-slate-900">Important</h3>
                                </div>
                                <p className="text-sm text-slate-600">
                                    These terms include limitations of liability and dispute resolution provisions that may affect your rights.
                                </p>
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
                                                <ul className="space-y-2 ml-6 list-disc">
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
                            <h2 className="text-2xl font-bold text-slate-900 mb-4">Contact Us About These Terms</h2>
                            <p className="text-slate-600 mb-6 leading-relaxed">
                                If you have questions about these Terms of Service, please contact us:
                            </p>
                            <div className="space-y-2 text-slate-700">
                                <p className="font-medium">Email: <a href="mailto:legal@teama.ai" className="text-purple-600 hover:underline">legal@teama.ai</a></p>
                                <p className="font-medium">Mail: Teama AI, Inc. - Legal Department</p>
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

export default Terms;
