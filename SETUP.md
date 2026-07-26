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
