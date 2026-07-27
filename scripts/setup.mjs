/**
 * Guided setup for the Victoria Kingdom launcher.
 *
 * You paste two values from the Supabase dashboard; this does the rest — writes
 * .env, links the project and deploys the check-access edge function.
 *
 *   node scripts/setup.mjs
 */
import { createInterface } from 'readline'
import { execFileSync } from 'child_process'
import { writeFileSync, existsSync } from 'fs'
import { join } from 'path'
import { stdin, stdout } from 'process'

const ENV_PATH = join(process.cwd(), '.env')

const rl = createInterface({ input: stdin, output: stdout })
const ask = (question) => new Promise((resolve) => rl.question(question, (a) => resolve(a.trim())))

function run(args) {
  return execFileSync('npx', ['--yes', 'supabase', ...args], { stdio: 'inherit', shell: true })
}

console.log(`
==========================================================
  Configuración del Victoria Kingdom Launcher
==========================================================

Necesitas dos valores de https://supabase.com/dashboard:

  Tu proyecto -> Project Settings -> API

    Project URL     ej. https://xxxx.supabase.co
    anon public     la clave PÚBLICA (no la secreta)

Y haber ejecutado ya supabase/schema.sql en el SQL Editor.

Ctrl+C para cancelar.
`)

if (existsSync(ENV_PATH)) {
  const overwrite = await ask('Ya existe un .env. ¿Sobrescribirlo? (s/n): ')
  if (overwrite.toLowerCase() !== 's') {
    console.log('Cancelado. No se ha cambiado nada.')
    process.exit(0)
  }
}

const supabaseUrl = await ask('\nProject URL de Supabase: ')
if (!/^https:\/\/[a-z0-9]+\.supabase\.co\/?$/i.test(supabaseUrl)) {
  console.error(
    `\n"${supabaseUrl}" no parece una Project URL.\n` +
      'Tiene que ser tal cual la muestra Supabase, por ejemplo:\n' +
      '  https://abcdefghijklmnop.supabase.co\n' +
      '(sin /rest/v1/ al final)\n\nCancelado — no se ha cambiado nada.'
  )
  process.exit(1)
}

const anonKey = await ask('Clave anon public: ')
if (!anonKey) {
  console.error('\nFalta la clave anon. Cancelado — no se ha cambiado nada.')
  process.exit(1)
}
if (/^sb_secret_|service_role/i.test(anonKey)) {
  console.error(
    '\nEsa es la clave SECRETA, no la pública.\n' +
      'La secreta salta todas las políticas de seguridad: si acabara dentro del\n' +
      'launcher, cualquier jugador podría leer y escribir tu whitelist entera.\n\n' +
      'Usa la "anon public" (empieza por eyJ... o sb_publishable_...).\n\n' +
      'Cancelado — no se ha cambiado nada.'
  )
  process.exit(1)
}

rl.close()

// The project ref is the subdomain of the Supabase URL.
const projectRef = supabaseUrl.replace(/^https?:\/\//, '').split('.')[0]

writeFileSync(
  ENV_PATH,
  [
    `VITE_SUPABASE_URL=${supabaseUrl.replace(/\/$/, '')}`,
    `VITE_SUPABASE_ANON_KEY=${anonKey}`,
    'VITE_AZURE_CLIENT_ID=',
    ''
  ].join('\n'),
  'utf8'
)

console.log(`\n.env escrito.\nProyecto detectado: ${projectRef}`)
console.log('\nSe abrirá el login de Supabase en tu navegador si aún no has entrado.\n')

try {
  run(['login'])
  run(['link', '--project-ref', projectRef])
  console.log('\nDesplegando la edge function...')
  run(['functions', 'deploy', 'check-access'])
} catch {
  console.error(`
Algo falló en la CLI de Supabase (arriba está el error).

El .env sí quedó escrito. Puedes reintentar solo la parte que falló,
o volver a ejecutar este script entero sin problema.
`)
  process.exit(1)
}

console.log(`
==========================================================
  Listo. Configurado y función desplegada.
==========================================================

Siguiente paso — date acceso a ti mismo:

  Supabase -> Table Editor -> whitelist -> Insert row
    minecraft_uuid : tu UUID
    active         : true

  Cuenta premium  -> tu UUID real, de https://mcuuid.net
  Sin premium     -> el UUID offline; SETUP.md tiene el comando

Luego arranca el launcher:

  npm run dev

Recuerda: esta whitelist solo protege el launcher. El servidor
de Minecraft necesita la suya propia (whitelist.json o plugin).
`)
