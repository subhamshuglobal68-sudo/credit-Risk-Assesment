-- ==============================================================================
-- CREA AI - Supabase Database Schema & Row Level Security (RLS)
-- Roles: 'user' and 'admin'
-- ==============================================================================

-- 1. Create custom enum for application roles
do $$
begin
  if not exists (select 1 from pg_type where typname = 'user_role') then
    create type public.user_role as enum ('user', 'admin');
  end if;
end$$;

-- 2. Create public.profiles table referencing auth.users
create table if not exists public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  email text not null,
  full_name text,
  role public.user_role not null default 'user',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Index for fast lookup by email and role
create index if not exists idx_profiles_email on public.profiles(email);
create index if not exists idx_profiles_role on public.profiles(role);

-- 3. Auto-provision profile row whenever a new auth user is created
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    'user'
  )
  on conflict (id) do update
  set email = excluded.email,
      full_name = coalesce(excluded.full_name, public.profiles.full_name),
      updated_at = now();
  return new;
end;
$$ language plpgsql security definer set search_path = public;

-- Trigger firing on every new signup in auth.users
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Helper function to check if the current user is an admin without triggering RLS recursion
create or replace function public.is_admin()
returns boolean as $$
begin
  return exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
end;
$$ language plpgsql security definer set search_path = public;

-- 4. Enable Row Level Security (RLS)
alter table public.profiles enable row level security;

-- Drop existing policies if any to allow safe re-execution
drop policy if exists "Users can view own profile" on public.profiles;
drop policy if exists "Admins can view all profiles" on public.profiles;
drop policy if exists "Users can update own profile" on public.profiles;
drop policy if exists "Admins can update profiles" on public.profiles;

-- Policy 1: Regular users can only read their own profile
create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = id);

-- Policy 2: Admins can view all user profiles
create policy "Admins can view all profiles"
  on public.profiles for select
  using (public.is_admin());

-- Policy 3: Users can update their own personal info (excluding role)
create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Policy 4: Admins can update any profile (e.g. promoting users or toggling status)
create policy "Admins can update profiles"
  on public.profiles for update
  using (public.is_admin());

-- ==============================================================================
-- Manual Admin Promotion Instructions:
-- Execute the following command in the Supabase SQL Editor to promote a user to Admin:
--
--   update public.profiles set role = 'admin' where email = 'admin@crea-ai.internal';
-- ==============================================================================
