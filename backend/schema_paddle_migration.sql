-- Paddle Migration: Replace Paystack with Paddle

-- 1. Add Paddle columns to teams table
ALTER TABLE public.teams 
ADD COLUMN IF NOT EXISTS paddle_customer_id TEXT,
ADD COLUMN IF NOT EXISTS paddle_subscription_id TEXT;

-- 2. Optional: Keep old Paystack columns for reference during transition
-- ALTER TABLE public.teams 
-- DROP COLUMN IF EXISTS paystack_customer_code,
-- DROP COLUMN IF EXISTS paystack_subscription_code;

-- 3. Verify plan enum is correct
-- plan should already exist with: 'free', 'starter', 'growth'

-- Note: subscription_status and current_period_end should already exist
-- These will work the same way for Paddle:
-- - subscription_status: 'active', 'cancel_at_period_end', 'canceled'
-- - current_period_end: date when current billing period ends

-- 4. Refresh postgREST schema cache
NOTIFY pgrst, 'reload schema';
