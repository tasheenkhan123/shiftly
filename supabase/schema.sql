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

-- ---------------------------------------------------------------
-- Search rate limits (abuse protection). Safe to re-run.
-- The app calls consume_search_quota() once per search. Keys are HMAC hashes of the user id or IP,
-- so no raw IPs or ids are stored. Nobody can read or edit the table directly.
-- ---------------------------------------------------------------
create table if not exists public.search_quota (
  key          text primary key,
  window_start timestamptz not null default now(),
  count        integer not null default 0
);
alter table public.search_quota enable row level security;
revoke all on public.search_quota from anon, authenticated;

create or replace function public.consume_search_quota(p_key text, p_limit integer, p_window_seconds integer)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.search_quota;
  v_now timestamptz := now();
begin
  if p_key is null or length(p_key) < 16 or p_limit < 1 or p_limit > 1000 or p_window_seconds < 60 then
    raise exception 'invalid arguments';
  end if;

  insert into public.search_quota as q (key, window_start, count)
  values (p_key, v_now, 0)
  on conflict (key) do update
    set window_start = case when q.window_start < v_now - make_interval(secs => p_window_seconds) then v_now else q.window_start end,
        count        = case when q.window_start < v_now - make_interval(secs => p_window_seconds) then 0 else q.count end
  returning * into v_row;

  if v_row.count >= p_limit then
    return json_build_object('allowed', false, 'count', v_row.count,
      'reset_in_seconds', greatest(1, extract(epoch from (v_row.window_start + make_interval(secs => p_window_seconds) - v_now))::int));
  end if;

  update public.search_quota set count = count + 1 where key = p_key returning * into v_row;
  return json_build_object('allowed', true, 'count', v_row.count,
    'reset_in_seconds', greatest(1, extract(epoch from (v_row.window_start + make_interval(secs => p_window_seconds) - v_now))::int));
end;
$$;

revoke all on function public.consume_search_quota(text, integer, integer) from public;
grant execute on function public.consume_search_quota(text, integer, integer) to anon, authenticated;

-- Old windows can be cleaned up occasionally:
-- delete from public.search_quota where window_start < now() - interval '1 day';
