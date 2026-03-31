import React from 'react';
import { Shield, Lock, Eye, Server, Key, AlertTriangle, Award, FileCheck } from 'lucide-react';
import SEO from '../../components/common/SEO';

const Security = () => {
    const certifications = [
        {
            icon: <Award className="w-8 h-8" />,
            title: "SOC 2 Type II",
            description: "Independently audited and certified for security, availability, and confidentiality",
            status: "Certified"
        },
        {
            icon: <Shield className="w-8 h-8" />,
            title: "GDPR Compliant",
            description: "Fully compliant with EU data protection regulations",
            status: "Compliant"
        },
        {
            icon: <FileCheck className="w-8 h-8" />,
            title: "ISO 27001",
            description: "Information security management system certification in progress",
            status: "In Progress"
        },
        {
            icon: <Lock className="w-8 h-8" />,
            title: "CCPA Compliant",
            description: "Adheres to California Consumer Privacy Act requirements",
            status: "Compliant"
        }
    ];

    const securityFeatures = [
        {
            id: "encryption",
            title: "Enterprise-Grade Encryption",
            icon: <Lock className="w-6 h-6" />,
            features: [
                {
                    name: "Data in Transit",
                    description: "All data transmitted between your browser and our servers is protected with TLS 1.3 encryption (256-bit). We enforce HTTPS across all connections and use HSTS to prevent downgrade attacks."
                },
                {
                    name: "Data at Rest",
                    description: "All stored data is encrypted using AES-256 encryption. Encryption keys are managed using industry-standard key management systems with regular rotation policies."
                },
                {
                    name: "End-to-End Protection",
                    description: "Your workspace data remains encrypted throughout our entire infrastructure, from ingestion through processing to storage and delivery."
                }
            ]
        },
        {
            id: "infrastructure",
            title: "Secure Infrastructure",
            icon: <Server className="w-6 h-6" />,
            features: [
                {
                    name: "Cloud Infrastructure",
                    description: "We host on AWS and Google Cloud Platform, leveraging their world-class security infrastructure, with data centers certified for ISO 27001, SOC 1/2/3, and PCI DSS compliance."
                },
                {
                    name: "Network Security",
                    description: "Multi-layer firewall protection, DDoS mitigation, intrusion detection and prevention systems (IDS/IPS), and regular penetration testing by third-party security firms."
                },
                {
                    name: "Data Redundancy",
                    description: "Automated daily backups with geographic redundancy. Point-in-time recovery available. Disaster recovery tested quarterly with RTO < 4 hours, RPO < 1 hour."
                },
                {
                    name: "Infrastructure as Code",
                    description: "All infrastructure provisioned and managed through code with automated security scanning and compliance checks before deployment."
                }
            ]
        },
        {
            id: "access-control",
            title: "Access Control & Authentication",
            icon: <Key className="w-6 h-6" />,
            features: [
                {
                    name: "Multi-Factor Authentication (MFA)",
                    description: "Require 2FA for all accounts. Support for authenticator apps (TOTP), SMS, and hardware security keys (WebAuthn/FIDO2)."
                },
                {
                    name: "Single Sign-On (SSO)",
                    description: "Enterprise SSO support via SAML 2.0 and OAuth 2.0, including Okta, Azure AD, Google Workspace, and OneLogin."
                },
                {
                    name: "Role-Based Access Control (RBAC)",
                    description: "Granular permission system with predefined roles (Owner, Admin, Member) and custom role creation for enterprise plans."
                },
                {
                    name: "Session Management",
                    description: "Automatic session timeout after 30 days of inactivity. Ability to remotely revoke sessions. Concurrent session limits configurable per plan."
                },
                {
                    name: "IP Whitelisting",
                    description: "Enterprise customers can restrict access to specific IP ranges or VPN gateways."
                }
            ]
        },
        {
            id: "monitoring",
            title: "Monitoring & Detection",
            icon: <Eye className="w-6 h-6" />,
            features: [
                {
                    name: "24/7 Security Operations Center",
                    description: "Real-time monitoring of all systems for security events, anomalies, and potential threats. Automated alerting and incident response procedures."
                },
                {
                    name: "Intrusion Detection",
                    description: "Advanced threat detection using machine learning to identify suspicious patterns, unauthorized access attempts, and anomalous behavior."
                },
                {
                    name: "Audit Logging",
                    description: "Comprehensive audit trails for all user actions, API calls, and administrative changes. Logs retained for 1 year and available for export."
                },
                {
                    name: "Vulnerability Management",
                    description: "Continuous vulnerability scanning of all systems. Critical vulnerabilities patched within 24 hours. Regular third-party penetration testing."
                }
            ]
        },
        {
            id: "application-security",
            title: "Application Security",
            icon: <Shield className="w-6 h-6" />,
            features: [
                {
                    name: "Secure Development",
                    description: "Security-first development practices including secure coding standards, automated security testing in CI/CD pipeline, and mandatory code reviews."
                },
                {
                    name: "Dependency Management",
                    description: "Automated scanning of all dependencies for known vulnerabilities. Immediate updates for critical security patches."
                },
                {
                    name: "API Security",
                    description: "Rate limiting, request validation, OAuth 2.0 authentication, and API key rotation. All API endpoints protected by authentication and authorization."
                },
                {
                    name: "Data Validation",
                    description: "Input validation and sanitization on all user inputs. Protection against SQL injection, XSS, CSRF, and other common vulnerabilities."
                }
            ]
        },
        {
            id: "incident-response",
            title: "Incident Response",
            icon: <AlertTriangle className="w-6 h-6" />,
            features: [
                {
                    name: "Incident Response Plan",
                    description: "Documented and tested incident response procedures. Dedicated security incident response team available 24/7."
                },
                {
                    name: "Breach Notification",
                    description: "If a security incident occurs, we will notify affected customers within 72 hours and provide detailed information about the incident and remediation steps."
                },
                {
                    name: "Forensic Analysis",
                    description: "Comprehensive forensic investigation of security incidents to identify root cause, impact, and prevent recurrence."
                },
                {
                    name: "Bug Bounty Program",
                    description: "Active bug bounty program rewarding security researchers for responsibly disclosing vulnerabilities."
                }
            ]
        }
    ];

    const complianceItems = [
        {
            title: "Data Residency",
            description: "Choose where your data is stored (US, EU, or Asia-Pacific). Data never leaves your selected region."
        },
        {
            title: "Data Processing Agreement",
            description: "DPA available for enterprise customers, including Standard Contractual Clauses for EU data transfers."
        },
        {
            title: "Right to Audit",
            description: "Enterprise customers can request security audit reports and conduct their own audits with proper notice."
        },
        {
            title: "Data Retention",
            description: "Configurable data retention policies. Data deleted within 30 days of account termination unless retention is required by law."
        }
    ];

    const bestPractices = [
        "Enable multi-factor authentication (MFA) for all team members",
        "Use strong, unique passwords and consider a password manager",
        "Review team member access regularly and remove inactive users",
        "Enable SSO if your organization supports it",
        "Restrict access by IP address for sensitive environments",
        "Monitor audit logs for suspicious activity",
        "Review connected integrations and revoke unused ones",
        "Keep integration permissions minimal (principle of least privilege)",
        "Report security concerns immediately to team@mail.teamaai.xyz"
    ];

    return (
        <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
            <SEO 
                title="Security & Compliance" 
                description="Learn about the enterprise-grade security measures and compliance certifications at Teama AI."
            />
            {/* Hero Section */}
            <div className="bg-gradient-to-br from-purple-600 via-blue-600 to-purple-700 text-white">
                <div className="max-w-6xl mx-auto px-8 py-20">
                    <div className="max-w-3xl">
                        <div className="flex items-center gap-2 text-purple-200 mb-4">
                            <Shield size={24} />
                            <span className="font-medium">Security & Compliance</span>
                        </div>
                        <h1 className="text-5xl font-bold mb-6 leading-tight">
                            Enterprise-grade security you can trust
                        </h1>
                        <p className="text-xl text-purple-100">
                            Your data security is our top priority. We maintain the highest standards to protect your team's information.
                        </p>
                    </div>
                </div>
            </div>

            {/* Certifications */}
            <div className="max-w-6xl mx-auto px-8 -mt-12">
                <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {certifications.map((cert, index) => (
                        <div key={index} className="bg-white rounded-2xl shadow-lg p-6 border border-slate-100">
                            <div className="w-16 h-16 bg-gradient-to-br from-purple-100 to-blue-100 rounded-xl flex items-center justify-center text-purple-600 mb-4">
                                {cert.icon}
                            </div>
                            <h3 className="font-bold text-slate-900 mb-2">{cert.title}</h3>
                            <p className="text-sm text-slate-600 mb-3">{cert.description}</p>
                            <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${cert.status === 'Certified' || cert.status === 'Compliant'
                                ? 'bg-green-100 text-green-700'
                                : 'bg-blue-100 text-blue-700'
                                }`}>
                                {cert.status}
                            </span>
                        </div>
                    ))}
                </div>
            </div>

            {/* Security Features */}
            <div className="max-w-6xl mx-auto px-8 py-24">
                <div className="text-center mb-16">
                    <h2 className="text-3xl font-bold text-slate-900 mb-4">Comprehensive Security Measures</h2>
                    <p className="text-xl text-slate-600 max-w-3xl mx-auto">
                        Multiple layers of protection to keep your data safe at every step
                    </p>
                </div>

                <div className="space-y-16">
                    {securityFeatures.map((category, index) => (
                        <section key={index} id={category.id} className="scroll-mt-8">
                            <div className="flex items-center gap-3 mb-8">
                                <div className="w-12 h-12 bg-gradient-to-br from-purple-100 to-blue-100 rounded-xl flex items-center justify-center text-purple-600">
                                    {category.icon}
                                </div>
                                <h3 className="text-2xl font-bold text-slate-900">{category.title}</h3>
                            </div>
                            <div className="grid md:grid-cols-2 gap-6">
                                {category.features.map((feature, idx) => (
                                    <div key={idx} className="bg-white rounded-xl border border-slate-100 p-6 hover:shadow-lg transition-shadow">
                                        <h4 className="font-semibold text-slate-900 mb-3">{feature.name}</h4>
                                        <p className="text-sm text-slate-600 leading-relaxed">{feature.description}</p>
                                    </div>
                                ))}
                            </div>
                        </section>
                    ))}
                </div>
            </div>

            {/* Compliance Section */}
            <div className="bg-slate-50 py-24">
                <div className="max-w-6xl mx-auto px-8">
                    <div className="text-center mb-12">
                        <h2 className="text-3xl font-bold text-slate-900 mb-4">Compliance & Governance</h2>
                        <p className="text-xl text-slate-600 max-w-3xl mx-auto">
                            We meet the strictest regulatory requirements
                        </p>
                    </div>
                    <div className="grid md:grid-cols-2 gap-6">
                        {complianceItems.map((item, index) => (
                            <div key={index} className="bg-white rounded-xl border border-slate-100 p-6">
                                <h3 className="font-bold text-slate-900 mb-3">{item.title}</h3>
                                <p className="text-slate-600 text-sm leading-relaxed">{item.description}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Best Practices */}
            <div className="max-w-6xl mx-auto px-8 py-24">
                <div className="grid lg:grid-cols-2 gap-12 items-start">
                    <div>
                        <h2 className="text-3xl font-bold text-slate-900 mb-6">Security Best Practices</h2>
                        <p className="text-slate-600 mb-8 leading-relaxed">
                            While we maintain robust security measures, your security is a shared responsibility.
                            Follow these best practices to protect your team's data:
                        </p>
                        <ul className="space-y-3">
                            {bestPractices.map((practice, index) => (
                                <li key={index} className="flex items-start gap-3">
                                    <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                                        <span className="text-green-600 text-sm">✓</span>
                                    </div>
                                    <span className="text-slate-700">{practice}</span>
                                </li>
                            ))}
                        </ul>
                    </div>

                    <div className="space-y-6">
                        {/* Vulnerability Reporting */}
                        <div className="bg-gradient-to-br from-purple-50 to-blue-50 border border-purple-100 rounded-2xl p-8">
                            <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center text-purple-600 mb-4">
                                <AlertTriangle size={24} />
                            </div>
                            <h3 className="text-xl font-bold text-slate-900 mb-3">Report a Vulnerability</h3>
                            <p className="text-slate-600 mb-4 text-sm leading-relaxed">
                                Found a security issue? We appreciate responsible disclosure and participate in a bug bounty program.
                            </p>
                            <a
                                href="mailto:team@mail.teamaai.xyz"
                                className="text-purple-600 font-semibold hover:text-purple-700"
                            >
                                team@mail.teamaai.xyz →
                            </a>
                        </div>

                        {/* Security Docs */}
                        <div className="bg-white border border-slate-100 rounded-2xl p-8">
                            <h3 className="text-xl font-bold text-slate-900 mb-3">Security Documentation</h3>
                            <p className="text-slate-600 mb-6 text-sm">
                                Download detailed security documentation for your compliance team:
                            </p>
                            <div className="space-y-3">
                                <a href="#" className="block text-purple-600 hover:text-purple-700 font-medium text-sm">
                                    → SOC 2 Type II Report
                                </a>
                                <a href="#" className="block text-purple-600 hover:text-purple-700 font-medium text-sm">
                                    → Penetration Test Summary
                                </a>
                                <a href="#" className="block text-purple-600 hover:text-purple-700 font-medium text-sm">
                                    → Security White Paper
                                </a>
                                <a href="#" className="block text-purple-600 hover:text-purple-700 font-medium text-sm">
                                    → Data Processing Agreement
                                </a>
                            </div>
                        </div>

                        {/* Contact Security Team */}
                        <div className="bg-slate-50 border border-slate-100 rounded-2xl p-8">
                            <h3 className="text-xl font-bold text-slate-900 mb-3">Contact Security Team</h3>
                            <p className="text-slate-600 mb-4 text-sm">
                                Have questions about our security practices?
                            </p>
                            <div className="space-y-2 text-sm text-slate-700">
                                <p>Email: <a href="mailto:team@mail.teamaai.xyz" className="text-purple-600 hover:underline">team@mail.teamaai.xyz</a></p>
                                <p>Response time: Within 24 hours</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* CTA Section */}
            <div className="bg-gradient-to-br from-purple-600 to-blue-600 text-white">
                <div className="max-w-4xl mx-auto px-8 py-16 text-center">
                    <h2 className="text-3xl font-bold mb-4">Questions about security?</h2>
                    <p className="text-xl text-purple-100 mb-8">
                        Our security team is here to help with any questions or concerns
                    </p>
                    <div className="flex flex-col sm:flex-row gap-4 justify-center">
                        <a
                            href="/contact"
                            className="bg-white text-purple-600 px-8 py-3 rounded-lg font-semibold hover:shadow-xl transition-shadow"
                        >
                            Contact Security Team
                        </a>
                        <a
                            href="#"
                            className="bg-purple-500/30 backdrop-blur-sm border-2 border-white/20 text-white px-8 py-3 rounded-lg font-semibold hover:bg-purple-500/50 transition-colors"
                        >
                            Download Security Docs
                        </a>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Security;