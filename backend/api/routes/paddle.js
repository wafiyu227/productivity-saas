import express from 'express';
import logger from '../utils/logger.js';
import paddleService from '../services/paddle-service.js';
import { db } from '../services/supabase-client.js';

const router = express.Router();

const resolvePlanName = (paddleData) => {
    // Parse from custom data or metadata
    const customData = paddleData.custom_data || {};
    const planName = String(customData.planName || customData.plan_name || '').toLowerCase();
    
    if (['starter', 'growth'].includes(planName)) {
        return planName;
    }

    // Try to derive from price or product metadata
    const metadata = paddleData.metadata || {};
    const metaPlanName = String(metadata.plan_name || '').toLowerCase();
    if (['starter', 'growth'].includes(metaPlanName)) {
        return metaPlanName;
    }

    return 'growth'; // Default to growth if unable to determine
};

const buildSubscriptionUpdates = (data, planName = 'growth') => {
    const updates = {
        plan: planName,
        subscription_status: 'active'
    };

    // Extract IDs from transaction data
    if (data.customer_id) {
        updates.paddle_customer_id = String(data.customer_id);
    }

    if (data.subscription_id) {
        updates.paddle_subscription_id = String(data.subscription_id);
    }

    // Set current period end if available
    if (data.next_billed_at) {
        updates.current_period_end = new Date(data.next_billed_at).toISOString();
    }

    return updates;
};

const updateUserSubscription = async (userId, updates) => {
    if (!userId || !updates || Object.keys(updates).length === 0) {
        return false;
    }

    const { data: updateResult, error } = await db.supabase
        .from('profiles')
        .update(updates)
        .eq('id', userId)
        .select();

    if (error) {
        logger.error('Failed to update user subscription:', { error, userId, updates });
        throw error;
    }

    if (!updateResult || updateResult.length === 0) {
        logger.warn('Supabase update returned success but 0 rows affected. Check userId validity.', { userId });
        return false;
    }

    return true;
};

/**
 * Prepare checkout (frontend validation)
 * Frontend will call Paddle.Checkout.open() directly with the priceId
 */
router.post('/prepare-checkout', async (req, res) => {
    try {
        const { email, priceId, planName, userId } = req.body;

        if (!email || !priceId || !userId) {
            return res.status(400).json({ error: 'Missing required parameters: email, priceId, userId' });
        }

        const customData = {
            userId,
            planName: planName || 'growth'
        };

        const result = await paddleService.prepareCheckout({
            email,
            priceId,
            customData
        });

        res.json(result);
    } catch (error) {
        logger.error('Failed to prepare Paddle checkout:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Paddle Webhook Handler
 * Listens for transaction.paid, subscription.created, subscription.updated, subscription.canceled
 */
router.post('/webhook', async (req, res) => {
    try {
        const signature = req.headers['x-paddle-signature'];
        const payload = req.rawBody || JSON.stringify(req.body);

        if (!signature || !paddleService.verifyWebhookSignature(signature, payload)) {
            logger.warn('Invalid Paddle webhook signature');
            return res.status(400).send('Invalid signature');
        }

        const event = req.body;
        logger.info(`Received Paddle event: ${event.event_type}`, {
            data: event.data
        });

        // Handle various Paddle events
        switch (event.event_type) {
            case 'transaction.paid':
                await handleTransactionPaid(event.data);
                break;
            case 'subscription.created':
                await handleSubscriptionCreated(event.data);
                break;
            case 'subscription.updated':
                await handleSubscriptionUpdated(event.data);
                break;
            case 'subscription.canceled':
                await handleSubscriptionCanceled(event.data);
                break;
            default:
                logger.debug(`Unhandled Paddle event type: ${event.event_type}`);
        }

        // Paddle expects a 200 OK fast
        res.status(200).send('OK');
    } catch (error) {
        logger.error('Webhook processing error:', error);
        res.status(200).send('Error processing webhook');
    }
});

async function handleTransactionPaid(data) {
    logger.info('Processing transaction.paid event:', {
        transaction_id: data.id,
        customer_id: data.customer_id
    });

    const customData = data.custom_data || {};
    const userId = customData.userId;

    if (!userId) {
        logger.warn('Webhook: No userId found in custom_data', { custom_data: data.custom_data });
        return;
    }

    const planName = resolvePlanName(data);
    const updates = buildSubscriptionUpdates(data, planName);

    logger.info('Attempting DB update for transaction:', { userId, planName });
    const updated = await updateUserSubscription(userId, updates);
    if (updated) {
        logger.info(`Successfully activated ${planName} plan for user ${userId}`);
    }
}

async function handleSubscriptionCreated(data) {
    logger.info('Processing subscription.created event:', {
        subscription_id: data.id,
        customer_id: data.customer_id
    });

    const customData = data.custom_data || {};
    const userId = customData.userId;

    if (!userId) {
        logger.warn('Webhook: No userId found in custom_data', { custom_data: data.custom_data });
        return;
    }

    const planName = resolvePlanName(data);
    const updates = buildSubscriptionUpdates(data, planName);

    logger.info('Attempting DB update for subscription:', { userId, planName });
    const updated = await updateUserSubscription(userId, updates);
    if (updated) {
        logger.info(`Successfully created ${planName} subscription for user ${userId}`);
    }
}

async function handleSubscriptionUpdated(data) {
    logger.info('Processing subscription.updated event:', {
        subscription_id: data.id,
        status: data.status
    });

    const customData = data.custom_data || {};
    const userId = customData.userId;

    if (!userId) {
        logger.warn('Webhook: No userId found in custom_data', { custom_data: data.custom_data });
        return;
    }

    const planName = resolvePlanName(data);
    const updates = buildSubscriptionUpdates(data, planName);

    // Map Paddle subscription status to our status
    if (data.status === 'active') {
        updates.subscription_status = 'active';
    } else if (data.status === 'canceled') {
        updates.subscription_status = 'canceled';
    }

    logger.info('Attempting DB update for subscription update:', { userId, planName, status: data.status });
    const updated = await updateUserSubscription(userId, updates);
    if (updated) {
        logger.info(`Successfully updated subscription for user ${userId}`);
    }
}

async function handleSubscriptionCanceled(data) {
    logger.info('Processing subscription.canceled event:', {
        subscription_id: data.id,
        customer_id: data.customer_id
    });

    const customData = data.custom_data || {};
    const userId = customData.userId;

    if (!userId) {
        logger.warn('Webhook: No userId found in custom_data');
        return;
    }

    const updates = {
        subscription_status: 'canceled',
        plan: 'free'
    };

    logger.info('Attempting DB update for canceled subscription:', { userId });
    const updated = await updateUserSubscription(userId, updates);
    if (updated) {
        logger.info(`Successfully canceled subscription for user ${userId}`);
    }
}

export default router;
