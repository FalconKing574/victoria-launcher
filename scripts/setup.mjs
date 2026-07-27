/**
 * Guided setup for the Victoria Kingdom launcher.
 *
 * You paste four values from the Discord and Supabase dashboards; this does the
 * rest — writes .env, links the project, uploads the function secrets and
 * deploys both edge functions.
 *
 * The Discord client secret is read straight from this terminal into the
 * Supabase CLI. It is never written to .env, never echoed, and never logged.
 *
 *   node scripts/setup.mjs
 */
import { createInterface } from 'readline'
import { execFileSync } from 'child_process'
import { writeFileSync, existsSync, readFileSync } from 'fs'
import { join } from 'path'
import { stdin, stdout } from 'process'

const REDIRECT_URI = 'http://localhost:53682/discord/callback'
const ENV_PATH = join(process.cwd(), '.env')

const rl = createInterface({ input: stdin, output: stdout })

function ask(question, { secret = false } = {}) {
  return new Promise((resolve) => {
    if (!secret) {
      rl.question(question, (answer) => resolve(answer.trim()))
      return
    }
    // Suppress echo so the secret never appears on screen or in scrollback.
    const onData = (char) => {
      if (['\n', '\r', ''].includes(char.toString())) stdin.removeListener('data', onData)
      else stdout.write('\x1B[2K\x1B[200D' + question + '*'.repeat(rl.line.length))
    }
    stdin.on('data', onData)
    rl.question(question, (answer) => {
      stdout.write('\n')
      resolve(answer.trim())
    })
  })
}

function run(args, { input } = {}) {
  return execFileSync('npx', ['--yes', 'supabase', ...args], {
    stdio: input ? ['pipe', 'inherit', 'inherit'] : 'inherit',
    input,
    shell: true
  })
}

function required(value, label) {
  if (!value) {
    console.error(`\nFalta ${label}. Cancelado — no se ha cambiado nada.`)
    process.exit(1)
  }
  return value
}

console.log(`
==========================================================
  Configuración del Victoria Kingdom Launcher
==========================================================

Antes de empezar necesitas tener abierto:

  1. https://discord.com/developers/applications
     Tu aplicación -> OAuth2. Ahí está el Client ID y el
     Client Secret (pulsa "Reset Secret" si no lo ves).

     IMPORTANTE: en OAuth2 -> Redirects tiene que estar
     exactamente esta URL, o la vinculación fallará:

       ${REDIRECT_URI}

  2. https://supabase.com/dashboard
     Tu proyecto -> Project Settings -> API. Ahí está la
     Project URL y la clave "anon public".

     Y en SQL Editor tienes que haber ejecutado ya el
     contenido de supabase/schema.sql.

Pulsa Ctrl+C en cualquier momento para cancelar.
`)

if (existsSync(ENV_PATH)) {
  const overwrite = await ask('Ya existe un .env. ¿Sobrescribirlo? (s/n): ')
  if (overwrite.toLowerCase() !== 's') {
    console.log('Cancelado. No se ha cambiado nada.')
    process.exit(0)
  }
}

const supabaseUrl = required(await ask('\nProject URL de Supabase: '), 'la Project URL')
if (!/^https:\/\/[a-z0-9]+\.supabase\.co\/?$/i.test(supabaseUrl)) {
  console.error(
    `\n"${supabaseUrl}" no parece una Project URL.\n` +
      'Tiene que ser tal cual la muestra Supabase, por ejemplo:\n' +
      '  https://abcdefghijklmnop.supabase.co\n' +
      'Cancelado — no se ha cambiado nada.'
  )
  process.exit(1)
}
const anonKey = required(await ask('Clave anon public: '), 'la clave anon')
const discordClientId = required(await ask('Client ID de Discord: '), 'el Client ID')
const discordSecret = required(
  await ask('Client Secret de Discord (no se mostrará): ', { secret: true }),
  'el Client Secret'
)

rl.close()

// The project ref is the subdomain of the Supabase URL.
const projectRef = supabaseUrl.replace(/^https?:\/\//, '').split('.')[0]

writeFileSync(
  ENV_PATH,
  [
    `VITE_SUPABASE_URL=${supabaseUrl}`,
    `VITE_SUPABASE_ANON_KEY=${anonKey}`,
    `VITE_DISCORD_CLIENT_ID=${discordClientId}`,
    `VITE_DISCORD_REDIRECT_URI=${REDIRECT_URI}`,
    'VITE_AZURE_CLIENT_ID=',
    ''
  ].join('\n'),
  'utf8'
)
console.log(`\n.env escrito. (El Client Secret NO está ahí — solo va a Supabase.)`)

console.log(`\nProyecto detectado: ${projectRef}`)
console.log('\nSe abrirá el login de Supabase en tu navegador si aún no has entrado.\n')

try {
  run(['login'])
  run(['link', '--project-ref', projectRef])

  console.log('\nSubiendo los secretos de las funciones...')
  run([
    'secrets',
    'set',
    `DISCORD_CLIENT_ID=${discordClientId}`,
    `DISCORD_CLIENT_SECRET=${discordSecret}`,
    `DISCORD_REDIRECT_URI=${REDIRECT_URI}`
  ])

  console.log('\nDesplegando las edge functions...')
  run(['functions', 'deploy', 'check-access'])
  run(['functions', 'deploy', 'discord-oauth'])
} catch {
  console.error(`
Algo falló en la CLI de Supabase (arriba está el error).

El .env sí quedó escrito. Puedes reintentar solo la parte que falló,
o volver a ejecutar este script entero sin problema.
`)
  process.exit(1)
}

const envWritten = readFileSync(ENV_PATH, 'utf8').split('\n').length - 1

console.log(`
==========================================================
  Listo. ${envWritten} variables en .env, funciones desplegadas.
==========================================================

Siguiente paso — date acceso a ti mismo:

  Supabase -> Table Editor -> whitelist -> Insert row
    minecraft_uuid : tu UUID  (cuenta premium, mcuuid.net)
    discord_id     : tu ID de Discord  (cuenta del launcher)
    active         : true

  Basta con que uno de los dos coincida.

Luego arranca el launcher:

  npm run dev

Recuerda: esta whitelist solo protege el launcher. El servidor
de Minecraft necesita la suya propia (whitelist.json o plugin).
`)
