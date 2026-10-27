
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

// Background video textures sometimes finish loading a moment AFTER
// "canvasReady" fires (confirmed pattern with Foundry's video texture
// loader), so `canvas.primary.videoMeshes` can still be empty at that
// exact instant — a single call right then can silently find nothing to
// mute. Retrying a few times over the following seconds catches the
// video once it actually attaches, without needing to guess at a more
// specific "video loaded" hook. Cheap and idempotent — each retry just
// re-applies the same target volume to whatever meshes currently exist.
const VOLUME_RETRY_DELAYS_MS = [0, 200, 500, 1000, 2000, 4000];

function scheduleBackgroundVolumeUpdate() {
  for (const delay of VOLUME_RETRY_DELAYS_MS) {
    setTimeout(updateBackgroundVolume, delay);
  }
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

  settingsGroup: {
    label: "Background Volume Slider",
    keys: [SETTING_ENABLED],
  },

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
    scheduleBackgroundVolumeUpdate();
    Hooks.on("canvasReady", scheduleBackgroundVolumeUpdate);
    Hooks.on("globalAmbientVolumeChanged", updateBackgroundVolume);

    // Narrower than "updateDocument" (which fires for every document type
    // in the world, on every update) — "updateScene" only fires for Scene
    // updates, which is all this ever needed to react to.
    Hooks.on("updateScene", (scene) => {
      if (game.scenes.viewed?.id === scene.id) updateBackgroundVolume();
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
