/**
 * journal-scaler/persistence.js
 * Ported from journal-scaler-by-jack v1.4.1. Setting key renamed from
 * "page-scales" to "journalScaler.pageScales" to avoid collisions now that
 * this module shares a single settings namespace ("jack-small-details")
 * with other features.
 */

const MODULE = "jack-small-details";
const SETTING_PAGE_SCALES = "journalScaler.pageScales";

const DEFAULT_SCALE = Object.freeze({ fontScale: 1, imageScale: 1 });

/**
 * Scale is a personal reading preference, not shared world state — it is
 * stored as a "client" setting, keyed by `${documentUuid}::${pageId}` (see
 * scaling.js#resolveScaleKey), rather than as a document flag. A document
 * flag would (a) require edit permission on the JournalEntry for every
 * player, and (b) force the same scale on every player viewing the same
 * page. Neither is desired.
 */
export function registerPersistenceSettings() {
  game.settings.register(MODULE, SETTING_PAGE_SCALES, {
    scope: "client",
    config: false,
    type: Object,
    default: {}
  });
}

/** In-memory cache to avoid reading the settings object on every wheel tick. */
const runtimeCache = new Map();

/**
 * Fallback for containers whose owning document couldn't be identified at
 * all (key === null — e.g. an unrecognized third-party journal sheet).
 * Keyed by the DOM element itself so scaling still progresses correctly
 * within the current session, even though it can't be persisted across
 * reloads without a stable key.
 */
const sessionOnlyScales = new WeakMap();

/**
 * @param {string|null} key
 * @param {Element} [fallbackElement] - required when key is null.
 * @returns {{fontScale: number, imageScale: number}}
 */
export function getStoredScale(key, fallbackElement) {
  if (!key) {
    if (!fallbackElement) return { ...DEFAULT_SCALE };
    if (!sessionOnlyScales.has(fallbackElement)) {
      sessionOnlyScales.set(fallbackElement, { ...DEFAULT_SCALE });
    }
    return sessionOnlyScales.get(fallbackElement);
  }

  if (!runtimeCache.has(key)) {
    const stored = game.settings.get(MODULE, SETTING_PAGE_SCALES)[key];
    runtimeCache.set(key, stored ? { ...DEFAULT_SCALE, ...stored } : { ...DEFAULT_SCALE });
  }
  return runtimeCache.get(key);
}

/**
 * @param {string|null} key
 * @param {{fontScale?: number, imageScale?: number}} patch
 * @param {Element} [fallbackElement] - required when key is null.
 */
export function setStoredScale(key, patch, fallbackElement) {
  if (!key) {
    if (!fallbackElement) return;
    const current = getStoredScale(key, fallbackElement);
    sessionOnlyScales.set(fallbackElement, { ...current, ...patch });
    return;
  }

  const current = getStoredScale(key);
  runtimeCache.set(key, { ...current, ...patch });
  schedulePersist();
}

/** Writes are debounced so rapid wheel ticks don't hammer client storage. */
const schedulePersist = foundry.utils.debounce(() => {
  const all = foundry.utils.deepClone(game.settings.get(MODULE, SETTING_PAGE_SCALES));
  for (const [key, scale] of runtimeCache) all[key] = scale;
  game.settings.set(MODULE, SETTING_PAGE_SCALES, all);
}, 500);

/**
 * Wipe the entire persisted scale history — every page ever scaled, not
 * just the ones currently open. Only wired to the "Reset All" settings
 * menu, which confirms with the user first.
 */
export async function resetAllStoredScales() {
  runtimeCache.clear();
  await game.settings.set(MODULE, SETTING_PAGE_SCALES, {});
}
