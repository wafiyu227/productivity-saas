-- Migration: Add user_id to slack_summaries
ALTER TABLE public.slack_summaries ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);

-- Update RLS policies to include user-based access for safety
DROP POLICY IF EXISTS "Users can view their own summaries" ON slack_summaries;
CREATE POLICY "Users can view their own summaries"
ON slack_summaries FOR SELECT
USING (auth.uid() = user_id);

-- Refresh the schema cache
NOTIFY pgrst, 'reload schema';
