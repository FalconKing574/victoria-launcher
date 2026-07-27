-- supabase/schema.sql
-- Run this in the Supabase SQL Editor.

-- The launcher has no accounts of its own: players either sign in with a real
-- Microsoft account or just pick a name. Access is decided purely by matching a
-- Minecraft UUID against this table.
create table if not exists whitelist (
  id uuid primary key default gen_random_uuid(),
  minecraft_uuid text,
  discord_id text,
  active boolean default true,
  note text,
  added_at timestamptz default now()
);

create index if not exists whitelist_uuid_idx on whitelist (minecraft_uuid) where active;

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
alter table whitelist enable row level security;
alter table mods enable row level security;

-- whitelist has NO client policies: it is reachable only via the check-access
-- edge function, which uses the service role key and bypasses RLS. This stops
-- anyone from reading, or writing, who is allowed in.

-- mods is public read-only reference data.
create policy "mods are readable" on mods for select using (true);

-- If you ran an earlier version of this file, drop the now-unused table:
--   drop table if exists profiles;
