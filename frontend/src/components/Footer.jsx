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
            { label: 'Contact', to: '/contact' },
            { label: 'Careers', to: '/careers' },
            { label: 'Blog', to: '/blog' }
        ],
        resources: [
            { label: 'Documentation', to: '/docs' },
            { label: 'Help Center', to: '/help' },
            { label: 'API Reference', to: '/api' },
            { label: 'Status', to: '/status' }
        ],
        legal: [
            { label: 'Privacy Policy', to: '/privacy' },
            { label: 'Terms of Service', to: '/terms' },
            { label: 'Refund Policy', to: '/refund-policy' },
            { label: 'Cookie Policy', to: '/cookies' }
        ]
    };

    const socialLinks = [
        { icon: <Twitter size={20} />, href: 'https://twitter.com/teamaai', label: 'Twitter' },
        { icon: <Linkedin size={20} />, href: 'https://linkedin.com/company/teamaai', label: 'LinkedIn' },
        { icon: <Github size={20} />, href: 'https://github.com/teamaai', label: 'GitHub' },
        { icon: <Mail size={20} />, href: 'mailto:team@mail.teamaai.xyz', label: 'Email' }
    ];

    return (
        <footer className="bg-black text-white border-t border-white/10">
            <div className="max-w-7xl mx-auto px-6 md:px-8 py-16">
                {/* Main Footer Content */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-8 mb-12">
                    {/* Brand Column */}
                    <div className="col-span-2 md:col-span-1">
                        <Link to="/" className="inline-flex items-center gap-2 mb-6 group">
                            <img src="/logo.png" alt="Teama AI Logo" className="w-8 h-8 object-contain" />
                            <span className="font-bold text-lg tracking-tight group-hover:text-gray-300 transition-colors">Teama AI</span>
                        </Link>
                        <p className="text-gray-300 text-sm font-medium mb-6 leading-relaxed">
                            AI-powered productivity for modern teams
                        </p>
                        <div className="flex gap-3">
                            {socialLinks.map((social, index) => (
                                <a
                                    key={index}
                                    href={social.href}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="w-10 h-10 bg-white/10 hover:bg-white/20 rounded-lg flex items-center justify-center transition-colors border border-white/20 hover:border-white/30 text-gray-300 hover:text-white"
                                    aria-label={social.label}
                                    title={social.label}
                                >
                                    {social.icon}
                                </a>
                            ))}
                        </div>
                    </div>

                    {/* Product Links */}
                    <div>
                        <h3 className="font-bold text-sm uppercase tracking-widest mb-4 text-white">Product</h3>
                        <ul className="space-y-3">
                            {footerLinks.product.map((link, index) => (
                                <li key={index}>
                                    <Link
                                        to={link.to}
                                        className="text-gray-300 hover:text-white text-sm transition-colors font-medium"
                                    >
                                        {link.label}
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* Company Links */}
                    <div>
                        <h3 className="font-bold text-sm uppercase tracking-widest mb-4 text-white">Company</h3>
                        <ul className="space-y-3">
                            {footerLinks.company.map((link, index) => (
                                <li key={index}>
                                    <Link
                                        to={link.to}
                                        className="text-gray-300 hover:text-white text-sm transition-colors font-medium"
                                    >
                                        {link.label}
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* Resources Links */}
                    <div>
                        <h3 className="font-bold text-sm uppercase tracking-widest mb-4 text-white">Resources</h3>
                        <ul className="space-y-3">
                            {footerLinks.resources.map((link, index) => (
                                <li key={index}>
                                    <Link
                                        to={link.to}
                                        className="text-gray-300 hover:text-white text-sm transition-colors font-medium"
                                    >
                                        {link.label}
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* Legal Links */}
                    <div>
                        <h3 className="font-bold text-sm uppercase tracking-widest mb-4 text-white">Legal</h3>
                        <ul className="space-y-3">
                            {footerLinks.legal.map((link, index) => (
                                <li key={index}>
                                    <Link
                                        to={link.to}
                                        className="text-gray-300 hover:text-white text-sm transition-colors font-medium"
                                    >
                                        {link.label}
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>

                {/* Newsletter Signup */}
                <div className="border-t border-white/10 pt-8 mb-8">
                    <div className="max-w-md">
                        <h3 className="font-bold text-sm uppercase tracking-widest mb-2 text-white">Stay Updated</h3>
                        <p className="text-gray-300 text-sm font-medium mb-4">
                            Get the latest product updates and productivity tips.
                        </p>
                        <form className="flex gap-2">
                            <input
                                type="email"
                                placeholder="your@email.com"
                                className="flex-1 px-4 py-2.5 bg-white/5 border border-white/20 hover:border-white/30 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-white/40 focus:border-white/40 transition-all font-medium"
                            />
                            <button
                                type="submit"
                                className="px-6 py-2.5 bg-white text-black rounded-lg font-bold text-sm uppercase tracking-widest hover:bg-gray-100 transition-colors whitespace-nowrap"
                            >
                                Subscribe
                            </button>
                        </form>
                    </div>
                </div>

                {/* Bottom Bar */}
                <div className="border-t border-white/10 pt-8">
                    <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                        <p className="text-gray-400 text-xs font-medium uppercase tracking-widest">
                            © {currentYear} Teama AI, Inc. All rights reserved.
                        </p>
                        <div className="flex items-center gap-6 text-xs">
                            <Link to="/status" className="text-gray-300 hover:text-white transition-colors font-medium uppercase tracking-widest">
                                System Status
                            </Link>
                            <span className="text-white/20">|</span>
                            <Link to="/security" className="text-gray-300 hover:text-white transition-colors font-medium uppercase tracking-widest">
                                Security
                            </Link>
                            <span className="text-white/20">|</span>
                            <a href="mailto:support@teamaai.xyz" className="text-gray-300 hover:text-white transition-colors font-medium uppercase tracking-widest">
                                Support
                            </a>
                        </div>
                    </div>
                </div>
            </div>
        </footer>
    );
};

export default Footer;