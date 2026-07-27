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

-- A user may READ their own profile, and create it once at registration.
--
-- They may NOT update it. check-access derives a custom account's identity from
-- minecraft_username and discord_id in this row, so any client write to those
-- columns would defeat the whitelist entirely: a registered user could PATCH
-- their own profile with a whitelisted player's Discord ID (visible to anyone in
-- the Discord server) using the anon key shipped in the launcher, and be let in
-- without ever completing Discord OAuth. Rewriting minecraft_username would also
-- let them impersonate that player in game, since the offline UUID is derived
-- from it. discord_id is written only by the discord-oauth edge function, which
-- uses the service role and bypasses RLS.
create policy "own profile read" on profiles
  for select using (auth.uid() = id);

-- Registration may set the nick, but never claim a Discord link.
create policy "own profile insert" on profiles
  for insert with check (
    auth.uid() = id
    and discord_id is null
    and discord_username is null
  );

-- No update policy exists, so RLS already denies every client update. These
-- revokes are defense in depth: they keep the identity columns unwritable even
-- if a permissive update policy is added later by mistake.
revoke update (id, minecraft_username, discord_id, discord_username) on profiles from authenticated;
revoke update (id, minecraft_username, discord_id, discord_username) on profiles from anon;

-- whitelist has NO client policies: it is reachable only via edge functions
-- using the service role key, which bypasses RLS. This prevents users from
-- enumerating who is whitelisted.

-- mods is public read-only reference data.
create policy "mods are readable" on mods for select using (true);
