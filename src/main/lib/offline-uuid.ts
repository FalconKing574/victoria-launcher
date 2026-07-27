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
