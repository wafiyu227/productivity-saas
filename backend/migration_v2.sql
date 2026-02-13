-- Migration v2: Team-First Architecture
-- This script updates the schema to support shared team integrations and member management.

-- 1. CLEANUP / PREPARATION
-- (Optional: Drop old policies if they're too permissive)

-- 2. TEAMS TABLE UPDATES
alter table public.teams add column if not exists description text;
alter table public.teams add column if not exists created_by uuid references auth.users(id);
alter table public.teams add column if not exists settings jsonb default '{
  "timezone": "UTC",
  "work_hours": {"start": "09:00", "end": "17:00"},
  "working_days": [1,2,3,4,5]
}'::jsonb;
alter table public.teams add column if not exists updated_at timestamp with time zone default timezone('utc'::text, now());

-- 3. PROFILES TABLE UPDATES
alter table public.profiles add column if not exists current_team_id uuid references public.teams(id);

-- 4. TEAM MEMBERS TABLE (Junction)
create table if not exists public.team_members (
  id uuid default gen_random_uuid() primary key,
  team_id uuid references public.teams(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  role text default 'member' check (role in ('owner', 'admin', 'member')),
  status text default 'active' check (status in ('active', 'invited', 'inactive')),
  invited_by uuid references public.profiles(id),
  joined_at timestamp with time zone default timezone('utc'::text, now()),
  created_at timestamp with time zone default timezone('utc'::text, now()),
  unique(team_id, user_id)
);

-- 5. TEAM INVITATIONS UPDATES
alter table public.team_invitations add column if not exists role text default 'member' check (role in ('admin', 'member'));
alter table public.team_invitations add column if not exists expires_at timestamp with time zone default (now() + interval '7 days');
alter table public.team_invitations add column if not exists accepted_at timestamp with time zone;
-- Note: status enum extension needs care. SQLite/Postgres enum handling differs. 
-- Using text with check constraint for flexibility.
alter table public.team_invitations drop constraint if exists team_invitations_status_check;
alter table public.team_invitations add constraint team_invitations_status_check 
  check (status in ('pending', 'accepted', 'expired', 'cancelled'));

-- 6. INTEGRATIONS TABLE UPDATES
-- First ensure integrations table exists
create table if not exists public.integrations (
  id uuid default gen_random_uuid() primary key,
  team_id uuid references public.teams(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade not null,
  platform text not null,
  scope text default 'team' check (scope in ('team', 'personal')),
  access_token text,
  refresh_token text,
  expires_at timestamp with time zone,
  workspace_id text,
  workspace_name text,
  team_id_external text,
  team_name text,
  bot_user_id text, -- Added for Slack
  created_at timestamp with time zone default timezone('utc'::text, now()),
  updated_at timestamp with time zone default timezone('utc'::text, now())
);

-- Ensure columns exist if table was already there
alter table public.integrations add column if not exists team_id uuid references public.teams(id) on delete cascade;
alter table public.integrations add column if not exists scope text default 'team' check (scope in ('team', 'personal'));

-- 6b. USER SETTINGS TABLE
create table if not exists public.user_settings (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null unique,
  email_notifications boolean default true,
  slack_notifications boolean default true,
  blocker_alerts boolean default false,
  daily_digest boolean default true,
  appearance text default 'light',
  created_at timestamp with time zone default timezone('utc'::text, now()),
  updated_at timestamp with time zone default timezone('utc'::text, now())
);

-- Ensure user_id type if table existed (handling TEXT to UUID migration)
do $$ 
begin 
    if (select data_type from information_schema.columns where table_name = 'user_settings' and column_name = 'user_id') = 'text' then
        alter table public.user_settings alter column user_id type uuid using user_id::uuid;
    end if;
end $$;

-- Ensure unique constraints for scoped integrations
alter table public.integrations drop constraint if exists integrations_team_platform_unique;
create unique index if not exists integrations_team_platform_idx on public.integrations (team_id, platform) where scope = 'team';

alter table public.integrations drop constraint if exists integrations_user_platform_unique;
create unique index if not exists integrations_user_platform_idx on public.integrations (user_id, platform) where scope = 'personal';

-- 7. DATA MIGRATION (Move existing profiles.team_id to team_members)
insert into public.team_members (team_id, user_id, role, status)
select team_id::uuid, id::uuid, 'owner', 'active'
from public.profiles
where team_id is not null
on conflict (team_id, user_id) do nothing;

update public.profiles
set current_team_id = team_id::uuid
where team_id is not null and current_team_id is null;

-- 8. ROW LEVEL SECURITY (RLS) REFACTOR

-- Enable RLS on new table
alter table public.team_members enable row level security;

-- Teams Policies (Admin/Member check)
drop policy if exists "Users can view their own team" on public.teams;
drop policy if exists "Users can view their team workspace" on public.teams;
create policy "Users can view their team workspace"
  on public.teams for select
  using (
    id::uuid in (
      select team_id from public.team_members where user_id = auth.uid() and status = 'active'
    )
  );

-- Team Members Policies
drop policy if exists "Members can view their teammates" on public.team_members;
create policy "Members can view their teammates"
  on public.team_members for select
  using (
    team_id::uuid in (
      select team_id from public.team_members where user_id = auth.uid() and status = 'active'
    )
  );

-- Integrations Policies (Shared Access)
drop policy if exists "Users can view team integrations" on public.integrations;
drop policy if exists "Users can access team integrations" on public.integrations;
create policy "Users can access team integrations"
  on public.integrations for select
  using (
    (scope = 'team' and team_id::uuid in (
      select team_id from public.team_members where user_id = auth.uid() and status = 'active'
    ))
    or
    (scope = 'personal' and user_id::uuid = auth.uid())
  );

-- Only admins/owners can manage team settings and integrations
drop policy if exists "Admins can manage team" on public.teams;
create policy "Admins can manage team"
  on public.teams for update
  using (
    id::uuid in (
      select team_id from public.team_members 
      where user_id = auth.uid() and role in ('owner', 'admin')
    )
  );

drop policy if exists "Admins can manage team integrations" on public.integrations;
create policy "Admins can manage team integrations"
  on public.integrations for all
  using (
    (scope = 'team' and team_id::uuid in (
      select team_id from public.team_members 
      where user_id = auth.uid() and role in ('owner', 'admin')
    ))
    or
    (scope = 'personal' and user_id::uuid = auth.uid())
  );
