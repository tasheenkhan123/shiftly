-- Siftly database setup
-- Run this once in Supabase: Dashboard -> SQL Editor -> New query -> paste -> Run.
-- Safe to re-run.

-- ---------------------------------------------------------------
-- Chats (search history). Each row is one conversation.
-- ---------------------------------------------------------------
create table if not exists public.chat_sessions (
  id          text primary key,
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title       text not null default 'New search',
  pinned      boolean not null default false,
  messages    jsonb not null default '[]'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists chat_sessions_user_updated_idx
  on public.chat_sessions (user_id, pinned desc, updated_at desc);

-- ---------------------------------------------------------------
-- Saved products (the bookmark button on product cards)
-- ---------------------------------------------------------------
create table if not exists public.saved_products (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  product_key text not null,   -- stable key (title + brand) so the same product isn't saved twice
  product     jsonb not null,
  created_at  timestamptz not null default now(),
  unique (user_id, product_key)
);

create index if not exists saved_products_user_idx
  on public.saved_products (user_id, created_at desc);

-- ---------------------------------------------------------------
-- Table permissions. Newer Supabase projects don't grant these automatically.
-- Only signed-in users get access; Row Level Security below limits them to their own rows.
-- Guests (anon) get nothing.
-- ---------------------------------------------------------------
revoke all on public.chat_sessions, public.saved_products from anon;
grant select, insert, update, delete on public.chat_sessions  to authenticated;
grant select, insert, update, delete on public.saved_products to authenticated;

-- ---------------------------------------------------------------
-- Row Level Security: every user can only see and change their own rows.
-- ---------------------------------------------------------------
alter table public.chat_sessions  enable row level security;
alter table public.saved_products enable row level security;

drop policy if exists "own chats - select" on public.chat_sessions;
drop policy if exists "own chats - insert" on public.chat_sessions;
drop policy if exists "own chats - update" on public.chat_sessions;
drop policy if exists "own chats - delete" on public.chat_sessions;
create policy "own chats - select" on public.chat_sessions for select using (auth.uid() = user_id);
create policy "own chats - insert" on public.chat_sessions for insert with check (auth.uid() = user_id);
create policy "own chats - update" on public.chat_sessions for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own chats - delete" on public.chat_sessions for delete using (auth.uid() = user_id);

drop policy if exists "own saved - select" on public.saved_products;
drop policy if exists "own saved - insert" on public.saved_products;
drop policy if exists "own saved - update" on public.saved_products;
drop policy if exists "own saved - delete" on public.saved_products;
create policy "own saved - select" on public.saved_products for select using (auth.uid() = user_id);
create policy "own saved - insert" on public.saved_products for insert with check (auth.uid() = user_id);
create policy "own saved - update" on public.saved_products for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own saved - delete" on public.saved_products for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------
-- Preference profile (skin type, shoe size, favourite brands...), one row per user.
-- Added for personalised recommendations. Safe to re-run.
-- ---------------------------------------------------------------
create table if not exists public.user_profiles (
  user_id     uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  preferences jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now()
);

revoke all on public.user_profiles from anon;
grant select, insert, update, delete on public.user_profiles to authenticated;
alter table public.user_profiles enable row level security;

drop policy if exists "own profile - select" on public.user_profiles;
drop policy if exists "own profile - insert" on public.user_profiles;
drop policy if exists "own profile - update" on public.user_profiles;
drop policy if exists "own profile - delete" on public.user_profiles;
create policy "own profile - select" on public.user_profiles for select using (auth.uid() = user_id);
create policy "own profile - insert" on public.user_profiles for insert with check (auth.uid() = user_id);
create policy "own profile - update" on public.user_profiles for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own profile - delete" on public.user_profiles for delete using (auth.uid() = user_id);
