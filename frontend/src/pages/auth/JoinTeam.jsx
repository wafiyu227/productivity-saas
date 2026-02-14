import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { Loader, CheckCircle, AlertCircle, UserPlus } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL;

export default function JoinTeam() {
    const [searchParams] = useSearchParams();
    const token = searchParams.get('token');
    const navigate = useNavigate();
    const { user, signUp, signIn } = useAuth();

    const [invitation, setInvitation] = useState(null);
    const [loading, setLoading] = useState(true);
    const [joining, setJoining] = useState(false);
    const [error, setError] = useState(null);
    const [mode, setMode] = useState('signup'); // 'signup' or 'signin'
    const [formData, setFormData] = useState({
        full_name: '',
        email: '',
        password: ''
    });

    useEffect(() => {
        if (token) {
            fetchInvitation();
        } else {
            setError('Invalid invitation link');
            setLoading(false);
        }
    }, [token]);

    useEffect(() => {
        // If user is already logged in, show join confirmation
        if (user && invitation) {
            handleAcceptInvitation();
        }
    }, [user, invitation]);

    const fetchInvitation = async () => {
        try {
            const res = await fetch(`${API_URL}/api/invitations/${token}`);

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || 'Invalid invitation');
            }

            const data = await res.json();
            setInvitation(data);
            setFormData(prev => ({ ...prev, email: data.email }));
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleSignUp = async (e) => {
        e.preventDefault();
        setJoining(true);

        try {
            // Create account
            const { user: newUser, error: signUpError } = await signUp(
                formData.email,
                formData.password,
                formData.full_name
            );

            if (signUpError) throw signUpError;

            // Note: handleAcceptInvitation will be called by useEffect when user state updates
        } catch (err) {
            setError(err.message);
            setJoining(false);
        }
    };

    const handleSignIn = async (e) => {
        e.preventDefault();
        setJoining(true);

        try {
            const { error: signInError } = await signIn(formData.email, formData.password);
            if (signInError) throw signInError;

            // handleAcceptInvitation will be called by useEffect when user state updates
        } catch (err) {
            setError(err.message);
            setJoining(false);
        }
    };

    const handleAcceptInvitation = async (userId = user?.id) => {
        if (!userId) return;

        setJoining(true);

        try {
            const res = await fetch(`${API_URL}/api/invitations/${token}/accept`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId })
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || 'Failed to accept invitation');
            }

            const data = await res.json();

            // Redirect to welcome page
            navigate('/onboarding/welcome-member');
        } catch (err) {
            setError(err.message);
            setJoining(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 flex items-center justify-center">
                <Loader className="animate-spin text-white" size={48} />
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 flex items-center justify-center p-4">
                <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center">
                    <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
                        <AlertCircle className="text-red-600" size={48} />
                    </div>
                    <h1 className="text-2xl font-bold text-gray-900 mb-4">Invalid Invitation</h1>
                    <p className="text-gray-600 mb-8">{error}</p>
                    <button
                        onClick={() => navigate('/')}
                        className="w-full bg-gradient-to-r from-purple-600 to-blue-600 text-white py-3 rounded-lg font-semibold hover:shadow-lg transition"
                    >
                        Go to Home
                    </button>
                </div>
            </div>
        );
    }

    // If user is logged in, show join confirmation
    if (user) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 flex items-center justify-center p-4">
                <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center">
                    <div className="w-20 h-20 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-6">
                        <UserPlus className="text-purple-600" size={48} />
                    </div>
                    <h1 className="text-2xl font-bold text-gray-900 mb-4">
                        Join {invitation?.teams?.name}?
                    </h1>
                    <p className="text-gray-600 mb-2">
                        You've been invited by {invitation?.profiles?.full_name || 'your teammate'}
                    </p>
                    <p className="text-sm text-gray-500 mb-8">
                        Role: {invitation?.role}
                    </p>

                    {joining ? (
                        <div className="flex items-center justify-center gap-2 text-purple-600">
                            <Loader className="animate-spin" size={20} />
                            <span>Joining team...</span>
                        </div>
                    ) : (
                        <button
                            onClick={() => handleAcceptInvitation()}
                            className="w-full bg-gradient-to-r from-purple-600 to-blue-600 text-white py-3 rounded-lg font-semibold hover:shadow-lg transition"
                        >
                            Join Team
                        </button>
                    )}
                </div>
            </div>
        );
    }

    // Show signup/signin form
    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 flex items-center justify-center p-4">
            <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8">
                <div className="text-center mb-8">
                    <h1 className="text-2xl font-bold text-gray-900 mb-2">
                        Join {invitation?.teams?.name}
                    </h1>
                    <p className="text-gray-600">
                        You've been invited by {invitation?.profiles?.full_name || 'your teammate'}
                    </p>
                </div>

                {/* Mode Toggle */}
                <div className="flex gap-2 mb-6 bg-gray-100 p-1 rounded-lg">
                    <button
                        onClick={() => setMode('signup')}
                        className={`flex-1 py-2 rounded-md font-medium transition ${mode === 'signup'
                                ? 'bg-white text-purple-600 shadow-sm'
                                : 'text-gray-600 hover:text-gray-900'
                            }`}
                    >
                        Sign Up
                    </button>
                    <button
                        onClick={() => setMode('signin')}
                        className={`flex-1 py-2 rounded-md font-medium transition ${mode === 'signin'
                                ? 'bg-white text-purple-600 shadow-sm'
                                : 'text-gray-600 hover:text-gray-900'
                            }`}
                    >
                        Sign In
                    </button>
                </div>

                {mode === 'signup' ? (
                    <form onSubmit={handleSignUp} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Full Name
                            </label>
                            <input
                                type="text"
                                required
                                value={formData.full_name}
                                onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Email
                            </label>
                            <input
                                type="email"
                                required
                                value={formData.email}
                                disabled
                                className="w-full px-4 py-3 border border-gray-300 rounded-lg bg-gray-50 text-gray-600"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Password
                            </label>
                            <input
                                type="password"
                                required
                                value={formData.password}
                                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={joining}
                            className="w-full bg-gradient-to-r from-purple-600 to-blue-600 text-white py-3 rounded-lg font-semibold hover:shadow-lg transition disabled:opacity-50"
                        >
                            {joining ? 'Creating Account...' : 'Create Account & Join'}
                        </button>
                    </form>
                ) : (
                    <form onSubmit={handleSignIn} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Email
                            </label>
                            <input
                                type="email"
                                required
                                value={formData.email}
                                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Password
                            </label>
                            <input
                                type="password"
                                required
                                value={formData.password}
                                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={joining}
                            className="w-full bg-gradient-to-r from-purple-600 to-blue-600 text-white py-3 rounded-lg font-semibold hover:shadow-lg transition disabled:opacity-50"
                        >
                            {joining ? 'Signing In...' : 'Sign In & Join'}
                        </button>
                    </form>
                )}
            </div>
        </div>
    );
}
