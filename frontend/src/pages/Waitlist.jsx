// frontend/src/pages/Waitlist.jsx
// Beautiful waitlist page with your purple-blue gradient design

import React, { useState, useEffect } from 'react';
import { Sparkles, CheckCircle, Users, Zap, Brain, Target, Mail, ArrowRight } from 'lucide-react';
import SEO from '../components/common/SEO';

const Waitlist = () => {
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

  // Fetch waitlist count on load
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

  // Success State
  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-600 via-blue-600 to-purple-700 flex items-center justify-center p-4">
        <SEO
          title="Waitlist Joined! 🎉"
          description="You've successfully joined the Teama AI waitlist. Check your position and share to move up!"
        />
        <div className="max-w-lg w-full bg-white rounded-3xl shadow-2xl p-8 md:p-12 text-center animate-fade-in">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-12 h-12 text-green-600" />
          </div>

          <h1 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">
            You're In! 🎉
          </h1>

          <p className="text-slate-600 mb-8">
            Check your email for confirmation and next steps.
          </p>

          <div className="bg-gradient-to-br from-purple-50 to-blue-50 rounded-2xl p-8 mb-8">
            <p className="text-sm text-slate-600 mb-2 font-medium">YOUR POSITION</p>
            <p className="text-7xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
              #{position}
            </p>
            <p className="text-sm text-slate-600 mt-2">in line</p>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-8">
            <p className="text-sm text-blue-900 font-medium mb-2">💡 Want to move up faster?</p>
            <p className="text-xs text-blue-700">
              Share Teama AI with your team and we'll bump you up the list!
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <a
              href="/"
              className="flex-1 bg-gradient-to-r from-purple-600 to-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:shadow-xl transition-shadow text-center"
            >
              Back to Home
            </a>
            <a
              href="https://twitter.com/intent/tweet?text=I%20just%20joined%20the%20waitlist%20for%20Teama%20AI%20%E2%80%93%20AI-powered%20productivity%20for%20teams!&url=https://yourapp.com/waitlist"
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 border-2 border-purple-600 text-purple-600 px-6 py-3 rounded-lg font-semibold hover:bg-purple-50 transition-colors text-center"
            >
              Share on Twitter
            </a>
          </div>
        </div>
      </div>
    );
  }

  // Main Waitlist Page
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-600 via-blue-600 to-purple-700">
      <SEO 
        title="Early Access Waitlist" 
        description="Join the Teama AI waitlist to be among the first teams to experience AI-powered clarity and productivity."
      />
      
      <header>
        {/* Navigation */}
        <nav className="max-w-6xl mx-auto px-8 py-6" aria-label="Waitlist Navigation">
          <a href="/" className="flex items-center gap-2 text-white font-bold text-xl hover:opacity-80 transition-opacity">
            <img src="/logo.png" alt="Teama AI - AI Productivity Platform Logo" className="w-8 h-8 object-contain" />
            Teama AI
          </a>
        </nav>
      </header>

      <main>
        {/* Hero Section */}
        <section className="max-w-6xl mx-auto px-8 py-12 md:py-20">
          <header className="text-center mb-12">
            <div className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-sm px-4 py-2 rounded-full text-white mb-6">
              <Sparkles size={16} aria-hidden="true" />
              <span className="text-sm font-medium">Coming Soon • Early Access</span>
            </div>

            <h1 className="text-4xl md:text-6xl font-bold text-white mb-6 leading-tight">
              AI-Powered Productivity<br />for Modern Teams
            </h1>

            <p className="text-xl md:text-2xl text-purple-100 max-w-3xl mx-auto mb-8 leading-relaxed">
              Stop losing context in Slack. Teama AI turns your workspace chaos into clear, actionable insights.
            </p>

            {waitlistCount !== null && waitlistCount > 0 && (
              <div className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-sm px-6 py-3 rounded-full text-white mb-4">
                <Users size={20} aria-hidden="true" />
                <span className="font-semibold">{waitlistCount.toLocaleString()}</span>
                <span className="opacity-90">
                  {waitlistCount === 1 ? 'person has' : 'people have'} joined
                </span>
              </div>
            )}
          </header>

          {/* Two Column Layout */}
          <div className="grid lg:grid-cols-2 gap-8 items-start max-w-5xl mx-auto">
            {/* Waitlist Form */}
            <div className="order-2 lg:order-1">
              <section className="bg-white rounded-3xl shadow-2xl p-8">
                <h2 className="text-2xl font-bold text-slate-900 mb-2">Join the Waitlist</h2>
                <p className="text-slate-600 mb-6">
                  Be first to know when we launch. Get exclusive early access.
                </p>

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-2">
                      Work Email *
                    </label>
                    <input
                      id="email"
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleChange}
                      required
                      placeholder="you@company.com"
                      className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-all"
                    />
                  </div>

                  <div>
                    <label htmlFor="name" className="block text-sm font-medium text-slate-700 mb-2">
                      Name
                    </label>
                    <input
                      id="name"
                      type="text"
                      name="name"
                      value={formData.name}
                      onChange={handleChange}
                      placeholder="John Doe"
                      className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-all"
                    />
                  </div>

                  <div>
                    <label htmlFor="company" className="block text-sm font-medium text-slate-700 mb-2">
                      Company
                    </label>
                    <input
                      id="company"
                      type="text"
                      name="company"
                      value={formData.company}
                      onChange={handleChange}
                      placeholder="Acme Inc"
                      className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-all"
                    />
                  </div>

                  <div>
                    <label htmlFor="role" className="block text-sm font-medium text-slate-700 mb-2">
                      Role
                    </label>
                    <select
                      id="role"
                      name="role"
                      value={formData.role}
                      onChange={handleChange}
                      className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-all"
                    >
                      <option value="">Select your role...</option>
                      <option value="founder">Founder/CEO</option>
                      <option value="manager">Engineering Manager</option>
                      <option value="pm">Product Manager</option>
                      <option value="engineer">Engineer</option>
                      <option value="designer">Designer</option>
                      <option value="other">Other</option>
                    </select>
                  </div>

                  <div>
                    <label htmlFor="referralSource" className="block text-sm font-medium text-slate-700 mb-2">
                      How did you hear about us?
                    </label>
                    <select
                      id="referralSource"
                      name="referralSource"
                      value={formData.referralSource}
                      onChange={handleChange}
                      className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-all"
                    >
                      <option value="">Select...</option>
                      <option value="twitter">Twitter</option>
                      <option value="linkedin">LinkedIn</option>
                      <option value="friend">Friend/Colleague</option>
                      <option value="search">Google Search</option>
                      <option value="producthunt">Product Hunt</option>
                      <option value="other">Other</option>
                    </select>
                  </div>

                  {error && (
                    <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm" role="alert">
                      {error}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-gradient-to-r from-purple-600 to-blue-600 text-white py-3 rounded-lg font-semibold hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {loading ? (
                      <>
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        Joining...
                      </>
                    ) : (
                      <>
                        Join Waitlist
                        <ArrowRight size={20} aria-hidden="true" />
                      </>
                    )}
                  </button>

                  <p className="text-xs text-slate-500 text-center">
                    We'll never spam you. Unsubscribe anytime.
                  </p>
                </form>
              </section>
            </div>

            {/* Features */}
            <div className="order-1 lg:order-2 space-y-4">
              <header className="text-white mb-6">
                <h3 className="text-xl font-bold mb-2">What you'll get:</h3>
              </header>

              {[
                {
                  icon: <Mail className="w-6 h-6" />,
                  title: 'Early Access',
                  description: 'Be first in line when we launch'
                },
                {
                  icon: <Brain className="w-6 h-6" />,
                  title: 'AI Summaries',
                  description: 'Instant context from Slack without reading everything'
                },
                {
                  icon: <Target className="w-6 h-6" />,
                  title: 'Blocker Detection',
                  description: 'AI automatically spots team blockers'
                },
                {
                  icon: <Zap className="w-6 h-6" />,
                  title: 'Team Insights',
                  description: 'Workload, health, and productivity trends'
                }
              ].map((feature, index) => (
                <article key={index} className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 text-white hover:bg-white/20 transition-all">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center flex-shrink-0">
                      {feature.icon}
                    </div>
                    <div>
                      <h3 className="text-lg font-bold mb-1">{feature.title}</h3>
                      <p className="text-purple-100 text-sm">{feature.description}</p>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* Social Proof Section */}
        <section className="max-w-6xl mx-auto px-8 pb-20">
          <div className="bg-white/10 backdrop-blur-sm rounded-3xl p-8 md:p-12 text-center text-white">
            <h2 className="text-2xl font-bold mb-4">Join forward-thinking teams</h2>
            <p className="text-purple-100 max-w-2xl mx-auto mb-8">
              Product managers, engineering leaders, and founders trust Teama AI to keep their teams aligned and productive.
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              {['Product Managers', 'Engineering Teams', 'Remote Teams', 'Startups'].map((tag, i) => (
                <span key={i} className="bg-white/20 backdrop-blur-sm px-4 py-2 rounded-full text-sm font-medium">
                  {tag}
                </span>
              ))}
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/10">
        <div className="max-w-6xl mx-auto px-8 py-8 text-center text-purple-100 text-sm">
          <div className="flex flex-wrap justify-center gap-6 mb-4">
            <a href="/privacy" className="hover:text-white transition-colors">Privacy Policy</a>
            <a href="/terms" className="hover:text-white transition-colors">Terms of Service</a>
            <a href="/refund-policy" className="hover:text-white transition-colors">Refund Policy</a>
            <a href="/security" className="hover:text-white transition-colors">Security</a>
          </div>
          <p>© 2026 Teama AI. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
};

export default Waitlist;