import express from 'express';
import logger from '../utils/logger.js';
import paystackService from '../services/paystack-service.js';
import { db } from '../services/supabase-client.js';
import { requireTeamAdmin } from '../utils/team-permissions.js';

const router = express.Router();

const DEFAULT_CALLBACK_PATH = '/app/team?payment=success';

const resolveCheckoutCallbackUrl = (callbackPath) => {
    const frontendBase = (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/+$/, '');

    if (typeof callbackPath !== 'string' || !callbackPath.startsWith('/')) {
        return `${frontendBase}${DEFAULT_CALLBACK_PATH}`;
    }

    try {
        const fullUrl = new URL(callbackPath, frontendBase);
        const frontendOrigin = new URL(frontendBase).origin;
        if (fullUrl.origin !== frontendOrigin) {
            return `${frontendBase}${DEFAULT_CALLBACK_PATH}`;
        }
        return fullUrl.toString();
    } catch {
        return `${frontendBase}${DEFAULT_CALLBACK_PATH}`;
    }
};

const normalizeMetadata = (metadataCandidate) => {
    if (!metadataCandidate) return {};

    if (typeof metadataCandidate === 'string') {
        const trimmed = metadataCandidate.trim();
        if (!trimmed) return {};

        try {
            const parsed = JSON.parse(trimmed);
            return parsed && typeof parsed === 'object' ? parsed : {};
        } catch {
            return {};
        }
    }

    return typeof metadataCandidate === 'object' ? metadataCandidate : {};
};

const extractTeamIdFromMetadata = (metadata) => {
    const directTeamId = metadata.teamId || metadata.team_id || metadata.teamID;
    if (directTeamId) return directTeamId;

    const customFields = Array.isArray(metadata.custom_fields) ? metadata.custom_fields : [];
    const teamField = customFields.find((field) => {
        const variableName = String(field?.variable_name || field?.key || '').toLowerCase();
        return variableName === 'teamid' || variableName === 'team_id';
    });

    return teamField?.value || null;
};

const resolvePlanName = (data, metadata = {}) => {
    const metadataPlanName = String(metadata.plan_name || metadata.planName || '').toLowerCase();
    if (metadataPlanName === 'starter' || metadataPlanName === 'growth') {
        return metadataPlanName;
    }

    const paystackPlanName = String(data.plan?.name || data.plan_object?.name || '').toLowerCase();
    if (paystackPlanName.includes('growth')) return 'growth';
    if (paystackPlanName.includes('starter')) return 'starter';

    const planCode = String(
        metadata.plan_code
        || metadata.planCode
        || data.plan?.plan_code
        || data.plan_object?.plan_code
        || data.plan_code
        || data.plan
        || ''
    ).trim();

    if (planCode && process.env.PAYSTACK_GROWTH_PLAN && planCode === process.env.PAYSTACK_GROWTH_PLAN) {
        return 'growth';
    }

    if (planCode && process.env.PAYSTACK_STARTER_PLAN && planCode === process.env.PAYSTACK_STARTER_PLAN) {
        return 'starter';
    }

    const normalizedPlanCode = planCode.toLowerCase();
    if (normalizedPlanCode.includes('growth')) return 'growth';
    if (normalizedPlanCode.includes('starter')) return 'starter';

    return 'starter';
};

const buildTeamUpdates = (data, planName) => {
    const updates = {
        paystack_customer_code: data.customer?.customer_code,
        paystack_subscription_code: data.subscription_code || data.subscription?.subscription_code,
        subscription_status: 'active',
        plan: planName
    };

    const nextPaymentDate = data.next_payment_date
        || data.subscription?.next_payment_date
        || data.plan_object?.next_payment_date;

    if (nextPaymentDate) {
        updates.current_period_end = new Date(nextPaymentDate).toISOString();
    }

    return updates;
};

const updateTeamSubscription = async (teamId, updates) => {
    const { data: updateResult, error } = await db.supabase
        .from('teams')
        .update(updates)
        .eq('id', teamId)
        .select();

    if (error) {
        logger.error('Failed to update team subscription in Supabase:', { error, teamId });
        throw error;
    }

    if (!updateResult || updateResult.length === 0) {
        logger.warn('Supabase update returned success but 0 rows affected. Check teamId validity.', { teamId });
        return false;
    }

    return true;
};

const backfillSubscriptionCodeFromCustomer = async (teamId, customerCode, currentPeriodEnd) => {
    if (!customerCode) return null;

    const activeSubscription = await paystackService.getCustomerActiveSubscription(customerCode);
    const subscriptionCode = activeSubscription?.subscription_code || null;

    if (!subscriptionCode) return null;

    const patch = {
        paystack_subscription_code: subscriptionCode,
        subscription_status: 'active'
    };

    const nextPaymentDate = activeSubscription?.next_payment_date;
    if (nextPaymentDate && !currentPeriodEnd) {
        patch.current_period_end = new Date(nextPaymentDate).toISOString();
    }

    const { error } = await db.supabase
        .from('teams')
        .update(patch)
        .eq('id', teamId);

    if (error) {
        logger.error('Failed to backfill subscription code from Paystack customer:', { error, teamId, customerCode });
        throw error;
    }

    return subscriptionCode;
};

/**
 * Initialize checkout transaction
 */
router.post('/initialize', async (req, res) => {
    try {
        const { email, plan, planName, teamId, userId, callbackPath } = req.body;

        if (!email || !plan || !teamId || !userId) {
            return res.status(400).json({ error: 'Missing required parameters' });
        }

        await requireTeamAdmin(teamId, userId);

        const normalizedPlanName = ['starter', 'growth'].includes(String(planName || '').toLowerCase())
            ? String(planName).toLowerCase()
            : undefined;

        // Frontend URL where user returns after payment
        const callback_url = resolveCheckoutCallbackUrl(callbackPath);

        const metadata = {
            teamId,
            userId,
            plan_code: plan
        };

        if (normalizedPlanName) {
            metadata.plan_name = normalizedPlanName;
        }

        const amount = String(planName).toLowerCase() === 'growth'
            ? process.env.PAYSTACK_GROWTH_AMOUNT
            : (String(planName).toLowerCase() === 'starter' ? process.env.PAYSTACK_STARTER_AMOUNT : null);

        const transaction = await paystackService.initializeTransaction({
            email,
            amount, // Added mandatory amount for GHS accounts
            plan, // This should be the PLN_... code
            callback_url,
            metadata
        });

        res.json({ checkoutUrl: transaction.authorization_url });
    } catch (error) {
        logger.error('Failed to initialize Paystack transaction:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Generate manage subscription link
 */
router.post('/manage', async (req, res) => {
    try {
        const { teamId, userId } = req.body;

        if (!teamId || !userId) {
            return res.status(400).json({ error: 'teamId and userId required' });
        }

        await requireTeamAdmin(teamId, userId);

        const { data: team } = await db.supabase
            .from('teams')
            .select('id, paystack_subscription_code, paystack_customer_code, current_period_end')
            .eq('id', teamId)
            .single();

        if (!team) {
            return res.status(404).json({ error: 'Team not found' });
        }

        let subscriptionCode = team.paystack_subscription_code;

        if (!subscriptionCode) {
            subscriptionCode = await backfillSubscriptionCodeFromCustomer(
                team.id,
                team.paystack_customer_code,
                team.current_period_end
            );
        }

        if (!subscriptionCode) {
            return res.status(400).json({
                error: 'No active Paystack subscription code found yet. Please try again in a few seconds.'
            });
        }

        let manageLink;
        try {
            manageLink = await paystackService.generateManageSubscriptionLink(subscriptionCode);
        } catch (manageError) {
            // If stored code is stale, refresh from customer and retry once.
            const refreshedCode = await backfillSubscriptionCodeFromCustomer(
                team.id,
                team.paystack_customer_code,
                team.current_period_end
            );

            if (!refreshedCode || refreshedCode === subscriptionCode) {
                throw manageError;
            }

            manageLink = await paystackService.generateManageSubscriptionLink(refreshedCode);
        }

        res.json({ manageUrl: manageLink });
    } catch (error) {
        logger.error('Failed to generate manage subscription link:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Verify transaction after redirect and persist subscription update
 */
router.post('/verify', async (req, res) => {
    try {
        const { reference } = req.body;

        if (!reference) {
            return res.status(400).json({ error: 'reference required' });
        }

        const transaction = await paystackService.verifyTransaction(reference);

        if (transaction.status !== 'success') {
            return res.status(400).json({
                error: `Transaction not successful yet (status: ${transaction.status || 'unknown'})`
            });
        }

        const transactionMetadata = normalizeMetadata(transaction.metadata);
        const customerMetadata = normalizeMetadata(transaction.customer?.metadata);
        const metadata = { ...customerMetadata, ...transactionMetadata };
        const teamId = extractTeamIdFromMetadata(metadata);

        if (!teamId) {
            logger.warn('Verify endpoint: No teamId found in metadata', {
                reference,
                metadata_keys: Object.keys(metadata || {})
            });

            return res.status(400).json({
                error: 'Could not map payment to a team. teamId missing in metadata.'
            });
        }

        const planName = resolvePlanName(transaction, metadata);
        const updates = buildTeamUpdates(transaction, planName);
        if (!updates.paystack_subscription_code && updates.paystack_customer_code) {
            const activeSubscription = await paystackService.getCustomerActiveSubscription(updates.paystack_customer_code);
            const fallbackCode = activeSubscription?.subscription_code;
            if (fallbackCode) {
                updates.paystack_subscription_code = fallbackCode;
            }
        }

        logger.info('Attempting DB update from verify endpoint:', { teamId, planName, reference });
        await updateTeamSubscription(teamId, updates);

        res.json({
            success: true,
            teamId,
            plan: planName,
            subscription_status: 'active'
        });
    } catch (error) {
        logger.error('Failed to verify Paystack transaction:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Paystack Webhook Handler
 */
router.post('/webhook', async (req, res) => {
    try {
        const signature = req.headers['x-paystack-signature'];

        // Use req.rawBody that we preserved in api/index.js express.json() config
        const payload = req.rawBody || JSON.stringify(req.body);

        if (!signature || !paystackService.verifyWebhookSignature(signature, payload)) {
            logger.warn('Invalid Paystack webhook signature');
            return res.status(400).send('Invalid signature');
        }

        const event = req.body;
        logger.info(`Received Paystack event: ${event.event}`, { reference: event.data?.reference });

        // Handle various subscription events
        switch (event.event) {
            case 'subscription.create':
            case 'charge.success':
                await handleSubscriptionCreatedOrUpdated(event.data);
                break;
            case 'subscription.not_renew':
                await handleSubscriptionSetToNotRenew(event.data);
                break;
            case 'subscription.disable':
                await handleSubscriptionCanceled(event.data);
                break;
            default:
                logger.debug(`Unhandled Paystack event type: ${event.event}`);
        }

        // Paystack expects a 200 OK fast
        res.status(200).send('OK');
    } catch (error) {
        logger.error('Webhook processing error:', error);
        res.status(200).send('Error processing webhook');
    }
});

async function handleSubscriptionCreatedOrUpdated(data) {
    logger.info('Processing subscription/charge event:', {
        reference: data.reference,
        subscription_code: data.subscription_code
    });

    const dataMetadata = normalizeMetadata(data.metadata);
    const customerMetadata = normalizeMetadata(data.customer?.metadata);
    const metadata = { ...customerMetadata, ...dataMetadata };

    // Try multiple paths to find teamId
    const teamId = extractTeamIdFromMetadata(metadata);

    if (!teamId) {
        logger.warn('Webhook: No teamId found in metadata. Full data structure for debugging:', {
            event_keys: Object.keys(data),
            metadata_type: typeof data.metadata,
            metadata_keys: Object.keys(metadata || {}),
            data_metadata: data.metadata,
            customer_metadata: data.customer?.metadata
        });
        return;
    }

    const planName = resolvePlanName(data, metadata);
    const updates = buildTeamUpdates(data, planName);
    if (!updates.paystack_subscription_code && updates.paystack_customer_code) {
        const activeSubscription = await paystackService.getCustomerActiveSubscription(updates.paystack_customer_code);
        const fallbackCode = activeSubscription?.subscription_code;
        if (fallbackCode) {
            updates.paystack_subscription_code = fallbackCode;
        }
    }

    logger.info('Attempting DB update for team:', { teamId, planName });
    const updated = await updateTeamSubscription(teamId, updates);
    if (updated) {
        logger.info(`Successfully activated ${planName} plan for team ${teamId}`);
    }
}

async function handleSubscriptionCanceled(data) {
    const customerCode = data.customer?.customer_code;

    if (!customerCode) return;

    // Downgrade to free plan
    const { error } = await db.supabase
        .from('teams')
        .update({
            subscription_status: 'canceled',
            plan: 'free',
            current_period_end: new Date().toISOString()
        })
        .eq('paystack_customer_code', customerCode);

    if (error) {
        logger.error('Failed to process canceled subscription:', { error, customerCode });
        throw error;
    }
}

async function handleSubscriptionSetToNotRenew(data) {
    const customerCode = data.customer?.customer_code;
    if (!customerCode) return;

    const updates = {
        // Monthly subscriptions usually remain active until current period end.
        subscription_status: 'cancel_at_period_end'
    };

    const periodEnd = data.next_payment_date || data.subscription?.next_payment_date;
    if (periodEnd) {
        updates.current_period_end = new Date(periodEnd).toISOString();
    }

    const { error } = await db.supabase
        .from('teams')
        .update(updates)
        .eq('paystack_customer_code', customerCode);

    if (error) {
        logger.error('Failed to process non-renewing subscription state:', { error, customerCode });
        throw error;
    }
}

export default router;
