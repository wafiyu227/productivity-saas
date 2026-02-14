-- Fix User Deletion Error: Ensure foreign key constraints don't block deletion
-- These updates add ON DELETE CASCADE or ON DELETE SET NULL to references

-- 1. slack_summaries: Delete summaries when the user is deleted
ALTER TABLE public.slack_summaries 
  DROP CONSTRAINT IF EXISTS slack_summaries_user_id_fkey,
  ADD CONSTRAINT slack_summaries_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- 2. team_invitations: Delete invitations sent by the user
ALTER TABLE public.team_invitations
  DROP CONSTRAINT IF EXISTS team_invitations_invited_by_fkey,
  ADD CONSTRAINT team_invitations_invited_by_fkey
  FOREIGN KEY (invited_by) REFERENCES auth.users(id) ON DELETE CASCADE;

-- 3. team_members: Keep entry but clear inviter field if inviter is deleted
ALTER TABLE public.team_members
  DROP CONSTRAINT IF EXISTS team_members_invited_by_fkey,
  ADD CONSTRAINT team_members_invited_by_fkey
  FOREIGN KEY (invited_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

-- 4. teams: Keep team but clear creator field if creator is deleted
ALTER TABLE public.teams
  DROP CONSTRAINT IF EXISTS teams_created_by_fkey,
  ADD CONSTRAINT teams_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
