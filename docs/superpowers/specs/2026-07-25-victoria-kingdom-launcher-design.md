# Victoria Kingdom Launcher — Design Spec

**Date:** 2026-07-25
**Status:** Approved

## Purpose

A professional, premium-looking desktop launcher for the modded Minecraft server **Victoria Kingdom** (MC 1.20.1, Forge 47.4.0). It authenticates users (Microsoft Premium OR a launcher-native account with mandatory Discord link), validates them against a centrally-managed whitelist, manages the instance's mods, and launches the game.

Target instance directory (game files reused as `gameDir`):
`C:\Users\FalconKingman\curseforge\minecraft\Instances\Victoria Bien Hecho`

## Tech Stack

- **Launcher:** Electron 43 + React + TypeScript, built with `electron-vite` 5. `minecraft-launcher-core` 3.18.2 (MCLC) for install/launch; `msmc` 5.0.5 for Microsoft auth; `framer-motion` 12 for motion. Versions verified against the npm registry on 2026-07-25.
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
1. **Register:** email + password + **nick de Minecraft** → Supabase Auth `signUp`. A `profiles` row is created with `minecraft_username` (`mc_type = 'custom'`). The nick is what the offline UUID is derived from, so it is fixed at registration.
2. **Mandatory Discord link:** immediately after sign-up the UI forces the Discord step. The main process starts a loopback HTTP server on `127.0.0.1:53682` and opens an Electron window at the Discord authorize URL (scope `identify`, `redirect_uri = http://localhost:53682/discord/callback`). Discord redirects back to the loopback with a `code`, the server captures it and closes the window. A `state` nonce is generated per attempt and verified on return (CSRF protection).
3. The launcher sends `code` to the `discord-oauth` edge function **with the user's Supabase JWT in the `Authorization` header**. The function verifies the JWT to know *which* user is linking, exchanges the code using the client secret, calls `GET /users/@me`, and writes `discord_id` + `discord_username` onto that user's profile row. The client cannot claim a Discord ID it did not authorize.
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

**Validation (server-side, edge function `check-access`). The client never asserts its own identity — the function derives it:**

- **Premium mode:** client sends `{ mode: 'premium', mc_token }`. The function calls `GET https://api.minecraftservices.com/minecraft/profile` with that bearer token. Mojang returns the real `id` + `name`. A forged token fails there, so the UUID is proven, not claimed.
- **Custom mode:** client sends `{ mode: 'custom' }` plus its Supabase JWT in the `Authorization` header. The function resolves the user via `auth.getUser(jwt)`, reads their `profiles` row, and derives the offline UUID server-side from the stored `minecraft_username`. Identity comes from the session, never from the request body.
- Allowed if an `active` whitelist row matches the derived `minecraft_uuid` OR the derived `discord_id`.
- Returns `{ allowed: bool, reason, minecraft_uuid, minecraft_username }`.

Because both branches derive identity server-side, a user cannot probe or bypass the whitelist by sending someone else's UUID. An admin manages access purely by editing the `whitelist` table — no launcher update needed.

If denied → a styled "No tienes acceso al servidor" screen with the Discord invite / appeal note; PLAY is disabled.

## Database Schema (Postgres / Supabase)

```sql
-- profiles: 1:1 with auth.users (custom accounts). Premium users need no row.
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  minecraft_username text unique not null,  -- in-game nick, chosen at registration
  discord_id text unique,
  discord_username text,
  mc_type text default 'custom',            -- 'custom' | 'premium'
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

Follows `electron-vite` conventions (`src/main`, `src/preload`, `src/renderer`):

```
victoria-launcher/
  package.json  electron.vite.config.ts  tsconfig.json  electron-builder.yml
  src/
    main/
      index.ts            # BrowserWindow (frameless), lifecycle, single-instance
      config.ts           # paths, env loading + validation
      ipc/
        window.ts         # minimize/maximize/close
        auth.ts           # msmc Microsoft flow, token persistence
        discord.ts        # loopback HTTP server + OAuth window
        supabase.ts       # signUp/signIn/link/check-access calls
        mods.ts           # scan mods/ + disabled_mods/, enable/disable
        launch.ts         # MCLC Forge launch, java detection, progress
      lib/
        offline-uuid.ts   # deterministic offline UUID (shared logic)
        java.ts           # java runtime detection
    preload/
      index.ts            # contextBridge — typed IPC surface, no Node in renderer
      api.d.ts            # shared IPC types (imported by renderer)
    renderer/
      index.html
      src/
        main.tsx  App.tsx
        screens/ Splash Login Register WhitelistGate Home Mods Settings
        components/ TitleBar Button GlassCard Toast PanoramaBg DiscordLinkStep ProgressBar
        theme/ tokens.css glass.css motion.ts
        lib/ ipc.ts session.ts
        assets/ logo.png victoria.png panorama/*.png ost.ogg slideshow/*.png
  supabase/
    schema.sql
    functions/check-access/index.ts
    functions/discord-oauth/index.ts
  tests/                  # vitest — pure logic only
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

- MCLC `Client.launch()` with:
  - `root`: dedicated launcher dir `%APPDATA%/VictoriaLauncher/minecraft` (vanilla + Forge libraries, assets).
  - `overrides.gameDirectory`: the Victoria instance path, so `mods/`, `config/`, `saves/`, `resourcepacks/` are reused as-is.
  - `version`: `{ number: "1.20.1", type: "release" }`.
  - `forge`: path to the Forge **installer** jar, downloaded once on first launch from
    `https://maven.minecraftforge.net/net/minecraftforge/forge/1.20.1-47.4.0/forge-1.20.1-47.4.0-installer.jar`
    (MCLC requires the installer, not the universal jar, for 1.13+).
  - `memory`: configurable min/max in Settings; default max 8G (instance is currently configured for 8160 MB).
  - `javaPath`: auto-detected. Preference order: user override in Settings → CurseForge's bundled Java 17 at `%USERPROFILE%/curseforge/minecraft/Install/java/java-runtime-gamma/bin/javaw.exe` → `JAVA_HOME` → `java` on PATH. MC 1.20.1 requires Java 17.
  - `authorization`: `msmc` `Minecraft.mclc()` (premium) or `Authenticator.getAuth(username)` (custom/offline).
- MCLC emits `download-status`, `progress`, `debug`, `data`, `close` → forwarded over IPC to a renderer progress bar. On `close`, return to Home.

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

Vitest for pure logic; manual verification for flows that need real OAuth/network.

- **Unit:** offline-UUID derivation (known vectors — `Notch` → `b50ad385-829d-3141-a216-7e7d7539ba7f`), whitelist decision function, mods scan/toggle against a temp dir, env validation, java detection ordering.
- **Manual:** Microsoft login, register + Discord link, whitelist allow/deny, launch smoke test into the Victoria instance.

## Security Notes

- Discord client secret and the Supabase service-role key exist only as Edge Function secrets. The shipped app holds only the anon key, Discord client ID, and redirect URI — all public-safe values.
- `contextIsolation: true`, `nodeIntegration: false`. The renderer touches the OS only through the typed preload bridge.
- Identity for whitelist checks is always derived server-side (Mojang token verification or Supabase JWT), never trusted from the request body.
- Supabase Auth handles password hashing and session refresh; the launcher never stores raw passwords.
