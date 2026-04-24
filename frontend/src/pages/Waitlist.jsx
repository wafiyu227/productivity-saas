import React, { useState, useEffect } from 'react';
import { 
    Sparkles, 
    CheckCircle, 
    Users, 
    Zap, 
    Brain, 
    Target, 
    Mail, 
    ArrowRight, 
    TrendingUp, 
    Clock, 
    Shield,
    ArrowLeft,
    ShieldCheck,
    BarChart3,
    Terminal,
    ChevronRight,
    Globe
} from 'lucide-react';
import SEO from '../components/common/SEO';
import { useNavigate } from 'react-router-dom';

const Waitlist = () => {
    const navigate = useNavigate();
    const [formData, setFormData] = useState({
        email: '',
        name: '',
        company: '',
        role: '',
        referralSource: ''
    });
    const [loading, setLoading] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [position, setPosition] = useState(null);
    const [waitlistCount, setWaitlistCount] = useState(null);
    const [error, setError] = useState('');

    useEffect(() => {
        fetch(`${import.meta.env.VITE_API_URL}/api/waitlist/count`)
            .then(res => res.json())
            .then(data => setWaitlistCount(data.count))
            .catch(err => console.error('Failed to fetch count:', err));
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            const res = await fetch(`${import.meta.env.VITE_API_URL}/api/waitlist/join`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });

            const data = await res.json();

            if (res.ok) {
                setSubmitted(true);
                setPosition(data.position);
            } else {
                setError(data.error || 'Failed to join waitlist. Please try again.');
            }
        } catch (err) {
            console.error('Waitlist error:', err);
            setError('Network error. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const handleChange = (e) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value
        });
    };

    if (submitted) {
        return (
            <div className="min-h-screen bg-black text-white flex items-center justify-center p-6 selection:bg-gray-800">
                <SEO title="Waitlist Joined!" description="You've successfully joined the Teama AI waitlist." />
                
                <div className="max-w-2xl w-full bg-white/[0.02] border border-white/5 rounded-3xl p-12 md:p-16 text-center">
                    <div className="w-20 h-20 bg-white/10 border border-white/10 rounded-full flex items-center justify-center mx-auto mb-10">
                        <CheckCircle className="w-10 h-10 text-white" />
                    </div>

                    <h1 className="text-4xl font-bold mb-4">You're on the list!</h1>
                    <p className="text-gray-500 mb-12">We've added you to our early access queue.</p>

                    <div className="bg-white/[0.02] border border-white/5 rounded-3xl p-12 mb-12">
                        <p className="text-xs text-gray-700 mb-4 font-bold uppercase tracking-widest">Your Position</p>
                        <p className="text-8xl font-black text-white">#{position}</p>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-4">
                        <button onClick={() => navigate('/')} className="flex-1 bg-white text-black px-8 py-4 rounded-xl font-bold hover:bg-gray-200 transition-all">
                            Back to Home
                        </button>
                        <a
                            href={`https://twitter.com/intent/tweet?text=I%20just%20joined%20the%20waitlist%20for%20Teama%20AI!&url=${window.location.origin}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex-1 border border-white/10 text-white px-8 py-4 rounded-xl font-bold hover:bg-white/5 transition-all text-center"
                        >
                            Share on Twitter
                        </a>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-black text-white selection:bg-gray-800 font-sans">
            <SEO title="Join the Waitlist" description="Be the first to experience Teama AI." />
            
            <nav className="max-w-7xl mx-auto px-8 py-10 flex items-center justify-between">
                <button onClick={() => navigate('/')} className="flex items-center gap-2 text-white font-bold text-xl">
                    <img src="/logo.png" alt="Logo" className="w-8 h-8" />
                    <span>Teama AI</span>
                </button>
            </nav>

            <main className="max-w-7xl mx-auto px-8 pt-12 pb-24">
                <div className="text-center mb-24">
                    <h1 className="text-5xl md:text-7xl font-bold mb-8 tracking-tight">
                        Work better <br /> <span className="text-gray-500">with less noise.</span>
                    </h1>
                    <p className="text-lg text-gray-400 max-w-2xl mx-auto leading-relaxed mb-12">
                        Teama AI helps your team stay aligned by summarizing Slack messages and meetings automatically. Join the waitlist for early access.
                    </p>

                    {waitlistCount !== null && waitlistCount > 0 && (
                        <div className="inline-flex items-center gap-4 bg-white/[0.02] px-8 py-4 rounded-2xl border border-white/5">
                            <div className="text-left">
                                <span className="text-white font-bold text-lg block leading-none">{waitlistCount.toLocaleString()}</span>
                                <span className="text-[10px] text-gray-600 font-bold uppercase tracking-widest mt-1 block">People waiting</span>
                            </div>
                        </div>
                    )}
                </div>

                <div className="grid lg:grid-cols-2 gap-16 max-w-6xl mx-auto">
                    <div className="bg-white/[0.02] border border-white/5 rounded-3xl p-10 md:p-14">
                        <h2 className="text-2xl font-bold mb-8">Join the queue</h2>
                        <form onSubmit={handleSubmit} className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <WaitlistInput label="Full Name" name="name" value={formData.name} onChange={handleChange} placeholder="John Doe" />
                                <WaitlistInput label="Email" name="email" value={formData.email} onChange={handleChange} required type="email" placeholder="john@example.com" />
                            </div>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <WaitlistInput label="Company" name="company" value={formData.company} onChange={handleChange} placeholder="Acme Inc" />
                                <div className="flex flex-col gap-3">
                                    <label className="text-xs font-bold text-gray-500 uppercase tracking-widest ml-1">Role</label>
                                    <select
                                        name="role"
                                        value={formData.role}
                                        onChange={handleChange}
                                        className="w-full px-6 py-4 bg-white/5 border border-white/10 rounded-xl text-gray-300 outline-none focus:border-white/20 transition-all appearance-none cursor-pointer"
                                    >
                                        <option value="" className="bg-black">Select Role...</option>
                                        <option value="founder" className="bg-black">Founder/CEO</option>
                                        <option value="manager" className="bg-black">Manager</option>
                                        <option value="engineer" className="bg-black">Engineer</option>
                                        <option value="other" className="bg-black">Other</option>
                                    </select>
                                </div>
                            </div>

                            {error && (
                                <div className="bg-red-500/10 border border-red-500/20 text-red-500 px-6 py-4 rounded-xl text-xs font-bold" role="alert">
                                    {error}
                                </div>
                            )}

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full bg-white text-black py-4 rounded-xl font-bold hover:bg-gray-200 transition-all active:scale-95 disabled:opacity-50"
                            >
                                {loading ? 'Joining...' : 'Join Waitlist'}
                            </button>
                        </form>
                    </div>

                    <div className="space-y-8">
                        <SpecItem title="Daily Summaries" desc="Get a clear overview of what happened in Slack while you were out." />
                        <SpecItem title="Blocker Detection" desc="Automatically see what's stopping your team from moving faster." />
                        <SpecItem title="Simple Insights" desc="No complex charts. Just plain English updates on team health." />
                        <SpecItem title="Deep Security" desc="We don't train models on your data. Your privacy comes first." />
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

const WaitlistInput = ({ label, ...props }) => (
    <div className="flex flex-col gap-3">
        <label className="text-xs font-bold text-gray-500 uppercase tracking-widest ml-1">{label}</label>
        <input
            {...props}
            className="w-full px-6 py-4 bg-white/5 border border-white/10 rounded-xl text-gray-300 outline-none focus:border-white/20 transition-all placeholder:text-gray-700"
        />
    </div>
);

const SpecItem = ({ title, desc }) => (
    <div className="bg-white/[0.01] border border-white/5 rounded-3xl p-8 transition-all hover:bg-white/[0.03]">
        <h3 className="text-xl font-bold text-white mb-2">{title}</h3>
        <p className="text-gray-500 text-sm leading-relaxed">{desc}</p>
    </div>
);

export default Waitlist;