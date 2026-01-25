import { Link } from 'react-router-dom';
import { Zap, Target, TrendingUp } from 'lucide-react';

export default function Landing() {
    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
            {/* Header */}
            <header className="container mx-auto px-6 py-6">
                <div className="flex justify-between items-center">
                    <h1 className="text-2xl font-bold text-gray-900">ProductivityAI</h1>
                    <div className="space-x-4">
                        <Link to="/login" className="text-gray-600 hover:text-gray-900">
                            Login
                        </Link>
                        <Link
                            to="/signup"
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                        >
                            Get Started
                        </Link>
                    </div>
                </div>
            </header>

            {/* Hero */}
            <main className="container mx-auto px-6 py-20">
                <div className="text-center max-w-3xl mx-auto">
                    <h2 className="text-5xl font-bold text-gray-900 mb-6">
                        AI-Powered Team Productivity
                    </h2>
                    <p className="text-xl text-gray-600 mb-8">
                        Automatically summarize Slack conversations, detect blockers, and get actionable insights for your remote team.
                    </p>
                    <Link
                        to="/signup"
                        className="inline-block px-8 py-4 bg-blue-600 text-white text-lg rounded-lg hover:bg-blue-700"
                    >
                        Start Free Trial
                    </Link>
                </div>

                {/* Features */}
                <div className="grid md:grid-cols-3 gap-8 mt-20">
                    <FeatureCard
                        icon={<Zap className="text-blue-600" size={32} />}
                        title="AI Summaries"
                        description="Get instant summaries of Slack channels and meeting notes"
                    />
                    <FeatureCard
                        icon={<Target className="text-blue-600" size={32} />}
                        title="Blocker Detection"
                        description="Automatically identify and track team blockers"
                    />
                    <FeatureCard
                        icon={<TrendingUp className="text-blue-600" size={32} />}
                        title="Analytics"
                        description="Visualize team productivity trends over time"
                    />
                </div>
            </main>
        </div>
    );
}

function FeatureCard({ icon, title, description }) {
    return (
        <div className="bg-white p-6 rounded-xl shadow-sm">
            <div className="mb-4">{icon}</div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">{title}</h3>
            <p className="text-gray-600">{description}</p>
        </div>
    );
}