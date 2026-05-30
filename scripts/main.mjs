/**
 * Jack Small Details — main.mjs
 *
 * Entry point. To add a new feature:
 *   1. Create  scripts/features/my-feature.mjs  exporting a Feature object.
 *   2. Import it below and add it to the FEATURES array.
 *   3. Implement any of these optional interface methods:
 *        registerSettings()               — called on "init"
 *        isEnabled()                      — returns Boolean
 *        initialize()                     — called on "ready" if isEnabled()
 *        getSceneControlButtons(controls) — called on "getSceneControlButtons" if isEnabled()
 */

import { DarknessSliderFeature } from "./features/darkness-slider.mjs";
import { SceneDefaultsFeature   } from "./features/scene-defaults.mjs";
import { BackgroundVolumeFeature } from "./features/background-volume.mjs";

// ─── Feature registry ─────────────────────────────────────────────────────────
// Add new features here. Order = order in the Settings page.
const FEATURES = [
  DarknessSliderFeature,
  SceneDefaultsFeature,
  BackgroundVolumeFeature,
];
// ─────────────────────────────────────────────────────────────────────────────

Hooks.once("init", () => {
  for (const Feature of FEATURES) Feature.registerSettings?.();
  console.log("Jack Small Details | Initialized.");
});

Hooks.once("ready", () => {
  for (const Feature of FEATURES) {
    if (Feature.isEnabled?.()) Feature.initialize?.();
  }
});

Hooks.on("getSceneControlButtons", (controls) => {
  for (const Feature of FEATURES) {
    if (Feature.isEnabled?.()) Feature.getSceneControlButtons?.(controls);
  }
});
