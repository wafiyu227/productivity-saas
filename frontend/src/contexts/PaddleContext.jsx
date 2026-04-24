/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useEffect, useState } from 'react';

const PaddleContext = createContext();

export const usePaddle = () => {
    const context = useContext(PaddleContext);
    if (!context) {
        throw new Error('usePaddle must be used within PaddleProvider');
    }
    return context;
};

export const PaddleProvider = ({ children }) => {
    const [paddleReady, setPaddleReady] = useState(false);
    const [paddleError, setPaddleError] = useState(null);

    useEffect(() => {
        const initializePaddle = async () => {
            try {
                // Check if Paddle is loaded globally
                if (typeof window === 'undefined' || !window.Paddle) {
                    throw new Error('Paddle SDK not loaded. Check that script tag is in index.html');
                }

                const clientToken = import.meta.env.VITE_PADDLE_CLIENT_TOKEN;
                if (!clientToken || clientToken.startsWith('test_')) {
                    console.warn('Paddle client token not configured or using test token');
                }

                // Set Paddle environment - defaults to production since we use live credentials
                // Set VITE_PADDLE_ENVIRONMENT=sandbox in .env to use sandbox mode
                const environment = import.meta.env.VITE_PADDLE_ENVIRONMENT || 'production';
                window.Paddle.Environment.set(environment);
                console.log(`Paddle environment set to: ${environment}`);

                // Initialize Paddle with client token
                window.Paddle.Initialize({
                    token: clientToken
                });

                setPaddleReady(true);
                console.log('✅ Paddle SDK initialized successfully');
            } catch (error) {
                console.error('❌ Failed to initialize Paddle:', error);
                setPaddleError(error.message);
                // Don't prevent app from loading, just warn
            }
        };

        // Wait a bit for the Paddle script to load from CDN
        const timer = setTimeout(initializePaddle, 1000);
        return () => clearTimeout(timer);
    }, []);

    const openCheckout = (priceId, customData = {}) => {
        if (!paddleReady) {
            console.error('❌ Paddle is not ready yet. Check VITE_PADDLE_CLIENT_TOKEN in .env');
            throw new Error('Paddle SDK not initialized');
        }

        if (!priceId) {
            console.error('❌ priceId is required to open checkout');
            throw new Error('priceId is required');
        }

        try {
            console.log(`📤 Opening Paddle checkout with priceId: ${priceId}`, customData);
            
            // Build checkout config
            const checkoutConfig = {
                items: [{ priceId, quantity: 1 }]
            };
            
            // Add customer email if available
            if (customData.email) {
                checkoutConfig.customer = {
                    email: customData.email
                };
            }
            
            // Add metadata for webhook tracking
            if (customData.userId) {
                checkoutConfig.customData = {
                    userId: customData.userId,
                    planName: customData.planName
                };
            }
            
            console.log('🎯 Checkout config:', checkoutConfig);
            window.Paddle.Checkout.open(checkoutConfig);
            console.log('✅ Paddle checkout modal opened');
        } catch (error) {
            console.error('❌ Failed to open Paddle checkout:', error);
            throw error;
        }
    };

    const value = {
        paddleReady,
        paddleError,
        openCheckout
    };

    return (
        <PaddleContext.Provider value={value}>
            {children}
        </PaddleContext.Provider>
    );
};

export default PaddleContext;
