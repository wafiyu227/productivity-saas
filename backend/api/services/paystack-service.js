import crypto from 'crypto';
import logger from '../utils/logger.js';
import dotenv from 'dotenv';

dotenv.config();

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;
const PAYSTACK_BASE_URL = 'https://api.paystack.co';

if (!PAYSTACK_SECRET_KEY) {
    logger.warn('PAYSTACK_SECRET_KEY is missing in environment variables');
}

/**
 * Initialize a Paystack transaction for subscription
 * @param {Object} params - The initialization parameters
 * @param {string} params.email - Customer email
 * @param {string} params.amount - Amount in lowest denomination (e.g. kobo/pesewas). Optional if plan is provided.
 * @param {string} params.plan - Paystack Plan Code (e.g., PLN_xyz)
 * @param {string} params.callback_url - Where to redirect after checkout
 * @param {Object} params.metadata - Custom metadata (e.g. team_id, user_id)
 * @returns {Promise<Object>} Paystack authorization response
 */
export const initializeTransaction = async ({ email, amount, plan, callback_url, metadata }) => {
    try {
        const body = {
            email,
            callback_url,
            metadata
        };

        if (plan) {
            body.plan = plan;
            // Paystack requires amount even with a plan — use plan amount or a fallback
            // The plan's configured amount will be used at checkout regardless
            body.amount = amount || 500; // Minimum valid amount in pesewas/kobo
        } else if (amount) {
            body.amount = amount;
        } else {
            throw new Error('Either amount or plan is required to initialize transaction');
        }

        const response = await fetch(`${PAYSTACK_BASE_URL}/transaction/initialize`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(body)
        });

        const data = await response.json();

        if (!response.ok || !data.status) {
            throw new Error(data.message || 'Failed to initialize Paystack transaction');
        }

        return data.data; // contains authorization_url, access_code, reference
    } catch (error) {
        logger.error('Paystack Initialize Transaction Error:', error);
        throw error;
    }
};

/**
 * Generate a subscription management link for a customer
 * @param {string} subscriptionCode - The Paystack subscription code
 * @returns {Promise<string>} The billing portal link
 */
export const generateManageSubscriptionLink = async (subscriptionCode) => {
    try {
        const response = await fetch(`${PAYSTACK_BASE_URL}/subscription/${subscriptionCode}/manage/link`, {
            method: 'GET',
            headers: {
                Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
                'Content-Type': 'application/json'
            }
        });

        const data = await response.json();

        if (!response.ok || !data.status) {
            throw new Error(data.message || 'Failed to generate subscription manage link');
        }

        return data.data.link;
    } catch (error) {
        logger.error('Paystack Manage Subscription Error:', error);
        throw error;
    }
};

/**
 * Verify a transaction using its reference
 * @param {string} reference - Paystack transaction reference
 * @returns {Promise<Object>} Verified transaction payload
 */
export const verifyTransaction = async (reference) => {
    try {
        const response = await fetch(`${PAYSTACK_BASE_URL}/transaction/verify/${encodeURIComponent(reference)}`, {
            method: 'GET',
            headers: {
                Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
                'Content-Type': 'application/json'
            }
        });

        const data = await response.json();

        if (!response.ok || !data.status) {
            throw new Error(data.message || 'Failed to verify transaction');
        }

        return data.data;
    } catch (error) {
        logger.error('Paystack Verify Transaction Error:', error);
        throw error;
    }
};

/**
 * Find the most recent active-like subscription for a customer
 * @param {string} customerCodeOrEmail - Customer code or email
 * @returns {Promise<Object|null>} Subscription object or null
 */
export const getCustomerActiveSubscription = async (customerCodeOrEmail) => {
    try {
        const customer = await getCustomer(customerCodeOrEmail);
        if (!customer) return null;

        const subscriptions = Array.isArray(customer.subscriptions) ? customer.subscriptions : [];
        if (!subscriptions.length) return null;

        const activeStatuses = new Set(['active', 'attention', 'non-renewing']);
        const activeSubs = subscriptions.filter((subscription) =>
            activeStatuses.has(String(subscription?.status || '').toLowerCase())
        );

        const candidateSubs = activeSubs.length ? activeSubs : subscriptions;
        const sortedSubs = [...candidateSubs].sort((a, b) => {
            const aTime = new Date(a?.updatedAt || a?.updated_at || a?.createdAt || a?.created_at || 0).getTime();
            const bTime = new Date(b?.updatedAt || b?.updated_at || b?.createdAt || b?.created_at || 0).getTime();
            return bTime - aTime;
        });

        return sortedSubs[0] || null;
    } catch (error) {
        logger.error('Paystack Get Customer Active Subscription Error:', error);
        throw error;
    }
};

/**
 * Verify Paystack webhook signature
 * @param {string} signature - x-paystack-signature header
 * @param {string|Buffer} payload - Raw request body
 * @returns {boolean} Whether signature is valid
 */
export const verifyWebhookSignature = (signature, payload) => {
    try {
        const hash = crypto
            .createHmac('sha512', PAYSTACK_SECRET_KEY)
            .update(payload)
            .digest('hex');

        return hash === signature;
    } catch (error) {
        logger.error('Paystack Signature Verification Error:', error);
        return false;
    }
};

/**
 * Fetch a customer's details from Paystack
 * @param {string} emailOrCode - Customer's email or customer code
 */
export const getCustomer = async (emailOrCode) => {
    try {
        const response = await fetch(`${PAYSTACK_BASE_URL}/customer/${emailOrCode}`, {
            method: 'GET',
            headers: {
                Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
                'Content-Type': 'application/json'
            }
        });

        const data = await response.json();

        if (!response.ok || !data.status) {
            return null; // Customer not found
        }

        return data.data;
    } catch (error) {
        logger.error('Paystack Get Customer Error:', error);
        throw error;
    }
};

export default {
    initializeTransaction,
    generateManageSubscriptionLink,
    verifyTransaction,
    getCustomerActiveSubscription,
    verifyWebhookSignature,
    getCustomer
};
