-- Agent chat history foundation for the AI Agent experience.
-- This supports:
-- - new chats and saved history
-- - sidebar titles and previews
-- - rename / delete flows
-- - optional sharing
-- - future saved drafts such as meeting prep and approval suggestions

create table if not exists public.agent_conversations (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  title text not null default 'New chat',
  title_source text not null default 'system'
    check (title_source in ('system', 'user', 'generated')),
  conversation_kind text not null default 'chat'
    check (conversation_kind in ('chat', 'meeting_prep', 'draft')),
  status text not null default 'active'
    check (status in ('active', 'archived', 'deleted')),
  is_shared boolean not null default false,
  share_token uuid,
  shared_at timestamp with time zone,
  deleted_at timestamp with time zone,
  last_message_at timestamp with time zone default timezone('utc'::text, now()) not null,
  last_message_preview text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.agent_conversations
  drop column if exists team_id;

drop index if exists agent_conversations_team_idx;

create index if not exists agent_conversations_user_last_message_idx
  on public.agent_conversations (user_id, last_message_at desc);

create unique index if not exists agent_conversations_share_token_idx
  on public.agent_conversations (share_token)
  where share_token is not null;

create table if not exists public.agent_messages (
  id uuid default gen_random_uuid() primary key,
  conversation_id uuid references public.agent_conversations(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  client_message_id text,
  role text not null
    check (role in ('system', 'user', 'assistant', 'tool')),
  message_kind text not null default 'chat'
    check (message_kind in ('chat', 'tool_call', 'tool_result', 'suggestion', 'meeting_prep', 'note', 'approval_request')),
  status text not null default 'completed'
    check (status in ('pending', 'streaming', 'completed', 'failed', 'cancelled')),
  content text not null default '',
  tool_name text,
  tool_call_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create index if not exists agent_messages_conversation_created_idx
  on public.agent_messages (conversation_id, created_at asc);

create index if not exists agent_messages_user_idx
  on public.agent_messages (user_id, created_at desc);

create unique index if not exists agent_messages_client_message_idx
  on public.agent_messages (conversation_id, client_message_id)
  where client_message_id is not null;

alter table public.agent_conversations enable row level security;
alter table public.agent_messages enable row level security;

drop policy if exists "Users can view their own agent conversations" on public.agent_conversations;
create policy "Users can view their own agent conversations"
  on public.agent_conversations for select
  using (auth.uid() = user_id);

drop policy if exists "Users can create their own agent conversations" on public.agent_conversations;
create policy "Users can create their own agent conversations"
  on public.agent_conversations for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their own agent conversations" on public.agent_conversations;
create policy "Users can update their own agent conversations"
  on public.agent_conversations for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own agent conversations" on public.agent_conversations;
create policy "Users can delete their own agent conversations"
  on public.agent_conversations for delete
  using (auth.uid() = user_id);

drop policy if exists "Users can view their own agent messages" on public.agent_messages;
create policy "Users can view their own agent messages"
  on public.agent_messages for select
  using (
    exists (
      select 1
      from public.agent_conversations
      where agent_conversations.id = agent_messages.conversation_id
        and agent_conversations.user_id = auth.uid()
    )
  );

drop policy if exists "Users can create their own agent messages" on public.agent_messages;
create policy "Users can create their own agent messages"
  on public.agent_messages for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1
      from public.agent_conversations
      where agent_conversations.id = agent_messages.conversation_id
        and agent_conversations.user_id = auth.uid()
    )
  );

drop policy if exists "Users can update their own agent messages" on public.agent_messages;
create policy "Users can update their own agent messages"
  on public.agent_messages for update
  using (
    auth.uid() = user_id
    and exists (
      select 1
      from public.agent_conversations
      where agent_conversations.id = agent_messages.conversation_id
        and agent_conversations.user_id = auth.uid()
    )
  )
  with check (
    auth.uid() = user_id
    and exists (
      select 1
      from public.agent_conversations
      where agent_conversations.id = agent_messages.conversation_id
        and agent_conversations.user_id = auth.uid()
    )
  );

drop policy if exists "Users can delete their own agent messages" on public.agent_messages;
create policy "Users can delete their own agent messages"
  on public.agent_messages for delete
  using (
    auth.uid() = user_id
    and exists (
      select 1
      from public.agent_conversations
      where agent_conversations.id = agent_messages.conversation_id
        and agent_conversations.user_id = auth.uid()
    )
  );

notify pgrst, 'reload schema';
