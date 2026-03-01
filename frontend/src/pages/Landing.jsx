import { Link } from 'react-router-dom';
import { useState } from 'react';
import {
    Zap, Target, ArrowRight, CheckCircle,
    MessageSquare, BarChart3, Shield, Users, Menu, X
} from 'lucide-react';

export default function Landing() {
    const [mobileNavOpen, setMobileNavOpen] = useState(false);

    const handleSmoothScroll = (event, sectionId) => {
        event.preventDefault();
        setMobileNavOpen(false);
        const section = document.getElementById(sectionId);
        if (!section) return;
        section.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    return (
        <div className="min-h-screen bg-white">
            {/* Navigation */}
            <nav className="fixed w-full bg-white/80 backdrop-blur-md z-50 border-b border-gray-100">
                <div className="container mx-auto px-4 md:px-6 py-3 md:py-4">
                    <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                            <div className="w-9 h-9 md:w-10 md:h-10 bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
                                <Zap className="text-white" size={20} />
                            </div>
                            <span className="text-lg md:text-xl font-bold text-gray-900">Teama AI</span>
                        </div>
                        <div className="hidden md:flex items-center gap-8">
                            <a href="#features" onClick={(event) => handleSmoothScroll(event, 'features')} className="text-gray-600 hover:text-gray-900 transition">Features</a>
                            <a href="#how-it-works" onClick={(event) => handleSmoothScroll(event, 'how-it-works')} className="text-gray-600 hover:text-gray-900 transition">How it Works</a>
                            <a href="#pricing" onClick={(event) => handleSmoothScroll(event, 'pricing')} className="text-gray-600 hover:text-gray-900 transition">Pricing</a>
                        </div>
                        <div className="flex items-center gap-2 md:gap-4">
                            <Link to="/login" className="hidden sm:inline text-gray-600 hover:text-gray-900 transition text-sm md:text-base">
                                Sign In
                            </Link>
                            <Link
                                to="/signup?plan=free"
                                className="px-4 md:px-6 py-2 md:py-2.5 bg-gradient-to-r from-blue-600 to-purple-600 text-white text-sm md:text-base rounded-lg hover:shadow-lg hover:scale-105 transition-all"
                            >
                                Get Started Free
                            </Link>
                            <button
                                onClick={() => setMobileNavOpen(!mobileNavOpen)}
                                className="md:hidden p-2 text-gray-700 hover:bg-gray-100 rounded-lg transition"
                                aria-label="Toggle navigation menu"
                            >
                                {mobileNavOpen ? <X size={22} /> : <Menu size={22} />}
                            </button>
                        </div>
                    </div>

                    {/* Mobile Nav Menu */}
                    {mobileNavOpen && (
                        <div className="md:hidden mt-3 pt-3 border-t border-gray-100 pb-2">
                            <div className="flex flex-col gap-1">
                                <a href="#features" onClick={(event) => handleSmoothScroll(event, 'features')} className="px-3 py-2 text-gray-700 hover:bg-gray-50 rounded-lg transition">Features</a>
                                <a href="#how-it-works" onClick={(event) => handleSmoothScroll(event, 'how-it-works')} className="px-3 py-2 text-gray-700 hover:bg-gray-50 rounded-lg transition">How it Works</a>
                                <a href="#pricing" onClick={(event) => handleSmoothScroll(event, 'pricing')} className="px-3 py-2 text-gray-700 hover:bg-gray-50 rounded-lg transition">Pricing</a>
                                <Link to="/login" className="sm:hidden px-3 py-2 text-gray-700 hover:bg-gray-50 rounded-lg transition">Sign In</Link>
                            </div>
                        </div>
                    )}
                </div>
            </nav>

            {/* Hero Section */}
            <section className="pt-28 md:pt-32 pb-12 md:pb-20 px-4 md:px-6">
                <div className="container mx-auto max-w-6xl">
                    <div className="text-center">
                        <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-600 rounded-full text-sm font-medium mb-6">
                            <Zap size={16} />
                            Now in early access — be among the first teams
                        </div>
                        <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold text-gray-900 mb-6 leading-tight">
                            AI-Powered Team
                            <br />
                            <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                                Teama AI Productivity
                            </span>
                        </h1>
                        <p className="text-lg md:text-xl text-gray-600 mb-8 max-w-2xl mx-auto leading-relaxed">
                            Automatically summarize Slack conversations, detect blockers, and get actionable insights
                            for your remote team. No manual work required.
                        </p>
                        <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
                            <Link
                                to="/signup?plan=free"
                                className="px-8 py-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white text-lg rounded-lg hover:shadow-xl hover:scale-105 transition-all flex items-center justify-center gap-2"
                            >
                                Get Started
                                <ArrowRight size={20} />
                            </Link>
                            <a
                                href="/demo"
                                className="px-8 py-4 bg-white border-2 border-gray-200 text-gray-900 text-lg rounded-lg hover:border-gray-300 hover:shadow-lg transition-all"
                            >
                                Try Interactive Demo
                            </a>
                        </div>
                        <div className="flex items-center justify-center gap-8 text-sm text-gray-600 flex-wrap">
                            <div className="flex items-center gap-2">
                                <CheckCircle size={16} className="text-green-500" />
                                Free plan available
                            </div>
                            <div className="flex items-center gap-2">
                                <CheckCircle size={16} className="text-green-500" />
                                Upgrade anytime
                            </div>
                            <div className="flex items-center gap-2">
                                <CheckCircle size={16} className="text-green-500" />
                                Cancel anytime
                            </div>
                        </div>
                    </div>

                    <div className="mt-20">
                        <div className="relative">
                            <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl blur-3xl opacity-20"></div>
                            <img
                                src="https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=1200&h=600&fit=crop"
                                alt="Dashboard Preview"
                                className="relative rounded-2xl shadow-2xl border border-gray-200"
                            />
                        </div>
                    </div>
                </div>
            </section>

            {/* Features Section */}
            <section id="features" className="py-16 md:py-24 px-4 md:px-6 scroll-mt-24">
                <div className="container mx-auto max-w-6xl">
                    <div className="text-center mb-10 md:mb-16">
                        <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-gray-900 mb-4">
                            Everything you need to boost productivity
                        </h2>
                        <p className="text-lg md:text-xl text-gray-600 max-w-2xl mx-auto">
                            Powerful features designed for modern remote teams
                        </p>
                    </div>

                    <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-6 md:gap-8">
                        <FeatureCard
                            icon={<MessageSquare className="text-blue-600" size={32} />}
                            title="AI Summaries"
                            description="Get instant, intelligent summaries of Slack channels and threads. Save hours of reading."
                            features={['Real-time analysis', 'Context-aware', 'Multi-channel support']}
                        />
                        <FeatureCard
                            icon={<Target className="text-purple-600" size={32} />}
                            title="Blocker Detection"
                            description="Automatically identify team blockers, risks, and dependencies before they become problems."
                            features={['Smart alerts', 'Priority ranking', 'Resolution tracking']}
                        />
                        <FeatureCard
                            icon={<BarChart3 className="text-green-600" size={32} />}
                            title="Analytics Dashboard"
                            description="Beautiful visualizations of team productivity, sentiment, and communication patterns."
                            features={['Custom reports', 'Trend analysis', 'Export data']}
                        />
                        <FeatureCard
                            icon={<Shield className="text-red-600" size={32} />}
                            title="Enterprise Security"
                            description="Bank-level encryption and compliance. Your data never leaves your control."
                            features={['SOC 2 compliant', 'GDPR ready', 'SSO support']}
                        />
                        <FeatureCard
                            icon={<Users className="text-yellow-600" size={32} />}
                            title="Team Insights"
                            description="Understand collaboration patterns, identify knowledge silos, and improve team dynamics."
                            features={['Sentiment analysis', 'Engagement metrics', 'Burnout detection']}
                        />
                        <FeatureCard
                            icon={<Zap className="text-indigo-600" size={32} />}
                            title="Instant Integration"
                            description="Connect Slack, Asana, and your tools in seconds. No technical setup required."
                            features={['One-click setup', 'All major tools', 'API access']}
                        />
                    </div>
                </div>
            </section>

            {/* How It Works */}
            <section id="how-it-works" className="py-16 md:py-24 px-4 md:px-6 bg-gradient-to-br from-blue-50 to-purple-50 scroll-mt-24">
                <div className="container mx-auto max-w-6xl">
                    <div className="text-center mb-10 md:mb-16">
                        <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-gray-900 mb-4">
                            How it works
                        </h2>
                        <p className="text-lg md:text-xl text-gray-600">
                            Get started in minutes, not hours
                        </p>
                    </div>

                    <div className="grid sm:grid-cols-3 gap-8 md:gap-12">
                        <Step
                            number="1"
                            title="Connect Your Tools"
                            description="Link your Slack workspace and other tools with one click. We'll guide you through everything."
                        />
                        <Step
                            number="2"
                            title="AI Starts Learning"
                            description="Our AI analyzes your team's communication patterns and automatically surfaces key insights."
                        />
                        <Step
                            number="3"
                            title="Get Insights Daily"
                            description="Receive smart summaries, blocker alerts, and actionable recommendations every day."
                        />
                    </div>
                </div>
            </section>

            {/* Pricing */}
            <section id="pricing" className="py-16 md:py-24 px-4 md:px-6 bg-gray-50 scroll-mt-24">
                <div className="container mx-auto max-w-6xl">
                    <div className="text-center mb-10 md:mb-16">
                        <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-gray-900 mb-4">
                            Simple, flat-rate pricing
                        </h2>
                        <p className="text-lg md:text-xl text-gray-600">
                            Flat monthly pricing with clear team and usage limits.
                        </p>
                    </div>

                    <div className="grid md:grid-cols-3 gap-6 md:gap-8">
                        <PricingCard
                            name="Free"
                            plan="free"
                            price="$0"
                            description="Try the full platform, no card needed"
                            features={[
                                'Up to 5 team members',
                                '50 AI summaries per month',
                                'All integrations (Slack, Asana, Calendar, GitHub)',
                                'Blocker detection',
                                '7-day history',
                                'Basic analytics',
                                'Community support'
                            ]}
                            cta="Get Started Free"
                            highlighted={false}
                        />
                        <PricingCard
                            name="Starter"
                            plan="starter"
                            price="$19"
                            description="For teams that rely on it daily"
                            features={[
                                'Up to 20 team members',
                                '1,000 AI summaries per month',
                                'All integrations',
                                'Advanced blocker detection',
                                'Daily digest emails',
                                '90-day history',
                                'Full analytics & reports',
                                'Email support'
                            ]}
                            cta="Get Started"
                            highlighted={true}
                        />
                        <PricingCard
                            name="Growth"
                            plan="growth"
                            price="$49"
                            description="For scaling teams that need more"
                            features={[
                                'Up to 75 team members',
                                'Unlimited AI summaries',
                                'Everything in Starter',
                                'Workload insights',
                                'Export reports',
                                '1-year history',
                                'Priority support',
                                'Custom onboarding'
                            ]}
                            cta="Get Started"
                            highlighted={false}
                        />
                    </div>

                    <p className="text-center text-gray-600 mt-8 md:mt-10">
                        <span className="font-medium text-gray-900">Larger team?</span>{' '}
                        <a href="mailto:hello@teama.ai" className="text-blue-600 hover:text-blue-700 font-medium underline underline-offset-2 transition">
                            Contact us
                        </a>{' '}
                        — we'll build a plan that fits.
                    </p>
                </div>
            </section>

            {/* CTA Section */}
            <section className="py-16 md:py-24 px-4 md:px-6 bg-gradient-to-r from-blue-600 to-purple-600">
                <div className="container mx-auto max-w-4xl text-center">
                    <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-6">
                        Ready to transform your team's productivity?
                    </h2>
                    <p className="text-lg md:text-xl text-blue-100 mb-8">
                        Start with the free plan and upgrade when your team grows.
                    </p>
                    <Link
                        to="/signup?plan=free"
                        className="inline-flex items-center gap-2 px-8 py-4 bg-white text-blue-600 text-lg font-semibold rounded-lg hover:shadow-2xl hover:scale-105 transition-all"
                    >
                        Get Started
                        <ArrowRight size={20} />
                    </Link>
                    <p className="text-blue-100 mt-4 text-sm">
                        Free plan available • No long-term contracts
                    </p>
                </div>
            </section>

            {/* Footer */}
            <footer className="bg-gray-900 text-gray-400 py-10 md:py-12 px-4 md:px-6">
                <div className="container mx-auto max-w-6xl">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-8 mb-8">
                        <div>
                            <div className="flex items-center gap-2 mb-4">
                                <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
                                    <Zap className="text-white" size={16} />
                                </div>
                                <span className="text-white font-bold">Teama AI</span>
                            </div>
                            <p className="text-sm">
                                AI-powered productivity intelligence for modern teams.
                            </p>
                        </div>
                        <div>
                            <h4 className="text-white font-semibold mb-4">Product</h4>
                            <ul className="space-y-2 text-sm">
                                <li><a href="#features" className="hover:text-white transition">Features</a></li>
                                <li><a href="#pricing" className="hover:text-white transition">Pricing</a></li>
                            </ul>
                        </div>
                        <div>
                            <h4 className="text-white font-semibold mb-4">Company</h4>
                            <ul className="space-y-2 text-sm">
                                <li><a href="/about" className="hover:text-white transition">About</a></li>
                                <li><a href="/blog" className="hover:text-white transition">Blog</a></li>
                                <li><a href="/contact" className="hover:text-white transition">Contact</a></li>
                            </ul>
                        </div>
                        <div>
                            <h4 className="text-white font-semibold mb-4">Legal</h4>
                            <ul className="space-y-2 text-sm">
                                <li><a href="/privacy" className="hover:text-white transition">Privacy</a></li>
                                <li><a href="/terms" className="hover:text-white transition">Terms</a></li>
                                <li><a href="/security" className="hover:text-white transition">Security</a></li>
                            </ul>
                        </div>
                    </div>
                    <div className="border-t border-gray-800 pt-8 text-center text-sm">
                        <p>&copy; 2025 Teama AI. All rights reserved.</p>
                    </div>
                </div>
            </footer>
        </div>
    );
}

function FeatureCard({ icon, title, description, features }) {
    return (
        <div className="bg-white p-5 md:p-8 rounded-2xl shadow-sm border border-gray-100 hover:shadow-xl hover:scale-[1.02] md:hover:scale-105 transition-all">
            <div className="mb-4">{icon}</div>
            <h3 className="text-xl font-bold text-gray-900 mb-3">{title}</h3>
            <p className="text-gray-600 mb-4">{description}</p>
            <ul className="space-y-2">
                {features.map((feature, i) => (
                    <li key={i} className="flex items-center gap-2 text-sm text-gray-600">
                        <CheckCircle size={16} className="text-green-500" />
                        {feature}
                    </li>
                ))}
            </ul>
        </div>
    );
}

function Step({ number, title, description }) {
    return (
        <div className="text-center">
            <div className="w-16 h-16 bg-gradient-to-br from-blue-600 to-purple-600 text-white rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-4">
                {number}
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">{title}</h3>
            <p className="text-gray-600">{description}</p>
        </div>
    );
}

function PricingCard({ name, plan = 'free', price, description, features, cta, highlighted }) {
    return (
        <div className={`bg-white p-5 md:p-8 rounded-2xl border-2 ${highlighted
            ? 'border-blue-600 shadow-2xl md:scale-105'
            : 'border-gray-100 shadow-sm'
            }`}>
            {highlighted && (
                <span className="inline-block px-3 py-1 bg-blue-600 text-white text-sm font-semibold rounded-full mb-4">
                    Most Popular
                </span>
            )}
            <h3 className="text-2xl font-bold text-gray-900 mb-2">{name}</h3>
            <div className="mb-2">
                <span className="text-4xl md:text-5xl font-bold text-gray-900">{price}</span>
                {price !== 'Custom' && <span className="text-gray-600">/month</span>}
            </div>
            <p className="text-gray-600 mb-6">{description}</p>
            <ul className="space-y-3 mb-8">
                {features.map((feature, i) => (
                    <li key={i} className="flex items-center gap-2 text-gray-700">
                        <CheckCircle size={20} className="text-green-500 flex-shrink-0" />
                        {feature}
                    </li>
                ))}
            </ul>
            <Link
                to={`/signup?plan=${encodeURIComponent(plan)}`}
                className={`block w-full py-3 text-center rounded-lg font-semibold transition-all ${highlighted
                    ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:shadow-xl hover:scale-105'
                    : 'bg-gray-100 text-gray-900 hover:bg-gray-200'
                    }`}
            >
                {cta}
            </Link>
        </div>
    );
}
