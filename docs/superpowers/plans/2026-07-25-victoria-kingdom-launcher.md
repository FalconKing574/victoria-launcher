# Victoria Kingdom Launcher Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a premium Electron desktop launcher for the Victoria Kingdom Minecraft server (1.20.1 / Forge 47.4.0) with Microsoft Premium auth, launcher-native accounts requiring a Discord link, a server-side whitelist gate, mod management, and game launch.

**Architecture:** Electron main process owns all privileged work (OAuth, filesystem, game launch) and exposes a typed `contextBridge` API to a React renderer. Supabase provides Postgres, Auth, and two Edge Functions that hold every secret and derive user identity server-side. The launcher reuses the existing CurseForge instance directory as `gameDirectory` so its 113 mods, config, and saves work unchanged.

**Tech Stack:** Electron 43, electron-vite 5, React 18, TypeScript, framer-motion 12, minecraft-launcher-core 3.18.2, msmc 5.0.5, @supabase/supabase-js 2, Vitest, Supabase Edge Functions (Deno).

**Spec:** `docs/superpowers/specs/2026-07-25-victoria-kingdom-launcher-design.md`

**Project root:** `C:\Users\FalconKingman\Desktop\VictoriaLauncher`
**Game instance:** `C:\Users\FalconKingman\curseforge\minecraft\Instances\Victoria Bien Hecho`

---

## Phase 0 — Scaffold

### Task 1: Project scaffold

**Files:**
- Create: `package.json`, `tsconfig.json`, `tsconfig.node.json`, `electron.vite.config.ts`, `.env.example`, `src/main/index.ts`, `src/preload/index.ts`, `src/renderer/index.html`, `src/renderer/src/main.tsx`, `src/renderer/src/App.tsx`

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "victoria-launcher",
  "version": "1.0.0",
  "description": "Launcher oficial de Victoria Kingdom",
  "main": "./out/main/index.js",
  "author": "Victoria Kingdom",
  "scripts": {
    "dev": "electron-vite dev",
    "build": "electron-vite build",
    "start": "electron-vite preview",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit -p tsconfig.json",
    "dist": "electron-vite build && electron-builder"
  },
  "dependencies": {
    "@supabase/supabase-js": "^2.110.8",
    "minecraft-launcher-core": "^3.18.2",
    "msmc": "^5.0.5"
  },
  "devDependencies": {
    "@types/node": "^22.10.0",
    "@types/react": "^18.3.12",
    "@types/react-dom": "^18.3.1",
    "@vitejs/plugin-react": "^4.3.4",
    "electron": "^43.2.0",
    "electron-builder": "^25.1.8",
    "electron-vite": "^5.0.0",
    "framer-motion": "^12.42.2",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "typescript": "^5.7.2",
    "vite": "^6.0.3",
    "vitest": "^2.1.8"
  }
}
```

- [ ] **Step 2: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "jsx": "react-jsx",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "allowSyntheticDefaultImports": true,
    "noEmit": true,
    "types": ["node", "vite/client"],
    "baseUrl": ".",
    "paths": {
      "@shared/*": ["src/preload/*"],
      "@renderer/*": ["src/renderer/src/*"]
    }
  },
  "include": ["src/**/*.ts", "src/**/*.tsx", "tests/**/*.ts", "electron.vite.config.ts"]
}
```

- [ ] **Step 3: Create `electron.vite.config.ts`**

```ts
import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: { rollupOptions: { input: resolve(__dirname, 'src/main/index.ts') } }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: { rollupOptions: { input: resolve(__dirname, 'src/preload/index.ts') } }
  },
  renderer: {
    root: resolve(__dirname, 'src/renderer'),
    resolve: {
      alias: {
        '@renderer': resolve(__dirname, 'src/renderer/src'),
        '@shared': resolve(__dirname, 'src/preload')
      }
    },
    plugins: [react()],
    build: { rollupOptions: { input: resolve(__dirname, 'src/renderer/index.html') } }
  }
})
```

- [ ] **Step 4: Create `.env.example`**

```
# Supabase — get these from your project's API settings page
VITE_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOi...

# Discord OAuth2 — Client ID only. The SECRET belongs in Supabase, never here.
VITE_DISCORD_CLIENT_ID=000000000000000000
VITE_DISCORD_REDIRECT_URI=http://localhost:53682/discord/callback

# Optional: custom Azure app for Microsoft auth. Leave blank to use msmc's default.
VITE_AZURE_CLIENT_ID=
```

- [ ] **Step 5: Create a placeholder `src/main/index.ts`**

```ts
import { app, BrowserWindow } from 'electron'
import { join } from 'path'

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1200,
    height: 720,
    show: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  win.on('ready-to-show', () => win.show())

  if (process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(createWindow)

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
```

- [ ] **Step 6: Create placeholder `src/preload/index.ts`**

```ts
import { contextBridge } from 'electron'

contextBridge.exposeInMainWorld('api', {})
```

- [ ] **Step 7: Create `src/renderer/index.html`**

```html
<!doctype html>
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Victoria Kingdom</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 8: Create `src/renderer/src/main.tsx` and `App.tsx`**

```tsx
// src/renderer/src/main.tsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
```

```tsx
// src/renderer/src/App.tsx
export default function App(): JSX.Element {
  return <h1 style={{ color: 'white', background: '#111', height: '100vh' }}>Victoria Kingdom</h1>
}
```

- [ ] **Step 9: Install and verify it runs**

```bash
npm install
```

Then:

```bash
npm run dev
```

Expected: an Electron window opens showing "Victoria Kingdom" on a dark background. Close it.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "chore: scaffold electron-vite + react + typescript project"
```

---

### Task 2: Copy brand assets

**Files:**
- Create: `src/renderer/src/assets/` (logo.png, victoria.png, panorama/panorama_0..5.png, slideshow/image_1..7.png, ost.ogg)
- Create: `scripts/copy-assets.mjs`

- [ ] **Step 1: Write the asset copy script**

Create `scripts/copy-assets.mjs`. It copies from the FancyMenu folder so assets can be refreshed later if the server's branding changes.

```js
import { cpSync, mkdirSync, existsSync } from 'fs'
import { join } from 'path'

const SRC = 'C:/Users/FalconKingman/curseforge/minecraft/Instances/Victoria Bien Hecho/config/fancymenu'
const DEST = 'src/renderer/src/assets'

if (!existsSync(SRC)) {
  console.error(`FancyMenu folder not found: ${SRC}`)
  process.exit(1)
}

mkdirSync(join(DEST, 'panorama'), { recursive: true })
mkdirSync(join(DEST, 'slideshow'), { recursive: true })

const files = [
  ['assets/logo.png', 'logo.png'],
  ['assets/victoria.png', 'victoria.png'],
  ['assets/news-background.png', 'news-background.png'],
  ['assets/ost.ogg', 'ost.ogg']
]
for (const [from, to] of files) cpSync(join(SRC, from), join(DEST, to))

for (let i = 0; i < 6; i++) {
  cpSync(
    join(SRC, `panoramas/farfania_pan_1/panorama/panorama_${i}.png`),
    join(DEST, `panorama/panorama_${i}.png`)
  )
}
for (let i = 1; i <= 7; i++) {
  cpSync(join(SRC, `slideshows/carga/images/image_${i}.png`), join(DEST, `slideshow/image_${i}.png`))
}

console.log('Assets copied.')
```

- [ ] **Step 2: Run it**

```bash
node scripts/copy-assets.mjs
```

Expected output: `Assets copied.`

- [ ] **Step 3: Verify the files landed**

```bash
ls src/renderer/src/assets src/renderer/src/assets/panorama
```

Expected: `logo.png`, `victoria.png`, `news-background.png`, `ost.ogg`, and `panorama_0.png` through `panorama_5.png`.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: add Victoria Kingdom brand assets"
```

---

## Phase 1 — Supabase Backend

### Task 3: Database schema

**Files:**
- Create: `supabase/schema.sql`

- [ ] **Step 1: Write the schema**

```sql
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
```

- [ ] **Step 2: Commit**

```bash
git add supabase/schema.sql
git commit -m "feat: add Supabase database schema with RLS"
```

---

### Task 4: Whitelist decision logic (pure, tested)

The decision rule is pure logic, so it gets a real test. The edge function in Task 5 imports it.

**Files:**
- Create: `supabase/functions/_shared/whitelist.ts`
- Create: `tests/whitelist.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/whitelist.test.ts
import { describe, it, expect } from 'vitest'
import { decideAccess, type WhitelistRow } from '../supabase/functions/_shared/whitelist'

const rows: WhitelistRow[] = [
  { minecraft_uuid: 'aaaa-1111', discord_id: null, active: true },
  { minecraft_uuid: null, discord_id: '999888777', active: true },
  { minecraft_uuid: 'bbbb-2222', discord_id: null, active: false }
]

describe('decideAccess', () => {
  it('allows when the minecraft uuid matches an active row', () => {
    expect(decideAccess(rows, { uuid: 'aaaa-1111', discordId: null }).allowed).toBe(true)
  })

  it('allows when the discord id matches an active row', () => {
    expect(decideAccess(rows, { uuid: 'unknown', discordId: '999888777' }).allowed).toBe(true)
  })

  it('denies when nothing matches', () => {
    const result = decideAccess(rows, { uuid: 'zzzz-0000', discordId: '123' })
    expect(result.allowed).toBe(false)
    expect(result.reason).toBe('not_whitelisted')
  })

  it('denies when the only match is an inactive row', () => {
    expect(decideAccess(rows, { uuid: 'bbbb-2222', discordId: null }).allowed).toBe(false)
  })

  it('does not treat null identity as a match against null columns', () => {
    expect(decideAccess(rows, { uuid: null, discordId: null }).allowed).toBe(false)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/whitelist.test.ts`
Expected: FAIL — cannot resolve `../supabase/functions/_shared/whitelist`.

- [ ] **Step 3: Write the implementation**

```ts
// supabase/functions/_shared/whitelist.ts
export interface WhitelistRow {
  minecraft_uuid: string | null
  discord_id: string | null
  active: boolean
}

export interface Identity {
  uuid: string | null
  discordId: string | null
}

export interface AccessDecision {
  allowed: boolean
  reason: 'ok' | 'not_whitelisted'
}

/**
 * A player is allowed when an ACTIVE whitelist row matches either their
 * Minecraft UUID or their linked Discord ID. Null identity values never match,
 * so a row with a null column cannot be satisfied by an absent identity.
 */
export function decideAccess(rows: WhitelistRow[], identity: Identity): AccessDecision {
  const match = rows.some((row) => {
    if (!row.active) return false
    const uuidMatch = identity.uuid !== null && row.minecraft_uuid === identity.uuid
    const discordMatch = identity.discordId !== null && row.discord_id === identity.discordId
    return uuidMatch || discordMatch
  })

  return match ? { allowed: true, reason: 'ok' } : { allowed: false, reason: 'not_whitelisted' }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/whitelist.test.ts`
Expected: PASS — 5 tests.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/_shared/whitelist.ts tests/whitelist.test.ts
git commit -m "feat: add whitelist access decision logic with tests"
```

---

### Task 5: Offline UUID derivation (pure, tested)

Used in two places — the main process (to launch) and the edge function (to check the whitelist) — so it lives in `_shared` and is re-exported by the main process.

**Files:**
- Create: `supabase/functions/_shared/offline-uuid.ts`
- Create: `tests/offline-uuid.test.ts`

- [ ] **Step 1: Write the failing test**

The expected values are the real Minecraft offline UUIDs (name-based UUID v3 over `OfflinePlayer:<name>`).

```ts
// tests/offline-uuid.test.ts
import { describe, it, expect } from 'vitest'
import { offlineUuid } from '../supabase/functions/_shared/offline-uuid'

describe('offlineUuid', () => {
  it('matches Minecraft offline UUIDs for known names', () => {
    expect(offlineUuid('Notch')).toBe('b50ad385-829d-3141-a216-7e7d7539ba7f')
    expect(offlineUuid('Player')).toBe('a01e3843-e521-3998-958a-f459800e4d11')
    expect(offlineUuid('Victoria')).toBe('e4b15e84-ce04-3257-b401-4dd387ff8aac')
  })

  it('is deterministic', () => {
    expect(offlineUuid('FalconKingman')).toBe(offlineUuid('FalconKingman'))
  })

  it('is case sensitive, matching vanilla behaviour', () => {
    expect(offlineUuid('Notch')).not.toBe(offlineUuid('notch'))
  })

  it('sets the UUID version to 3 and the IETF variant', () => {
    const uuid = offlineUuid('AnyName')
    expect(uuid[14]).toBe('3')
    expect(['8', '9', 'a', 'b']).toContain(uuid[19])
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/offline-uuid.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

`node:crypto` works in both Node (main process) and Deno (Supabase Edge Functions).

```ts
// supabase/functions/_shared/offline-uuid.ts
import { createHash } from 'node:crypto'

/**
 * Derives the UUID Minecraft assigns to a player on an offline-mode server.
 * Vanilla uses UUID.nameUUIDFromBytes("OfflinePlayer:<name>") — a name-based
 * (version 3) UUID over the MD5 of that string.
 */
export function offlineUuid(username: string): string {
  const digest = createHash('md5').update(`OfflinePlayer:${username}`, 'utf8').digest()

  digest[6] = (digest[6] & 0x0f) | 0x30 // version 3
  digest[8] = (digest[8] & 0x3f) | 0x80 // IETF variant

  const hex = digest.toString('hex')
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20)
  ].join('-')
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/offline-uuid.test.ts`
Expected: PASS — 4 tests.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/_shared/offline-uuid.ts tests/offline-uuid.test.ts
git commit -m "feat: add offline UUID derivation with known-vector tests"
```

---

### Task 6: `check-access` edge function

**Files:**
- Create: `supabase/functions/_shared/cors.ts`
- Create: `supabase/functions/check-access/index.ts`

- [ ] **Step 1: Write the shared CORS helper**

```ts
// supabase/functions/_shared/cors.ts
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
}

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  })
}
```

- [ ] **Step 2: Write the function**

```ts
// supabase/functions/check-access/index.ts
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { decideAccess, type WhitelistRow } from '../_shared/whitelist.ts'
import { offlineUuid } from '../_shared/offline-uuid.ts'
import { corsHeaders, json } from '../_shared/cors.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

interface PremiumRequest {
  mode: 'premium'
  mc_token: string
}
interface CustomRequest {
  mode: 'custom'
}
type AccessRequest = PremiumRequest | CustomRequest

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  let body: AccessRequest
  try {
    body = await req.json()
  } catch {
    return json({ allowed: false, reason: 'bad_request' }, 400)
  }

  let uuid: string | null = null
  let username: string | null = null
  let discordId: string | null = null

  if (body.mode === 'premium') {
    // Verify the token with Mojang. A forged token fails here, so the UUID we
    // end up with is proven rather than claimed.
    const profileRes = await fetch('https://api.minecraftservices.com/minecraft/profile', {
      headers: { Authorization: `Bearer ${body.mc_token}` }
    })
    if (!profileRes.ok) {
      return json({ allowed: false, reason: 'invalid_minecraft_token' }, 401)
    }
    const profile = (await profileRes.json()) as { id: string; name: string }
    // Mojang returns an undashed UUID; the whitelist stores the dashed form.
    uuid = dashUuid(profile.id)
    username = profile.name

    // Premium identity is the Mojang-proven UUID and nothing else. We must NOT
    // look up a launcher profile by minecraft_username to inherit its discord_id:
    // Minecraft names are mutable and launcher nicks are free text, so anyone who
    // renamed a premium account to a whitelisted player's nick would inherit that
    // player's Discord identity and pass the check. Whitelist premium players by
    // UUID (see SETUP.md).
    discordId = null
  } else {
    // Custom account: identity comes from the session, never the request body.
    const authHeader = req.headers.get('Authorization') ?? ''
    const jwt = authHeader.replace('Bearer ', '')
    const { data: userData, error: userError } = await admin.auth.getUser(jwt)
    if (userError || !userData.user) {
      return json({ allowed: false, reason: 'unauthenticated' }, 401)
    }

    const { data: profile } = await admin
      .from('profiles')
      .select('minecraft_username, discord_id')
      .eq('id', userData.user.id)
      .maybeSingle()

    if (!profile) return json({ allowed: false, reason: 'no_profile' }, 403)
    if (!profile.discord_id) return json({ allowed: false, reason: 'discord_not_linked' }, 403)

    username = profile.minecraft_username
    uuid = offlineUuid(profile.minecraft_username)
    discordId = profile.discord_id
  }

  const { data: rows, error } = await admin
    .from('whitelist')
    .select('minecraft_uuid, discord_id, active')

  if (error) return json({ allowed: false, reason: 'server_error' }, 500)

  const decision = decideAccess((rows ?? []) as WhitelistRow[], { uuid, discordId })

  return json({
    allowed: decision.allowed,
    reason: decision.reason,
    minecraft_uuid: uuid,
    minecraft_username: username
  })
})

function dashUuid(undashed: string): string {
  if (undashed.includes('-')) return undashed
  return [
    undashed.slice(0, 8),
    undashed.slice(8, 12),
    undashed.slice(12, 16),
    undashed.slice(16, 20),
    undashed.slice(20)
  ].join('-')
}
```

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/check-access supabase/functions/_shared/cors.ts
git commit -m "feat: add check-access edge function with server-side identity derivation"
```

---

### Task 7: `discord-oauth` edge function

**Files:**
- Create: `supabase/functions/discord-oauth/index.ts`

- [ ] **Step 1: Write the function**

```ts
// supabase/functions/discord-oauth/index.ts
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { corsHeaders, json } from '../_shared/cors.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const DISCORD_CLIENT_ID = Deno.env.get('DISCORD_CLIENT_ID')!
const DISCORD_CLIENT_SECRET = Deno.env.get('DISCORD_CLIENT_SECRET')!
const DISCORD_REDIRECT_URI = Deno.env.get('DISCORD_REDIRECT_URI')!

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  // Identify the caller from their session — this is the account we link to.
  const jwt = (req.headers.get('Authorization') ?? '').replace('Bearer ', '')
  const { data: userData, error: userError } = await admin.auth.getUser(jwt)
  if (userError || !userData.user) {
    return json({ ok: false, reason: 'unauthenticated' }, 401)
  }

  let code: string
  try {
    const body = (await req.json()) as { code?: string }
    if (!body.code) return json({ ok: false, reason: 'missing_code' }, 400)
    code = body.code
  } catch {
    return json({ ok: false, reason: 'bad_request' }, 400)
  }

  // Exchange the code. The secret never leaves this function.
  const tokenRes = await fetch('https://discord.com/api/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: DISCORD_CLIENT_ID,
      client_secret: DISCORD_CLIENT_SECRET,
      grant_type: 'authorization_code',
      code,
      redirect_uri: DISCORD_REDIRECT_URI
    })
  })

  if (!tokenRes.ok) return json({ ok: false, reason: 'discord_exchange_failed' }, 400)
  const token = (await tokenRes.json()) as { access_token: string }

  const meRes = await fetch('https://discord.com/api/users/@me', {
    headers: { Authorization: `Bearer ${token.access_token}` }
  })
  if (!meRes.ok) return json({ ok: false, reason: 'discord_profile_failed' }, 400)
  const me = (await meRes.json()) as { id: string; username: string; global_name?: string }

  // Refuse to link a Discord account already bound to someone else.
  const { data: existing } = await admin
    .from('profiles')
    .select('id')
    .eq('discord_id', me.id)
    .maybeSingle()

  if (existing && existing.id !== userData.user.id) {
    return json({ ok: false, reason: 'discord_already_linked' }, 409)
  }

  const { error: updateError } = await admin
    .from('profiles')
    .update({ discord_id: me.id, discord_username: me.global_name ?? me.username })
    .eq('id', userData.user.id)

  if (updateError) return json({ ok: false, reason: 'server_error' }, 500)

  return json({ ok: true, discord_id: me.id, discord_username: me.global_name ?? me.username })
})
```

- [ ] **Step 2: Commit**

```bash
git add supabase/functions/discord-oauth
git commit -m "feat: add discord-oauth edge function"
```

---

### Task 8: SETUP.md

**Files:**
- Create: `SETUP.md`

- [ ] **Step 1: Write the setup guide**

````markdown
# Configuración del Victoria Kingdom Launcher

Estos pasos los tienes que hacer tú una sola vez, porque requieren iniciar sesión
con tus cuentas.

## 1. Crear la aplicación de Discord

1. Entra en https://discord.com/developers/applications y pulsa **New Application**.
2. Ponle el nombre `Victoria Kingdom Launcher` y acepta.
3. En **OAuth2 → General**:
   - Copia el **Client ID**.
   - Pulsa **Reset Secret** y copia el **Client Secret**. No lo pegues nunca en el
     código del launcher — solo va en Supabase (paso 2.4).
   - En **Redirects**, añade exactamente: `http://localhost:53682/discord/callback`
   - Guarda los cambios.

## 2. Crear el proyecto de Supabase

1. Entra en https://supabase.com y crea un proyecto nuevo.
2. Cuando termine, ve a **SQL Editor**, pega el contenido de `supabase/schema.sql`
   y ejecútalo.
3. Ve a **Project Settings → API** y copia:
   - **Project URL** → `VITE_SUPABASE_URL`
   - **anon public key** → `VITE_SUPABASE_ANON_KEY`
4. Instala la CLI y despliega las funciones:

   ```bash
   npm install -g supabase
   supabase login
   supabase link --project-ref TU_PROJECT_REF
   supabase secrets set DISCORD_CLIENT_ID=tu_client_id DISCORD_CLIENT_SECRET=tu_secret DISCORD_REDIRECT_URI=http://localhost:53682/discord/callback
   supabase functions deploy check-access
   supabase functions deploy discord-oauth
   ```

   `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` ya existen automáticamente dentro
   de las funciones; no hace falta configurarlas.

## 3. Configurar el launcher

Copia `.env.example` a `.env` y rellena los valores:

```
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOi...
VITE_DISCORD_CLIENT_ID=000000000000000000
VITE_DISCORD_REDIRECT_URI=http://localhost:53682/discord/callback
VITE_AZURE_CLIENT_ID=
```

`VITE_AZURE_CLIENT_ID` puede quedarse vacío: msmc usa su propia aplicación de
Azure por defecto y funciona sin configurar nada.

## 4. Dar acceso a jugadores (whitelist)

En Supabase → **Table Editor → whitelist**, añade una fila por jugador:

- Para una cuenta **premium**: rellena `minecraft_uuid` con el UUID real del
  jugador (lo puedes sacar de https://mcuuid.net).
- Para una cuenta **propia del launcher**: rellena `discord_id` con el ID de
  Discord del jugador (Discord → Ajustes → Avanzado → Modo desarrollador, luego
  clic derecho sobre el usuario → Copiar ID).
- Puedes rellenar los dos. Basta con que uno coincida.
- `active` en `false` revoca el acceso sin borrar la fila.

Los cambios son inmediatos: el launcher consulta la base de datos en cada inicio
de sesión.

## 5. Probar

```bash
npm run dev
```
````

- [ ] **Step 2: Commit**

```bash
git add SETUP.md
git commit -m "docs: add setup guide for Discord and Supabase"
```

---

## Phase 2 — Electron Core

### Task 9: Config and environment validation

**Files:**
- Create: `src/main/config.ts`
- Create: `tests/config.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/config.test.ts
import { describe, it, expect } from 'vitest'
import { validateEnv } from '../src/main/config'

const complete = {
  VITE_SUPABASE_URL: 'https://x.supabase.co',
  VITE_SUPABASE_ANON_KEY: 'anon',
  VITE_DISCORD_CLIENT_ID: '123',
  VITE_DISCORD_REDIRECT_URI: 'http://localhost:53682/discord/callback'
}

describe('validateEnv', () => {
  it('accepts a complete environment', () => {
    expect(validateEnv(complete)).toEqual({ ok: true, missing: [] })
  })

  it('reports every missing key', () => {
    const result = validateEnv({ VITE_SUPABASE_URL: 'https://x.supabase.co' })
    expect(result.ok).toBe(false)
    expect(result.missing).toEqual([
      'VITE_SUPABASE_ANON_KEY',
      'VITE_DISCORD_CLIENT_ID',
      'VITE_DISCORD_REDIRECT_URI'
    ])
  })

  it('treats empty strings as missing', () => {
    expect(validateEnv({ ...complete, VITE_SUPABASE_ANON_KEY: '' }).ok).toBe(false)
  })

  it('does not require the optional Azure client id', () => {
    expect(validateEnv({ ...complete, VITE_AZURE_CLIENT_ID: '' }).ok).toBe(true)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/config.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

This module must NOT import `electron`, because the tests import it directly and
Electron's API does not exist in a plain Node/Vitest process. Anything needing
`app` lives in `src/main/lib/paths.ts` instead (Step 4).

```ts
// src/main/config.ts
import { join } from 'path'

export const REQUIRED_ENV_KEYS = [
  'VITE_SUPABASE_URL',
  'VITE_SUPABASE_ANON_KEY',
  'VITE_DISCORD_CLIENT_ID',
  'VITE_DISCORD_REDIRECT_URI'
] as const

export interface EnvValidation {
  ok: boolean
  missing: string[]
}

export function validateEnv(env: Record<string, string | undefined>): EnvValidation {
  const missing = REQUIRED_ENV_KEYS.filter((key) => !env[key] || env[key]!.trim() === '')
  return { ok: missing.length === 0, missing: [...missing] }
}

/** The CurseForge instance whose mods, config and saves the launcher reuses. */
export const INSTANCE_DIR =
  process.env.VICTORIA_INSTANCE_DIR ??
  'C:\\Users\\FalconKingman\\curseforge\\minecraft\\Instances\\Victoria Bien Hecho'

export const MC_VERSION = '1.20.1'
export const FORGE_VERSION = '47.4.0'
export const FORGE_INSTALLER_URL = `https://maven.minecraftforge.net/net/minecraftforge/forge/${MC_VERSION}-${FORGE_VERSION}/forge-${MC_VERSION}-${FORGE_VERSION}-installer.jar`

export const DISCORD_CALLBACK_PORT = 53682

export const env = {
  supabaseUrl: process.env.VITE_SUPABASE_URL ?? '',
  supabaseAnonKey: process.env.VITE_SUPABASE_ANON_KEY ?? '',
  discordClientId: process.env.VITE_DISCORD_CLIENT_ID ?? '',
  discordRedirectUri: process.env.VITE_DISCORD_REDIRECT_URI ?? '',
  azureClientId: process.env.VITE_AZURE_CLIENT_ID ?? ''
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/config.test.ts`
Expected: PASS — 4 tests.

- [ ] **Step 5: Write the Electron-dependent paths module**

Keeping this separate is what lets `config.ts` stay importable from tests.

```ts
// src/main/lib/paths.ts
import { app } from 'electron'
import { join } from 'path'

/** Launcher-owned directory for libraries, assets and the Forge installer. */
export function launcherRoot(): string {
  return join(app.getPath('userData'), 'minecraft')
}

export function settingsPath(): string {
  return join(app.getPath('userData'), 'settings.json')
}

export function msTokenPath(): string {
  return join(app.getPath('userData'), 'ms-token.bin')
}
```

- [ ] **Step 6: Commit**

```bash
git add src/main/config.ts src/main/lib/paths.ts tests/config.test.ts
git commit -m "feat: add config module with env validation"
```

---

### Task 10: Java runtime detection

**Files:**
- Create: `src/main/lib/java.ts`
- Create: `tests/java.test.ts`

- [ ] **Step 1: Write the failing test**

The selection order is pure logic once candidate paths are known, so that part is tested directly.

```ts
// tests/java.test.ts
import { describe, it, expect } from 'vitest'
import { pickJavaPath } from '../src/main/lib/java'

describe('pickJavaPath', () => {
  const exists = (p: string): boolean =>
    p === 'C:/curseforge/java-runtime-gamma/bin/javaw.exe' || p === 'C:/jdk/bin/javaw.exe'

  it('prefers the user override when it exists', () => {
    expect(pickJavaPath({ override: 'C:/jdk/bin/javaw.exe', candidates: [], exists })).toBe(
      'C:/jdk/bin/javaw.exe'
    )
  })

  it('ignores an override that does not exist', () => {
    const result = pickJavaPath({
      override: 'C:/missing/javaw.exe',
      candidates: ['C:/curseforge/java-runtime-gamma/bin/javaw.exe'],
      exists
    })
    expect(result).toBe('C:/curseforge/java-runtime-gamma/bin/javaw.exe')
  })

  it('returns the first existing candidate', () => {
    const result = pickJavaPath({
      override: null,
      candidates: ['C:/nope/javaw.exe', 'C:/jdk/bin/javaw.exe'],
      exists
    })
    expect(result).toBe('C:/jdk/bin/javaw.exe')
  })

  it('falls back to bare java on PATH when nothing is found', () => {
    expect(pickJavaPath({ override: null, candidates: ['C:/nope/javaw.exe'], exists })).toBe('java')
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/java.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

```ts
// src/main/lib/java.ts
import { existsSync } from 'fs'
import { join } from 'path'
import { homedir } from 'os'

export interface PickJavaOptions {
  override: string | null
  candidates: string[]
  exists: (path: string) => boolean
}

/**
 * Chooses a Java executable: an explicit user override wins, then the first
 * candidate that exists on disk, then whatever `java` resolves to on PATH.
 */
export function pickJavaPath({ override, candidates, exists }: PickJavaOptions): string {
  if (override && exists(override)) return override
  const found = candidates.find((candidate) => exists(candidate))
  return found ?? 'java'
}

/**
 * Minecraft 1.20.1 needs Java 17. CurseForge ships it as `java-runtime-gamma`,
 * so an existing CurseForge install gives us a correct JRE for free.
 */
export function javaCandidates(): string[] {
  const cfJava = join(homedir(), 'curseforge', 'minecraft', 'Install', 'java')
  const list = [
    join(cfJava, 'java-runtime-gamma', 'bin', 'javaw.exe'),
    join(cfJava, 'java-runtime-delta', 'bin', 'javaw.exe'),
    join(cfJava, 'Jre_21', 'bin', 'javaw.exe')
  ]
  if (process.env.JAVA_HOME) {
    list.push(join(process.env.JAVA_HOME, 'bin', 'javaw.exe'))
  }
  return list
}

export function detectJava(override: string | null): string {
  return pickJavaPath({ override, candidates: javaCandidates(), exists: existsSync })
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/java.test.ts`
Expected: PASS — 4 tests.

- [ ] **Step 5: Commit**

```bash
git add src/main/lib/java.ts tests/java.test.ts
git commit -m "feat: add java runtime detection"
```

---

### Task 11: Mod scanning and toggling

**Files:**
- Create: `src/main/lib/mods-core.ts` (pure filesystem logic — what the tests import)
- Create: `src/main/ipc/mods.ts` (Electron handler wrapper)
- Create: `tests/mods.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/mods.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { scanMods, toggleMod, prettyModName } from '../src/main/lib/mods-core'

let dir: string

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'victoria-mods-'))
  mkdirSync(join(dir, 'mods'))
  mkdirSync(join(dir, 'disabled_mods'))
  writeFileSync(join(dir, 'mods', 'jei-1.20.1-15.2.0.jar'), 'x')
  writeFileSync(join(dir, 'mods', 'sodium.jar'), 'x')
  writeFileSync(join(dir, 'disabled_mods', 'optifine.jar'), 'x')
  writeFileSync(join(dir, 'mods', 'notes.txt'), 'x')
})

afterEach(() => rmSync(dir, { recursive: true, force: true }))

describe('scanMods', () => {
  it('lists enabled and disabled jars', () => {
    const mods = scanMods(dir)
    expect(mods).toHaveLength(3)
    expect(mods.filter((m) => m.enabled).map((m) => m.filename).sort()).toEqual([
      'jei-1.20.1-15.2.0.jar',
      'sodium.jar'
    ])
    expect(mods.find((m) => m.filename === 'optifine.jar')!.enabled).toBe(false)
  })

  it('ignores files that are not jars', () => {
    expect(scanMods(dir).some((m) => m.filename === 'notes.txt')).toBe(false)
  })
})

describe('toggleMod', () => {
  it('disables an enabled mod by moving the jar', () => {
    toggleMod(dir, 'sodium.jar', false)
    expect(existsSync(join(dir, 'mods', 'sodium.jar'))).toBe(false)
    expect(existsSync(join(dir, 'disabled_mods', 'sodium.jar'))).toBe(true)
  })

  it('enables a disabled mod by moving the jar back', () => {
    toggleMod(dir, 'optifine.jar', true)
    expect(existsSync(join(dir, 'mods', 'optifine.jar'))).toBe(true)
    expect(existsSync(join(dir, 'disabled_mods', 'optifine.jar'))).toBe(false)
  })

  it('rejects a filename containing path separators', () => {
    expect(() => toggleMod(dir, '../evil.jar', false)).toThrow('Invalid mod filename')
  })
})

describe('prettyModName', () => {
  it('strips the extension and version noise', () => {
    expect(prettyModName('jei-1.20.1-15.2.0.jar')).toBe('jei')
    expect(prettyModName('sodium.jar')).toBe('sodium')
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/mods.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

```ts
// src/main/lib/mods-core.ts
import { readdirSync, existsSync, mkdirSync, renameSync, statSync } from 'fs'
import { join, basename } from 'path'

export interface ModEntry {
  filename: string
  name: string
  enabled: boolean
  sizeBytes: number
}

const ENABLED_DIR = 'mods'
const DISABLED_DIR = 'disabled_mods'

/** Turns `jei-1.20.1-15.2.0.jar` into `jei` for display. */
export function prettyModName(filename: string): string {
  const withoutExt = filename.replace(/\.jar$/i, '')
  return withoutExt.replace(/[-_]\d[\d.\-+_a-zA-Z]*$/, '')
}

function listJars(dir: string): string[] {
  if (!existsSync(dir)) return []
  return readdirSync(dir).filter((file) => file.toLowerCase().endsWith('.jar'))
}

export function scanMods(instanceDir: string): ModEntry[] {
  const build = (dir: string, enabled: boolean): ModEntry[] =>
    listJars(join(instanceDir, dir)).map((filename) => ({
      filename,
      name: prettyModName(filename),
      enabled,
      sizeBytes: statSync(join(instanceDir, dir, filename)).size
    }))

  return [...build(ENABLED_DIR, true), ...build(DISABLED_DIR, false)].sort((a, b) =>
    a.name.localeCompare(b.name)
  )
}

export function toggleMod(instanceDir: string, filename: string, enable: boolean): void {
  // Never let a renderer-supplied name escape the mods folders.
  if (filename !== basename(filename) || filename.includes('..')) {
    throw new Error('Invalid mod filename')
  }

  const from = join(instanceDir, enable ? DISABLED_DIR : ENABLED_DIR, filename)
  const toDir = join(instanceDir, enable ? ENABLED_DIR : DISABLED_DIR)
  if (!existsSync(from)) throw new Error(`Mod not found: ${filename}`)
  mkdirSync(toDir, { recursive: true })
  renameSync(from, join(toDir, filename))
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/mods.test.ts`
Expected: PASS — 6 tests.

- [ ] **Step 5: Write the Electron handler wrapper**

```ts
// src/main/ipc/mods.ts
import { ipcMain } from 'electron'
import { INSTANCE_DIR } from '../config'
import { scanMods, toggleMod } from '../lib/mods-core'

export function registerModHandlers(): void {
  ipcMain.handle('mods:list', () => scanMods(INSTANCE_DIR))
  ipcMain.handle('mods:toggle', (_event, filename: string, enable: boolean) => {
    toggleMod(INSTANCE_DIR, filename, enable)
    return scanMods(INSTANCE_DIR)
  })
}
```

- [ ] **Step 6: Commit**

```bash
git add src/main/lib/mods-core.ts src/main/ipc/mods.ts tests/mods.test.ts
git commit -m "feat: add mod scanning and enable/disable"
```

---

### Task 12: Settings store

**Files:**
- Create: `src/main/lib/settings-core.ts` (pure merge/clamp logic — what the tests import)
- Create: `src/main/lib/settings.ts` (disk I/O, needs Electron paths)
- Create: `tests/settings.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/settings.test.ts
import { describe, it, expect } from 'vitest'
import { mergeSettings, DEFAULT_SETTINGS } from '../src/main/lib/settings-core'

describe('mergeSettings', () => {
  it('returns defaults for empty stored data', () => {
    expect(mergeSettings({})).toEqual(DEFAULT_SETTINGS)
  })

  it('keeps stored values over defaults', () => {
    expect(mergeSettings({ maxMemoryMb: 4096 }).maxMemoryMb).toBe(4096)
  })

  it('drops unknown keys', () => {
    expect('junk' in mergeSettings({ junk: 1 } as never)).toBe(false)
  })

  it('clamps memory to a sane range', () => {
    expect(mergeSettings({ maxMemoryMb: 100 }).maxMemoryMb).toBe(1024)
    expect(mergeSettings({ maxMemoryMb: 999999 }).maxMemoryMb).toBe(32768)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/settings.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

```ts
// src/main/lib/settings-core.ts
export interface Settings {
  maxMemoryMb: number
  minMemoryMb: number
  javaPath: string | null
  musicEnabled: boolean
  closeOnLaunch: boolean
}

export const DEFAULT_SETTINGS: Settings = {
  maxMemoryMb: 8192,
  minMemoryMb: 2048,
  javaPath: null,
  musicEnabled: false,
  closeOnLaunch: false
}

const MIN_MB = 1024
const MAX_MB = 32768

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

export function mergeSettings(stored: Partial<Settings>): Settings {
  return {
    maxMemoryMb: clamp(stored.maxMemoryMb ?? DEFAULT_SETTINGS.maxMemoryMb, MIN_MB, MAX_MB),
    minMemoryMb: clamp(stored.minMemoryMb ?? DEFAULT_SETTINGS.minMemoryMb, 512, MAX_MB),
    javaPath: stored.javaPath ?? DEFAULT_SETTINGS.javaPath,
    musicEnabled: stored.musicEnabled ?? DEFAULT_SETTINGS.musicEnabled,
    closeOnLaunch: stored.closeOnLaunch ?? DEFAULT_SETTINGS.closeOnLaunch
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/settings.test.ts`
Expected: PASS — 4 tests.

- [ ] **Step 5: Write the disk-backed store**

```ts
// src/main/lib/settings.ts
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { settingsPath } from './paths'
import { mergeSettings, DEFAULT_SETTINGS, type Settings } from './settings-core'

export { DEFAULT_SETTINGS, mergeSettings }
export type { Settings }

export function loadSettings(): Settings {
  if (!existsSync(settingsPath())) return DEFAULT_SETTINGS
  try {
    return mergeSettings(JSON.parse(readFileSync(settingsPath(), 'utf8')))
  } catch {
    // A corrupt settings file should never stop the launcher from opening.
    return DEFAULT_SETTINGS
  }
}

export function saveSettings(patch: Partial<Settings>): Settings {
  const next = mergeSettings({ ...loadSettings(), ...patch })
  writeFileSync(settingsPath(), JSON.stringify(next, null, 2), 'utf8')
  return next
}
```

- [ ] **Step 6: Commit**

```bash
git add src/main/lib/settings-core.ts src/main/lib/settings.ts tests/settings.test.ts
git commit -m "feat: add settings store with clamping"
```

---

### Task 13: Microsoft authentication (msmc)

**Files:**
- Create: `src/main/ipc/auth.ts`

No unit test — this task is entirely a wrapper over an interactive OAuth library. It is verified manually in Step 3.

- [ ] **Step 1: Write the implementation**

```ts
// src/main/ipc/auth.ts
import { ipcMain, safeStorage } from 'electron'
import { readFileSync, writeFileSync, existsSync, rmSync } from 'fs'
import { Auth } from 'msmc'
import type { MclcUser } from 'msmc/types/types'
import { msTokenPath } from '../lib/paths'

export interface PremiumSession {
  name: string
  uuid: string
  mcToken: string
  mclc: MclcUser
}

/** Stores the Microsoft refresh token encrypted with the OS keychain. */
function saveRefreshToken(token: string): void {
  if (!safeStorage.isEncryptionAvailable()) return
  writeFileSync(msTokenPath(), safeStorage.encryptString(token))
}

function readRefreshToken(): string | null {
  if (!existsSync(msTokenPath()) || !safeStorage.isEncryptionAvailable()) return null
  try {
    return safeStorage.decryptString(readFileSync(msTokenPath()))
  } catch {
    return null
  }
}

export function clearRefreshToken(): void {
  if (existsSync(msTokenPath())) rmSync(msTokenPath())
}

async function toSession(xbox: Awaited<ReturnType<Auth['launch']>>): Promise<PremiumSession> {
  const minecraft = await xbox.getMinecraft()
  if (!minecraft.profile) {
    throw new Error('Esta cuenta de Microsoft no tiene Minecraft: Java Edition.')
  }
  saveRefreshToken(xbox.save())
  return {
    name: minecraft.profile.name,
    uuid: minecraft.profile.id,
    mcToken: minecraft.mcToken,
    mclc: minecraft.mclc()
  }
}

export async function loginMicrosoft(): Promise<PremiumSession> {
  const auth = new Auth('select_account')
  const xbox = await auth.launch('electron')
  return toSession(xbox)
}

/** Silent re-login on startup. Returns null when there is no usable token. */
export async function restoreMicrosoft(): Promise<PremiumSession | null> {
  const refreshToken = readRefreshToken()
  if (!refreshToken) return null
  try {
    const auth = new Auth('select_account')
    const xbox = await auth.refresh(refreshToken)
    return await toSession(xbox)
  } catch {
    clearRefreshToken()
    return null
  }
}

export function registerAuthHandlers(): void {
  ipcMain.handle('auth:microsoft-login', () => loginMicrosoft())
  ipcMain.handle('auth:microsoft-restore', () => restoreMicrosoft())
  ipcMain.handle('auth:microsoft-logout', () => {
    clearRefreshToken()
    return true
  })
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/main/ipc/auth.ts
git commit -m "feat: add Microsoft authentication via msmc"
```

---

### Task 14: Discord OAuth loopback flow

**Files:**
- Create: `src/main/lib/discord-url.ts` (pure URL builder — what the tests import)
- Create: `src/main/ipc/discord.ts` (loopback server + OAuth window)
- Create: `tests/discord-url.test.ts`

- [ ] **Step 1: Write the failing test for the URL builder**

```ts
// tests/discord-url.test.ts
import { describe, it, expect } from 'vitest'
import { buildAuthorizeUrl } from '../src/main/lib/discord-url'

describe('buildAuthorizeUrl', () => {
  const url = buildAuthorizeUrl({
    clientId: '123456',
    redirectUri: 'http://localhost:53682/discord/callback',
    state: 'nonce-abc'
  })
  const parsed = new URL(url)

  it('points at the Discord authorize endpoint', () => {
    expect(parsed.origin + parsed.pathname).toBe('https://discord.com/oauth2/authorize')
  })

  it('requests only the identify scope', () => {
    expect(parsed.searchParams.get('scope')).toBe('identify')
  })

  it('uses the authorization code flow', () => {
    expect(parsed.searchParams.get('response_type')).toBe('code')
  })

  it('carries the client id, redirect uri and state', () => {
    expect(parsed.searchParams.get('client_id')).toBe('123456')
    expect(parsed.searchParams.get('redirect_uri')).toBe('http://localhost:53682/discord/callback')
    expect(parsed.searchParams.get('state')).toBe('nonce-abc')
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/discord-url.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the pure URL builder**

```ts
// src/main/lib/discord-url.ts
export interface AuthorizeUrlOptions {
  clientId: string
  redirectUri: string
  state: string
}

export function buildAuthorizeUrl({ clientId, redirectUri, state }: AuthorizeUrlOptions): string {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'identify',
    state
  })
  return `https://discord.com/oauth2/authorize?${params.toString()}`
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/discord-url.test.ts`
Expected: PASS — 4 tests.

- [ ] **Step 5: Write the loopback OAuth flow**

```ts
// src/main/ipc/discord.ts
import { BrowserWindow } from 'electron'
import { createServer, type Server } from 'http'
import { randomBytes } from 'crypto'
import { env, DISCORD_CALLBACK_PORT } from '../config'
import { buildAuthorizeUrl } from '../lib/discord-url'

const SUCCESS_PAGE = `<!doctype html><html lang="es"><head><meta charset="utf-8">
<title>Discord vinculado</title><style>
body{background:#0d0d12;color:#fff;font-family:system-ui,sans-serif;display:grid;
place-items:center;height:100vh;margin:0}h1{font-weight:600}p{color:#9aa}
</style></head><body><div><h1>Cuenta de Discord vinculada</h1>
<p>Ya puedes volver al launcher.</p></div></body></html>`

const ERROR_PAGE = SUCCESS_PAGE.replace('Cuenta de Discord vinculada', 'No se pudo vincular')
  .replace('Ya puedes volver al launcher.', 'Cierra esta ventana e inténtalo de nuevo.')

/**
 * Opens Discord's consent screen and captures the authorization code from a
 * loopback redirect. Resolves with the raw code, which only the edge function
 * can exchange (it holds the client secret).
 */
export function linkDiscord(): Promise<string> {
  return new Promise((resolve, reject) => {
    const state = randomBytes(16).toString('hex')
    let server: Server | null = null
    let win: BrowserWindow | null = null
    let settled = false

    const cleanup = (): void => {
      server?.close()
      server = null
      if (win && !win.isDestroyed()) win.destroy()
      win = null
    }

    const finish = (error: Error | null, code?: string): void => {
      if (settled) return
      settled = true
      cleanup()
      if (error) reject(error)
      else resolve(code!)
    }

    server = createServer((req, res) => {
      const url = new URL(req.url ?? '/', `http://localhost:${DISCORD_CALLBACK_PORT}`)
      if (url.pathname !== '/discord/callback') {
        res.writeHead(404).end()
        return
      }

      const code = url.searchParams.get('code')
      const returnedState = url.searchParams.get('state')

      if (!code || returnedState !== state) {
        res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' }).end(ERROR_PAGE)
        finish(new Error('Respuesta de Discord inválida.'))
        return
      }

      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }).end(SUCCESS_PAGE)
      finish(null, code)
    })

    server.on('error', (error) => finish(error))

    server.listen(DISCORD_CALLBACK_PORT, '127.0.0.1', () => {
      win = new BrowserWindow({
        width: 520,
        height: 780,
        autoHideMenuBar: true,
        title: 'Vincular Discord',
        webPreferences: { nodeIntegration: false, contextIsolation: true }
      })
      win.on('closed', () => finish(new Error('Vinculación cancelada.')))
      win.loadURL(
        buildAuthorizeUrl({
          clientId: env.discordClientId,
          redirectUri: env.discordRedirectUri,
          state
        })
      )
    })
  })
}
```

- [ ] **Step 6: Commit**

```bash
git add src/main/lib/discord-url.ts src/main/ipc/discord.ts tests/discord-url.test.ts
git commit -m "feat: add Discord OAuth loopback flow with CSRF state"
```

---

### Task 15: Supabase IPC layer

**Files:**
- Create: `src/main/ipc/supabase.ts`

- [ ] **Step 1: Write the implementation**

```ts
// src/main/ipc/supabase.ts
import { ipcMain } from 'electron'
import { createClient, type SupabaseClient, type Session } from '@supabase/supabase-js'
import { env } from '../config'
import { linkDiscord } from './discord'

export interface LauncherProfile {
  id: string
  email: string | null
  minecraft_username: string
  discord_id: string | null
  discord_username: string | null
}

export interface AccessResult {
  allowed: boolean
  reason: string
  minecraft_uuid: string | null
  minecraft_username: string | null
}

let client: SupabaseClient | null = null

function supabase(): SupabaseClient {
  if (!client) {
    client = createClient(env.supabaseUrl, env.supabaseAnonKey, {
      auth: { persistSession: false, autoRefreshToken: false }
    })
  }
  return client
}

let session: Session | null = null

export function currentSession(): Session | null {
  return session
}

export async function register(
  email: string,
  password: string,
  minecraftUsername: string
): Promise<LauncherProfile> {
  const trimmed = minecraftUsername.trim()
  if (!/^[A-Za-z0-9_]{3,16}$/.test(trimmed)) {
    throw new Error('El nick debe tener 3-16 caracteres: letras, números o guion bajo.')
  }

  const { data, error } = await supabase().auth.signUp({ email, password })
  if (error) throw new Error(error.message)
  if (!data.session || !data.user) {
    throw new Error('Revisa tu correo para confirmar la cuenta y vuelve a iniciar sesión.')
  }
  session = data.session

  const { error: profileError } = await supabase()
    .from('profiles')
    .insert({ id: data.user.id, email, minecraft_username: trimmed })

  if (profileError) {
    throw new Error(
      profileError.code === '23505'
        ? 'Ese nick de Minecraft ya está en uso.'
        : profileError.message
    )
  }

  return {
    id: data.user.id,
    email,
    minecraft_username: trimmed,
    discord_id: null,
    discord_username: null
  }
}

export async function login(email: string, password: string): Promise<LauncherProfile> {
  const { data, error } = await supabase().auth.signInWithPassword({ email, password })
  if (error) throw new Error('Correo o contraseña no válidos.')
  session = data.session

  const { data: profile, error: profileError } = await supabase()
    .from('profiles')
    .select('id, email, minecraft_username, discord_id, discord_username')
    .eq('id', data.user.id)
    .single()

  if (profileError || !profile) throw new Error('No se encontró el perfil de esta cuenta.')
  return profile as LauncherProfile
}

/** Opens the Discord consent flow, then asks the edge function to link it. */
export async function linkDiscordAccount(): Promise<LauncherProfile> {
  if (!session) throw new Error('Inicia sesión antes de vincular Discord.')

  const code = await linkDiscord()

  const { data, error } = await supabase().functions.invoke('discord-oauth', {
    body: { code },
    headers: { Authorization: `Bearer ${session.access_token}` }
  })

  if (error) throw new Error('No se pudo vincular Discord. Inténtalo de nuevo.')
  const result = data as { ok: boolean; reason?: string }
  if (!result.ok) {
    throw new Error(
      result.reason === 'discord_already_linked'
        ? 'Esa cuenta de Discord ya está vinculada a otro usuario.'
        : 'No se pudo vincular Discord.'
    )
  }

  const { data: profile } = await supabase()
    .from('profiles')
    .select('id, email, minecraft_username, discord_id, discord_username')
    .eq('id', session.user.id)
    .single()

  return profile as LauncherProfile
}

export async function checkAccessPremium(mcToken: string): Promise<AccessResult> {
  const { data, error } = await supabase().functions.invoke('check-access', {
    body: { mode: 'premium', mc_token: mcToken }
  })
  if (error) throw new Error('No se pudo comprobar la whitelist.')
  return data as AccessResult
}

export async function checkAccessCustom(): Promise<AccessResult> {
  if (!session) throw new Error('No hay sesión activa.')
  const { data, error } = await supabase().functions.invoke('check-access', {
    body: { mode: 'custom' },
    headers: { Authorization: `Bearer ${session.access_token}` }
  })
  if (error) throw new Error('No se pudo comprobar la whitelist.')
  return data as AccessResult
}

export function logout(): void {
  session = null
}

export function registerSupabaseHandlers(): void {
  ipcMain.handle('supabase:register', (_e, email: string, password: string, nick: string) =>
    register(email, password, nick)
  )
  ipcMain.handle('supabase:login', (_e, email: string, password: string) => login(email, password))
  ipcMain.handle('supabase:link-discord', () => linkDiscordAccount())
  ipcMain.handle('supabase:check-access-premium', (_e, mcToken: string) =>
    checkAccessPremium(mcToken)
  )
  ipcMain.handle('supabase:check-access-custom', () => checkAccessCustom())
  ipcMain.handle('supabase:logout', () => {
    logout()
    return true
  })
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/main/ipc/supabase.ts
git commit -m "feat: add Supabase auth, Discord linking and whitelist IPC"
```

---

### Task 16: Game launch via MCLC

**Files:**
- Create: `src/main/ipc/launch.ts`

- [ ] **Step 1: Write the implementation**

```ts
// src/main/ipc/launch.ts
import { ipcMain, BrowserWindow } from 'electron'
import { existsSync, mkdirSync, createWriteStream } from 'fs'
import { join } from 'path'
import { pipeline } from 'stream/promises'
import { Readable } from 'stream'
import { Client, Authenticator } from 'minecraft-launcher-core'
import type { ILauncherOptions, IUser } from 'minecraft-launcher-core'
import { INSTANCE_DIR, MC_VERSION, FORGE_VERSION, FORGE_INSTALLER_URL } from '../config'
import { launcherRoot } from '../lib/paths'
import { detectJava } from '../lib/java'
import { loadSettings } from '../lib/settings'

export interface LaunchRequest {
  /** Premium sessions pass the MCLC user object produced by msmc. */
  mclcUser?: IUser
  /** Custom accounts pass their nick; MCLC builds an offline user from it. */
  offlineUsername?: string
}

let running = false

function send(channel: string, payload: unknown): void {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send(channel, payload)
  }
}

/** Downloads the Forge installer once; MCLC handles installation from there. */
async function ensureForgeInstaller(): Promise<string> {
  const dir = join(launcherRoot(), 'forge')
  mkdirSync(dir, { recursive: true })
  const target = join(dir, `forge-${MC_VERSION}-${FORGE_VERSION}-installer.jar`)
  if (existsSync(target)) return target

  send('launch:status', { stage: 'forge', message: 'Descargando Forge...' })
  const response = await fetch(FORGE_INSTALLER_URL)
  if (!response.ok || !response.body) {
    throw new Error(`No se pudo descargar Forge (HTTP ${response.status}).`)
  }
  await pipeline(Readable.fromWeb(response.body as never), createWriteStream(target))
  return target
}

export async function launchGame(request: LaunchRequest): Promise<void> {
  if (running) throw new Error('El juego ya se está iniciando.')
  running = true

  try {
    const settings = loadSettings()
    const authorization: IUser =
      request.mclcUser ?? (await Authenticator.getAuth(request.offlineUsername!))

    const forgePath = await ensureForgeInstaller()
    const client = new Client()

    client.on('progress', (event: { type: string; task: number; total: number }) => {
      send('launch:progress', {
        type: event.type,
        percent: event.total > 0 ? Math.round((event.task / event.total) * 100) : 0
      })
    })
    client.on('download-status', (event: { name: string }) => {
      send('launch:status', { stage: 'download', message: `Descargando ${event.name}` })
    })
    client.on('data', (line: string) => send('launch:log', String(line)))
    client.on('close', (code: number) => {
      running = false
      // Bring the launcher back when the game exits, even if it was hidden.
      for (const win of BrowserWindow.getAllWindows()) win.show()
      send('launch:closed', { code })
    })

    const options: ILauncherOptions = {
      authorization,
      root: launcherRoot(),
      forge: forgePath,
      javaPath: detectJava(settings.javaPath),
      version: { number: MC_VERSION, type: 'release' },
      memory: {
        max: `${settings.maxMemoryMb}M`,
        min: `${settings.minMemoryMb}M`
      },
      overrides: {
        // Reuse the CurseForge instance so its mods, config and saves apply.
        gameDirectory: INSTANCE_DIR,
        maxSockets: 8
      }
    }

    send('launch:status', { stage: 'starting', message: 'Iniciando Minecraft...' })
    await client.launch(options)
    send('launch:status', { stage: 'running', message: 'Minecraft en ejecución' })

    if (settings.closeOnLaunch) {
      for (const win of BrowserWindow.getAllWindows()) win.hide()
    }
  } catch (error) {
    running = false
    send('launch:error', { message: (error as Error).message })
    throw error
  }
}

export function registerLaunchHandlers(): void {
  ipcMain.handle('launch:start', (_event, request: LaunchRequest) => launchGame(request))
  ipcMain.handle('launch:is-running', () => running)
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/main/ipc/launch.ts
git commit -m "feat: add Minecraft launch via MCLC with Forge and progress events"
```

---

### Task 17: Preload bridge and main wiring

**Files:**
- Modify: `src/preload/index.ts` (replace the placeholder from Task 1)
- Create: `src/preload/api.d.ts`
- Modify: `src/main/index.ts` (replace the placeholder from Task 1)
- Create: `src/main/ipc/window.ts`

- [ ] **Step 1: Write the window controls handler**

```ts
// src/main/ipc/window.ts
import { ipcMain, BrowserWindow, shell } from 'electron'

export function registerWindowHandlers(): void {
  ipcMain.on('window:minimize', (event) => {
    BrowserWindow.fromWebContents(event.sender)?.minimize()
  })

  ipcMain.on('window:maximize', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (!win) return
    if (win.isMaximized()) win.unmaximize()
    else win.maximize()
  })

  ipcMain.on('window:close', (event) => {
    BrowserWindow.fromWebContents(event.sender)?.close()
  })

  ipcMain.handle('shell:open-external', (_event, url: string) => {
    // Only ever hand http(s) links to the OS browser.
    if (!/^https?:\/\//i.test(url)) throw new Error('URL no permitida')
    return shell.openExternal(url)
  })
}
```

- [ ] **Step 2: Write the shared API types**

```ts
// src/preload/api.d.ts
import type { IUser } from 'minecraft-launcher-core'

export interface PremiumSession {
  name: string
  uuid: string
  mcToken: string
  mclc: IUser
}

export interface LauncherProfile {
  id: string
  email: string | null
  minecraft_username: string
  discord_id: string | null
  discord_username: string | null
}

export interface AccessResult {
  allowed: boolean
  reason: string
  minecraft_uuid: string | null
  minecraft_username: string | null
}

export interface ModEntry {
  filename: string
  name: string
  enabled: boolean
  sizeBytes: number
}

export interface Settings {
  maxMemoryMb: number
  minMemoryMb: number
  javaPath: string | null
  musicEnabled: boolean
  closeOnLaunch: boolean
}

export interface LaunchProgress {
  type: string
  percent: number
}

export interface LaunchStatus {
  stage: 'forge' | 'download' | 'starting' | 'running'
  message: string
}

export interface VictoriaApi {
  window: {
    minimize(): void
    maximize(): void
    close(): void
    openExternal(url: string): Promise<void>
  }
  auth: {
    microsoftLogin(): Promise<PremiumSession>
    microsoftRestore(): Promise<PremiumSession | null>
    microsoftLogout(): Promise<boolean>
  }
  account: {
    register(email: string, password: string, nick: string): Promise<LauncherProfile>
    login(email: string, password: string): Promise<LauncherProfile>
    linkDiscord(): Promise<LauncherProfile>
    logout(): Promise<boolean>
  }
  access: {
    checkPremium(mcToken: string): Promise<AccessResult>
    checkCustom(): Promise<AccessResult>
  }
  mods: {
    list(): Promise<ModEntry[]>
    toggle(filename: string, enable: boolean): Promise<ModEntry[]>
  }
  settings: {
    get(): Promise<Settings>
    save(patch: Partial<Settings>): Promise<Settings>
  }
  launch: {
    start(request: { mclcUser?: IUser; offlineUsername?: string }): Promise<void>
    isRunning(): Promise<boolean>
    onProgress(cb: (progress: LaunchProgress) => void): () => void
    onStatus(cb: (status: LaunchStatus) => void): () => void
    onError(cb: (error: { message: string }) => void): () => void
    onClosed(cb: (info: { code: number }) => void): () => void
  }
}

declare global {
  interface Window {
    api: VictoriaApi
  }
}
```

- [ ] **Step 3: Write the preload bridge**

```ts
// src/preload/index.ts
import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import type { VictoriaApi } from './api'

/** Subscribes to a main-process event and returns an unsubscribe function. */
function on<T>(channel: string, cb: (payload: T) => void): () => void {
  const listener = (_event: IpcRendererEvent, payload: T): void => cb(payload)
  ipcRenderer.on(channel, listener)
  return () => ipcRenderer.removeListener(channel, listener)
}

const api: VictoriaApi = {
  window: {
    minimize: () => ipcRenderer.send('window:minimize'),
    maximize: () => ipcRenderer.send('window:maximize'),
    close: () => ipcRenderer.send('window:close'),
    openExternal: (url) => ipcRenderer.invoke('shell:open-external', url)
  },
  auth: {
    microsoftLogin: () => ipcRenderer.invoke('auth:microsoft-login'),
    microsoftRestore: () => ipcRenderer.invoke('auth:microsoft-restore'),
    microsoftLogout: () => ipcRenderer.invoke('auth:microsoft-logout')
  },
  account: {
    register: (email, password, nick) =>
      ipcRenderer.invoke('supabase:register', email, password, nick),
    login: (email, password) => ipcRenderer.invoke('supabase:login', email, password),
    linkDiscord: () => ipcRenderer.invoke('supabase:link-discord'),
    logout: () => ipcRenderer.invoke('supabase:logout')
  },
  access: {
    checkPremium: (mcToken) => ipcRenderer.invoke('supabase:check-access-premium', mcToken),
    checkCustom: () => ipcRenderer.invoke('supabase:check-access-custom')
  },
  mods: {
    list: () => ipcRenderer.invoke('mods:list'),
    toggle: (filename, enable) => ipcRenderer.invoke('mods:toggle', filename, enable)
  },
  settings: {
    get: () => ipcRenderer.invoke('settings:get'),
    save: (patch) => ipcRenderer.invoke('settings:save', patch)
  },
  launch: {
    start: (request) => ipcRenderer.invoke('launch:start', request),
    isRunning: () => ipcRenderer.invoke('launch:is-running'),
    onProgress: (cb) => on('launch:progress', cb),
    onStatus: (cb) => on('launch:status', cb),
    onError: (cb) => on('launch:error', cb),
    onClosed: (cb) => on('launch:closed', cb)
  }
}

contextBridge.exposeInMainWorld('api', api)
```

- [ ] **Step 4: Rewrite the main process entry**

```ts
// src/main/index.ts
import { app, BrowserWindow, ipcMain, dialog } from 'electron'
import { join } from 'path'
import { validateEnv } from './config'
import { registerWindowHandlers } from './ipc/window'
import { registerAuthHandlers } from './ipc/auth'
import { registerSupabaseHandlers } from './ipc/supabase'
import { registerModHandlers } from './ipc/mods'
import { registerLaunchHandlers } from './ipc/launch'
import { loadSettings, saveSettings, type Settings } from './lib/settings'

const gotLock = app.requestSingleInstanceLock()
if (!gotLock) app.quit()

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1180,
    height: 720,
    minWidth: 1024,
    minHeight: 640,
    show: false,
    frame: false,
    backgroundColor: '#0b0b10',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  win.on('ready-to-show', () => win.show())

  if (process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return win
}

function registerSettingsHandlers(): void {
  ipcMain.handle('settings:get', () => loadSettings())
  ipcMain.handle('settings:save', (_event, patch: Partial<Settings>) => saveSettings(patch))
}

app.whenReady().then(() => {
  const validation = validateEnv(process.env as Record<string, string | undefined>)
  if (!validation.ok) {
    dialog.showErrorBox(
      'Configuración incompleta',
      `Faltan estas variables en tu archivo .env:\n\n${validation.missing.join('\n')}\n\n` +
        'Consulta SETUP.md para saber cómo obtenerlas.'
    )
    app.quit()
    return
  }

  registerWindowHandlers()
  registerAuthHandlers()
  registerSupabaseHandlers()
  registerModHandlers()
  registerLaunchHandlers()
  registerSettingsHandlers()

  const win = createWindow()
  app.on('second-instance', () => {
    if (win.isMinimized()) win.restore()
    win.focus()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
```

- [ ] **Step 5: Verify the app still starts**

Run: `npm run dev`

Expected: with no `.env` present, an error dialog lists the four missing variables and the app exits. Copy `.env.example` to `.env`, fill in placeholder strings, run again — the window opens.

- [ ] **Step 6: Run the whole test suite and typecheck**

```bash
npm test && npm run typecheck
```

Expected: all tests pass, no type errors.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: wire preload bridge and main process IPC handlers"
```

---

## Phase 3 — User Interface

> Phase 3 tasks are visual. Each ends with a manual verification step describing exactly what should appear on screen.

### Task 18: Design tokens and base styles

**Files:**
- Create: `src/renderer/src/theme/tokens.css`
- Create: `src/renderer/src/theme/motion.ts`
- Modify: `src/renderer/src/main.tsx`

- [ ] **Step 1: Write the design tokens**

Palette taken from the Victoria Kingdom logo: Dutch red and blue, with the gold from "KINGDOM" as the primary accent.

```css
/* src/renderer/src/theme/tokens.css */
@import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&display=swap');

:root {
  --gold: #e6b422;
  --gold-bright: #ffd45e;
  --gold-deep: #a67c0d;
  --red: #d7263d;
  --blue: #1e3a8a;
  --blue-bright: #3b5bdb;

  --bg-0: #07070b;
  --bg-1: #0d0d14;
  --bg-2: #14141d;

  --text: #f4f4f7;
  --text-dim: #a1a1b5;
  --text-faint: #6b6b80;

  --glass: rgba(20, 20, 29, 0.55);
  --glass-strong: rgba(13, 13, 20, 0.82);
  --stroke: rgba(255, 255, 255, 0.08);
  --stroke-strong: rgba(255, 255, 255, 0.16);

  --ok: #2ecc71;
  --err: #ff5c6c;

  --r-sm: 8px;
  --r-md: 14px;
  --r-lg: 22px;

  --shadow-lg: 0 24px 60px rgba(0, 0, 0, 0.55);
  --shadow-gold: 0 8px 32px rgba(230, 180, 34, 0.28);

  --titlebar-h: 38px;
}

* {
  box-sizing: border-box;
}

html,
body,
#root {
  height: 100%;
  margin: 0;
}

body {
  background: var(--bg-0);
  color: var(--text);
  font-family: 'Outfit', system-ui, -apple-system, sans-serif;
  overflow: hidden;
  user-select: none;
}

button {
  font-family: inherit;
  cursor: pointer;
}

input {
  font-family: inherit;
}

::-webkit-scrollbar {
  width: 8px;
}
::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.12);
  border-radius: 99px;
}
::-webkit-scrollbar-thumb:hover {
  background: rgba(230, 180, 34, 0.4);
}

.glass {
  background: var(--glass);
  border: 1px solid var(--stroke);
  border-radius: var(--r-lg);
  backdrop-filter: blur(22px) saturate(140%);
  box-shadow: var(--shadow-lg);
}

@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

- [ ] **Step 2: Write the motion presets**

```ts
// src/renderer/src/theme/motion.ts
import type { Transition, Variants } from 'framer-motion'

export const spring: Transition = { type: 'spring', stiffness: 260, damping: 26 }
export const smooth: Transition = { duration: 0.45, ease: [0.22, 1, 0.36, 1] }

export const screenVariants: Variants = {
  initial: { opacity: 0, y: 18, filter: 'blur(6px)' },
  animate: { opacity: 1, y: 0, filter: 'blur(0px)', transition: smooth },
  exit: { opacity: 0, y: -12, filter: 'blur(6px)', transition: { duration: 0.28 } }
}

export const staggerChildren: Variants = {
  animate: { transition: { staggerChildren: 0.07, delayChildren: 0.05 } }
}

export const fadeUp: Variants = {
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0, transition: smooth }
}
```

- [ ] **Step 3: Import the tokens**

```tsx
// src/renderer/src/main.tsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './theme/tokens.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
```

- [ ] **Step 4: Commit**

```bash
git add src/renderer/src/theme src/renderer/src/main.tsx
git commit -m "feat: add design tokens and motion presets"
```

---

### Task 19: Shell components — TitleBar, PanoramaBg, Button, GlassCard

**Files:**
- Create: `src/renderer/src/components/TitleBar.tsx`
- Create: `src/renderer/src/vite-env.d.ts`
- Create: `src/renderer/src/components/PanoramaBg.tsx`
- Create: `src/renderer/src/components/panorama.css`
- Create: `src/renderer/src/components/Button.tsx`
- Create: `src/renderer/src/components/GlassCard.tsx`

- [ ] **Step 1: Write the TitleBar**

```tsx
// src/renderer/src/components/TitleBar.tsx
import logo from '../assets/logo.png'

export default function TitleBar(): JSX.Element {
  return (
    <div
      style={{
        height: 'var(--titlebar-h)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 0 0 14px',
        WebkitAppRegion: 'drag',
        position: 'relative',
        zIndex: 50
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <img src={logo} alt="" style={{ height: 16, imageRendering: 'pixelated' }} />
        <span style={{ fontSize: 11, letterSpacing: 1.4, color: 'var(--text-faint)' }}>
          VICTORIA KINGDOM LAUNCHER
        </span>
      </div>

      <div style={{ display: 'flex', WebkitAppRegion: 'no-drag' }}>
        <WindowButton label="—" onClick={() => window.api.window.minimize()} />
        <WindowButton label="▢" onClick={() => window.api.window.maximize()} />
        <WindowButton label="✕" danger onClick={() => window.api.window.close()} />
      </div>
    </div>
  )
}

function WindowButton({
  label,
  onClick,
  danger
}: {
  label: string
  onClick: () => void
  danger?: boolean
}): JSX.Element {
  return (
    <button
      onClick={onClick}
      className="win-btn"
      data-danger={danger ? 'true' : undefined}
      style={{
        width: 44,
        height: 'var(--titlebar-h)',
        border: 'none',
        background: 'transparent',
        color: 'var(--text-dim)',
        fontSize: 12,
        transition: 'background 0.18s, color 0.18s'
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = danger ? 'var(--err)' : 'rgba(255,255,255,0.08)'
        e.currentTarget.style.color = '#fff'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'transparent'
        e.currentTarget.style.color = 'var(--text-dim)'
      }}
    >
      {label}
    </button>
  )
}
```

Add this to `tokens.css` so the `WebkitAppRegion` inline style typechecks — React's CSS types do not include it:

```ts
// src/renderer/src/vite-env.d.ts  (create this file)
/// <reference types="vite/client" />

declare module 'react' {
  interface CSSProperties {
    WebkitAppRegion?: 'drag' | 'no-drag'
  }
}

export {}
```

- [ ] **Step 2: Write the rotating panorama background**

A CSS 3D cube built from the six Farfania panorama faces. No WebGL dependency.

```tsx
// src/renderer/src/components/PanoramaBg.tsx
import p0 from '../assets/panorama/panorama_0.png'
import p1 from '../assets/panorama/panorama_1.png'
import p2 from '../assets/panorama/panorama_2.png'
import p3 from '../assets/panorama/panorama_3.png'
import p4 from '../assets/panorama/panorama_4.png'
import p5 from '../assets/panorama/panorama_5.png'
import './panorama.css'

/**
 * Minecraft panorama face order: 0 front, 1 right, 2 back, 3 left, 4 top, 5 bottom.
 */
const FACES: Array<{ src: string; transform: string }> = [
  { src: p0, transform: 'rotateY(0deg) translateZ(-50vmax)' },
  { src: p1, transform: 'rotateY(-90deg) translateZ(-50vmax)' },
  { src: p2, transform: 'rotateY(180deg) translateZ(-50vmax)' },
  { src: p3, transform: 'rotateY(90deg) translateZ(-50vmax)' },
  { src: p4, transform: 'rotateX(-90deg) translateZ(-50vmax)' },
  { src: p5, transform: 'rotateX(90deg) translateZ(-50vmax)' }
]

export default function PanoramaBg({ blur = 8 }: { blur?: number }): JSX.Element {
  return (
    <div className="panorama-root" aria-hidden="true">
      <div className="panorama-stage">
        <div className="panorama-cube">
          {FACES.map((face, index) => (
            <div
              key={index}
              className="panorama-face"
              style={{ transform: face.transform, backgroundImage: `url(${face.src})` }}
            />
          ))}
        </div>
      </div>
      <div className="panorama-veil" style={{ backdropFilter: `blur(${blur}px)` }} />
    </div>
  )
}
```

```css
/* src/renderer/src/components/panorama.css */
.panorama-root {
  position: fixed;
  inset: 0;
  overflow: hidden;
  z-index: 0;
}

.panorama-stage {
  position: absolute;
  inset: 0;
  perspective: 60vmax;
  transform-style: preserve-3d;
}

.panorama-cube {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 100vmax;
  height: 100vmax;
  margin: -50vmax 0 0 -50vmax;
  transform-style: preserve-3d;
  animation: panorama-spin 140s linear infinite;
}

.panorama-face {
  position: absolute;
  width: 100vmax;
  height: 100vmax;
  background-size: cover;
  background-position: center;
  backface-visibility: hidden;
}

@keyframes panorama-spin {
  from {
    transform: rotateX(-6deg) rotateY(0deg);
  }
  to {
    transform: rotateX(-6deg) rotateY(360deg);
  }
}

.panorama-veil {
  position: absolute;
  inset: 0;
  background:
    radial-gradient(120% 90% at 50% 0%, rgba(7, 7, 11, 0.25), rgba(7, 7, 11, 0.9) 78%),
    linear-gradient(180deg, rgba(30, 58, 138, 0.12), rgba(7, 7, 11, 0.7));
}
```

- [ ] **Step 3: Write the Button**

```tsx
// src/renderer/src/components/Button.tsx
import { motion } from 'framer-motion'
import type { ReactNode } from 'react'
import { spring } from '../theme/motion'

type Variant = 'primary' | 'ghost' | 'discord' | 'microsoft'

const STYLES: Record<Variant, React.CSSProperties> = {
  primary: {
    background: 'linear-gradient(135deg, var(--gold-bright), var(--gold-deep))',
    color: '#241a00',
    boxShadow: 'var(--shadow-gold)',
    fontWeight: 700
  },
  ghost: {
    background: 'rgba(255,255,255,0.05)',
    color: 'var(--text)',
    border: '1px solid var(--stroke-strong)'
  },
  discord: { background: '#5865f2', color: '#fff', fontWeight: 600 },
  microsoft: { background: '#107c10', color: '#fff', fontWeight: 600 }
}

export interface ButtonProps {
  children: ReactNode
  onClick?: () => void
  variant?: Variant
  disabled?: boolean
  loading?: boolean
  full?: boolean
}

export default function Button({
  children,
  onClick,
  variant = 'primary',
  disabled,
  loading,
  full
}: ButtonProps): JSX.Element {
  const inactive = disabled || loading
  return (
    <motion.button
      whileHover={inactive ? undefined : { scale: 1.025, y: -1 }}
      whileTap={inactive ? undefined : { scale: 0.975 }}
      transition={spring}
      onClick={inactive ? undefined : onClick}
      disabled={inactive}
      style={{
        ...STYLES[variant],
        width: full ? '100%' : undefined,
        padding: '13px 22px',
        borderRadius: 12,
        border: STYLES[variant].border ?? 'none',
        fontSize: 14,
        letterSpacing: 0.3,
        opacity: inactive ? 0.55 : 1,
        cursor: inactive ? 'not-allowed' : 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10
      }}
    >
      {loading && <Spinner />}
      {children}
    </motion.button>
  )
}

function Spinner(): JSX.Element {
  return (
    <motion.span
      animate={{ rotate: 360 }}
      transition={{ repeat: Infinity, duration: 0.8, ease: 'linear' }}
      style={{
        width: 14,
        height: 14,
        border: '2px solid rgba(0,0,0,0.25)',
        borderTopColor: 'currentColor',
        borderRadius: '50%',
        display: 'inline-block'
      }}
    />
  )
}
```

- [ ] **Step 4: Write the GlassCard**

```tsx
// src/renderer/src/components/GlassCard.tsx
import { motion } from 'framer-motion'
import type { ReactNode, CSSProperties } from 'react'
import { smooth } from '../theme/motion'

export default function GlassCard({
  children,
  style,
  delay = 0
}: {
  children: ReactNode
  style?: CSSProperties
  delay?: number
}): JSX.Element {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...smooth, delay }}
      className="glass"
      style={{ padding: 26, ...style }}
    >
      {children}
    </motion.div>
  )
}
```

- [ ] **Step 5: Verify visually**

Temporarily render the shell in `App.tsx`:

```tsx
// src/renderer/src/App.tsx
import TitleBar from './components/TitleBar'
import PanoramaBg from './components/PanoramaBg'
import GlassCard from './components/GlassCard'
import Button from './components/Button'

export default function App(): JSX.Element {
  return (
    <>
      <PanoramaBg />
      <div style={{ position: 'relative', zIndex: 10, height: '100vh' }}>
        <TitleBar />
        <div style={{ display: 'grid', placeItems: 'center', height: 'calc(100vh - 38px)' }}>
          <GlassCard style={{ width: 360 }}>
            <h2 style={{ marginTop: 0 }}>Victoria Kingdom</h2>
            <Button full>JUGAR</Button>
          </GlassCard>
        </div>
      </div>
    </>
  )
}
```

Run: `npm run dev`

Expected: a slowly rotating blurred Minecraft panorama behind a frosted glass card with a gold button. The custom titlebar drags the window; the three buttons minimize, maximize, and close it.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: add titlebar, rotating panorama background and glass UI primitives"
```

---

### Task 20: Splash screen

**Files:**
- Create: `src/renderer/src/screens/Splash.tsx`

- [ ] **Step 1: Write the Splash screen**

```tsx
// src/renderer/src/screens/Splash.tsx
import { motion } from 'framer-motion'
import { useEffect } from 'react'
import logo from '../assets/logo.png'

export default function Splash({ onDone }: { onDone: () => void }): JSX.Element {
  useEffect(() => {
    const timer = setTimeout(onDone, 2200)
    return () => clearTimeout(timer)
  }, [onDone])

  return (
    <motion.div
      exit={{ opacity: 0, scale: 1.04, transition: { duration: 0.5 } }}
      style={{
        position: 'fixed',
        inset: 0,
        display: 'grid',
        placeItems: 'center',
        background: 'var(--bg-0)',
        zIndex: 100
      }}
    >
      <div style={{ display: 'grid', justifyItems: 'center', gap: 26 }}>
        <motion.img
          src={logo}
          alt="Victoria Kingdom"
          initial={{ opacity: 0, scale: 0.86, filter: 'blur(14px)' }}
          animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
          transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
          style={{ width: 360, imageRendering: 'pixelated' }}
        />

        <div
          style={{
            width: 220,
            height: 3,
            borderRadius: 99,
            background: 'rgba(255,255,255,0.08)',
            overflow: 'hidden'
          }}
        >
          <motion.div
            initial={{ x: '-100%' }}
            animate={{ x: '100%' }}
            transition={{ repeat: Infinity, duration: 1.1, ease: 'easeInOut' }}
            style={{
              height: '100%',
              width: '55%',
              background: 'linear-gradient(90deg, transparent, var(--gold), transparent)'
            }}
          />
        </div>
      </div>
    </motion.div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/renderer/src/screens/Splash.tsx
git commit -m "feat: add animated splash screen"
```

---

### Task 21: Login screen

**Files:**
- Create: `src/renderer/src/screens/Login.tsx`
- Create: `src/renderer/src/components/Field.tsx`

- [ ] **Step 1: Write the reusable input Field**

```tsx
// src/renderer/src/components/Field.tsx
export interface FieldProps {
  label: string
  type?: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  autoFocus?: boolean
}

export default function Field({
  label,
  type = 'text',
  value,
  onChange,
  placeholder,
  autoFocus
}: FieldProps): JSX.Element {
  return (
    <label style={{ display: 'grid', gap: 7 }}>
      <span style={{ fontSize: 11, letterSpacing: 1, color: 'var(--text-faint)' }}>
        {label.toUpperCase()}
      </span>
      <input
        type={type}
        value={value}
        autoFocus={autoFocus}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        style={{
          background: 'rgba(255,255,255,0.05)',
          border: '1px solid var(--stroke)',
          borderRadius: 11,
          padding: '12px 14px',
          color: 'var(--text)',
          fontSize: 14,
          outline: 'none',
          transition: 'border-color 0.2s, background 0.2s'
        }}
        onFocus={(event) => {
          event.currentTarget.style.borderColor = 'var(--gold)'
          event.currentTarget.style.background = 'rgba(255,255,255,0.08)'
        }}
        onBlur={(event) => {
          event.currentTarget.style.borderColor = 'var(--stroke)'
          event.currentTarget.style.background = 'rgba(255,255,255,0.05)'
        }}
      />
    </label>
  )
}
```

- [ ] **Step 2: Write the Login screen**

```tsx
// src/renderer/src/screens/Login.tsx
import { useState } from 'react'
import { motion } from 'framer-motion'
import GlassCard from '../components/GlassCard'
import Button from '../components/Button'
import Field from '../components/Field'
import logo from '../assets/logo.png'
import { screenVariants } from '../theme/motion'
import type { LauncherProfile, PremiumSession } from '@shared/api'

export interface LoginProps {
  onPremium: (session: PremiumSession) => void
  onCustom: (profile: LauncherProfile) => void
  onGoRegister: () => void
}

export default function Login({ onPremium, onCustom, onGoRegister }: LoginProps): JSX.Element {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState<'ms' | 'custom' | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleMicrosoft(): Promise<void> {
    setError(null)
    setBusy('ms')
    try {
      onPremium(await window.api.auth.microsoftLogin())
    } catch (caught) {
      setError((caught as Error).message)
    } finally {
      setBusy(null)
    }
  }

  async function handleCustom(): Promise<void> {
    setError(null)
    setBusy('custom')
    try {
      onCustom(await window.api.account.login(email, password))
    } catch (caught) {
      setError((caught as Error).message)
    } finally {
      setBusy(null)
    }
  }

  return (
    <motion.div
      variants={screenVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      style={{ display: 'grid', placeItems: 'center', height: '100%' }}
    >
      <GlassCard style={{ width: 420, display: 'grid', gap: 20 }}>
        <img
          src={logo}
          alt="Victoria Kingdom"
          style={{ width: 210, justifySelf: 'center', imageRendering: 'pixelated' }}
        />

        <Button variant="microsoft" full loading={busy === 'ms'} onClick={handleMicrosoft}>
          Iniciar sesión con Microsoft
        </Button>

        <Divider label="o con tu cuenta del launcher" />

        <Field label="Correo" type="email" value={email} onChange={setEmail} />
        <Field label="Contraseña" type="password" value={password} onChange={setPassword} />

        <Button
          full
          loading={busy === 'custom'}
          disabled={!email || !password}
          onClick={handleCustom}
        >
          Entrar
        </Button>

        {error && (
          <motion.p
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            style={{ color: 'var(--err)', fontSize: 13, margin: 0, textAlign: 'center' }}
          >
            {error}
          </motion.p>
        )}

        <button
          onClick={onGoRegister}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--text-dim)',
            fontSize: 13,
            textDecoration: 'underline'
          }}
        >
          ¿No tienes cuenta? Crear una
        </button>
      </GlassCard>
    </motion.div>
  )
}

function Divider({ label }: { label: string }): JSX.Element {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <span style={{ flex: 1, height: 1, background: 'var(--stroke)' }} />
      <span style={{ fontSize: 11, color: 'var(--text-faint)' }}>{label}</span>
      <span style={{ flex: 1, height: 1, background: 'var(--stroke)' }} />
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add src/renderer/src/screens/Login.tsx src/renderer/src/components/Field.tsx
git commit -m "feat: add login screen with Microsoft and launcher account paths"
```

---

### Task 22: Register screen with mandatory Discord link

**Files:**
- Create: `src/renderer/src/screens/Register.tsx`
- Create: `src/renderer/src/components/DiscordLinkStep.tsx`

- [ ] **Step 1: Write the DiscordLinkStep**

```tsx
// src/renderer/src/components/DiscordLinkStep.tsx
import { useState } from 'react'
import { motion } from 'framer-motion'
import Button from './Button'
import type { LauncherProfile } from '@shared/api'

export interface DiscordLinkStepProps {
  onLinked: (profile: LauncherProfile) => void
}

export default function DiscordLinkStep({ onLinked }: DiscordLinkStepProps): JSX.Element {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleLink(): Promise<void> {
    setError(null)
    setBusy(true)
    try {
      onLinked(await window.api.account.linkDiscord())
    } catch (caught) {
      setError((caught as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{ display: 'grid', gap: 18, textAlign: 'center' }}>
      <motion.div
        animate={{ y: [0, -6, 0] }}
        transition={{ repeat: Infinity, duration: 3, ease: 'easeInOut' }}
        style={{ fontSize: 46 }}
      >
        🔗
      </motion.div>

      <div>
        <h2 style={{ margin: '0 0 8px' }}>Vincula tu Discord</h2>
        <p style={{ margin: 0, color: 'var(--text-dim)', fontSize: 14, lineHeight: 1.6 }}>
          Es obligatorio para usar el launcher. Así el staff puede darte acceso al servidor y
          contactarte.
        </p>
      </div>

      <Button variant="discord" full loading={busy} onClick={handleLink}>
        Vincular con Discord
      </Button>

      {error && <p style={{ color: 'var(--err)', fontSize: 13, margin: 0 }}>{error}</p>}
    </div>
  )
}
```

- [ ] **Step 2: Write the Register screen**

```tsx
// src/renderer/src/screens/Register.tsx
import { useState } from 'react'
import { motion } from 'framer-motion'
import GlassCard from '../components/GlassCard'
import Button from '../components/Button'
import Field from '../components/Field'
import DiscordLinkStep from '../components/DiscordLinkStep'
import { screenVariants } from '../theme/motion'
import type { LauncherProfile } from '@shared/api'

export interface RegisterProps {
  onComplete: (profile: LauncherProfile) => void
  onBack: () => void
}

export default function Register({ onComplete, onBack }: RegisterProps): JSX.Element {
  const [step, setStep] = useState<'form' | 'discord'>('form')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [nick, setNick] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const nickValid = /^[A-Za-z0-9_]{3,16}$/.test(nick)
  const canSubmit = email && password.length >= 6 && password === confirm && nickValid

  async function handleRegister(): Promise<void> {
    setError(null)
    setBusy(true)
    try {
      await window.api.account.register(email, password, nick)
      setStep('discord')
    } catch (caught) {
      setError((caught as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <motion.div
      variants={screenVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      style={{ display: 'grid', placeItems: 'center', height: '100%' }}
    >
      <GlassCard style={{ width: 420, display: 'grid', gap: 18 }}>
        {step === 'form' ? (
          <>
            <h2 style={{ margin: 0, textAlign: 'center' }}>Crear cuenta</h2>

            <Field label="Nick de Minecraft" value={nick} onChange={setNick} autoFocus />
            {nick && !nickValid && (
              <p style={{ color: 'var(--err)', fontSize: 12, margin: 0 }}>
                3-16 caracteres: letras, números o guion bajo.
              </p>
            )}

            <Field label="Correo" type="email" value={email} onChange={setEmail} />
            <Field label="Contraseña" type="password" value={password} onChange={setPassword} />
            <Field label="Repetir contraseña" type="password" value={confirm} onChange={setConfirm} />

            {confirm && password !== confirm && (
              <p style={{ color: 'var(--err)', fontSize: 12, margin: 0 }}>
                Las contraseñas no coinciden.
              </p>
            )}

            <Button full loading={busy} disabled={!canSubmit} onClick={handleRegister}>
              Continuar
            </Button>

            {error && (
              <p style={{ color: 'var(--err)', fontSize: 13, margin: 0, textAlign: 'center' }}>
                {error}
              </p>
            )}

            <button
              onClick={onBack}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--text-dim)',
                fontSize: 13,
                textDecoration: 'underline'
              }}
            >
              Volver
            </button>
          </>
        ) : (
          <DiscordLinkStep onLinked={onComplete} />
        )}
      </GlassCard>
    </motion.div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add src/renderer/src/screens/Register.tsx src/renderer/src/components/DiscordLinkStep.tsx
git commit -m "feat: add registration with mandatory Discord linking step"
```

---

### Task 23: Whitelist gate screen

**Files:**
- Create: `src/renderer/src/screens/WhitelistGate.tsx`

- [ ] **Step 1: Write the screen**

```tsx
// src/renderer/src/screens/WhitelistGate.tsx
import { motion } from 'framer-motion'
import GlassCard from '../components/GlassCard'
import Button from '../components/Button'
import { screenVariants } from '../theme/motion'

const MESSAGES: Record<string, string> = {
  not_whitelisted: 'Tu cuenta no está en la whitelist del servidor.',
  discord_not_linked: 'Tienes que vincular tu cuenta de Discord antes de entrar.',
  invalid_minecraft_token: 'La sesión de Minecraft no es válida. Vuelve a iniciar sesión.',
  no_profile: 'No encontramos tu perfil. Vuelve a iniciar sesión.',
  unauthenticated: 'Tu sesión ha caducado. Vuelve a iniciar sesión.',
  server_error: 'Hubo un problema al comprobar tu acceso. Inténtalo más tarde.'
}

export interface WhitelistGateProps {
  reason: string
  onRetry: () => void
  onLogout: () => void
}

export default function WhitelistGate({
  reason,
  onRetry,
  onLogout
}: WhitelistGateProps): JSX.Element {
  return (
    <motion.div
      variants={screenVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      style={{ display: 'grid', placeItems: 'center', height: '100%' }}
    >
      <GlassCard style={{ width: 440, display: 'grid', gap: 20, textAlign: 'center' }}>
        <motion.div
          initial={{ scale: 0.7, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 16 }}
          style={{
            width: 74,
            height: 74,
            borderRadius: '50%',
            justifySelf: 'center',
            display: 'grid',
            placeItems: 'center',
            fontSize: 32,
            background: 'rgba(255,92,108,0.12)',
            border: '1px solid rgba(255,92,108,0.35)'
          }}
        >
          🔒
        </motion.div>

        <div>
          <h2 style={{ margin: '0 0 10px' }}>Acceso denegado</h2>
          <p style={{ margin: 0, color: 'var(--text-dim)', fontSize: 14, lineHeight: 1.6 }}>
            {MESSAGES[reason] ?? 'No tienes acceso al servidor.'}
          </p>
        </div>

        <p style={{ margin: 0, color: 'var(--text-faint)', fontSize: 13 }}>
          Si crees que es un error, abre un ticket en el Discord de Victoria Kingdom.
        </p>

        <div style={{ display: 'grid', gap: 10 }}>
          <Button full onClick={onRetry}>
            Volver a comprobar
          </Button>
          <Button variant="ghost" full onClick={onLogout}>
            Cerrar sesión
          </Button>
        </div>
      </GlassCard>
    </motion.div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/renderer/src/screens/WhitelistGate.tsx
git commit -m "feat: add whitelist denial screen"
```

---

### Task 24: Home screen with PLAY

**Files:**
- Create: `src/renderer/src/screens/Home.tsx`
- Create: `src/renderer/src/components/SideNav.tsx`
- Create: `src/renderer/src/components/ProgressBar.tsx`

- [ ] **Step 1: Write the ProgressBar**

```tsx
// src/renderer/src/components/ProgressBar.tsx
import { motion } from 'framer-motion'

export default function ProgressBar({
  percent,
  label
}: {
  percent: number
  label: string
}): JSX.Element {
  return (
    <div style={{ display: 'grid', gap: 7 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
        <span style={{ color: 'var(--text-dim)' }}>{label}</span>
        <span style={{ color: 'var(--gold)' }}>{percent}%</span>
      </div>
      <div
        style={{
          height: 6,
          borderRadius: 99,
          background: 'rgba(255,255,255,0.08)',
          overflow: 'hidden'
        }}
      >
        <motion.div
          animate={{ width: `${percent}%` }}
          transition={{ ease: 'easeOut', duration: 0.3 }}
          style={{
            height: '100%',
            background: 'linear-gradient(90deg, var(--gold-deep), var(--gold-bright))'
          }}
        />
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Write the SideNav**

```tsx
// src/renderer/src/components/SideNav.tsx
import { motion } from 'framer-motion'
import logo from '../assets/logo.png'

export type NavKey = 'play' | 'mods' | 'settings'

const ITEMS: Array<{ key: NavKey; label: string; icon: string }> = [
  { key: 'play', label: 'Jugar', icon: '▶' },
  { key: 'mods', label: 'Mods', icon: '🧩' },
  { key: 'settings', label: 'Ajustes', icon: '⚙' }
]

export interface SideNavProps {
  active: NavKey
  onSelect: (key: NavKey) => void
  username: string
  accountType: 'premium' | 'custom'
  onLogout: () => void
}

export default function SideNav({
  active,
  onSelect,
  username,
  accountType,
  onLogout
}: SideNavProps): JSX.Element {
  return (
    <nav
      className="glass"
      style={{
        width: 214,
        borderRadius: 0,
        borderLeft: 'none',
        borderTop: 'none',
        borderBottom: 'none',
        display: 'grid',
        gridTemplateRows: 'auto 1fr auto',
        padding: '22px 16px',
        gap: 18
      }}
    >
      <img src={logo} alt="Victoria Kingdom" style={{ width: '100%', imageRendering: 'pixelated' }} />

      <div style={{ display: 'grid', gap: 6, alignContent: 'start' }}>
        {ITEMS.map((item) => (
          <button
            key={item.key}
            onClick={() => onSelect(item.key)}
            style={{
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
              gap: 11,
              padding: '11px 13px',
              borderRadius: 11,
              border: 'none',
              background: active === item.key ? 'rgba(230,180,34,0.12)' : 'transparent',
              color: active === item.key ? 'var(--gold-bright)' : 'var(--text-dim)',
              fontSize: 14,
              textAlign: 'left',
              transition: 'background 0.2s, color 0.2s'
            }}
          >
            {active === item.key && (
              <motion.span
                layoutId="nav-indicator"
                style={{
                  position: 'absolute',
                  left: 0,
                  top: 9,
                  bottom: 9,
                  width: 3,
                  borderRadius: 99,
                  background: 'var(--gold)'
                }}
              />
            )}
            <span style={{ fontSize: 13 }}>{item.icon}</span>
            {item.label}
          </button>
        ))}
      </div>

      <div style={{ display: 'grid', gap: 8 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: 10,
            borderRadius: 11,
            background: 'rgba(255,255,255,0.04)'
          }}
        >
          <img
            src={`https://mc-heads.net/avatar/${encodeURIComponent(username)}/32`}
            alt=""
            style={{ width: 32, height: 32, borderRadius: 7, imageRendering: 'pixelated' }}
          />
          <div style={{ overflow: 'hidden' }}>
            <div style={{ fontSize: 13, whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
              {username}
            </div>
            <div style={{ fontSize: 10, color: accountType === 'premium' ? 'var(--ok)' : 'var(--text-faint)' }}>
              {accountType === 'premium' ? 'PREMIUM' : 'LAUNCHER'}
            </div>
          </div>
        </div>

        <button
          onClick={onLogout}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--text-faint)',
            fontSize: 12,
            textDecoration: 'underline',
            textAlign: 'left',
            paddingLeft: 10
          }}
        >
          Cerrar sesión
        </button>
      </div>
    </nav>
  )
}
```

- [ ] **Step 3: Write the Home screen**

```tsx
// src/renderer/src/screens/Home.tsx
import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import Button from '../components/Button'
import ProgressBar from '../components/ProgressBar'
import GlassCard from '../components/GlassCard'
import { fadeUp, screenVariants, staggerChildren } from '../theme/motion'
import newsBg from '../assets/news-background.png'
import type { LaunchProgress, LaunchStatus } from '@shared/api'
import type { IUser } from 'minecraft-launcher-core'

export interface HomeProps {
  username: string
  mclcUser?: IUser
  offlineUsername?: string
}

export default function Home({ username, mclcUser, offlineUsername }: HomeProps): JSX.Element {
  const [progress, setProgress] = useState<LaunchProgress | null>(null)
  const [status, setStatus] = useState<LaunchStatus | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [launching, setLaunching] = useState(false)

  useEffect(() => {
    const offProgress = window.api.launch.onProgress(setProgress)
    const offStatus = window.api.launch.onStatus(setStatus)
    const offError = window.api.launch.onError((payload) => {
      setError(payload.message)
      setLaunching(false)
    })
    const offClosed = window.api.launch.onClosed(() => {
      setLaunching(false)
      setStatus(null)
      setProgress(null)
    })
    return () => {
      offProgress()
      offStatus()
      offError()
      offClosed()
    }
  }, [])

  async function handlePlay(): Promise<void> {
    setError(null)
    setLaunching(true)
    try {
      await window.api.launch.start({ mclcUser, offlineUsername })
    } catch (caught) {
      setError((caught as Error).message)
      setLaunching(false)
    }
  }

  return (
    <motion.div
      variants={screenVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      style={{ padding: 34, height: '100%', display: 'grid', gridTemplateRows: '1fr auto', gap: 24 }}
    >
      <motion.div variants={staggerChildren} initial="initial" animate="animate">
        <motion.p variants={fadeUp} style={{ color: 'var(--text-dim)', margin: 0, fontSize: 15 }}>
          Bienvenido de vuelta,
        </motion.p>
        <motion.h1
          variants={fadeUp}
          style={{ margin: '4px 0 26px', fontSize: 40, fontWeight: 800, letterSpacing: -0.5 }}
        >
          {username}
        </motion.h1>

        <motion.div variants={fadeUp}>
          <GlassCard
            style={{
              maxWidth: 460,
              backgroundImage: `linear-gradient(rgba(13,13,20,0.86), rgba(13,13,20,0.94)), url(${newsBg})`,
              backgroundSize: 'cover'
            }}
          >
            <h3 style={{ margin: '0 0 8px', fontSize: 15 }}>Novedades</h3>
            <p style={{ margin: 0, color: 'var(--text-dim)', fontSize: 13, lineHeight: 1.65 }}>
              Servidor Victoria Kingdom — Minecraft 1.20.1 con Forge. Revisa el Discord para
              enterarte de eventos y actualizaciones.
            </p>
          </GlassCard>
        </motion.div>
      </motion.div>

      <div style={{ display: 'grid', gap: 14, maxWidth: 460 }}>
        {launching && progress && (
          <ProgressBar percent={progress.percent} label={status?.message ?? 'Preparando...'} />
        )}
        {launching && !progress && status && (
          <p style={{ margin: 0, fontSize: 13, color: 'var(--text-dim)' }}>{status.message}</p>
        )}
        {error && <p style={{ margin: 0, fontSize: 13, color: 'var(--err)' }}>{error}</p>}

        <Button full loading={launching} onClick={handlePlay}>
          {launching ? 'INICIANDO...' : 'JUGAR'}
        </Button>
      </div>
    </motion.div>
  )
}
```

- [ ] **Step 4: Commit**

```bash
git add src/renderer/src/screens/Home.tsx src/renderer/src/components/SideNav.tsx src/renderer/src/components/ProgressBar.tsx
git commit -m "feat: add home screen with play button and launch progress"
```

---

### Task 25: Mods screen

**Files:**
- Create: `src/renderer/src/screens/Mods.tsx`

- [ ] **Step 1: Write the screen**

```tsx
// src/renderer/src/screens/Mods.tsx
import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { screenVariants } from '../theme/motion'
import type { ModEntry } from '@shared/api'

export default function Mods(): JSX.Element {
  const [mods, setMods] = useState<ModEntry[]>([])
  const [query, setQuery] = useState('')
  const [busy, setBusy] = useState<string | null>(null)

  useEffect(() => {
    window.api.mods.list().then(setMods)
  }, [])

  const filtered = useMemo(
    () => mods.filter((mod) => mod.name.toLowerCase().includes(query.toLowerCase())),
    [mods, query]
  )

  const enabledCount = mods.filter((mod) => mod.enabled).length

  async function handleToggle(mod: ModEntry): Promise<void> {
    setBusy(mod.filename)
    try {
      setMods(await window.api.mods.toggle(mod.filename, !mod.enabled))
    } finally {
      setBusy(null)
    }
  }

  return (
    <motion.div
      variants={screenVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      style={{ padding: 34, height: '100%', display: 'grid', gridTemplateRows: 'auto auto 1fr', gap: 18 }}
    >
      <div>
        <h1 style={{ margin: 0, fontSize: 30, fontWeight: 800 }}>Mods</h1>
        <p style={{ margin: '5px 0 0', color: 'var(--text-dim)', fontSize: 13 }}>
          {enabledCount} activos de {mods.length} instalados
        </p>
      </div>

      <input
        value={query}
        placeholder="Buscar mod..."
        onChange={(event) => setQuery(event.target.value)}
        style={{
          background: 'rgba(255,255,255,0.05)',
          border: '1px solid var(--stroke)',
          borderRadius: 11,
          padding: '11px 14px',
          color: 'var(--text)',
          fontSize: 14,
          outline: 'none'
        }}
      />

      <div style={{ overflowY: 'auto', display: 'grid', gap: 7, alignContent: 'start' }}>
        {filtered.map((mod) => (
          <motion.div
            key={mod.filename}
            layout
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px 15px',
              borderRadius: 12,
              background: 'rgba(255,255,255,0.035)',
              border: '1px solid var(--stroke)'
            }}
          >
            <div style={{ overflow: 'hidden' }}>
              <div style={{ fontSize: 14 }}>{mod.name}</div>
              <div style={{ fontSize: 11, color: 'var(--text-faint)' }}>
                {mod.filename} · {(mod.sizeBytes / 1024 / 1024).toFixed(1)} MB
              </div>
            </div>

            <button
              onClick={() => handleToggle(mod)}
              disabled={busy === mod.filename}
              style={{
                width: 46,
                height: 25,
                borderRadius: 99,
                border: 'none',
                padding: 3,
                background: mod.enabled ? 'var(--gold)' : 'rgba(255,255,255,0.14)',
                display: 'flex',
                justifyContent: mod.enabled ? 'flex-end' : 'flex-start',
                transition: 'background 0.22s',
                flexShrink: 0
              }}
            >
              <motion.span
                layout
                transition={{ type: 'spring', stiffness: 500, damping: 32 }}
                style={{ width: 19, height: 19, borderRadius: '50%', background: '#fff' }}
              />
            </button>
          </motion.div>
        ))}
      </div>
    </motion.div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/renderer/src/screens/Mods.tsx
git commit -m "feat: add mods management screen"
```

---

### Task 26: Settings screen

**Files:**
- Create: `src/renderer/src/screens/Settings.tsx`

- [ ] **Step 1: Write the screen**

```tsx
// src/renderer/src/screens/Settings.tsx
import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import GlassCard from '../components/GlassCard'
import { screenVariants } from '../theme/motion'
import type { Settings as SettingsType } from '@shared/api'

export default function Settings(): JSX.Element {
  const [settings, setSettings] = useState<SettingsType | null>(null)

  useEffect(() => {
    window.api.settings.get().then(setSettings)
  }, [])

  async function patch(update: Partial<SettingsType>): Promise<void> {
    setSettings(await window.api.settings.save(update))
    // Lets AmbientMusic pick up a music toggle without a restart.
    window.dispatchEvent(new CustomEvent('settings-changed'))
  }

  if (!settings) return <div style={{ padding: 34 }}>Cargando...</div>

  return (
    <motion.div
      variants={screenVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      style={{ padding: 34, height: '100%', overflowY: 'auto' }}
    >
      <h1 style={{ margin: '0 0 22px', fontSize: 30, fontWeight: 800 }}>Ajustes</h1>

      <GlassCard style={{ maxWidth: 520, display: 'grid', gap: 22 }}>
        <div style={{ display: 'grid', gap: 9 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
            <span>Memoria máxima</span>
            <span style={{ color: 'var(--gold)' }}>
              {(settings.maxMemoryMb / 1024).toFixed(1)} GB
            </span>
          </div>
          <input
            type="range"
            min={1024}
            max={16384}
            step={512}
            value={settings.maxMemoryMb}
            onChange={(event) => patch({ maxMemoryMb: Number(event.target.value) })}
            style={{ accentColor: 'var(--gold)' }}
          />
          <p style={{ margin: 0, fontSize: 12, color: 'var(--text-faint)' }}>
            Con 113 mods, 8 GB es un buen punto de partida.
          </p>
        </div>

        <Toggle
          label="Música del launcher"
          checked={settings.musicEnabled}
          onChange={(value) => patch({ musicEnabled: value })}
        />

        <Toggle
          label="Cerrar el launcher al iniciar el juego"
          checked={settings.closeOnLaunch}
          onChange={(value) => patch({ closeOnLaunch: value })}
        />

        <div style={{ display: 'grid', gap: 7 }}>
          <span style={{ fontSize: 14 }}>Ruta de Java</span>
          <input
            value={settings.javaPath ?? ''}
            placeholder="Automático (detectado del sistema)"
            onChange={(event) => patch({ javaPath: event.target.value || null })}
            style={{
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid var(--stroke)',
              borderRadius: 11,
              padding: '11px 14px',
              color: 'var(--text)',
              fontSize: 13,
              outline: 'none'
            }}
          />
        </div>
      </GlassCard>
    </motion.div>
  )
}

function Toggle({
  label,
  checked,
  onChange
}: {
  label: string
  checked: boolean
  onChange: (value: boolean) => void
}): JSX.Element {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <span style={{ fontSize: 14 }}>{label}</span>
      <button
        onClick={() => onChange(!checked)}
        style={{
          width: 46,
          height: 25,
          borderRadius: 99,
          border: 'none',
          padding: 3,
          background: checked ? 'var(--gold)' : 'rgba(255,255,255,0.14)',
          display: 'flex',
          justifyContent: checked ? 'flex-end' : 'flex-start',
          transition: 'background 0.22s'
        }}
      >
        <motion.span
          layout
          transition={{ type: 'spring', stiffness: 500, damping: 32 }}
          style={{ width: 19, height: 19, borderRadius: '50%', background: '#fff' }}
        />
      </button>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/renderer/src/screens/Settings.tsx
git commit -m "feat: add settings screen"
```

---

### Task 27: App state machine wiring

**Files:**
- Modify: `src/renderer/src/App.tsx`

- [ ] **Step 1: Write the full App**

```tsx
// src/renderer/src/App.tsx
import { useCallback, useEffect, useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import TitleBar from './components/TitleBar'
import PanoramaBg from './components/PanoramaBg'
import SideNav, { type NavKey } from './components/SideNav'
import Splash from './screens/Splash'
import Login from './screens/Login'
import Register from './screens/Register'
import WhitelistGate from './screens/WhitelistGate'
import Home from './screens/Home'
import Mods from './screens/Mods'
import Settings from './screens/Settings'
import type { LauncherProfile, PremiumSession } from '@shared/api'

type Stage = 'splash' | 'login' | 'register' | 'checking' | 'denied' | 'app'

interface Account {
  type: 'premium' | 'custom'
  username: string
  premium?: PremiumSession
  profile?: LauncherProfile
}

export default function App(): JSX.Element {
  const [stage, setStage] = useState<Stage>('splash')
  const [account, setAccount] = useState<Account | null>(null)
  const [denyReason, setDenyReason] = useState('not_whitelisted')
  const [nav, setNav] = useState<NavKey>('play')

  const runAccessCheck = useCallback(async (next: Account): Promise<void> => {
    setStage('checking')
    try {
      const result =
        next.type === 'premium'
          ? await window.api.access.checkPremium(next.premium!.mcToken)
          : await window.api.access.checkCustom()

      if (result.allowed) {
        setAccount(next)
        setStage('app')
      } else {
        setDenyReason(result.reason)
        setStage('denied')
      }
    } catch {
      setDenyReason('server_error')
      setStage('denied')
    }
  }, [])

  // Try a silent Microsoft re-login once the splash finishes.
  const handleSplashDone = useCallback(async (): Promise<void> => {
    const restored = await window.api.auth.microsoftRestore().catch(() => null)
    if (restored) {
      await runAccessCheck({ type: 'premium', username: restored.name, premium: restored })
    } else {
      setStage('login')
    }
  }, [runAccessCheck])

  const handleLogout = useCallback(async (): Promise<void> => {
    await window.api.auth.microsoftLogout()
    await window.api.account.logout()
    setAccount(null)
    setNav('play')
    setStage('login')
  }, [])

  const handleRetry = useCallback(() => {
    if (account) void runAccessCheck(account)
    else setStage('login')
  }, [account, runAccessCheck])

  return (
    <>
      <PanoramaBg blur={stage === 'app' ? 14 : 6} />

      <div
        style={{
          position: 'relative',
          zIndex: 10,
          height: '100vh',
          display: 'grid',
          gridTemplateRows: 'auto 1fr'
        }}
      >
        <TitleBar />

        <div style={{ overflow: 'hidden' }}>
          <AnimatePresence mode="wait">
            {stage === 'splash' && <Splash key="splash" onDone={handleSplashDone} />}

            {stage === 'login' && (
              <Login
                key="login"
                onPremium={(session) =>
                  runAccessCheck({ type: 'premium', username: session.name, premium: session })
                }
                onCustom={(profile) =>
                  runAccessCheck({
                    type: 'custom',
                    username: profile.minecraft_username,
                    profile
                  })
                }
                onGoRegister={() => setStage('register')}
              />
            )}

            {stage === 'register' && (
              <Register
                key="register"
                onBack={() => setStage('login')}
                onComplete={(profile) =>
                  runAccessCheck({
                    type: 'custom',
                    username: profile.minecraft_username,
                    profile
                  })
                }
              />
            )}

            {stage === 'checking' && (
              <div
                key="checking"
                style={{
                  display: 'grid',
                  placeItems: 'center',
                  height: '100%',
                  color: 'var(--text-dim)'
                }}
              >
                Comprobando acceso al servidor...
              </div>
            )}

            {stage === 'denied' && (
              <WhitelistGate
                key="denied"
                reason={denyReason}
                onRetry={handleRetry}
                onLogout={handleLogout}
              />
            )}

            {stage === 'app' && account && (
              <div key="app" style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', height: '100%' }}>
                <SideNav
                  active={nav}
                  onSelect={setNav}
                  username={account.username}
                  accountType={account.type}
                  onLogout={handleLogout}
                />
                <div style={{ overflow: 'hidden' }}>
                  <AnimatePresence mode="wait">
                    {nav === 'play' && (
                      <Home
                        key="play"
                        username={account.username}
                        mclcUser={account.premium?.mclc}
                        offlineUsername={
                          account.type === 'custom' ? account.username : undefined
                        }
                      />
                    )}
                    {nav === 'mods' && <Mods key="mods" />}
                    {nav === 'settings' && <Settings key="settings" />}
                  </AnimatePresence>
                </div>
              </div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </>
  )
}
```

- [ ] **Step 2: Typecheck and test**

```bash
npm run typecheck && npm test
```

Expected: no type errors, all tests pass.

- [ ] **Step 3: Verify the flow manually**

Run: `npm run dev`

Expected sequence: splash with the animated logo → login screen over the rotating panorama → clicking "Crear una" shows the registration form → after registering, the Discord step appears and cannot be skipped → once linked, the whitelist check runs → if the account is not in the `whitelist` table, the denial screen appears; if it is, the Home screen with the sidebar appears.

- [ ] **Step 4: Commit**

```bash
git add src/renderer/src/App.tsx
git commit -m "feat: wire full app flow from splash to launcher"
```

---

### Task 28: Ambient music

**Files:**
- Create: `src/renderer/src/components/AmbientMusic.tsx`
- Modify: `src/renderer/src/App.tsx`

- [ ] **Step 1: Write the component**

```tsx
// src/renderer/src/components/AmbientMusic.tsx
import { useEffect, useRef, useState } from 'react'
import ost from '../assets/ost.ogg'

export default function AmbientMusic(): JSX.Element | null {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [enabled, setEnabled] = useState(false)

  useEffect(() => {
    const sync = (): void => {
      void window.api.settings.get().then((settings) => setEnabled(settings.musicEnabled))
    }
    sync()
    // The Settings screen fires this after saving so the toggle applies at once.
    window.addEventListener('settings-changed', sync)
    return () => window.removeEventListener('settings-changed', sync)
  }, [])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    if (enabled) {
      audio.volume = 0.25
      // Autoplay can still be refused; ignoring is fine since music is optional.
      void audio.play().catch(() => undefined)
    } else {
      audio.pause()
    }
  }, [enabled])

  return <audio ref={audioRef} src={ost} loop preload="auto" />
}
```

- [ ] **Step 2: Mount it in App**

Add the import and render it just inside the fragment in `src/renderer/src/App.tsx`:

```tsx
import AmbientMusic from './components/AmbientMusic'
```

```tsx
  return (
    <>
      <AmbientMusic />
      <PanoramaBg blur={stage === 'app' ? 14 : 6} />
```

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: add optional ambient music"
```

---

### Task 29: Packaging

**Files:**
- Create: `electron-builder.yml`
- Create: `build/icon.ico` (converted from the FancyMenu icon)

- [ ] **Step 1: Generate the app icon**

electron-builder needs a `.ico` of at least 256×256; the FancyMenu `icon32x32.png`
is too small, so generate one from `logo.png`. Install the converter and run it:

```bash
npm install --save-dev png-to-ico sharp
```

Create `scripts/make-icon.mjs`:

```js
import { mkdirSync, writeFileSync } from 'fs'
import sharp from 'sharp'
import pngToIco from 'png-to-ico'

mkdirSync('build', { recursive: true })

// The logo is a wide banner; pad it into a square canvas so it is not distorted.
const square = await sharp('src/renderer/src/assets/logo.png')
  .resize(256, 256, { fit: 'contain', background: { r: 11, g: 11, b: 16, alpha: 1 } })
  .png()
  .toBuffer()

writeFileSync('build/icon.ico', await pngToIco([square]))
console.log('build/icon.ico written.')
```

Run it:

```bash
node scripts/make-icon.mjs
```

Expected output: `build/icon.ico written.`

- [ ] **Step 2: Write the builder config**

```yaml
# electron-builder.yml
appId: com.victoriakingdom.launcher
productName: Victoria Kingdom
directories:
  output: release
  buildResources: build
files:
  - out/**/*
  - package.json
win:
  target:
    - target: nsis
      arch: [x64]
  icon: build/icon.ico
nsis:
  oneClick: false
  allowToChangeInstallationDirectory: true
  createDesktopShortcut: true
  shortcutName: Victoria Kingdom
```

- [ ] **Step 3: Build the installer**

```bash
npm run dist
```

Expected: `release/Victoria Kingdom Setup 1.0.0.exe` is produced.

- [ ] **Step 4: Commit**

```bash
git add electron-builder.yml build
git commit -m "build: add electron-builder packaging config"
```

---

### Task 30: Final verification

- [ ] **Step 1: Run the full suite**

```bash
npm test && npm run typecheck && npm run build
```

Expected: all tests pass, no type errors, build succeeds.

- [ ] **Step 2: Manual end-to-end checklist**

Complete `SETUP.md` first (real Discord app and Supabase project), then verify each item:

1. Launching with an incomplete `.env` shows the missing-variables dialog.
2. Splash plays, then the login screen appears.
3. Microsoft login opens the real Microsoft window and returns the correct username.
4. Registering requires a valid nick, matching passwords, and then forces the Discord step.
5. Closing the Discord window mid-flow shows "Vinculación cancelada." and does not complete registration.
6. A user absent from `whitelist` sees the denial screen.
7. Adding that user's `discord_id` to `whitelist` and clicking "Volver a comprobar" grants access.
8. Setting `active = false` on that row and retrying denies access again.
9. The Mods screen lists every jar in the instance (114 enabled + 1 disabled at time of writing); toggling one moves its jar between `mods/` and `disabled_mods/`.
10. PLAY downloads Forge on first run, shows progress, and launches Minecraft 1.20.1 with the Victoria mods loaded.

- [ ] **Step 3: Commit any fixes**

```bash
git add -A
git commit -m "fix: address issues found in end-to-end verification"
```

---

## Notes for the Implementer

- **Never put the Discord client secret in the launcher.** It belongs only in Supabase function secrets. Anything shipped in the Electron bundle is readable by any user.
- **Identity is derived server-side.** Do not "simplify" `check-access` by accepting a UUID from the request body — that would let anyone bypass the whitelist.
- **The instance directory is the user's real game data.** `toggleMod` moves real jars in a folder with 113 mods and real save files. Keep the filename validation in place.
- **`prettyModName` is display-only.** Never use it to locate a file; always use `filename`.
