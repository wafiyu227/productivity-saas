import React, { useState } from 'react';
import { Mail, MessageSquare, Phone, MapPin, Send, CheckCircle, Clock, HelpCircle } from 'lucide-react';

const Contact = () => {
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        company: '',
        subject: '',
        message: ''
    });
    const [submitted, setSubmitted] = useState(false);
    const [sending, setSending] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSending(true);

        // Simulate API call
        await new Promise(resolve => setTimeout(resolve, 1500));

        setSubmitted(true);
        setSending(false);
        setFormData({ name: '', email: '', company: '', subject: '', message: '' });

        setTimeout(() => setSubmitted(false), 5000);
    };

    const handleChange = (e) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value
        });
    };

    const contactMethods = [
        {
            icon: <Mail className="w-6 h-6" />,
            title: "Email Us",
            description: "Our team typically responds within 24 hours",
            contact: "hello@teama.ai",
            link: "mailto:hello@teama.ai"
        },
        {
            icon: <MessageSquare className="w-6 h-6" />,
            title: "Live Chat",
            description: "Chat with our support team in real-time",
            contact: "Available 9am-6pm EST",
            link: "#",
            action: "Start Chat"
        },
        {
            icon: <Phone className="w-6 h-6" />,
            title: "Schedule a Call",
            description: "Book a 30-minute demo with our team",
            contact: "calendly.com/teama",
            link: "#",
            action: "Book Demo"
        }
    ];

    const faqs = [
        {
            question: "How quickly can we get started?",
            answer: "Most teams are up and running in under 10 minutes. Just connect your tools and start getting insights."
        },
        {
            question: "Do you offer custom enterprise plans?",
            answer: "Yes! We work with teams of all sizes. Contact us to discuss custom pricing and features for your organization."
        },
        {
            question: "Is my data secure?",
            answer: "Absolutely. We're SOC 2 Type II certified and use enterprise-grade encryption. Your data is never used to train our models."
        },
        {
            question: "Can I cancel anytime?",
            answer: "Yes, you can cancel your subscription at any time. No long-term contracts or cancellation fees."
        }
    ];

    const offices = [
        {
            city: "San Francisco",
            address: "123 Market Street, Suite 400",
            region: "CA 94103",
            primary: true
        },
        {
            city: "New York",
            address: "456 Broadway, Floor 12",
            region: "NY 10013",
            primary: false
        }
    ];

    return (
        <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
            {/* Hero Section */}
            <div className="bg-gradient-to-br from-purple-600 via-blue-600 to-purple-700 text-white">
                <div className="max-w-6xl mx-auto px-8 py-20">
                    <div className="max-w-3xl">
                        <h1 className="text-5xl font-bold mb-6 leading-tight">
                            Let's talk about your team
                        </h1>
                        <p className="text-xl text-purple-100">
                            Whether you have questions, need a demo, or want to explore how Teama AI can help your team—we're here to help.
                        </p>
                    </div>
                </div>
            </div>

            {/* Contact Methods */}
            <div className="max-w-6xl mx-auto px-8 -mt-12">
                <div className="grid md:grid-cols-3 gap-6">
                    {contactMethods.map((method, index) => (
                        <div key={index} className="bg-white rounded-2xl shadow-lg p-8 border border-slate-100 hover:shadow-xl transition-shadow">
                            <div className="w-12 h-12 bg-gradient-to-br from-purple-100 to-blue-100 rounded-xl flex items-center justify-center text-purple-600 mb-4">
                                {method.icon}
                            </div>
                            <h3 className="text-xl font-bold text-slate-900 mb-2">{method.title}</h3>
                            <p className="text-slate-600 text-sm mb-4">{method.description}</p>
                            {method.action ? (
                                <button className="text-purple-600 font-semibold hover:text-purple-700 transition-colors">
                                    {method.action} →
                                </button>
                            ) : (
                                <a
                                    href={method.link}
                                    className="text-purple-600 font-semibold hover:text-purple-700 transition-colors break-all"
                                >
                                    {method.contact}
                                </a>
                            )}
                        </div>
                    ))}
                </div>
            </div>

            {/* Main Content: Form + Info */}
            <div className="max-w-6xl mx-auto px-8 py-24">
                <div className="grid lg:grid-cols-3 gap-12">
                    {/* Contact Form */}
                    <div className="lg:col-span-2">
                        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-8">
                            <h2 className="text-2xl font-bold text-slate-900 mb-2">Send us a message</h2>
                            <p className="text-slate-600 mb-8">
                                Fill out the form below and we'll get back to you as soon as possible
                            </p>

                            {submitted ? (
                                <div className="bg-green-50 border border-green-200 rounded-xl p-8 text-center">
                                    <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                        <CheckCircle className="w-8 h-8 text-green-600" />
                                    </div>
                                    <h3 className="text-xl font-bold text-green-900 mb-2">Message Sent!</h3>
                                    <p className="text-green-700">
                                        Thanks for reaching out. We'll respond within 24 hours.
                                    </p>
                                </div>
                            ) : (
                                <form onSubmit={handleSubmit} className="space-y-6">
                                    <div className="grid md:grid-cols-2 gap-6">
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 mb-2">
                                                Full Name *
                                            </label>
                                            <input
                                                type="text"
                                                name="name"
                                                value={formData.name}
                                                onChange={handleChange}
                                                required
                                                className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
                                                placeholder="John Doe"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 mb-2">
                                                Work Email *
                                            </label>
                                            <input
                                                type="email"
                                                name="email"
                                                value={formData.email}
                                                onChange={handleChange}
                                                required
                                                className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
                                                placeholder="john@company.com"
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-2">
                                            Company
                                        </label>
                                        <input
                                            type="text"
                                            name="company"
                                            value={formData.company}
                                            onChange={handleChange}
                                            className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
                                            placeholder="Acme Inc"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-2">
                                            Subject *
                                        </label>
                                        <select
                                            name="subject"
                                            value={formData.subject}
                                            onChange={handleChange}
                                            required
                                            className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
                                        >
                                            <option value="">Select a topic...</option>
                                            <option value="demo">Request a Demo</option>
                                            <option value="sales">Sales Inquiry</option>
                                            <option value="support">Technical Support</option>
                                            <option value="partnership">Partnership Opportunity</option>
                                            <option value="other">Other</option>
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-2">
                                            Message *
                                        </label>
                                        <textarea
                                            name="message"
                                            value={formData.message}
                                            onChange={handleChange}
                                            required
                                            rows={6}
                                            className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none resize-none"
                                            placeholder="Tell us more about what you're looking for..."
                                        />
                                    </div>

                                    <button
                                        type="submit"
                                        disabled={sending}
                                        className="w-full bg-gradient-to-r from-purple-600 to-blue-600 text-white py-3 rounded-lg font-semibold hover:shadow-lg transition-shadow disabled:opacity-50 flex items-center justify-center gap-2"
                                    >
                                        {sending ? (
                                            <>
                                                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                                Sending...
                                            </>
                                        ) : (
                                            <>
                                                <Send size={20} />
                                                Send Message
                                            </>
                                        )}
                                    </button>
                                </form>
                            )}
                        </div>
                    </div>

                    {/* Sidebar Info */}
                    <div className="space-y-8">
                        {/* Office Locations */}
                        <div className="bg-slate-50 rounded-2xl p-6 border border-slate-100">
                            <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
                                <MapPin size={20} className="text-purple-600" />
                                Our Offices
                            </h3>
                            <div className="space-y-4">
                                {offices.map((office, index) => (
                                    <div key={index} className={`${office.primary ? 'pb-4 border-b border-slate-200' : ''}`}>
                                        <p className="font-semibold text-slate-900">{office.city}</p>
                                        <p className="text-sm text-slate-600">{office.address}</p>
                                        <p className="text-sm text-slate-600">{office.region}</p>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Response Time */}
                        <div className="bg-purple-50 rounded-2xl p-6 border border-purple-100">
                            <div className="flex items-start gap-3 mb-3">
                                <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center flex-shrink-0">
                                    <Clock size={20} className="text-purple-600" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-slate-900 mb-1">Quick Response</h3>
                                    <p className="text-sm text-slate-600">
                                        We typically respond to all inquiries within 24 hours during business days
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* FAQs Teaser */}
                        <div className="bg-white rounded-2xl p-6 border border-slate-100">
                            <h3 className="font-bold text-slate-900 mb-3 flex items-center gap-2">
                                <HelpCircle size={20} className="text-purple-600" />
                                Quick Answers
                            </h3>
                            <p className="text-sm text-slate-600 mb-4">
                                Looking for quick answers? Check out our FAQ section below.
                            </p>
                            <button
                                onClick={() => document.getElementById('faqs')?.scrollIntoView({ behavior: 'smooth' })}
                                className="text-purple-600 font-semibold hover:text-purple-700 transition-colors text-sm"
                            >
                                View FAQs →
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* FAQs Section */}
            <div id="faqs" className="bg-slate-50 py-24">
                <div className="max-w-4xl mx-auto px-8">
                    <div className="text-center mb-12">
                        <h2 className="text-3xl font-bold text-slate-900 mb-4">Frequently Asked Questions</h2>
                        <p className="text-xl text-slate-600">
                            Can't find what you're looking for? Send us a message above.
                        </p>
                    </div>
                    <div className="space-y-4">
                        {faqs.map((faq, index) => (
                            <details
                                key={index}
                                className="bg-white rounded-xl border border-slate-100 overflow-hidden group"
                            >
                                <summary className="px-6 py-4 cursor-pointer font-semibold text-slate-900 hover:text-purple-600 transition-colors flex items-center justify-between">
                                    {faq.question}
                                    <span className="text-purple-600 group-open:rotate-180 transition-transform">▼</span>
                                </summary>
                                <div className="px-6 pb-4 text-slate-600">
                                    {faq.answer}
                                </div>
                            </details>
                        ))}
                    </div>
                </div>
            </div>

            {/* CTA Section */}
            <div className="bg-gradient-to-br from-purple-600 to-blue-600 text-white">
                <div className="max-w-4xl mx-auto px-8 py-16 text-center">
                    <h2 className="text-3xl font-bold mb-4">Prefer to try it yourself?</h2>
                    <p className="text-xl text-purple-100 mb-8">
                        Start your free 14-day trial—no credit card required
                    </p>
                    <button className="bg-white text-purple-600 px-8 py-3 rounded-lg font-semibold hover:shadow-xl transition-shadow">
                        Start Free Trial
                    </button>
                </div>
            </div>
        </div>
    );
};

export default Contact;