import React, { useState } from 'react';
import { Mail, MessageSquare, MapPin, Send, CheckCircle2, AlertCircle, Phone, Globe, Github, Users, ArrowLeft, Terminal, Sparkles, Loader2, ChevronRight } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import SEO from '../../components/common/SEO';
import { useNavigate } from 'react-router-dom';

const Contact = () => {
    const navigate = useNavigate();
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        company: '',
        message: ''
    });
    const [submitted, setSubmitted] = useState(false);
    const [sending, setSending] = useState(false);

    const handleChange = (e) => {
        setFormData((prev) => ({
            ...prev,
            [e.target.name]: e.target.value
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSending(true);

        try {
            const response = await fetch(`${import.meta.env.VITE_API_URL}/api/contact`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(formData),
            });

            if (!response.ok) throw new Error('Failed to send');

            setSubmitted(true);
            setFormData({ name: '', email: '', company: '', message: '' });
        } catch (error) {
            console.error('Error:', error);
            alert('Something went wrong. Please email us at team@mail.teamaai.xyz');
        } finally {
            setSending(false);
        }
    };

    return (
        <div className="min-h-screen bg-black text-white selection:bg-gray-800 font-sans">
            <SEO
                title="Contact Teama AI"
                description="Get in touch with us for support or partnerships."
            />
            
            {/* Header */}
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
                            Get in touch <br /> <span className="text-gray-500">with us.</span>
                        </h1>
                        <p className="text-xl text-gray-400 max-w-2xl leading-relaxed">
                            Have a question or want to partner with us? Send us a message and we'll get back to you soon.
                        </p>
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-8 py-20 pb-32">
                <div className="grid lg:grid-cols-3 gap-16 items-start">
                    {/* Info Sidebar */}
                    <div className="lg:col-span-1 space-y-8">
                        <div className="bg-white/[0.02] border border-white/5 rounded-3xl p-10">
                            <div className="w-12 h-12 bg-white/5 border border-white/5 rounded-xl flex items-center justify-center text-gray-400 mb-8">
                                <Mail size={22} />
                            </div>
                            <h3 className="text-sm font-bold text-gray-500 uppercase tracking-widest mb-2">Email</h3>
                            <a href="mailto:team@mail.teamaai.xyz" className="text-xl font-bold text-white hover:text-gray-400 transition-colors break-all">
                                team@mail.teamaai.xyz
                            </a>
                        </div>
                        
                        <div className="p-8 border-l-2 border-white/10 bg-white/[0.01] rounded-r-2xl">
                             <p className="text-sm text-gray-500 leading-relaxed">
                                We typically respond within 24 hours. For support, please include your account email.
                             </p>
                        </div>
                    </div>

                    {/* Form Area */}
                    <div className="lg:col-span-2">
                        <div className="bg-white/[0.02] border border-white/5 rounded-3xl p-10 md:p-14">
                            {submitted ? (
                                <div className="py-20 text-center">
                                    <div className="w-20 h-20 bg-white/10 border border-white/10 rounded-full flex items-center justify-center mx-auto mb-8">
                                        <CheckCircle2 size={40} className="text-white" />
                                    </div>
                                    <h3 className="text-3xl font-bold text-white mb-4">Message Sent</h3>
                                    <p className="text-gray-500 mb-8">
                                        We've received your message and will get back to you shortly.
                                    </p>
                                    <button 
                                        onClick={() => setSubmitted(false)}
                                        className="text-sm font-bold text-gray-400 hover:text-white transition-colors"
                                    >
                                        Send another message
                                    </button>
                                </div>
                            ) : (
                                <form onSubmit={handleSubmit} className="space-y-8">
                                    <div className="grid md:grid-cols-2 gap-8">
                                        <SimpleInput label="Full Name" name="name" value={formData.name} onChange={handleChange} required placeholder="John Doe" />
                                        <SimpleInput label="Email Address" name="email" type="email" value={formData.email} onChange={handleChange} required placeholder="john@example.com" />
                                    </div>

                                    <SimpleInput label="Company (Optional)" name="company" value={formData.company} onChange={handleChange} placeholder="Acme Inc" />

                                    <div className="flex flex-col gap-3">
                                        <label className="text-xs font-bold text-gray-500 uppercase tracking-widest ml-1">Message</label>
                                        <textarea
                                            name="message"
                                            value={formData.message}
                                            onChange={handleChange}
                                            required
                                            rows={6}
                                            className="w-full px-6 py-4 bg-white/5 border border-white/10 rounded-xl text-gray-300 outline-none focus:border-white/20 transition-all resize-none placeholder:text-gray-700"
                                            placeholder="How can we help?"
                                        />
                                    </div>

                                    <button
                                        type="submit"
                                        disabled={sending}
                                        className="w-full bg-white text-black py-4 rounded-xl font-bold hover:bg-gray-200 transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-3"
                                    >
                                        {sending ? <>Sending...</> : <>Send Message <Send size={18} /></>}
                                    </button>
                                </form>
                            )}
                        </div>
                    </div>
                </div>
            </main>

            <footer className="py-20 border-t border-white/5">
                <div className="max-w-7xl mx-auto px-8 text-center text-[10px] uppercase tracking-widest text-gray-800">
                    &copy; 2026 Teama AI. All rights reserved.
                </div>
            </footer>
        </div>
    );
};

const SimpleInput = ({ label, ...props }) => (
    <div className="flex flex-col gap-3">
        <label className="text-xs font-bold text-gray-500 uppercase tracking-widest ml-1">{label}</label>
        <input
            {...props}
            className="w-full px-6 py-4 bg-white/5 border border-white/10 rounded-xl text-gray-300 outline-none focus:border-white/20 transition-all placeholder:text-gray-700"
        />
    </div>
);


export default Contact;
