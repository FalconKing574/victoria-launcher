import type { SyncCheck } from '@shared/api'

/**
 * Decides whether the play button must be replaced by an update button.
 *
 * The rule that matters is the negative one: a check we could not complete must
 * NEVER block. If the manifest is unreachable — no modpack published, GitHub
 * down, player offline — blocking would take the whole server's playerbase
 * offline the moment the host has a hiccup. Only a positively confirmed pending
 * update stops anyone from playing.
 */
export function shouldBlockPlay(check: SyncCheck | null): boolean {
  if (!check) return false
  if (check.unavailable) return false
  return check.needsUpdate
}
