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
 */

import { DarknessSliderFeature } from "./features/darkness-slider.mjs";
import { SceneDefaultsFeature   } from "./features/scene-defaults.mjs";
import { BackgroundVolumeFeature } from "./features/background-volume.mjs";
import { JournalScalerFeature   } from "./features/journal-scaler/index.mjs";
import { ModuleFilterFeature    } from "./features/module-filter.mjs";
import { FilePickerFolderFilterFeature } from "./features/file-picker-folder-filter.mjs";
import { FilePickerSpaceDisplayFeature } from "./features/file-picker-space-display.mjs";
import { GMVisionFeature        } from "./features/gm-vision.mjs";
import { TextSpacingFixFeature  } from "./features/text-spacing-fix.mjs";
import { StatusSortFeature      } from "./features/status-sort.mjs";
import { MacroLibraryFeature    } from "./features/macro-library.mjs";
import { InstructionsViewer     } from "./apps/InstructionsViewer.mjs";
import { registerSettingsDividers } from "./apps/SettingsDividers.mjs";

// ─── Feature registry ─────────────────────────────────────────────────────────
const FEATURES = [
  DarknessSliderFeature,
  SceneDefaultsFeature,
  BackgroundVolumeFeature,
  JournalScalerFeature,
  ModuleFilterFeature,
  FilePickerFolderFilterFeature,
  FilePickerSpaceDisplayFeature,
  GMVisionFeature,
  TextSpacingFixFeature,
  StatusSortFeature,
  MacroLibraryFeature,
];
// ─────────────────────────────────────────────────────────────────────────────

const MODULE = "jack-small-details";

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
