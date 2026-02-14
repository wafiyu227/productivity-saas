import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

const API_URL = import.meta.env.VITE_API_URL;

export default function TeamSetup() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        name: '',
        size_range: '',
        description: ''
    });

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

            navigate('/onboarding/connect-tools');
        } catch (error) {
            console.error('Team creation error:', error);
            alert('Failed to create team. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 flex items-center justify-center p-4">
            <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8">
                <h1 className="text-3xl font-bold text-gray-900 mb-2">Create Your Team</h1>
                <p className="text-gray-600 mb-8">
                    Set up your team workspace to get started with Teama AI.
                </p>

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
