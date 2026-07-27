/**
 * Reglas del servidor.
 *
 * Este archivo es el único que hay que tocar para cambiar las reglas: la
 * pantalla `screens/Rules.tsx` numera las categorías y las reglas sola (1.1,
 * 1.2, 2.1...) según el orden de estos arrays, así que basta con añadir,
 * quitar o reordenar entradas.
 */

export interface RuleCategory {
  /** Clave estable, sólo para React. */
  id: string
  title: string
  /** Una línea que resume el porqué de la categoría. */
  summary: string
  rules: string[]
}

/** Se muestra en la cabecera para que se note cuándo se actualizaron. */
export const RULES_UPDATED = 'Julio 2026'

export const RULES: RuleCategory[] = [
  {
    id: 'convivencia',
    title: 'Convivencia',
    summary: 'Lo básico para que el servidor sea un sitio agradable.',
    rules: [
      'Trata al resto con respeto. Los insultos, las burlas y el acoso no se toleran, ni en el juego ni en Discord.',
      'Nada de contenido racista, sexual, xenófobo ni discriminatorio en construcciones, carteles, nombres o skins.',
      'No compartas datos personales de nadie, ni los tuyos ni los de otro jugador.',
      'Las discusiones se resuelven hablando. Si no sale, abre un ticket en Discord en vez de tomarte la justicia por tu cuenta.',
      'Si un miembro del staff te pide que pares algo, para primero y discútelo después.'
    ]
  },
  {
    id: 'construccion',
    title: 'Construcción',
    summary: 'Cómo repartimos el mapa para que quepamos todos.',
    rules: [
      'Deja al menos 150 bloques entre tu base y la de otro jugador salvo que os pongáis de acuerdo.',
      'No construyas ni mines dentro de la zona protegida del spawn ni pegado a los caminos principales.',
      'Prohibido destruir, modificar o saquear construcciones ajenas sin permiso del dueño.',
      'Recoge lo que dejes a medias: no abandones cráteres, torres de tierra ni granjas rotas por el mapa.',
      'Las granjas de mobs y las máquinas que generan lag masivo pueden ser desactivadas por el staff sin aviso.'
    ]
  },
  {
    id: 'juego-limpio',
    title: 'Juego limpio',
    summary: 'Se juega con el modpack y nada más.',
    rules: [
      'Prohibidos los hacks, X-ray, fly, killaura, autoclickers y cualquier cliente modificado.',
      'No uses mods que no vengan en el modpack oficial ni en la lista de opcionales del launcher.',
      'Los bugs y los duplicadores se reportan, no se explotan. Aprovecharlos es motivo de baneo.',
      'Nada de AFK farms con el personaje bloqueado toda la noche para saltarte la progresión.',
      'Una cuenta por persona. No compartas la tuya ni juegues con la de otro.'
    ]
  },
  {
    id: 'chat-y-voz',
    title: 'Chat y voz',
    summary: 'El chat es de todos, incluido el de voz del modpack.',
    rules: [
      'No hagas spam, flood ni escribas en mayúsculas sostenidas.',
      'Prohibida la publicidad de otros servidores, canales o tiendas por chat, susurro o cartel.',
      'En el chat de voz evita los ruidos fuertes, la música de fondo y los micros que saturan.',
      'El chat general es en español. Para otros idiomas usa los susurros o los canales de Discord.'
    ]
  },
  {
    id: 'sanciones',
    title: 'Sanciones',
    summary: 'Qué pasa cuando algo de lo anterior se incumple.',
    rules: [
      'Las sanciones van por tramos: aviso, silencio temporal, expulsión y baneo, según la gravedad y la reincidencia.',
      'Hacks, duplicación y griefeo grave saltan directamente al baneo permanente, sin avisos previos.',
      'Las apelaciones se hacen en Discord y sólo las tramita el staff; discutirlas por el chat del juego no cuenta.',
      'El staff puede revertir construcciones, retirar objetos duplicados y revisar inventarios cuando investigue un caso.'
    ]
  }
]
