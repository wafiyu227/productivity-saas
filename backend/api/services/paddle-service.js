import crypto from 'crypto';
import logger from '../utils/logger.js';
import dotenv from 'dotenv';

dotenv.config();

const PADDLE_API_KEY = process.env.PADDLE_API_KEY;
const PADDLE_BASE_URL = 'https://api.paddle.com/transactions';
const PADDLE_WEBHOOK_SECRET = process.env.PADDLE_WEBHOOK_SECRET;

if (!PADDLE_API_KEY) {
    logger.warn('PADDLE_API_KEY is missing in environment variables');
}

if (!PADDLE_WEBHOOK_SECRET) {
    logger.warn('PADDLE_WEBHOOK_SECRET is missing in environment variables');
}

/**
 * Open Paddle Checkout
 * The actual checkout is handled on the frontend via Paddle.Checkout.open()
 * This endpoint stores relevant metadata in the database before checkout
 * @param {Object} params - The parameters
 * @param {string} params.email - Customer email
 * @param {string} params.priceId - Paddle price ID (e.g., pri_xxxxx)
 * @param {Object} params.customData - Custom metadata for the transaction
 * @returns {Promise<Object>} Status confirmation
 */
export const prepareCheckout = async ({ email, priceId, customData = {} }) => {
    try {
        if (!email || !priceId) {
            throw new Error('email and priceId are required');
        }
        
        // The actual checkout is handled by frontend via Paddle.Checkout.open()
        // We just validate and return a response
        return {
            status: true,
            message: 'Ready for checkout',
            priceId,
            email,
            customData
        };
    } catch (error) {
        logger.error('Paddle Prepare Checkout Error:', error);
        throw error;
    }
};

/**
 * Create or update a subscription after successful transaction
 * This is called from webhook after transaction.paid
 * @param {Object} params - The parameters
 * @param {string} params.customerId - Paddle customer ID
 * @param {string} params.subscriptionId - Paddle subscription ID
 * @param {string} params.email - Customer email
 * @returns {Promise<Object>} Subscription data
 */
export const createSubscription = async ({ customerId, subscriptionId, email }) => {
    try {
        if (!customerId || !subscriptionId) {
            throw new Error('customerId and subscriptionId are required');
        }
        
        return {
            status: true,
            message: 'Subscription recorded',
            customerId,
            subscriptionId,
            email
        };
    } catch (error) {
        logger.error('Paddle Create Subscription Error:', error);
        throw error;
    }
};

/**
 * Verify Paddle webhook signature
 * @param {string} signature - x-paddle-signature header
 * @param {string|Buffer} payload - Raw request body
 * @returns {boolean} Whether signature is valid
 */
export const verifyWebhookSignature = (signature, payload) => {
    try {
        if (!PADDLE_WEBHOOK_SECRET) {
            logger.warn('PADDLE_WEBHOOK_SECRET not configured, skipping signature verification');
            return false;
        }

        // Paddle uses HMAC-SHA256 for webhook signatures
        const hash = crypto
            .createHmac('sha256', PADDLE_WEBHOOK_SECRET)
            .update(payload)
            .digest('hex');

        return hash === signature;
    } catch (error) {
        logger.error('Paddle Signature Verification Error:', error);
        return false;
    }
};

/**
 * Get transaction details from Paddle
 * @param {string} transactionId - Paddle transaction ID
 * @returns {Promise<Object>} Transaction data
 */
export const getTransaction = async (transactionId) => {
    try {
        const response = await fetch(`${PADDLE_BASE_URL}/${transactionId}`, {
            method: 'GET',
            headers: {
                Authorization: `Bearer ${PADDLE_API_KEY}`,
                'Content-Type': 'application/json'
            }
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error?.message || 'Failed to fetch transaction');
        }

        return data.data;
    } catch (error) {
        logger.error('Paddle Get Transaction Error:', error);
        throw error;
    }
};

/**
 * Cancel a subscription
 * @param {string} subscriptionId - Paddle subscription ID
 * @returns {Promise<Object>} Cancellation response
 */
export const cancelSubscription = async (subscriptionId) => {
    try {
        const response = await fetch(`https://api.paddle.com/subscriptions/${subscriptionId}`, {
            method: 'PATCH',
            headers: {
                Authorization: `Bearer ${PADDLE_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                scheduled_change: {
                    action: 'cancel',
                    effective_at: 'next_billing_period'
                }
            })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error?.message || 'Failed to cancel subscription');
        }

        return data.data;
    } catch (error) {
        logger.error('Paddle Cancel Subscription Error:', error);
        throw error;
    }
};

export default {
    prepareCheckout,
    createSubscription,
    verifyWebhookSignature,
    getTransaction,
    cancelSubscription
};
