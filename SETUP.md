# Configuración del Victoria Kingdom Launcher

El launcher no tiene cuentas propias. Se entra de dos formas:

- **Con cuenta Microsoft** (premium): sesión real de Minecraft, verificada contra Mojang.
- **Sin cuenta premium**: el jugador escribe su nick y juega.

En ambos casos el launcher comprueba el UUID contra una tabla de Supabase antes
de dejar entrar. Así puedes dar y quitar acceso en remoto sin tocar el launcher.

Solo hace falta configurar Supabase. No hay Discord, ni registro, ni contraseñas.

---

## 1. Crear el proyecto de Supabase

1. Entra en https://supabase.com y crea un proyecto.
2. Ve a **SQL Editor** → **New query**, pega el contenido de `supabase/schema.sql`
   y pulsa **Run**. Debe decir *Success*.
3. Ve a **Project Settings** → **API** y copia:
   - **Project URL** → algo como `https://xxxx.supabase.co` (sin `/rest/v1/`)
   - **anon public** → la clave pública. **No** la `service_role` ni la `secret`.

La clave secreta nunca va en el launcher: la whitelist solo se lee desde la edge
function, que usa el service role internamente y sí lo tiene.

---

## 2. Configurar el launcher

### Opción rápida

```bash
node scripts/setup.mjs
```

Te pide los dos valores del paso anterior, escribe el `.env`, enlaza el proyecto
y despliega la función.

### Opción manual

Copia `.env.example` a `.env`:

```
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOi...
VITE_AZURE_CLIENT_ID=
```

Y despliega la función:

```bash
npm install -g supabase
supabase login
supabase link --project-ref TU_PROJECT_REF
supabase functions deploy check-access
```

`VITE_AZURE_CLIENT_ID` puede quedarse vacío: msmc usa su propia aplicación de
Azure por defecto y funciona sin configurar nada.

---

## 3. Dar acceso a jugadores

En Supabase → **Table Editor** → **whitelist** → **Insert row**, una fila por
jugador, rellenando `minecraft_uuid`:

- **Cuenta premium**: su UUID real. Lo sacas en https://mcuuid.net poniendo su nick.
- **Sin premium**: el UUID *offline*, que se deriva del nombre. Lo calculas con:

  ```bash
  node -e "const{createHash}=require('crypto');const n=process.argv[1];const d=createHash('md5').update('OfflinePlayer:'+n,'utf8').digest();d[6]=(d[6]&0x0f)|0x30;d[8]=(d[8]&0x3f)|0x80;const h=d.toString('hex');console.log([h.slice(0,8),h.slice(8,12),h.slice(12,16),h.slice(16,20),h.slice(20)].join('-'))" NOMBRE
  ```

Deja `active` en `true`. Ponerlo en `false` revoca el acceso sin borrar la fila.

Los cambios son inmediatos: el launcher consulta la base de datos en cada inicio
de sesión.

### Importante: el launcher no es la seguridad del servidor

Esta whitelist se comprueba en el **cliente**. Impide entrar desde el launcher,
pero nada evita que alguien abra el mismo modpack con MultiMC o Prism y se
conecte directo a la IP del servidor.

El servidor de Minecraft tiene que llevar su propia lista de acceso: usa el
`whitelist.json` de vanilla, o un plugin que lea esta misma tabla de Supabase.
Trata este launcher como comodidad y experiencia de usuario, no como la barrera
de seguridad.

---

## 4. Probar

```bash
npm run dev
```

---

## 5. Generar el instalador

```bash
npm run dist
```

Produce `release/Victoria Kingdom Setup 1.0.0.exe`.

### Si falla con "Cannot create symbolic link"

electron-builder descarga un paquete de firma que contiene dos symlinks de macOS
(`libcrypto.dylib`, `libssl.dylib`). Crear symlinks en Windows requiere un
privilegio que las cuentas normales no tienen, así que 7-Zip aborta y tumba todo
el build — aunque esos dos archivos no sirvan para nada en Windows.

Se arregla extrayendo la caché a mano, sin `darwin` y sin permisos de
administrador:

```bash
node scripts/fix-wincodesign.mjs
```

Después vuelve a lanzar `npm run dist`. Solo hace falta una vez por máquina.
