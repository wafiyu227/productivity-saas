-- SQL script to fix foreign key constraints that prevent deleting users manually.
-- Run this in your Supabase SQL Editor.

-- 1. Fix for Team Invitations
-- Allows a user to be deleted even if they have sent invitations.
-- The 'invited_by' field will be set to NULL instead of blocking the deletion.
ALTER TABLE public.team_invitations 
DROP CONSTRAINT IF EXISTS team_invitations_invited_by_fkey;

ALTER TABLE public.team_invitations
ADD CONSTRAINT team_invitations_invited_by_fkey 
FOREIGN KEY (invited_by) REFERENCES auth.users(id) ON DELETE SET NULL;

-- 2. Fix for Profiles
-- Allows a team to be deleted without error (members will stay but have no team).
ALTER TABLE public.profiles 
DROP CONSTRAINT IF EXISTS profiles_team_id_fkey;

ALTER TABLE public.profiles
ADD CONSTRAINT profiles_team_id_fkey 
FOREIGN KEY (team_id) REFERENCES public.teams(id) ON DELETE SET NULL;

-- 3. Fix for Integrations
-- Ensures integration records are removed when a user is deleted.
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'integrations') THEN
        -- Check if user_id is text and convert it to uuid
        IF (SELECT data_type FROM information_schema.columns WHERE table_name = 'integrations' AND column_name = 'user_id') = 'text' THEN
            ALTER TABLE public.integrations ALTER COLUMN user_id TYPE uuid USING user_id::uuid;
        END IF;

        ALTER TABLE public.integrations 
        DROP CONSTRAINT IF EXISTS integrations_user_id_fkey;
        
        ALTER TABLE public.integrations
        ADD CONSTRAINT integrations_user_id_fkey 
        FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
    END IF;
END $$;

-- 4. Fix for User Settings
-- Ensures settings are removed when a user is deleted.
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_settings') THEN
        -- Check if user_id is text and convert it to uuid
        IF (SELECT data_type FROM information_schema.columns WHERE table_name = 'user_settings' AND column_name = 'user_id') = 'text' THEN
            ALTER TABLE public.user_settings ALTER COLUMN user_id TYPE uuid USING user_id::uuid;
        END IF;

        ALTER TABLE public.user_settings 
        DROP CONSTRAINT IF EXISTS user_settings_user_id_fkey;
        
        ALTER TABLE public.user_settings
        ADD CONSTRAINT user_settings_user_id_fkey 
        FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
    END IF;
END $$;
