import { Link } from 'react-router-dom';
import {
    Zap, Target, TrendingUp, ArrowRight, CheckCircle,
    MessageSquare, BarChart3, Shield, Star, Users
} from 'lucide-react';

export default function Landing() {
    return (
        <div className="min-h-screen bg-white">
            {/* Navigation */}
            <nav className="fixed w-full bg-white/80 backdrop-blur-md z-50 border-b border-gray-100">
                <div className="container mx-auto px-6 py-4">
                    <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                            <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
                                <Zap className="text-white" size={24} />
                            </div>
                            <span className="text-xl font-bold text-gray-900">ProductivityAI</span>
                        </div>
                        <div className="hidden md:flex items-center gap-8">
                            <a href="#features" className="text-gray-600 hover:text-gray-900 transition">Features</a>
                            <a href="#how-it-works" className="text-gray-600 hover:text-gray-900 transition">How it Works</a>
                            <a href="#testimonials" className="text-gray-600 hover:text-gray-900 transition">Testimonials</a>
                            <a href="#pricing" className="text-gray-600 hover:text-gray-900 transition">Pricing</a>
                        </div>
                        <div className="flex items-center gap-4">
                            <Link to="/login" className="text-gray-600 hover:text-gray-900 transition">
                                Sign In
                            </Link>
                            <Link
                                to="/signup"
                                className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:shadow-lg hover:scale-105 transition-all"
                            >
                                Get Started Free
                            </Link>
                        </div>
                    </div>
                </div>
            </nav>

            {/* Hero Section */}
            <section className="pt-32 pb-20 px-6">
                <div className="container mx-auto max-w-6xl">
                    <div className="text-center">
                        <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-600 rounded-full text-sm font-medium mb-6">
                            <Star size={16} fill="currentColor" />
                            Trusted by 500+ remote teams
                        </div>
                        <h1 className="text-6xl md:text-7xl font-bold text-gray-900 mb-6 leading-tight">
                            AI-Powered Team
                            <br />
                            <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                                Productivity Intelligence
                            </span>
                        </h1>
                        <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto leading-relaxed">
                            Automatically summarize Slack conversations, detect blockers, and get actionable insights
                            for your remote team. No manual work required.
                        </p>
                        <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
                            <Link
                                to="/signup"
                                className="px-8 py-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white text-lg rounded-lg hover:shadow-xl hover:scale-105 transition-all flex items-center justify-center gap-2"
                            >
                                Start Free Trial
                                <ArrowRight size={20} />
                            </Link>
                            <a
                                href="#demo"
                                className="px-8 py-4 bg-white border-2 border-gray-200 text-gray-900 text-lg rounded-lg hover:border-gray-300 hover:shadow-lg transition-all"
                            >
                                Watch Demo
                            </a>
                        </div>
                        <div className="flex items-center justify-center gap-8 text-sm text-gray-600 flex-wrap">
                            <div className="flex items-center gap-2">
                                <CheckCircle size={16} className="text-green-500" />
                                Free 14-day trial
                            </div>
                            <div className="flex items-center gap-2">
                                <CheckCircle size={16} className="text-green-500" />
                                No credit card required
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

            {/* Social Proof */}
            <section className="py-12 bg-gray-50 border-y border-gray-100">
                <div className="container mx-auto px-6">
                    <p className="text-center text-gray-600 mb-8">Trusted by teams at</p>
                    <div className="flex flex-wrap justify-center items-center gap-12 opacity-50">
                        <span className="text-2xl font-bold text-gray-400">Stripe</span>
                        <span className="text-2xl font-bold text-gray-400">Notion</span>
                        <span className="text-2xl font-bold text-gray-400">Vercel</span>
                        <span className="text-2xl font-bold text-gray-400">Linear</span>
                        <span className="text-2xl font-bold text-gray-400">Figma</span>
                    </div>
                </div>
            </section>

            {/* Features Section */}
            <section id="features" className="py-24 px-6">
                <div className="container mx-auto max-w-6xl">
                    <div className="text-center mb-16">
                        <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
                            Everything you need to boost productivity
                        </h2>
                        <p className="text-xl text-gray-600 max-w-2xl mx-auto">
                            Powerful features designed for modern remote teams
                        </p>
                    </div>

                    <div className="grid md:grid-cols-3 gap-8">
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
                            features={['One-click setup', '50+ integrations', 'API access']}
                        />
                    </div>
                </div>
            </section>

            {/* How It Works */}
            <section id="how-it-works" className="py-24 px-6 bg-gradient-to-br from-blue-50 to-purple-50">
                <div className="container mx-auto max-w-6xl">
                    <div className="text-center mb-16">
                        <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
                            How it works
                        </h2>
                        <p className="text-xl text-gray-600">
                            Get started in minutes, not hours
                        </p>
                    </div>

                    <div className="grid md:grid-cols-3 gap-12">
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

            {/* Testimonials */}
            <section id="testimonials" className="py-24 px-6">
                <div className="container mx-auto max-w-6xl">
                    <div className="text-center mb-16">
                        <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
                            Loved by teams worldwide
                        </h2>
                        <p className="text-xl text-gray-600">
                            See what our customers have to say
                        </p>
                    </div>

                    <div className="grid md:grid-cols-3 gap-8">
                        <Testimonial
                            quote="ProductivityAI saved us 10+ hours per week. We catch blockers before they impact delivery."
                            author="Sarah Chen"
                            role="Engineering Manager"
                            company="Stripe"
                            avatar="https://i.pravatar.cc/150?img=1"
                        />
                        <Testimonial
                            quote="The AI summaries are incredibly accurate. It's like having a super-assistant for the whole team."
                            author="Michael Rodriguez"
                            role="Product Lead"
                            company="Notion"
                            avatar="https://i.pravatar.cc/150?img=3"
                        />
                        <Testimonial
                            quote="Best investment we made this year. Our async communication improved dramatically."
                            author="Emily Taylor"
                            role="VP of Operations"
                            company="Vercel"
                            avatar="https://i.pravatar.cc/150?img=5"
                        />
                    </div>
                </div>
            </section>

            {/* Pricing */}
            <section id="pricing" className="py-24 px-6 bg-gray-50">
                <div className="container mx-auto max-w-6xl">
                    <div className="text-center mb-16">
                        <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
                            Simple, transparent pricing
                        </h2>
                        <p className="text-xl text-gray-600">
                            Start free, upgrade when you're ready
                        </p>
                    </div>

                    <div className="grid md:grid-cols-3 gap-8">
                        <PricingCard
                            name="Free"
                            price="$0"
                            description="Perfect for trying out"
                            features={[
                                '1 Slack workspace',
                                '10 summaries/month',
                                'Basic analytics',
                                'Email support'
                            ]}
                            cta="Start Free"
                            highlighted={false}
                        />
                        <PricingCard
                            name="Pro"
                            price="$29"
                            description="For growing teams"
                            features={[
                                'Unlimited workspaces',
                                'Unlimited summaries',
                                'Advanced analytics',
                                'Priority support',
                                'Custom integrations',
                                'API access'
                            ]}
                            cta="Start Free Trial"
                            highlighted={true}
                        />
                        <PricingCard
                            name="Enterprise"
                            price="Custom"
                            description="For large organizations"
                            features={[
                                'Everything in Pro',
                                'Dedicated support',
                                'Custom AI training',
                                'SLA guarantee',
                                'On-premise option',
                                'Volume discounts'
                            ]}
                            cta="Contact Sales"
                            highlighted={false}
                        />
                    </div>
                </div>
            </section>

            {/* CTA Section */}
            <section className="py-24 px-6 bg-gradient-to-r from-blue-600 to-purple-600">
                <div className="container mx-auto max-w-4xl text-center">
                    <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
                        Ready to transform your team's productivity?
                    </h2>
                    <p className="text-xl text-blue-100 mb-8">
                        Join 500+ teams already using ProductivityAI
                    </p>
                    <Link
                        to="/signup"
                        className="inline-flex items-center gap-2 px-8 py-4 bg-white text-blue-600 text-lg font-semibold rounded-lg hover:shadow-2xl hover:scale-105 transition-all"
                    >
                        Start Free Trial
                        <ArrowRight size={20} />
                    </Link>
                    <p className="text-blue-100 mt-4 text-sm">
                        No credit card required • 14-day free trial
                    </p>
                </div>
            </section>

            {/* Footer */}
            <footer className="bg-gray-900 text-gray-400 py-12 px-6">
                <div className="container mx-auto max-w-6xl">
                    <div className="grid md:grid-cols-4 gap-8 mb-8">
                        <div>
                            <div className="flex items-center gap-2 mb-4">
                                <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
                                    <Zap className="text-white" size={16} />
                                </div>
                                <span className="text-white font-bold">ProductivityAI</span>
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
                                <li><a href="#" className="hover:text-white transition">Integrations</a></li>
                            </ul>
                        </div>
                        <div>
                            <h4 className="text-white font-semibold mb-4">Company</h4>
                            <ul className="space-y-2 text-sm">
                                <li><a href="#" className="hover:text-white transition">About</a></li>
                                <li><a href="#" className="hover:text-white transition">Blog</a></li>
                                <li><a href="#" className="hover:text-white transition">Contact</a></li>
                            </ul>
                        </div>
                        <div>
                            <h4 className="text-white font-semibold mb-4">Legal</h4>
                            <ul className="space-y-2 text-sm">
                                <li><a href="#" className="hover:text-white transition">Privacy</a></li>
                                <li><a href="#" className="hover:text-white transition">Terms</a></li>
                                <li><a href="#" className="hover:text-white transition">Security</a></li>
                            </ul>
                        </div>
                    </div>
                    <div className="border-t border-gray-800 pt-8 text-center text-sm">
                        <p>&copy; 2025 ProductivityAI. All rights reserved.</p>
                    </div>
                </div>
            </footer>
        </div>
    );
}

function FeatureCard({ icon, title, description, features }) {
    return (
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 hover:shadow-xl hover:scale-105 transition-all">
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

function Testimonial({ quote, author, role, company, avatar }) {
    return (
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
            <div className="flex gap-1 mb-4">
                {[...Array(5)].map((_, i) => (
                    <Star key={i} size={16} fill="#FCD34D" className="text-yellow-400" />
                ))}
            </div>
            <p className="text-gray-700 mb-6 italic">"{quote}"</p>
            <div className="flex items-center gap-3">
                <img src={avatar} alt={author} className="w-12 h-12 rounded-full" />
                <div>
                    <p className="font-semibold text-gray-900">{author}</p>
                    <p className="text-sm text-gray-600">{role} at {company}</p>
                </div>
            </div>
        </div>
    );
}

function PricingCard({ name, price, description, features, cta, highlighted }) {
    return (
        <div className={`bg-white p-8 rounded-2xl border-2 ${highlighted
            ? 'border-blue-600 shadow-2xl scale-105'
            : 'border-gray-100 shadow-sm'
            }`}>
            {highlighted && (
                <span className="inline-block px-3 py-1 bg-blue-600 text-white text-sm font-semibold rounded-full mb-4">
                    Most Popular
                </span>
            )}
            <h3 className="text-2xl font-bold text-gray-900 mb-2">{name}</h3>
            <div className="mb-2">
                <span className="text-5xl font-bold text-gray-900">{price}</span>
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
                to="/signup"
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