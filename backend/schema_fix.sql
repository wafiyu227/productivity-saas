-- 1. Create Teams table FIRST
create table if not exists public.teams (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  size_range text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS for Teams
alter table public.teams enable row level security;

-- 2. NOW add columns to profiles
do $$
begin
  if not exists (select 1 from information_schema.columns where table_name = 'profiles' and column_name = 'team_id') then
    alter table public.profiles add column team_id uuid references public.teams(id);
  end if;

  if not exists (select 1 from information_schema.columns where table_name = 'profiles' and column_name = 'job_title') then
    alter table public.profiles add column job_title text;
  end if;

  if not exists (select 1 from information_schema.columns where table_name = 'profiles' and column_name = 'full_name') then
    alter table public.profiles add column full_name text;
  end if;

  if not exists (select 1 from information_schema.columns where table_name = 'profiles' and column_name = 'avatar_url') then
      alter table public.profiles add column avatar_url text;
  end if;
end $$;

-- 3. Create Team Invitations
create table if not exists public.team_invitations (
  id uuid default gen_random_uuid() primary key,
  team_id uuid references public.teams(id) on delete cascade not null,
  email text not null,
  token text not null unique,
  status text default 'pending' check (status in ('pending', 'accepted', 'expired')),
  invited_by uuid references auth.users(id),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS for Invitations
alter table public.team_invitations enable row level security;

-- 4. Apply Policies

-- Profiles Policies
drop policy if exists "Profiles are viewable by everyone" on public.profiles;
create policy "Profiles are viewable by everyone"
  on public.profiles for select
  using ( true );

drop policy if exists "Users can insert their own profile" on public.profiles;
create policy "Users can insert their own profile"
  on public.profiles for insert
  with check ( auth.uid() = id );

drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile"
  on public.profiles for update
  using ( auth.uid() = id );

-- Teams Policies
drop policy if exists "Users can view their own team" on public.teams;
create policy "Users can view their own team"
  on public.teams for select
  using (
    id in (
      select team_id from public.profiles where id = auth.uid()
    )
  );

drop policy if exists "Authenticated users can create teams" on public.teams;
create policy "Authenticated users can create teams"
  on public.teams for insert
  with check ( auth.role() = 'authenticated' );

-- Invitations Policies
drop policy if exists "Users can view invitations for their team" on public.team_invitations;
create policy "Users can view invitations for their team"
  on public.team_invitations for select
  using (
    team_id in (
      select team_id from public.profiles where id = auth.uid()
    )
  );

drop policy if exists "Users can create invitations for their team" on public.team_invitations;
create policy "Users can create invitations for their team"
  on public.team_invitations for insert
  with check (
    team_id in (
      select team_id from public.profiles where id = auth.uid()
    )
  );
