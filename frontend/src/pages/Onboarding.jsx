import React, { useState } from 'react';
import { ChevronRight, Check } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const Toggle = ({ id, defaultChecked = false }) => {
    return (
        <div className="relative inline-block w-10 mr-2 align-middle select-none transition duration-200 ease-in">
            <input
                type="checkbox"
                name={id}
                id={id}
                defaultChecked={defaultChecked}
                className="peer absolute block w-6 h-6 rounded-full bg-white border-4 appearance-none cursor-pointer checked:right-0 checked:bg-vibrant-cyan checked:border-vibrant-cyan transition-all duration-200"
            />
            <label
                htmlFor={id}
                className="block overflow-hidden h-6 rounded-full bg-gray-300 cursor-pointer peer-checked:bg-vibrant-cyan transition-colors duration-200"
            ></label>
        </div>
    );
};

const Onboarding = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [title, setTitle] = useState('');
    const [fullName, setFullName] = useState(user?.user_metadata?.full_name || '');

    const handleComplete = (e) => {
        e.preventDefault();
        // Here we would typically save the profile info to the backend
        // For now, we'll just navigate to the dashboard
        navigate('/dashboard');
    };

    return (
        <div className="relative flex min-h-screen w-full flex-col bg-[#f5f8f8] dark:bg-background-dark pb-28 font-sans items-center justify-center">

            <div className="w-full max-w-md p-6">
                <div className="text-center mb-10">
                    <h1 className="text-3xl font-bold text-deep-indigo dark:text-white mb-2">Welcome to SyncSphere!</h1>
                    <p className="text-gray-500 dark:text-gray-400">Let's get you set up.</p>
                </div>

                <div className="space-y-6">
                    {/* Profile Info */}
                    <div className="rounded-xl bg-white dark:bg-gray-800 p-6 shadow-sm">
                        <h3 className="text-deep-indigo dark:text-white text-lg font-bold mb-4">Your Profile</h3>
                        <div className="space-y-4">
                            <label className="block w-full">
                                <span className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 block">Full Name</span>
                                <input
                                    className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 px-4 py-3 text-gray-900 dark:text-white focus:ring-2 focus:ring-vibrant-cyan outline-none transition-all"
                                    value={fullName}
                                    onChange={(e) => setFullName(e.target.value)}
                                    placeholder="Jane Doe"
                                />
                            </label>
                            <label className="block w-full">
                                <span className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 block">Job Title</span>
                                <input
                                    className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 px-4 py-3 text-gray-900 dark:text-white focus:ring-2 focus:ring-vibrant-cyan outline-none transition-all"
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    placeholder="Product Manager"
                                />
                            </label>
                        </div>
                    </div>

                    {/* Integrations */}
                    <div className="rounded-xl bg-white dark:bg-gray-800 p-6 shadow-sm">
                        <h3 className="text-deep-indigo dark:text-white text-lg font-bold mb-4">Connect Apps</h3>
                        <div className="space-y-4">
                            <div className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                                <div className="flex items-center gap-3">
                                    <img className="h-8 w-8" alt="Slack logo" src="https://lh3.googleusercontent.com/aida-public/AB6AXuAkKK-TTNYj-nRujJNGLz1L5rI_9e_doLWTbItIz8ujp_cJcGIzWRHfpvOVqr99bd8CJkDP1tbl_sGjJGCxHqaQuWeNFkUpkpt8gznMg5sNUsd4eTqxCjFOXvnzxVYIbxIRub_8uBMZMBcSeC6bhWaEoEe8uM9z4lMlQZIjU-N5c5_19sYMMFykhl0s9rSLtkwDigXuD-KMmlTpLVrhSM-eND7bzyNfsptWOiq816609AMK5mk1rZe0iJ8GkfB8fJAGWojMF1HqgYo" />
                                    <span className="text-slate-800 dark:text-white font-medium">Slack</span>
                                </div>
                                <Toggle id="slack-toggle" />
                            </div>
                            <div className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                                <div className="flex items-center gap-3">
                                    <img className="h-8 w-8" alt="Asana logo" src="https://lh3.googleusercontent.com/aida-public/AB6AXuAg4LY4aqJY5FTxYpGnTW7paadm453MS5vfsf02eAl7ZSoi2WtwWav6B7_O-3-eMaIakybySFKivIc0EhsX2rOf34x_DO89bBnZjz--eOTKF793K74Wgy1vxKDKrhNAgZNkdT5u8gQfIq7pc1jPOae-B3DiOpvvkjLDorIOH9Jhx_XE_U1ATGLGISCCuwmRks0E8bDDFLVlwRvzuHs_Qxb_TcKz9OGEvQBuGylafc4RiFG6ghWztn1SDEow1udcUsQsj5og7VWV0B8" />
                                    <span className="text-slate-800 dark:text-white font-medium">Asana</span>
                                </div>
                                <Toggle id="asana-toggle" />
                            </div>
                        </div>
                    </div>

                    <button
                        onClick={handleComplete}
                        className="w-full bg-primary-signup text-white font-bold py-4 px-6 rounded-xl text-lg shadow-lg hover:bg-primary-signup/90 transition-transform active:scale-[0.98]"
                    >
                        Complete Setup
                    </button>
                </div>
            </div>
        </div>
    );
};

export default Onboarding;
