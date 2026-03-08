import React from 'react';
import { Link } from 'react-router-dom';
import { Twitter, Linkedin, Github, Mail } from 'lucide-react';

const Footer = () => {
    const currentYear = new Date().getFullYear();

    const footerLinks = {
        product: [
            { label: 'Features', to: '/features' },
            { label: 'Integrations', to: '/app/integrations' },
            { label: 'Pricing', to: '/pricing' },
            { label: 'Security', to: '/security' }
        ],
        company: [
            { label: 'About', to: '/about' },
            { label: 'Careers', to: '/careers' },
            { label: 'Contact', to: '/contact' }
        ],
        resources: [
            { label: 'Documentation', to: '/docs' },
            { label: 'Help Center', to: '/help' },
            { label: 'API Reference', to: '/api' },
            { label: 'Changelog', to: '/changelog' }
        ],
        legal: [
            { label: 'Privacy Policy', to: '/privacy' },
            { label: 'Terms of Service', to: '/terms' },
            { label: 'Cookie Policy', to: '/cookies' },
            { label: 'GDPR', to: '/gdpr' }
        ]
    };

    const socialLinks = [
        { icon: <Twitter size={20} />, href: 'https://twitter.com/teamaai', label: 'Twitter' },
        { icon: <Linkedin size={20} />, href: 'https://linkedin.com/company/teamaai', label: 'LinkedIn' },
        { icon: <Github size={20} />, href: 'https://github.com/teamaai', label: 'GitHub' },
        { icon: <Mail size={20} />, href: 'mailto:hello@teama.ai', label: 'Email' }
    ];

    return (
        <footer className="bg-slate-900 text-white">
            <div className="max-w-6xl mx-auto px-8 py-16">
                {/* Main Footer Content */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-8 mb-12">
                    {/* Brand Column */}
                    <div className="col-span-2 md:col-span-1">
                        <div className="flex items-center gap-2 mb-4">
                            <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-blue-500 rounded-lg"></div>
                            <span className="font-bold text-xl">Teama AI</span>
                        </div>
                        <p className="text-slate-400 text-sm mb-6">
                            AI-powered productivity for modern teams
                        </p>
                        <div className="flex gap-3">
                            {socialLinks.map((social, index) => (
                                <a
                                    key={index}
                                    href={social.href}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="w-10 h-10 bg-slate-800 hover:bg-slate-700 rounded-lg flex items-center justify-center transition-colors"
                                    aria-label={social.label}
                                >
                                    {social.icon}
                                </a>
                            ))}
                        </div>
                    </div>

                    {/* Product Links */}
                    <div>
                        <h4 className="font-semibold mb-4">Product</h4>
                        <ul className="space-y-3">
                            {footerLinks.product.map((link, index) => (
                                <li key={index}>
                                    <Link
                                        to={link.to}
                                        className="text-slate-400 hover:text-white text-sm transition-colors"
                                    >
                                        {link.label}
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* Company Links */}
                    <div>
                        <h4 className="font-semibold mb-4">Company</h4>
                        <ul className="space-y-3">
                            {footerLinks.company.map((link, index) => (
                                <li key={index}>
                                    <Link
                                        to={link.to}
                                        className="text-slate-400 hover:text-white text-sm transition-colors"
                                    >
                                        {link.label}
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* Resources Links */}
                    <div>
                        <h4 className="font-semibold mb-4">Resources</h4>
                        <ul className="space-y-3">
                            {footerLinks.resources.map((link, index) => (
                                <li key={index}>
                                    <Link
                                        to={link.to}
                                        className="text-slate-400 hover:text-white text-sm transition-colors"
                                    >
                                        {link.label}
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* Legal Links */}
                    <div>
                        <h4 className="font-semibold mb-4">Legal</h4>
                        <ul className="space-y-3">
                            {footerLinks.legal.map((link, index) => (
                                <li key={index}>
                                    <Link
                                        to={link.to}
                                        className="text-slate-400 hover:text-white text-sm transition-colors"
                                    >
                                        {link.label}
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>

                {/* Newsletter Signup */}
                <div className="border-t border-slate-800 pt-8 mb-8">
                    <div className="max-w-md">
                        <h4 className="font-semibold mb-2">Stay updated</h4>
                        <p className="text-slate-400 text-sm mb-4">
                            Get the latest product updates and productivity tips
                        </p>
                        <form className="flex gap-2">
                            <input
                                type="email"
                                placeholder="your@email.com"
                                className="flex-1 px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
                            />
                            <button
                                type="submit"
                                className="px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-600 rounded-lg font-medium text-sm hover:shadow-lg transition-shadow whitespace-nowrap"
                            >
                                Subscribe
                            </button>
                        </form>
                    </div>
                </div>

                {/* Bottom Bar */}
                <div className="border-t border-slate-800 pt-8">
                    <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                        <p className="text-slate-400 text-sm">
                            © {currentYear} Teama AI, Inc. All rights reserved.
                        </p>
                        <div className="flex items-center gap-6 text-sm">
                            <a href="#" className="text-slate-400 hover:text-white transition-colors">
                                Status
                            </a>
                            <a href="#" className="text-slate-400 hover:text-white transition-colors">
                                Changelog
                            </a>
                            <a href="#" className="text-slate-400 hover:text-white transition-colors">
                                System Status
                            </a>
                        </div>
                    </div>
                </div>
            </div>
        </footer>
    );
};

export default Footer;