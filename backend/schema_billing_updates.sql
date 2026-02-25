-- 1. Add subscription fields to the teams table
ALTER TABLE public.teams 
ADD COLUMN IF NOT EXISTS paystack_customer_code TEXT,
ADD COLUMN IF NOT EXISTS paystack_subscription_code TEXT,
ADD COLUMN IF NOT EXISTS plan TEXT DEFAULT 'free' CHECK (plan IN ('free', 'starter', 'growth')),
ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT 'active',
ADD COLUMN IF NOT EXISTS current_period_end TIMESTAMPTZ;

-- 2. Create team_usage table to track monthly summary limits
CREATE TABLE IF NOT EXISTS public.team_usage (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  month_year TEXT NOT NULL, -- Format: 'YYYY-MM'
  summary_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(team_id, month_year)
);

-- 3. Enable RLS on team_usage
ALTER TABLE public.team_usage ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies for team_usage
-- Users can view usage for their own teams
DROP POLICY IF EXISTS "Users can view usage for their teams" ON public.team_usage;
CREATE POLICY "Users can view usage for their teams"
  ON public.team_usage FOR SELECT
  USING (
    team_id IN (
      SELECT team_id FROM public.profiles WHERE id = auth.uid()
    )
  );

-- Only service role can insert/update usage (backend API)
-- Since RLS applies to authenticated users, service_role bypasses it by default.
-- So we don't need to add explicit INSERT/UPDATE policies for the backend.

-- 5. Refresh postgREST schema cache
NOTIFY pgrst, 'reload schema';
