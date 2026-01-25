import { useAuth } from '../contexts/AuthContext';
import { User, Mail } from 'lucide-react';

export default function Profile() {
    const { user } = useAuth();

    return (
        <div className="p-8">
            <div className="max-w-2xl mx-auto">
                <h1 className="text-3xl font-bold text-gray-900 mb-8">Profile</h1>

                <div className="bg-white rounded-lg shadow-sm p-6">
                    <div className="flex items-center gap-4 mb-6">
                        <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
                            <User className="text-blue-600" size={32} />
                        </div>
                        <div>
                            <h2 className="text-xl font-semibold text-gray-900">
                                {user?.email?.split('@')[0]}
                            </h2>
                            <p className="text-gray-600 flex items-center gap-2">
                                <Mail size={16} />
                                {user?.email}
                            </p>
                        </div>
                    </div>

                    <div className="border-t border-gray-200 pt-6">
                        <h3 className="font-semibold text-gray-900 mb-4">Account Info</h3>
                        <dl className="space-y-3">
                            <div>
                                <dt className="text-sm text-gray-600">User ID</dt>
                                <dd className="text-sm font-mono text-gray-900">{user?.id}</dd>
                            </div>
                            <div>
                                <dt className="text-sm text-gray-600">Created</dt>
                                <dd className="text-sm text-gray-900">
                                    {new Date(user?.created_at).toLocaleDateString()}
                                </dd>
                            </div>
                        </dl>
                    </div>
                </div>
            </div>
        </div>
    );
}