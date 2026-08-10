/**
 * Numbers both the main process and the interface have to agree on.
 *
 * They lived in two places: `src/main/lib/settings-core.ts` decided what the
 * launcher would actually give Java, and `src/renderer/src/screens/Settings.tsx`
 * had its own copy with a comment asking whoever changed one to remember the
 * other. The tick marks under the RAM slider are positioned from these, so a
 * drift would not throw an error — it would quietly point "8 GB recomendado" at
 * a value that is no longer the recommendation.
 *
 * This file sits in `src/preload` because that is already the layer both sides
 * share (`api.d.ts` is the IPC contract). It must stay free of any `electron`
 * import: the renderer bundles it, and the tests run it in plain Node.
 *
 * Sized from the real pack: 117 mods / 425 MB, including Distant Horizons,
 * Complementary shaders, Immersive Engineering, Create, Tropicraft and TACZ.
 */

/** Below this the game runs out of memory loading the world. */
export const RAM_ABSOLUTE_MIN_MB = 4096

/** Below this it plays, but stutters while exploring. */
export const RAM_MIN_RECOMMENDED_MB = 6144

/** The sweet spot for this pack — what the original CurseForge instance used. */
export const RAM_RECOMMENDED_MB = 8192

/**
 * Past this it gets WORSE, not better: a larger heap means the garbage
 * collector walks more memory on each pass, so pauses last longer and land as
 * stutter.
 */
export const RAM_DIMINISHING_MB = 10240
