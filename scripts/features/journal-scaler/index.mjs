/**
 * journal-scaler/index.mjs — Feature: Journal Scaler
 *
 * Merged into Jack Small Details from the standalone module
 * "journal-scaler-by-jack" v1.4.1, itself a V14 fork/rewrite of "Journal
 * Scaler" (v1.1.0) by Syrious. Merged with the original author's
 * permission. See technical-instructions.md for the full history of bug
 * fixes carried over from the standalone module's changelog.
 *
 * Usage: hold CTRL and use the mouse wheel over a journal entry to scale
 * its text. Hold CTRL + SHIFT (or enable "Always scale images" in
 * Settings) to also scale images. Press SHIFT + = to reset the journal
 * page under the cursor to 100%. See INSTRUCTIONS.md (also available via
 * "Open Instructions" in Settings) for full usage details.
 */

import { loc } from "./constants.js";
import {
  getDirection,
  nextFactor,
  applyFontScale,
  applyImageScale,
  findScaleTarget,
  isJournalDocument,
  getOpenJournalPageTargets,
  getPageTargetsForApp
} from "./scaling.js";
import { registerPersistenceSettings, getStoredScale, setStoredScale } from "./persistence.js";
import { ResetAllScalesMenu } from "./reset-all-menu.js";
import { showScaleIndicator } from "./indicator.js";

const MODULE = "jack-small-details";
const SETTING_ENABLED = "journalScaler.enabled";
const SETTING_SCALE_IMAGES = "journalScaler.scaleImages";

/** Cached client setting: whether images should always scale with text. */
let alwaysScaleImages = true;

/** Silent cache sync — used at startup, never triggers side effects. */
function syncAlwaysScaleImagesCache(value) {
  alwaysScaleImages = value;
}

/**
 * Live user toggle handler. Turning "Always scale images" OFF resets any
 * already-enlarged images in currently open journal pages back to 100%
 * (text scale is untouched).
 */
function onScaleImagesSettingChanged(value) {
  syncAlwaysScaleImagesCache(value);
  if (value) return;

  for (const { textBody, key } of getOpenJournalPageTargets()) {
    applyImageScale(textBody, 1);
    setStoredScale(key, { imageScale: 1 }, textBody);
  }
}

/**
 * Multiple `wheel` events can fire per animation frame, especially on
 * trackpads. Collapsing everything queued within a frame into a single
 * applied step keeps the scaling speed consistent between input devices.
 */
let pending = null;
let rafScheduled = false;

/** @param {WheelEvent} event */
function onWheel(event) {
  if (!event.ctrlKey) return;

  const target = findScaleTarget(event.target);
  if (!target) return;

  const direction = getDirection(event);
  if (!direction) return;

  // Stop the browser's native Ctrl+Wheel page zoom from firing alongside
  // the in-journal scaling.
  event.preventDefault();

  pending = { target, direction, shiftKey: event.shiftKey };

  if (!rafScheduled) {
    rafScheduled = true;
    requestAnimationFrame(applyPendingScale);
  }
}

function applyPendingScale() {
  rafScheduled = false;
  if (!pending) return;

  const { target, direction, shiftKey } = pending;
  pending = null;

  const { textBody, key, app } = target;
  const scale = getStoredScale(key, textBody);

  scale.fontScale = nextFactor(scale.fontScale, direction);
  applyFontScale(textBody, scale.fontScale);

  if (alwaysScaleImages || shiftKey) {
    scale.imageScale = nextFactor(scale.imageScale, direction);
    applyImageScale(textBody, scale.imageScale);
  }

  setStoredScale(key, scale, textBody);
  showScaleIndicator(app, scale.fontScale, scale.imageScale);
}

/** Tracked purely so the reset hotkey knows which journal page is under the cursor. */
let lastPointerX = 0;
let lastPointerY = 0;

function onPointerMove(event) {
  lastPointerX = event.clientX;
  lastPointerY = event.clientY;
}

function resetTarget({ app, textBody, key }) {
  applyFontScale(textBody, 1);
  applyImageScale(textBody, 1);
  setStoredScale(key, { fontScale: 1, imageScale: 1 }, textBody);
  showScaleIndicator(app, 1, 1);
}

function resetScaleUnderCursor() {
  const el = document.elementFromPoint(lastPointerX, lastPointerY);
  const target = findScaleTarget(el);
  if (!target) return;
  resetTarget(target);
}

/**
 * Re-apply previously saved scale when a journal sheet renders. Fires on
 * every ApplicationV2 render and filters down to journal documents via
 * `instanceof`. A single JournalEntrySheet window can show several pages
 * scrolled into view at once, so every visible page's content container
 * is processed independently with its own key/scale.
 */
async function restoreScaleForApp(app) {
  if (!isJournalDocument(app?.document)) return;

  // Wait a frame for the sheet's own render to finish.
  await new Promise((resolve) => requestAnimationFrame(resolve));

  const targets = getPageTargetsForApp(app);
  if (!targets.length) return;

  const waitForImages = foundry.applications?.sheets?.journal?.JournalEntryPageSheet?.waitForImages;

  for (const { textBody, key } of targets) {
    const scale = getStoredScale(key, textBody);
    if (scale.fontScale === 1 && scale.imageScale === 1) continue;

    // Use the documented JournalEntryPageSheet.waitForImages() helper so
    // image baselines are captured from fully-loaded <img> elements
    // rather than mid-load placeholder sizes.
    if (typeof waitForImages === "function") {
      await waitForImages(textBody).catch(() => {});
    }

    applyFontScale(textBody, scale.fontScale);
    applyImageScale(textBody, scale.imageScale);
  }
}

// ── Feature Export ───────────────────────────────────────────────────────────
export const JournalScalerFeature = {

  settingsGroup: {
    label: "JSD.Settings.JournalScaler.Label",
    keys: [SETTING_ENABLED, SETTING_SCALE_IMAGES, "journalScalerResetAll"],
  },

  isEnabled() {
    try { return game.settings.get(MODULE, SETTING_ENABLED); } catch { return true; }
  },

  registerSettings() {
    // client-scoped: this is a personal reading preference, each player
    // decides for themselves whether they want the feature active.
    game.settings.register(MODULE, SETTING_ENABLED, {
      name: "JSD.Settings.JournalScaler.Label",
      hint: "JSD.Settings.JournalScaler.Hint",
      scope: "client", config: true, type: Boolean, default: true, requiresReload: true,
    });

    game.settings.register(MODULE, SETTING_SCALE_IMAGES, {
      name: "JOURNALSCALER.Settings.ScaleImages.Name",
      hint: "JOURNALSCALER.Settings.ScaleImages.Hint",
      scope: "client",
      config: true,
      type: Boolean,
      default: true,
      requiresReload: false,
      onChange: onScaleImagesSettingChanged
    });

    registerPersistenceSettings();

    // Accessible to any player, not just the GM — scale is a personal
    // reading preference, not a world configuration.
    game.settings.registerMenu(MODULE, "journalScalerResetAll", {
      name: "JOURNALSCALER.Settings.ResetAll.Name",
      label: "JOURNALSCALER.Settings.ResetAll.Label",
      hint: "JOURNALSCALER.Settings.ResetAll.Hint",
      icon: "fa-solid fa-arrow-rotate-left",
      type: ResetAllScalesMenu,
      restricted: false
    });

    game.keybindings.register(MODULE, "journalScalerResetScale", {
      name: "JOURNALSCALER.Keybindings.ResetScale.Name",
      hint: "JOURNALSCALER.Keybindings.ResetScale.Hint",
      editable: [{ key: "Equal", modifiers: ["Shift"] }],
      onDown: () => {
        if (!JournalScalerFeature.isEnabled()) return false;
        resetScaleUnderCursor();
        return true;
      },
      restricted: false,
      precedence: CONST.KEYBINDING_PRECEDENCE.NORMAL
    });
  },

  initialize() {
    syncAlwaysScaleImagesCache(game.settings.get(MODULE, SETTING_SCALE_IMAGES));

    // { passive: false } is required so preventDefault() in onWheel is honored.
    window.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("pointermove", onPointerMove, { passive: true });

    Hooks.on("renderApplicationV2", restoreScaleForApp);
  },
};
