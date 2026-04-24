-- Table to track dismissed blockers persistently
CREATE TABLE IF NOT EXISTS public.dismissed_blockers (
    id uuid default gen_random_uuid() primary key,
    user_id uuid references public.profiles(id) on delete cascade not null,
    blocker_id text not null, -- Unique ID for the blocker (e.g. 'slack-123-0', 'asana-gid')
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    UNIQUE(user_id, blocker_id)
);

-- Enable RLS
ALTER TABLE public.dismissed_blockers ENABLE ROW LEVEL SECURITY;

-- Policy: Users can manage their own dismissed blockers
CREATE POLICY "Users can manage their own dismissed blockers"
    ON public.dismissed_blockers FOR ALL
    USING ( auth.uid() = user_id );

-- Indexing for fast lookups
CREATE INDEX IF NOT EXISTS dismissed_blockers_user_id_idx ON public.dismissed_blockers(user_id);
