import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { usePaddle } from '../../contexts/PaddleContext';

const API_URL = import.meta.env.VITE_API_URL;
const VALID_PLANS = new Set(['free', 'starter', 'growth']);

export default function TeamSetup() {
    const { user, refreshProfile } = useAuth();
    const { paddleReady, openCheckout } = usePaddle();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const requestedPlan = (searchParams.get('plan') || '').toLowerCase();
    const selectedPlan = VALID_PLANS.has(requestedPlan)
        ? requestedPlan
        : 'free';
    const [loading, setLoading] = useState(false);
    const [successMessage, setSuccessMessage] = useState('');
    const [formData, setFormData] = useState({
        name: '',
        size_range: '',
        description: ''
    });

    useEffect(() => {
        // ✅ NEW: Show success message if user just signed up via Google
        const signupSuccessStr = sessionStorage.getItem('signup_success');
        if (signupSuccessStr) {
            try {
                const signupSuccess = JSON.parse(signupSuccessStr);
                setSuccessMessage(signupSuccess.message);
                sessionStorage.removeItem('signup_success');
            } catch (e) {
                console.error('Error parsing signup success:', e);
            }
        }
    }, []);

    const startCheckoutForPlan = async (team) => {
        if (!paddleReady) {
            alert('Payment system is not ready yet. Please try again in a moment.');
            navigate('/onboarding/connect-tools');
            return;
        }

        const priceId = selectedPlan === 'starter'
            ? import.meta.env.VITE_PADDLE_STARTER_PRICE_ID
            : import.meta.env.VITE_PADDLE_GROWTH_PRICE_ID;

        if (!priceId) {
            alert(`Price IDs not configured for ${selectedPlan}. Continuing with Free for now.`);
            navigate('/onboarding/connect-tools');
            return;
        }

        try {
            // Prepare checkout on backend (stores metadata)
            const prepareRes = await fetch(`${API_URL}/api/paddle/prepare-checkout`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: user.email,
                    priceId,
                    planName: selectedPlan,
                    teamId: team.id,
                    userId: user.id
                })
            });

            if (!prepareRes.ok) {
                const error = await prepareRes.json();
                throw new Error(error.error || 'Failed to prepare checkout');
            }

            // Open Paddle checkout
            openCheckout(priceId, {
                email: user.email,
                teamId: team.id,
                userId: user.id,
                planName: selectedPlan
            });
        } catch (error) {
            console.error('Checkout error:', error);
            alert(error.message || 'Failed to start checkout');
            navigate('/onboarding/connect-tools');
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);

        try {
            const res = await fetch(`${API_URL}/api/teams`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: user.id,
                    ...formData
                })
            });

            if (!res.ok) throw new Error('Failed to create team');

            const team = await res.json();

            // Store team ID for next step
            sessionStorage.setItem('onboarding_team_id', team.id);

            // Refresh profile so AuthContext has the new team data
            await refreshProfile();

            if (selectedPlan === 'starter' || selectedPlan === 'growth') {
                await startCheckoutForPlan(team);
                return;
            }

            navigate('/onboarding/connect-tools');
        } catch (error) {
            console.error('Team creation error:', error);
            alert(error.message || 'Failed to complete setup. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 flex items-center justify-center p-4">
            <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8">
                <div className="flex flex-col items-center mb-8">
                    <img src="/logo.png" alt="Teama AI Logo" className="w-12 h-12 object-contain mb-4" />
                    <h1 className="text-3xl font-bold text-gray-900 mb-2 text-center">Create Your Team</h1>
                </div>
                <p className="text-gray-600 mb-8">
                    Set up your team workspace to get started with Teama AI.
                </p>

                {successMessage && (
                    <div className="mb-6 p-4 bg-green-100 text-green-800 rounded-lg border border-green-300">
                        <p className="font-medium">✅ {successMessage}</p>
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Team Name *
                        </label>
                        <input
                            type="text"
                            required
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            placeholder="e.g., Marketing Team, Acme Inc"
                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Team Size
                        </label>
                        <select
                            value={formData.size_range}
                            onChange={(e) => setFormData({ ...formData, size_range: e.target.value })}
                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        >
                            <option value="">Select size</option>
                            <option value="2-10">2-10 people</option>
                            <option value="11-50">11-50 people</option>
                            <option value="51-200">51-200 people</option>
                            <option value="201+">201+ people</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Description (Optional)
                        </label>
                        <textarea
                            value={formData.description}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            placeholder="What does your team do?"
                            rows={3}
                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-gradient-to-r from-purple-600 to-blue-600 text-white py-3 rounded-lg font-semibold hover:shadow-lg transition disabled:opacity-50"
                    >
                        {loading ? 'Creating...' : 'Continue →'}
                    </button>
                </form>
            </div>
        </div>
    );
}
