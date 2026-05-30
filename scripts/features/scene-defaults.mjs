/**
 * scene-defaults.mjs — Feature: Scene Defaults
 * Solução Definitiva para Injeção no Form de Criação da V14
 */

const MODULE          = "jack-small-details";
const SETTING_ENABLED = "sceneDefaults.enabled";
const SETTING_DATA    = "sceneDefaults.data";
const TEMPLATE_FLAG   = "isTemplate";

// Excluir dimensões e IDs para nunca sobrescrever o comportamento padrão do Foundry
const EXCLUDE_TOP = new Set([
  "_id", "_stats", "name", "thumb", "folder", "sort", "ownership", "active", "navigation", "navOrder", "navName",
  "width", "height", "padding", "shiftX", "shiftY", "initial",
  "initialLevel", "drawings", "tokens", "walls", "lights", "sounds", "notes", "regions", "tiles", "levels"
]);

const EXCLUDE_LEVEL_KEYS = new Set(["_id", "_stats", "sort", "flags"]);

function shouldExclude(flatKey) {
  if (flatKey.startsWith("_")) return true;
  const top = flatKey.split(".")[0];
  return EXCLUDE_TOP.has(flatKey) || EXCLUDE_TOP.has(top);
}

function getStoredDefaults() {
  try { return game.settings.get(MODULE, SETTING_DATA) ?? {}; } catch { return {}; }
}

function resolveSceneConfigClass() {
  const sheets = CONFIG.Scene?.sheetClasses;
  if (sheets) {
    for (const bucket of Object.values(sheets)) {
      if (!bucket || typeof bucket !== "object") continue;
      const entries = Object.values(bucket);
      const def = entries.find(e => e?.default && e?.cls);
      if (def) return def.cls;
      const any = entries.find(e => e?.cls);
      if (any) return any.cls;
    }
  }
  return SceneConfig;
}

function buildSceneDefaultsConfigClass() {
  const BaseSheet = resolveSceneConfigClass();
  if (!BaseSheet) return null;

  return class SceneDefaultsConfig extends BaseSheet {
    get title() { return game.i18n.localize("JSD.SceneDefaults.WindowTitle"); }

    async _processSubmitData(event, form, submitData, options) {
      const flat = foundry.utils.flattenObject(submitData);

      for (const key of Object.keys(flat)) {
        if (shouldExclude(key)) delete flat[key];
      }
      
      const mainData = foundry.utils.expandObject(flat);

      let levelDefaults = null;
      if (Array.isArray(submitData.levels) && submitData.levels.length > 0) {
        const levelFlat = foundry.utils.flattenObject(submitData.levels[0]);
        for (const key of Object.keys(levelFlat)) {
          if (EXCLUDE_LEVEL_KEYS.has(key) || EXCLUDE_LEVEL_KEYS.has(key.split(".")[0])) {
            delete levelFlat[key];
          }
        }
        if (Object.keys(levelFlat).length > 0) levelDefaults = foundry.utils.expandObject(levelFlat);
      }

      const toStore = { ...mainData };
      if (levelDefaults) toStore._jsd_levelDefaults = levelDefaults;

      await game.settings.set(MODULE, SETTING_DATA, toStore);
      ui.notifications.info(game.i18n.localize("JSD.SceneDefaults.Saved"));
      await this.close();
    }

    async _onClose(options) {
      await super._onClose(options);
      if (this.document?.getFlag(MODULE, TEMPLATE_FLAG)) {
        try { await this.document.delete(); } catch (e) {}
      }
    }
  };
}

class SceneDefaultsMenuRelay extends foundry.applications.api.ApplicationV2 {
  static DEFAULT_OPTIONS = { id: "jsd-scene-defaults-relay", window: { frame: false } };
  async _renderHTML() { const div = document.createElement("div"); div.style.display = "none"; return div; }
  _replaceHTML(result, content) { if (result) content.replaceChildren(result); }
  async _onRender() { setTimeout(() => { this.close({ animate: false }); SceneDefaultsFeature._openConfigUI(); }, 0); }
}

// ── Feature Export ───────────────────────────────────────────────────────────
export const SceneDefaultsFeature = {
  isEnabled() {
    try { return game.settings.get(MODULE, SETTING_ENABLED); } catch { return true; }
  },

  registerSettings() {
    game.settings.register(MODULE, SETTING_ENABLED, {
      name: "JSD.Settings.SceneDefaults.Label",
      hint: "JSD.Settings.SceneDefaults.Hint",
      scope: "world", config: true, type: Boolean, default: true,
    });
    game.settings.register(MODULE, SETTING_DATA, {
      scope: "world", config: false, type: Object, default: {},
    });
    game.settings.registerMenu(MODULE, "sceneDefaultsMenu", {
      name: "JSD.Settings.SceneDefaults.Menu.Name",
      label: "JSD.Settings.SceneDefaults.Menu.Label",
      hint: "JSD.Settings.SceneDefaults.Menu.Hint",
      icon: "fa-solid fa-map",
      type: SceneDefaultsMenuRelay,
      restricted: true,
    });
  },

  initialize() {
    this._cleanupTemplateScenes();

    // Na V14, escutar a renderização da folha de configuração resolve o problema visual e de persistência
    Hooks.on("renderSceneConfig", this._onRenderSceneConfig.bind(this));
  },

  async _cleanupTemplateScenes() {
    const orphans = game.scenes?.filter(s => s.getFlag(MODULE, TEMPLATE_FLAG)) ?? [];
    for (const s of orphans) { await s.delete(); }
  },

  async _openConfigUI() {
    try {
      const SceneDefaultsConfig = buildSceneDefaultsConfigClass();
      if (!SceneDefaultsConfig) return;

      const stored = getStoredDefaults();
      const { _jsd_levelDefaults, ...mainStored } = stored;

      const createData = foundry.utils.mergeObject(
        mainStored,
        { name: game.i18n.localize("JSD.SceneDefaults.TemplateName"), navigation: false, sort: -999999 },
        { inplace: false }
      );
      foundry.utils.setProperty(createData, `flags.${MODULE}.${TEMPLATE_FLAG}`, true);

      if (_jsd_levelDefaults) {
        createData.levels = [{ _id: "defaultLevel0000", name: "Level", ..._jsd_levelDefaults }];
      }

      const tempScene = await Scene.create(createData);
      new SceneDefaultsConfig({ document: tempScene }).render({ force: true });
    } catch (e) {
      console.error("[Jack Small Details] Erro ao abrir Scene Defaults:", e);
    }
  },

  /**
   * Intercepta a renderização da tela de configuração.
   * Se for uma cena nova aberta pela primeira vez, injeta os dados direto nos inputs do formulário.
   */
  _onRenderSceneConfig(app, html, data) {
    if (!this.isEnabled()) return;

    const scene = app.document;
    if (!scene) return;

    // Ignora se for a tela de configuração do próprio módulo
    if (scene.getFlag(MODULE, TEMPLATE_FLAG)) return;

    // Detecta se a cena acabou de ser criada (sem plano de fundo e criada nos últimos segundos)
    // V14: Scene#background is deprecated — use Level#background instead
    const levelBgSrc = scene.initialLevel?.background?.src;
    const isBrandNew = !levelBgSrc && (Date.now() - (scene._stats?.createdTime ?? 0) < 5000);
    if (!isBrandNew) return;

    // Verifica se já aplicamos os defaults nesta instância da janela para evitar loops infinitos
    if (app._jsdDefaultsApplied) return;
    app._jsdDefaultsApplied = true;

    const stored = getStoredDefaults();
    if (!stored || foundry.utils.isEmpty(stored)) return;

    const { _jsd_levelDefaults, ...mainDefaults } = stored;

    console.log("[Jack Small Details] Injetando configurações padrão na interface da nova cena.");

    // Atualiza o documento em background sem disparar nova renderização completa imediatamente
    scene.updateSource(mainDefaults);

    if (_jsd_levelDefaults && !foundry.utils.isEmpty(_jsd_levelDefaults)) {
      const currentLevels = scene.toObject().levels || [];
      if (currentLevels.length > 0) {
        const mergedLevel = foundry.utils.mergeObject(currentLevels[0], _jsd_levelDefaults, { inplace: false });
        scene.updateSource({ levels: [mergedLevel] });
      }
    }

    // Força o formulário aberto a recalcular seus dados internos a partir do documento que atualizamos
    app.render();
  }
};