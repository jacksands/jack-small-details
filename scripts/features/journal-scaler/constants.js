/**
 * journal-scaler/constants.js
 * Ported from journal-scaler-by-jack v1.4.1 (standalone module).
 */

export const SCALE_FACTOR = 1.1;
export const MIN_IMAGE_SIZE_PX = 40;
export const MIN_FONT_SIZE_PX = 3;

export const DIRECTION = Object.freeze({
  INCREASE: "increase",
  DECREASE: "decrease"
});

/** @param {string} key @param {Record<string, unknown>} [data] */
export function loc(key, data) {
  return game.i18n.localize(key, data);
}
