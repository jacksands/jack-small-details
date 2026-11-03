/**
 * macro-library.mjs  —  v1.7.2
 *
 * Correção: auto-sync entre compendium e as UIs do módulo.
 *
 * Problema: alterações feitas diretamente no compendium do Foundry
 * (ou via settings manager) não apareciam nas outras janelas abertas.
 *
 * Solução: hooks createMacro / updateMacro / deleteMacro com debounce.
 * Quando qualquer macro do compendium JSD é criada, editada ou removida
 * (independente de quem fez a mudança), as instâncias abertas do
 * MacroLibraryPanel e MacroLibrarySettings se atualizam automaticamente.
 */

import { DarknessPanel        } from "../apps/DarknessPanel.mjs";
import { MacroLibraryPanel    } from "../apps/MacroLibraryPanel.mjs";
import { MacroLibrarySettings } from "../apps/MacroLibrarySettings.mjs";

const MODULE          = "jack-small-details";
export const PACK_ID  = "jack-small-details.jsd-macros";
const LEGACY_PACK_ID  = "world.jsd-macro-library";
const SETTING_ENABLED = "macroLib.enabled";
const SETTING_SEEDED  = "macroLib.seeded";

// V14: the scene-control button IS the FA icon (::before pseudo-element).
// No child <i> element. Setting color on the button is inherited by ::before.
const _AMBER_ICON_CSS = `
  #scene-controls button.control[data-control="jsd"],
  #scene-controls button[data-control="jsd"] {
    color: #d4a574 !important;
    text-shadow: 0 0 8px rgba(212,165,116,0.35) !important;
  }
`;

/**
 * Opens the Foundry SettingsConfig and navigates to the JSD tab.
 * Pattern from resizable-camera-bar/scripts/readme.js → openModuleSettings().
 */
function openJSDSettings() {
  new foundry.applications.settings.SettingsConfig().render({ force: true });
  const tryClick = (attempts = 0) => {
    if (attempts > 20) return;
    const tabBtn = document.querySelector(
      `button[data-action="tab"][data-group="categories"][data-tab="${MODULE}"]`,
    );
    if (tabBtn) tabBtn.click();
    else setTimeout(() => tryClick(attempts + 1), 50);
  };
  setTimeout(() => tryClick(), 100);
}

export const MacroLibraryFeature = {

  // Guard so hooks are only registered once across ready/reload cycles.
  _hooksRegistered: false,

  settingsGroup: {
    label: "JSD.Settings.MacroLib.Label",
    keys:  [SETTING_ENABLED, "macroLibMenu"],
  },

  isEnabled() {
    try { return game.settings.get(MODULE, SETTING_ENABLED); } catch { return true; }
  },

  registerSettings() {
    game.settings.register(MODULE, SETTING_ENABLED, {
      name: "JSD.Settings.MacroLib.Label",
      hint: "JSD.Settings.MacroLib.Hint",
      scope: "world", config: true, type: Boolean, default: true, requiresReload: true,
    });

    game.settings.register(MODULE, SETTING_SEEDED, {
      scope: "world", config: false, type: Boolean, default: false,
    });

    game.settings.registerMenu(MODULE, "macroLibMenu", {
      name:       "JSD.Settings.MacroLib.Menu.Name",
      label:      "JSD.Settings.MacroLib.Menu.Label",
      hint:       "JSD.Settings.MacroLib.Menu.Hint",
      icon:       "fa-solid fa-code",
      type:       MacroLibrarySettings,
      restricted: true,
    });
  },

  async initialize() {
    if (!game.user.isGM) return;

    // Inject amber tint CSS for the JSD sidebar icon.
    const CSS_ID = "jsd-panel-icon-css";
    if (!document.getElementById(CSS_ID)) {
      const s = document.createElement("style");
      s.id = CSS_ID;
      s.textContent = _AMBER_ICON_CSS;
      document.head.appendChild(s);
    }

    // ── Auto-sync: refresh open MacroLibrary UIs when the compendium changes ──
    // This covers ALL sources of change: Foundry's own compendium editor,
    // our settings manager, drag-and-drop, or any external modification.
    if (!this._hooksRegistered) {
      this._hooksRegistered = true;

      // Debounce: coalesce rapid-fire hook calls (e.g. during import/reset)
      // into a single re-render 300 ms after the last change.
      const refreshMLViews = foundry.utils.debounce(() => {
        // Panel: always refresh if open.
        const panel = foundry.applications.instances.get("jsd-macro-lib-panel");
        if (panel?.rendered) panel.render({ force: true });

        // Settings manager: refresh only if the user is NOT in the middle
        // of typing a description (would interrupt input).
        const settings = foundry.applications.instances.get("jsd-macro-lib-settings");
        if (settings?.rendered) {
          const focusedDesc = settings.element?.querySelector(".jsd-mls-desc:focus");
          if (!focusedDesc) settings.render({ force: true });
        }
      }, 300);

      // Only react to macros that belong to OUR compendium.
      const inOurPack = (macro) => macro.pack === PACK_ID;

      Hooks.on("createMacro", (macro) => { if (inOurPack(macro)) refreshMLViews(); });
      Hooks.on("updateMacro", (macro) => { if (inOurPack(macro)) refreshMLViews(); });
      Hooks.on("deleteMacro", (macro) => { if (inOurPack(macro)) refreshMLViews(); });

      console.log("[JSD] Macro Library sync hooks registered.");
    }

    await this._migrateWorldPack();
    await this._ensurePackSeeded();
  },

  // ── Migration from world pack (v1.6.x → v1.7.x) ───────────────────────────

  async _migrateWorldPack() {
    const modulePack = game.packs.get(PACK_ID);
    const worldPack  = game.packs.get(LEGACY_PACK_ID);
    if (!modulePack || !worldPack) return;

    const [mIdx, wIdx] = await Promise.all([modulePack.getIndex(), worldPack.getIndex()]);
    if (mIdx.size > 0 || wIdx.size === 0) return;

    console.log("[JSD] Migrating macros from world compendium to module compendium...");
    try {
      await modulePack.configure({ locked: false });
      const worldDocs = await worldPack.getDocuments();
      for (const doc of worldDocs) {
        const data = doc.toObject(); delete data._id;
        await Macro.create(data, { pack: PACK_ID });
      }
      await game.settings.set(MODULE, SETTING_SEEDED, true);
      console.log(`[JSD] Migrated ${worldDocs.length} macro(s) to module compendium.`);
      ui.notifications.info(
        "JSD: Macros migradas para o compendium do módulo. " +
        "O compendium de mundo pode ser removido com segurança.",
      );
    } catch (err) {
      console.error("[JSD] Migration error:", err);
    } finally {
      await modulePack.configure({ locked: true });
    }
  },

  // ── Seed module compendium on first run ────────────────────────────────────

  async _ensurePackSeeded() {
    const pack = game.packs.get(PACK_ID);
    if (!pack) {
      console.error("[JSD] Module compendium not found. Verify module.json packs declaration.");
      return;
    }

    const index = await pack.getIndex();
    if (index.size > 0) {
      if (!game.settings.get(MODULE, SETTING_SEEDED))
        await game.settings.set(MODULE, SETTING_SEEDED, true);
      return;
    }

    try {
      const resp = await fetch(`/modules/${MODULE}/packs/jsd-macros-seed.json`);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const { macros } = await resp.json();

      await pack.configure({ locked: false });
      for (const data of macros) await Macro.create(data, { pack: PACK_ID });
      await game.settings.set(MODULE, SETTING_SEEDED, true);
      console.log(`[JSD] Module compendium seeded with ${macros.length} macro(s).`);
      ui.notifications.info("JSD: Macro Library created in the module compendium.");
    } catch (err) {
      console.error("[JSD] Seeding error:", err);
    } finally {
      await pack.configure({ locked: true });
    }
  },

  // ── Scene controls ─────────────────────────────────────────────────────────

  getSceneControlButtons(controls) {
    if (!game.user.isGM) return;

    const updateMode = (() => {
      try { return game.settings.get(MODULE, "darknessSlider.updateMode"); }
      catch { return "apply"; }
    })();

    // Merge, don't replace: other JSD features (e.g. File Picker Space Display)
    // register their tools into this group before this feature runs.
    controls["jsd"] = {
      name: "jsd", title: game.i18n.localize("JSD.Panel.Title"),
      icon: "fa-solid fa-toolbox", visible: true, tools: controls["jsd"]?.tools ?? {},
    };

    controls["jsd"].tools["jsd-panel-darkness"] = {
      name: "jsd-panel-darkness", title: game.i18n.localize("JSD.DarknessPanel.Title"),
      icon: "fa-solid fa-moon-stars", order: 1, button: true, visible: true,
      onChange: () => {
        const ex = foundry.applications.instances.get("jsd-darkness-panel");
        if (ex?.rendered) { ex.close({ animate: false }); return; }
        if (!canvas.scene) { ui.notifications.warn("No active scene."); return; }
        const btn = document.querySelector('[data-tool="jsd-panel-darkness"]');
        new DarknessPanel({ triggerElement: btn, updateMode }).render({ force: true });
      },
    };

    controls["jsd"].tools["jsd-macro-lib"] = {
      name: "jsd-macro-lib", title: game.i18n.localize("JSD.MacroLib.PanelTitle"),
      icon: "fa-solid fa-code", order: 2, button: true, visible: true,
      onChange: () => {
        const ex = foundry.applications.instances.get("jsd-macro-lib-panel");
        if (ex?.rendered) { ex.close({ animate: false }); return; }
        const btn = document.querySelector('[data-tool="jsd-macro-lib"]');
        new MacroLibraryPanel({ triggerElement: btn }).render({ force: true });
      },
    };

    controls["jsd"].tools["jsd-scene-defaults"] = {
      name: "jsd-scene-defaults", title: "Scene Defaults",
      icon: "fa-solid fa-film", order: 3, button: true, visible: true,
      onChange: () => {
        const menu = game.settings.menus.get(`${MODULE}.sceneDefaultsMenu`);
        if (menu) { new menu.type().render({ force: true }); return; }
        ui.notifications.warn("Scene Defaults feature not found.");
      },
    };

    controls["jsd"].tools["jsd-panel-gm-vision"] = {
      name: "jsd-panel-gm-vision", title: "GM Clear Vision",
      icon: "fa-solid fa-eye", order: 4, button: true, visible: true,
      onChange: () => {
        const toolBtn = document.querySelector('[data-tool="jsd-gm-vision"]');
        if (toolBtn) { toolBtn.click(); return; }
        ui.notifications.warn("GM Clear Vision not found — enable it in Module Settings.");
      },
    };

    controls["jsd"].tools["jsd-open-settings"] = {
      name: "jsd-open-settings", title: "JSD Module Settings",
      icon: "fa-solid fa-gear", order: 5, button: true, visible: true,
      onChange: () => openJSDSettings(),
    };
  },
};
