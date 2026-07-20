/**
 * Jack Small Details — main.mjs
 *
 * Entry point. To add a new feature:
 *   1. Create  scripts/features/my-feature.mjs  exporting a Feature object.
 *   2. Import it below and add it to the FEATURES array.
 *   3. Implement any of these optional interface methods:
 *        registerSettings()               — called on "init"
 *        isEnabled()                      — returns Boolean
 *        setup()                          — called on "setup" if isEnabled()
 *        initialize()                     — called on "ready" if isEnabled()
 *        getSceneControlButtons(controls) — called on "getSceneControlButtons" if isEnabled()
 *
 *   `setup()` exists specifically for features that must patch CONFIG
 *   classes (e.g. CONFIG.Token.objectClass, CONFIG.Canvas.*) before the
 *   canvas is configured. The once-hook order is:
 *     init → i18nInit → setup → ... → canvasConfig → ready
 *   So anything gated on "ready" is already too late for the FIRST scene's
 *   token/filter classes — use "setup" for that class of feature instead.
 *   See gm-vision.mjs for the concrete example.
 */

import { DarknessSliderFeature } from "./features/darkness-slider.mjs";
import { SceneDefaultsFeature   } from "./features/scene-defaults.mjs";
import { BackgroundVolumeFeature } from "./features/background-volume.mjs";
import { JournalScalerFeature   } from "./features/journal-scaler/index.mjs";
import { ModuleFilterFeature    } from "./features/module-filter.mjs";
import { GMVisionFeature        } from "./features/gm-vision.mjs";
import { TextSpacingFixFeature  } from "./features/text-spacing-fix.mjs";
import { InstructionsViewer     } from "./apps/InstructionsViewer.mjs";
import { registerSettingsDividers } from "./apps/SettingsDividers.mjs";

// ─── Feature registry ─────────────────────────────────────────────────────────
// Add new features here. Order = order in the Settings page.
// Each feature may also export a `settingsGroup: { label, keys }` — see
// darkness-slider.mjs for an example — to get its own header/divider on
// the Settings page grouping its rows together. Purely optional.
const FEATURES = [
  DarknessSliderFeature,
  SceneDefaultsFeature,
  BackgroundVolumeFeature,
  JournalScalerFeature,
  ModuleFilterFeature,
  GMVisionFeature,
  TextSpacingFixFeature,
];
// ─────────────────────────────────────────────────────────────────────────────

const MODULE = "jack-small-details";

/** Runs `fn` for a feature, logging (not throwing) so one broken feature
 *  can never silently prevent the rest of the module from registering. */
function safeCall(Feature, methodName, ...args) {
  const fn = Feature[methodName];
  if (typeof fn !== "function") return;
  try {
    fn.apply(Feature, args);
  } catch (err) {
    console.error(`Jack Small Details | ${Feature.settingsGroup?.label ?? "(unnamed feature)"}.${methodName}() failed:`, err);
  }
}

Hooks.once("init", () => {
  game.settings.registerMenu(MODULE, "instructions", {
    name: "Instructions",
    label: "Open Instructions",
    hint: "View the usage guide for all features included in this module.",
    icon: "fa-solid fa-book",
    type: InstructionsViewer,
    restricted: false,
  });

  for (const Feature of FEATURES) safeCall(Feature, "registerSettings");

  registerSettingsDividers(MODULE, FEATURES, ["instructions"]);

  console.log("Jack Small Details | Initialized.");
});

Hooks.once("setup", () => {
  for (const Feature of FEATURES) {
    if (Feature.isEnabled?.()) safeCall(Feature, "setup");
  }
});

Hooks.once("ready", () => {
  for (const Feature of FEATURES) {
    if (Feature.isEnabled?.()) safeCall(Feature, "initialize");
  }
});

Hooks.on("getSceneControlButtons", (controls) => {
  for (const Feature of FEATURES) {
    if (Feature.isEnabled?.()) safeCall(Feature, "getSceneControlButtons", controls);
  }
});
