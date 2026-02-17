-- Fix for Team Creation Functionality

-- 1. Ensure Profiles table has all necessary columns
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS full_name TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS current_team_id UUID REFERENCES public.teams(id);
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS onboarding_step TEXT;

-- 2. Ensure Team Members table exists with correct schema
CREATE TABLE IF NOT EXISTS public.team_members (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  role TEXT DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'invited', 'inactive')),
  joined_via TEXT CHECK (joined_via IN ('creator', 'invitation', 'domain')),
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  UNIQUE(team_id, user_id)
);

-- Enable RLS for team_members if not already enabled
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;

-- 3. RLS Policies for Teams
-- Ensure creators can see their team even before team_members link is established (for .select() after insert)
DROP POLICY IF EXISTS "Creators can see their own teams" ON public.teams;
CREATE POLICY "Creators can see their own teams"
  ON public.teams FOR SELECT
  USING (auth.uid() = created_by);

-- 4. RLS Policies for Team Members
-- Allow users to see their own memberships
DROP POLICY IF EXISTS "Users can view their own memberships" ON public.team_members;
CREATE POLICY "Users can view their own memberships"
  ON public.team_members FOR SELECT
  USING (auth.uid() = user_id);

-- Allow insertion into team_members (needed during team creation)
DROP POLICY IF EXISTS "Users can join teams they create" ON public.team_members;
CREATE POLICY "Users can join teams they create"
  ON public.team_members FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- 5. Helper Function to link existing profile team_id (if any)
INSERT INTO public.team_members (team_id, user_id, role, status, joined_via)
SELECT team_id, id, 'owner', 'active', 'creator'
FROM public.profiles
WHERE team_id IS NOT NULL
ON CONFLICT (team_id, user_id) DO NOTHING;

-- Refresh schema cache
NOTIFY pgrst, 'reload schema';
