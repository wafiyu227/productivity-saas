-- Create a table for Teams (Companies)
create table if not exists public.teams (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  size_range text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create a table for User Profiles
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  full_name text,
  job_title text,
  team_id uuid references public.teams(id),
  avatar_url text,
  updated_at timestamp with time zone default timezone('utc'::text, now())
);

-- Create a table for Team Invitations
create table if not exists public.team_invitations (
  id uuid default gen_random_uuid() primary key,
  team_id uuid references public.teams(id) on delete cascade not null,
  email text not null,
  token text not null unique,
  status text default 'pending' check (status in ('pending', 'accepted', 'expired')),
  platform TEXT NOT NULL CHECK (platform IN ('slack', 'asana', 'google', 'jira', 'trello', 'github')),
  invited_by uuid references auth.users(id),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable Row Level Security (RLS)
alter table public.teams enable row level security;
alter table public.profiles enable row level security;
alter table public.team_invitations enable row level security;

-- Policies --

-- VIEW_PROFILE: Everyone can view profiles (needed for team lists)
create policy "Profiles are viewable by everyone"
  on public.profiles for select
  using ( true );

-- UPDATE_PROFILE: Users can insert/update their own profile
create policy "Users can insert their own profile"
  on public.profiles for insert
  with check ( auth.uid() = id );

create policy "Users can update their own profile"
  on public.profiles for update
  using ( auth.uid() = id );

-- VIEW_TEAMS: Users can view their own team
create policy "Users can view their own team"
  on public.teams for select
  using (
    id in (
      select team_id from public.profiles where id = auth.uid()
    )
  );

-- INSERT_TEAMS: Authenticated users can create teams (during onboarding)
create policy "Authenticated users can create teams"
  on public.teams for insert
  with check ( auth.role() = 'authenticated' );

-- VIEW_INVITATIONS: Users can view invitations for their team
create policy "Users can view invitations for their team"
  on public.team_invitations for select
  using (
    team_id in (
      select team_id from public.profiles where id = auth.uid()
    )
  );

-- CREATE_INVITATIONS: Users can create invitations for their team
create policy "Users can create invitations for their team"
  on public.team_invitations for insert
  with check (
    team_id in (
      select team_id from public.profiles where id = auth.uid()
    )
  );
