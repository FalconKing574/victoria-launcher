-- supabase/schema.sql
-- Run this in the Supabase SQL Editor.

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  minecraft_username text unique not null,
  discord_id text unique,
  discord_username text,
  mc_type text default 'custom',
  created_at timestamptz default now()
);

create table if not exists whitelist (
  id uuid primary key default gen_random_uuid(),
  minecraft_uuid text,
  discord_id text,
  active boolean default true,
  note text,
  added_at timestamptz default now()
);

create index if not exists whitelist_uuid_idx on whitelist (minecraft_uuid) where active;
create index if not exists whitelist_discord_idx on whitelist (discord_id) where active;

create table if not exists mods (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  filename text not null,
  sha1 text,
  category text,
  required boolean default false,
  enabled boolean default true
);

-- Row Level Security
alter table profiles enable row level security;
alter table whitelist enable row level security;
alter table mods enable row level security;

-- A user may read and update only their own profile.
create policy "own profile read" on profiles
  for select using (auth.uid() = id);
create policy "own profile insert" on profiles
  for insert with check (auth.uid() = id);
create policy "own profile update" on profiles
  for update using (auth.uid() = id);

-- whitelist has NO client policies: it is reachable only via edge functions
-- using the service role key, which bypasses RLS. This prevents users from
-- enumerating who is whitelisted.

-- mods is public read-only reference data.
create policy "mods are readable" on mods for select using (true);
