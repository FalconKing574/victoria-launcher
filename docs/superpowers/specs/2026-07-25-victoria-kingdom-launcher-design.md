# Victoria Kingdom Launcher — Design Spec

**Date:** 2026-07-25
**Status:** Approved

## Purpose

A professional, premium-looking desktop launcher for the modded Minecraft server **Victoria Kingdom** (MC 1.20.1, Forge 47.4.0). It authenticates users (Microsoft Premium OR a launcher-native account with mandatory Discord link), validates them against a centrally-managed whitelist, manages the instance's mods, and launches the game.

Target instance directory (game files reused as `gameDir`):
`C:\Users\FalconKingman\curseforge\minecraft\Instances\Victoria Bien Hecho`

## Tech Stack

- **Launcher:** Electron + React + TypeScript (Vite renderer). `minecraft-launcher-core` (MCLC) for install/launch; `msmc` for Microsoft auth.
- **Backend:** Supabase — Postgres DB + Auth + Edge Functions (Deno). No self-hosted server.
- **Styling:** CSS + framer-motion. Dark glassmorphism, frameless custom window.

## Architecture

```
Launcher (Electron main + preload + React renderer)
   │
   ├─ msmc ..................... Microsoft/Xbox OAuth  → premium profile (name, uuid, token)
   ├─ minecraft-launcher-core .. installs Forge 47.4.0/1.20.1, launches with gameDir = instance
   └─ Supabase client
         ├─ Auth ............... launcher-native email/password accounts
         ├─ Edge: discord-oauth  holds Discord client secret, does code→token exchange
         ├─ Edge: check-access . server-side whitelist validation
         └─ DB ................. profiles, whitelist, mods
```

Secrets rule: the Discord **client secret** and any service-role keys live ONLY in Supabase Edge Functions, never in the Electron bundle. The launcher ships only the Supabase anon key + Discord client ID + redirect URI.

## Authentication Flows

### 1. Microsoft Premium
1. User clicks "Iniciar sesión con Microsoft".
2. `msmc` opens the official Xbox/Microsoft OAuth window (uses msmc's default Azure client, or a custom one from `.env` if provided).
3. On success → real Minecraft profile: `{ name, uuid, access_token, client_token }`.
4. Proceed to whitelist gate. Launch is premium (validated session).

### 2. Launcher-native account (with mandatory Discord link)
1. **Register:** email + password → Supabase Auth `signUp`. A `profiles` row is created (`mc_type = 'custom'`).
2. **Mandatory Discord link:** immediately after sign-up the UI forces the Discord step. It opens the Discord OAuth2 authorize URL (scope `identify`) in the system browser / an Electron popup. Discord redirects with a `code`.
3. The launcher sends `code` to the `discord-oauth` edge function. The function exchanges it (using the secret) for a token, calls `GET /users/@me`, and writes `discord_id` + `discord_username` onto the caller's profile row.
4. **Gate:** a profile with `discord_id IS NULL` cannot proceed past registration — the app blocks Home and re-shows the Discord step until linked.
5. **Login (returning custom user):** email + password → Supabase Auth `signInWithPassword`. If the profile has no `discord_id`, force the Discord step before continuing.
6. Launch is **offline mode**: username = chosen launcher name, UUID = offline UUID derived from `OfflinePlayer:<name>` (MD5, standard Minecraft offline scheme).

## Whitelist

Table `whitelist`:

| column | type | notes |
|---|---|---|
| id | uuid pk | |
| minecraft_uuid | text null | premium real UUID or offline UUID |
| discord_id | text null | linked Discord snowflake |
| active | bool default true | soft toggle |
| note | text | admin label |
| added_at | timestamptz default now() | |

**Validation (server-side, edge function `check-access`):**
- Input `{ minecraft_uuid, discord_id }`.
- Allowed if there exists an `active` row where `minecraft_uuid` matches OR `discord_id` matches.
- Premium user: passes `{ real_uuid, discord_id? }`. Custom user: passes `{ offline_uuid, discord_id }`.
- Returns `{ allowed: bool, reason }`. All logic runs in the edge function against the DB, so an admin manages access remotely by editing the `whitelist` table — no launcher update needed.

If denied → a styled "No tienes acceso al servidor" screen with the Discord invite / appeal note; PLAY is disabled.

## Database Schema (Postgres / Supabase)

```sql
-- profiles: 1:1 with auth.users (custom accounts). Premium users need no row.
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  discord_id text unique,
  discord_username text,
  mc_type text default 'custom',        -- 'custom' | 'premium'
  created_at timestamptz default now()
);

create table whitelist (
  id uuid primary key default gen_random_uuid(),
  minecraft_uuid text,
  discord_id text,
  active boolean default true,
  note text,
  added_at timestamptz default now()
);

-- prepared for future mod sync
create table mods (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  filename text not null,
  sha1 text,
  category text,
  required boolean default false,
  enabled boolean default true
);
```

RLS: `profiles` readable/writable only by its owner (`auth.uid() = id`); `whitelist` and `mods` are read-only to clients (or accessed only via edge functions with service role). `check-access` and `discord-oauth` use the service-role key inside the function.

## Project Structure

```
victoria-launcher/
  package.json
  electron/
    main.ts              # BrowserWindow, frameless, lifecycle, single-instance
    preload.ts           # contextBridge — typed IPC surface, no Node in renderer
    config.ts            # instance path, roots, env loading
    ipc/
      auth.ts            # msmc microsoft flow + offline UUID helper
      launch.ts          # MCLC install/launch Forge 47.4.0, progress events
      mods.ts            # scan mods/ + disabled_mods/, enable/disable (move jar)
      supabase.ts        # calls to edge functions, auth, whitelist
  src/                   # React renderer (Vite)
    main.tsx  App.tsx  router.tsx
    screens/ Splash Login Register WhitelistGate Home Mods Settings
    components/ TitleBar Button Card Toast PanoramaBg DiscordLinkStep ProgressBar
    theme/ colors.ts glass.css motion.ts
    assets/ logo.png victoria.png panorama/* ost.ogg slideshow/*
    lib/ ipc.ts (typed wrappers over window.api)
  supabase/
    schema.sql
    functions/discord-oauth/index.ts
    functions/check-access/index.ts
  .env.example
  SETUP.md
```

Assets copied from `...\Victoria Bien Hecho\config\fancymenu\assets` and `.../panoramas/farfania_pan_1/panorama`.

## UI / Visual

- Frameless window, custom draggable TitleBar (min/max/close), rounded corners.
- Background: Farfania panorama cubemap slowly rotating, blur + dark gradient overlay for legibility. Gold (`#E6B422`) + Dutch red/blue accents from the logo. Glass cards.
- framer-motion for screen transitions and hover/press micro-interactions.
- Ambient music `ost.ogg` with a mute toggle (default off, remembered).
- Splash: animated sequence reusing the `carga` slideshow images + logo, while the app boots and restores session.
- Home: large PLAY button, player card (avatar via `https://crafatar.com` / mc-heads for premium, generic for offline), news placeholder panel, left nav (Play, Mods, Settings), footer with version + online-status dot.

## Launching

- MCLC `Client` with:
  - `root`: a launcher-managed dir for vanilla+forge libraries (e.g. `%APPDATA%/VictoriaLauncher/.minecraft`), OR the instance itself — **decision: use a dedicated root for libraries but set `gameDir`/`overrides.gameDirectory` to the instance** so mods/config/saves are reused while libraries stay clean.
  - `version`: `{ number: "1.20.1", type: "release" }`, `forge`: path to Forge 47.4.0 installer (MCLC installs it).
  - `memory`: configurable min/max (Settings).
  - `authorization`: from msmc (premium) or MCLC offline auth (custom).
- Emits `download-status` / `progress` → renderer progress bar. On close, return to Home.

## Scope

**v1 (this build):** Microsoft premium auth; native account + mandatory Discord link; whitelist DB check (server-side); premium UI; basic mods enable/disable; launch modded Forge instance.

**Prepared, NOT built:** auto mod sync/download, news feed, profiles/stats, auto-updates. Schema/structure leaves room (mods table, modular IPC).

## Credentials & Setup

`SETUP.md` gives step-by-step:
- **Discord:** create app at Discord Developer Portal → OAuth2 → copy Client ID + Client Secret, add redirect URI. (User must do this — requires their Discord login.)
- **Supabase:** create project → run `schema.sql` → deploy the two edge functions → set function secrets (Discord secret, service role). Copy project URL + anon key.
- **Azure (optional):** msmc default client works; custom Azure app only if desired.
- `.env` keys: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `DISCORD_CLIENT_ID`, `DISCORD_REDIRECT_URI`, optional `AZURE_CLIENT_ID`.

## Testing

- Unit: offline-UUID helper, whitelist decision logic (edge function pure part), mods scan/toggle.
- Manual: full auth flows, whitelist allow/deny, launch smoke test.
