-- Ensure integrations table supports Jira/Trello and team-scoped integrations.
-- Safe to run multiple times.

-- Required columns for OAuth integrations
alter table public.integrations add column if not exists team_id uuid references public.teams(id) on delete cascade;
alter table public.integrations add column if not exists scope text default 'team';
alter table public.integrations add column if not exists access_token text;
alter table public.integrations add column if not exists refresh_token text;
alter table public.integrations add column if not exists expires_at timestamp with time zone;
alter table public.integrations add column if not exists workspace_id text;
alter table public.integrations add column if not exists workspace_name text;
alter table public.integrations add column if not exists team_id_external text;
alter table public.integrations add column if not exists team_name text;

-- Scope constraint
alter table public.integrations drop constraint if exists integrations_scope_check;
alter table public.integrations add constraint integrations_scope_check
  check (scope in ('team', 'personal'));

-- Platform constraint (note: use google_calendar, not google)
alter table public.integrations drop constraint if exists integrations_platform_check;
alter table public.integrations add constraint integrations_platform_check
  check (platform in ('slack', 'asana', 'jira', 'trello', 'google_calendar', 'github'));

-- Uniqueness for one integration per scope target
create unique index if not exists integrations_team_platform_idx
  on public.integrations (team_id, platform)
  where scope = 'team';

create unique index if not exists integrations_user_platform_idx
  on public.integrations (user_id, platform)
  where scope = 'personal';

-- Refresh PostgREST schema cache (Supabase)
notify pgrst, 'reload schema';
