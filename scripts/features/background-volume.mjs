
const MODULE = "jack-small-details";
const SETTING_ENABLED = "backgroundVolume.enabled";
const FLAG_SCOPE = "jack-small-details";
const VOLUME_FLAG = "backgroundVolume";
const SLIDER_ID = "bvSlider";

function getVolume(scene) {
  const v = scene.getFlag(FLAG_SCOPE, VOLUME_FLAG);
  return typeof v !== "undefined" ? v : 1;
}

async function setVolume(scene, volume) {
  if (volume === scene.getFlag(FLAG_SCOPE, VOLUME_FLAG)) return;
  await scene.setFlag(FLAG_SCOPE, VOLUME_FLAG, volume);
}

function updateVolume(newVolume) {
  if (!canvas?.ready) return;
  for (const mesh of canvas.primary.videoMeshes) {
    const src = mesh.sourceElement;
    if (src instanceof HTMLVideoElement) src.volume = newVolume;
  }
}

function updateBackgroundVolume() {
  const scene = game.scenes.viewed;
  if (!scene) return;
  const ambient = game.settings.get("core", "globalAmbientVolume");
  updateVolume(ambient * getVolume(scene));
}

function findInsertionTarget(rootEl) {
  return (
    rootEl.querySelector("div.tab[data-tab='misc']") ||
    rootEl.querySelector("div[data-application-part='misc']") ||
    rootEl.querySelector("div[data-group='ambience'][data-tab='basic']") ||
    rootEl.querySelector("div.tab[data-tab='basics']") ||
    rootEl.querySelector("div[data-application-part='basics']") ||
    rootEl.querySelector("form")
  );
}

export const BackgroundVolumeFeature = {
  isEnabled() {
    try { return game.settings.get(MODULE, SETTING_ENABLED); } catch { return true; }
  },

  registerSettings() {
    game.settings.register(MODULE, SETTING_ENABLED, {
      name: "Activate Background Volume Slider in Scene Settings",
      hint: "Adds a per-scene video volume slider to Scene Configuration.",
      scope: "world", config: true, type: Boolean, default: true, requiresReload: true
    });
  },

  initialize() {
    updateBackgroundVolume();
    Hooks.on("canvasReady", updateBackgroundVolume);
    Hooks.on("globalAmbientVolumeChanged", updateBackgroundVolume);
    Hooks.on("updateDocument", (document) => {
      if (!(document instanceof Scene)) return;
      if (game.scenes.viewed?.id === document.id) updateBackgroundVolume();
    });

    Hooks.on("renderSceneConfig", async (sceneConfig, element) => {
      const rootEl = (element instanceof HTMLElement) ? element : element[0];
      if (!rootEl || rootEl.querySelector(`#${SLIDER_ID}`)) return;

      const scene = sceneConfig.document;
      const oldVolume = getVolume(scene);

      const html = await foundry.applications.handlebars.renderTemplate(
        "modules/jack-small-details/html/SceneSlider.html",
        {
          label: "Background Volume",
          hint: "Sets the volume of background videos (applies to all Levels simultaneously).",
          id: SLIDER_ID,
          value: oldVolume,
          max: 1, min: 0, step: 0.05
        }
      );

      const sliderDiv = new DOMParser().parseFromString(html, "text/html").body.firstElementChild;
      const target = findInsertionTarget(rootEl);
      if (!sliderDiv || !target) return;

      target.insertBefore(sliderDiv, target.firstChild);

      const sliderInput = rootEl.querySelector(`#${SLIDER_ID}`);
      sliderInput?.addEventListener("input", () => {
        const ambient = game.settings.get("core", "globalAmbientVolume");
        updateVolume(ambient * parseFloat(sliderInput.value));
      });

      sliderInput?.addEventListener("change", () => {
        setVolume(scene, parseFloat(sliderInput.value));
      });

      sceneConfig.setPosition();
    });
  }
};
