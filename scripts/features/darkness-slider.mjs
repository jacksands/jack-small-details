/**
 * darkness-slider.mjs
 * Feature: Quick Darkness Slider — moon icon in the Lighting layer controls.
 */

import { DarknessPanel } from "../apps/DarknessPanel.mjs";

const MODULE              = "jack-small-details";
const SETTING_ENABLED     = "darknessSlider.enabled";
const SETTING_UPDATE_MODE = "darknessSlider.updateMode";

export const DarknessSliderFeature = {

  // Used by SettingsDividers.mjs to draw a header + group this feature's
  // rows together on the Settings page. `keys` are the settings/menu keys
  // (without the "jack-small-details." module prefix) belonging to this
  // feature, listed in the order they should appear — enabled toggle first.
  settingsGroup: {
    label: "JSD.Settings.DarknessSlider.Label",
    keys: [SETTING_ENABLED, SETTING_UPDATE_MODE],
  },

  isEnabled() {
    try { return game.settings.get(MODULE, SETTING_ENABLED); } catch { return true; }
  },

  registerSettings() {
    game.settings.register(MODULE, SETTING_ENABLED, {
      name: "JSD.Settings.DarknessSlider.Label",
      hint: "JSD.Settings.DarknessSlider.Hint",
      scope: "world", config: true, type: Boolean, default: true, requiresReload: true,
    });

    game.settings.register(MODULE, SETTING_UPDATE_MODE, {
      name: "JSD.Settings.DarknessSlider.Mode.Label",
      hint: "JSD.Settings.DarknessSlider.Mode.Hint",
      scope: "world", config: true, type: String,
      choices: {
        "apply":    "JSD.Settings.DarknessSlider.Mode.Apply",
        "realtime": "JSD.Settings.DarknessSlider.Mode.Realtime",
      },
      default: "apply",
    });
  },

  initialize() { /* panel is opened via scene control button */ },

  getSceneControlButtons(controls) {
    if (!controls.lighting || !game.user.isGM) return;
    controls.lighting.tools["jsd-darkness"] = {
      name: "jsd-darkness", title: "JSD.DarknessPanel.Title",
      icon: "fa-solid fa-moon-stars", order: 100, button: true, visible: true,
      onChange: () => this._onTogglePanel(),
    };
  },

  _onTogglePanel() {
    const existing = foundry.applications.instances.get("jsd-darkness-panel");
    if (existing?.rendered) { existing.close({ animate: false }); return; }

    if (!canvas.scene) { ui.notifications.warn("No active scene to adjust darkness."); return; }

    const triggerBtn = document.querySelector('[data-tool="jsd-darkness"]');
    const updateMode = (() => { try { return game.settings.get(MODULE, SETTING_UPDATE_MODE); } catch { return "apply"; } })();

    new DarknessPanel({ triggerElement: triggerBtn, updateMode }).render({ force: true });
  },
};
