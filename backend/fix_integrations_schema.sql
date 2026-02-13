-- Fix for missing columns in integrations table
alter table public.integrations add column if not exists access_token text;
alter table public.integrations add column if not exists refresh_token text;
alter table public.integrations add column if not exists expires_at timestamp with time zone;
alter table public.integrations add column if not exists workspace_id text;
alter table public.integrations add column if not exists workspace_name text;
alter table public.integrations add column if not exists team_id_external text;
alter table public.integrations add column if not exists team_name text;

-- Refresh schema cache (Supabase specific hint)
notify pgrst, 'reload schema';
