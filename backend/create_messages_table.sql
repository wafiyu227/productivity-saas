-- Table to store email messages (inbound and outbound) for threading and dashboard display
create table if not exists public.messages (
    id uuid default gen_random_uuid() primary key,
    thread_id text not null, -- Can be the original Message-ID or a custom conversation ID
    message_id text not null unique, -- The Resend Message-ID
    from_email text not null,
    to_email text not null,
    subject text,
    body_text text,
    body_html text,
    direction text not null check (direction in ('inbound', 'outbound')),
    team_id uuid references public.teams(id) on delete cascade,
    user_id uuid references auth.users(id) on delete set null,
    metadata jsonb default '{}'::jsonb,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Indexing for performance
create index if not exists messages_thread_id_idx on public.messages(thread_id);
create index if not exists messages_team_id_idx on public.messages(team_id);
create index if not exists messages_message_id_idx on public.messages(message_id);

-- Enable RLS
alter table public.messages enable row level security;

-- Policies
create policy "Users can view messages for their team"
    on public.messages for select
    using (
        team_id in (
            select team_id from public.profiles where id = auth.uid()
        )
    );

create policy "Service role can insert messages"
    on public.messages for insert
    with check (true); -- Usually handled by service role or specific triggers
