-- MADAR private chats. Run this ONLY on a NEW dedicated Supabase project
-- that belongs to MADAR's owner. NEVER run in the existing
-- "miss-eman-english" project or another person's project.
--
-- Configure Supabase Auth > URL Configuration:
-- Site URL: https://madar-ai-yousef.vercel.app
-- Redirect URLs: https://madar-ai-yousef.vercel.app/**
--
-- Supabase Auth Email provider: enabled, with email confirmation enabled.
--
-- Set these Vercel Production environment variables:
-- MADAR_SUPABASE_URL = the Supabase project URL (public)
-- MADAR_SUPABASE_PUBLISHABLE_KEY = the sb_publishable_ key (public)
-- Do NOT use service_role or sb_secret_* keys.

create table if not exists public.madar_chats (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'New chat' check (char_length(title) <= 70),
  messages jsonb not null default '[]'::jsonb check (jsonb_typeof(messages)='array'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists madar_chats_user_updated_idx
  on public.madar_chats(user_id, updated_at desc);

alter table public.madar_chats enable row level security;

-- Only signed-in users receive SQL privileges. RLS further isolates rows.
revoke all on public.madar_chats from anon, authenticated;
grant select, insert, update, delete on public.madar_chats to authenticated;

create policy "madar_chats_read_own" on public.madar_chats
 for select to authenticated using ((select auth.uid()) = user_id);

create policy "madar_chats_insert_own" on public.madar_chats
 for insert to authenticated with check ((select auth.uid()) = user_id);

create policy "madar_chats_update_own" on public.madar_chats
 for update to authenticated
 using ((select auth.uid()) = user_id)
 with check ((select auth.uid()) = user_id);

create policy "madar_chats_delete_own" on public.madar_chats
 for delete to authenticated using ((select auth.uid()) = user_id);

-- Security checks: run in Supabase SQL editor in the dedicated project.
-- select relrowsecurity from pg_class where oid='public.madar_chats'::regclass;
-- select policyname,cmd,roles,qual,with_check
--   from pg_policies where schemaname='public' and tablename='madar_chats';
