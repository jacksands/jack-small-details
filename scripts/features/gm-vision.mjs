/**
 * gm-vision.mjs
 * Feature: GM Vision — eye icon in Token Tools, GM-only.
 *
 * Ported from the standalone "GM Vision" module by dev7355608 (MIT license,
 * https://github.com/dev7355608/gm-vision). Original source recovered from
 * its bundled script.js.map (script.js ships minified but the sourcemap
 * embeds the full original .mjs files).
 *
 * Two changes from the original module, both requested explicitly:
 *   1. Activation is a dedicated toggle icon in Token Tools (open/closed eye,
 *      green when active) instead of right-click on the Lighting tool icon.
 *      The Lighting icon is untouched — no `renderSceneControls` hijack.
 *   2. The two real "native method" touchpoints are registered through
 *      lib-wrapper instead of ES6 subclass-and-reassign on CONFIG, so this
 *      composes correctly with any other module patching the same targets
 *      (lib-wrapper detects and reports the conflict instead of silently
 *      "last module wins").
 *
 * NOT converted to lib-wrapper, and why:
 *   `VisualEffectsMaskingFilter.defaultUniforms` and `.fragmentHeader` are
 *   static DATA fields (a plain object and a plain string), not functions —
 *   confirmed by reading the original source. lib-wrapper only wraps normal
 *   methods and property getters (see its own README), so these two cannot
 *   be registered with it by design, not by omission. They are instead
 *   extended in place on the existing class (no subclassing at all), which
 *   is strictly less invasive than the original module's approach.
 *
 * Requires: lib-wrapper (declared in module.json → relationships.requires).
 */

const MODULE = "jack-small-details";
const SETTING_ENABLED = "gmVision.enabled";
const SETTING_ACTIVE = "gmVision.active";
const SETTING_TOKEN_REVEAL_MODE = "gmVision.tokenRevealMode";
const TOOL_NAME = "jsd-gm-vision";

/** @type {{active: boolean, wrapped: boolean, tokenRevealMode: "linked"|"always"|"off"}} */
const state = { active: false, wrapped: false, tokenRevealMode: "always" };

/** @type {PIXI.LegacyGraphics|undefined} */
let revealFog;

/** @type {DetectionFilter|undefined} */
let detectionFilter;

class DetectionFilter extends foundry.canvas.rendering.filters.AbstractBaseFilter {
  /** @override */
  static vertexShader = `\
        attribute vec2 aVertexPosition;

        uniform vec4 inputSize;
        uniform vec4 outputFrame;
        uniform mat3 projectionMatrix;
        uniform vec2 origin;
        uniform mediump float thickness;

        varying vec2 vTextureCoord;
        varying float vOffset;

        void main() {
            vTextureCoord = (aVertexPosition * outputFrame.zw) * inputSize.zw;
            vec2 position = aVertexPosition * max(outputFrame.zw, vec2(0.0)) + outputFrame.xy;
            vec2 offset = position - origin;
            vOffset = (offset.x + offset.y) / (1.414213562373095 * 2.0 * thickness);
            gl_Position = vec4((projectionMatrix * vec3(position, 1.0)).xy, 0.0, 1.0);
        }
    `;

  /** @override */
  static fragmentShader = `\
        varying vec2 vTextureCoord;
        varying float vOffset;

        uniform sampler2D uSampler;
        uniform mediump float thickness;

        void main() {
            float x = abs(vOffset - floor(vOffset + 0.5)) * 2.0;
            float y0 = clamp((x + 0.5) * thickness + 0.5, 0.0, 1.0);
            float y1 = clamp((x - 0.5) * thickness + 0.5, 0.0, 1.0);
            float y = y0 - y1;
            float alpha = texture2D(uSampler, vTextureCoord).a * 0.25;
            gl_FragColor = vec4(y, y, y, 1.0) * alpha;
        }
    `;

  /** @override */
  static defaultUniforms = {
    origin: { x: 0.0, y: 0.0 },
    thickness: 1.0,
  };

  /** @override */
  apply(filterManager, input, output, clearMode, currentState) {
    const uniforms = this.uniforms;
    const worldTransform = currentState.target.worldTransform;

    uniforms.origin.x = worldTransform.tx;
    uniforms.origin.y = worldTransform.ty;
    uniforms.thickness = 4 * canvas.dimensions.uiScale * canvas.stage.scale.x;

    super.apply(filterManager, input, output, clearMode, currentState);
  }
}

/* -------------------------------------------- */
/* Canvas hooks — plain Hooks.on, no wrapping needed (Foundry's hook system  */
/* already supports many listeners on the same hook without conflict).      */
/* -------------------------------------------- */

function drawCanvasVisibility(group) {
  revealFog = group.addChild(
    new PIXI.LegacyGraphics()
      .beginFill(0xFFFFFF)
      .drawShape(canvas.dimensions.rect)
      .endFill());
  revealFog.visible = false;
}

function sightRefresh(_group) {
  revealFog.visible = state.active;
  canvas.effects.illumination.filter.uniforms.gmVision = state.active;
  canvas.effects.darkness.filter.alpha = state.active ? 0.5 : 1.0;
}

function drawCanvasDarknessEffects(layer) {
  const index = layer.filters?.indexOf(layer.filter);
  layer.filter = new PIXI.AlphaFilter();
  if (index >= 0) layer.filters[index] = layer.filter;
}

/* -------------------------------------------- */
/* Hidden/undetected token reveal — 3 configurable modes.                   */
/* -------------------------------------------- */

function shouldRevealTokens() {
  switch (state.tokenRevealMode) {
    case "always": return true;   // always on while the feature itself is enabled
    case "off": return false;      // never
    case "linked":
    default: return state.active;  // only while the eye icon is toggled on
  }
}

/* -------------------------------------------- */
/* Token Tools icon — dedicated toggle, independent of the Lighting tool.   */
/* -------------------------------------------- */

function updateToolVisual(element) {
  const btn = element.querySelector(`[data-tool="${TOOL_NAME}"]`);
  if (!btn) return;
  const icon = btn.querySelector("i");
  if (!icon) return;
  // Same glyph always (plain eye, never eye-slash — that shape reads as
  // "hidden/visibility" elsewhere in Foundry's own UI and was confusing).
  // On/off is conveyed by weight (outline vs filled) plus the green color
  // rule in jack-small-details.css, not by swapping to a different icon.
  icon.classList.toggle("fa-solid", state.active);
  icon.classList.toggle("fa-regular", !state.active);
  btn.classList.toggle("jsd-gm-vision-on", state.active);
}

export const GMVisionFeature = {
  settingsGroup: {
    label: "JSD.Settings.GMVision.Label",
    keys: [SETTING_ENABLED, SETTING_TOKEN_REVEAL_MODE],
  },

  isEnabled() {
    try { return game.settings.get(MODULE, SETTING_ENABLED); } catch { return true; }
  },

  registerSettings() {
    game.settings.register(MODULE, SETTING_ENABLED, {
      name: "JSD.Settings.GMVision.Label",
      hint: "JSD.Settings.GMVision.Hint",
      scope: "world", config: true, type: Boolean, default: true, requiresReload: true,
    });

    // Controls the hidden/undetected-token outline specifically — the
    // darkness/fog brightening (the eye icon's actual on/off effect) is
    // always tied to the icon and is not affected by this setting.
    game.settings.register(MODULE, SETTING_TOKEN_REVEAL_MODE, {
      name: "JSD.Settings.GMVision.RevealMode.Label",
      hint: "JSD.Settings.GMVision.RevealMode.Hint",
      scope: "world", config: true, type: String,
      choices: {
        always: "JSD.GMVision.RevealMode.Always",
        linked: "JSD.GMVision.RevealMode.Linked",
        off: "JSD.GMVision.RevealMode.Off",
      },
      default: "always",
      requiresReload: false,
      onChange: (value) => {
        console.log(`${MODULE} | GM Vision reveal mode changed to "${value}", forcing a vision refresh.`);
        state.tokenRevealMode = value;
        // isVisible is a getter — Foundry only re-evaluates it at specific
        // trigger points (sightRefresh, token movement, combat turns...),
        // not continuously. Without forcing a recompute here, every token's
        // .visible stays at whatever it was under the PREVIOUS mode until
        // some unrelated event happens to trigger one naturally — which is
        // exactly why changing this setting appeared to do nothing.
        if (game.user.isGM && !game.settings.get("core", "noCanvas")) {
          canvas.perception?.update({ refreshVision: true, refreshOcclusion: true });
          // Belt-and-suspenders: directly dirty each token's own
          // refreshVisibility render flag (the flag that maps to
          // Token#_refreshVisibility — confirmed present per the console's
          // own stack trace), rather than relying solely on
          // canvas.perception.update to cascade down to every token.
          for (const token of canvas.tokens?.placeables ?? []) {
            token.renderFlags?.set({ refreshVisibility: true });
          }
        }
      },
    });

    // Personal per-browser on/off state. Not shown in the Settings list —
    // driven entirely by the Token Tools icon and the Ctrl+G keybinding.
    game.settings.register(MODULE, SETTING_ACTIVE, {
      scope: "client", config: false, type: Boolean, default: false,
      onChange: (value) => {
        if (!game.user.isGM || game.settings.get("core", "noCanvas")) return;
        state.active = value;
        canvas.perception?.update({ refreshVision: true });
        ui.controls.render();
      },
    });

    game.keybindings.register(MODULE, "gmVisionToggle", {
      name: "JSD.GMVision.Keybinding.Name",
      hint: "JSD.GMVision.Keybinding.Hint",
      editable: [
        { key: "KeyG", modifiers: [foundry.helpers.interaction.KeyboardManager.MODIFIER_KEYS.CONTROL] },
      ],
      restricted: true,
      onDown: () => {
        if (!GMVisionFeature.isEnabled() || !game.user.isGM || game.settings.get("core", "noCanvas")) return;
        game.settings.set(MODULE, SETTING_ACTIVE, !game.settings.get(MODULE, SETTING_ACTIVE));
        return true;
      },
    });
  },

  /**
   * Runs on "setup" — must happen here, NOT on "ready". `CONFIG.Token`'s
   * prototype and `CONFIG.Canvas.visualEffectsMaskingFilter` are read when
   * the canvas is first configured (`canvasConfig` fires between `setup`
   * and `ready` in the once-hook order), so patching them any later means
   * the token/filter classes for the initially-loaded scene are already
   * built without the patch.
   */
  setup() {
    if (!game.user.isGM || game.settings.get("core", "noCanvas")) return;
    if (state.wrapped) return;

    if (typeof libWrapper === "undefined") {
      console.error(`${MODULE} | GM Vision requires the "lib-wrapper" module to be installed and active. Feature disabled for this session.`);
      return;
    }

    state.active = game.settings.get(MODULE, SETTING_ACTIVE);
    state.tokenRevealMode = game.settings.get(MODULE, SETTING_TOKEN_REVEAL_MODE);
    state.wrapped = true;

    // --- Token#isVisible (getter) ---------------------------------------
    // Both branches below are now gated by shouldRevealTokens() — the
    // "visible && this.document.hidden" branch (manually GM-hidden tokens,
    // which core already shows to the GM by default) previously bypassed
    // the reveal-mode setting entirely, since && binds tighter than ||.
    // That meant "Always off" had no effect on any document.hidden token.
    libWrapper.register(MODULE, "CONFIG.Token.objectClass.prototype.isVisible", function (wrapped, ...args) {
      const visible = wrapped(...args);

      if (shouldRevealTokens() && (
            (!visible && (this._preview?.previewType !== "config")
              && !(this.layer.active && this.document.visible && (ui.placeables?.isEntryVisible(this) === false)))
            || (visible && this.document.hidden)
          )) {
        this.detectionFilter = detectionFilter ??= DetectionFilter.create();
        return true;
      }

      return visible;
    }, "WRAPPER");

    // --- VisualEffectsMaskingFilter -------------------------------------
    const VEM = CONFIG.Canvas.visualEffectsMaskingFilter;

    // Static DATA fields — extended in place, no subclass created.
    //
    // Using Object.defineProperty rather than plain assignment (`VEM.x = ...`)
    // on purpose: if `defaultUniforms`/`fragmentHeader` are actually inherited
    // via a getter-only accessor somewhere in VEM's own prototype chain (common
    // in PIXI filter base classes), a plain assignment throws in strict mode
    // (.mjs is always strict) — "Cannot set property which has only a getter".
    // defineProperty instead creates a genuine OWN data property directly on
    // VEM, which shadows any inherited accessor and cannot hit that error.
    try {
      if (!("gmVision" in VEM.defaultUniforms)) {
        Object.defineProperty(VEM, "defaultUniforms", {
          value: { ...VEM.defaultUniforms, gmVision: false },
          writable: true, configurable: true, enumerable: true,
        });
      }
      if (!VEM.fragmentHeader.includes("uniform bool gmVision;")) {
        Object.defineProperty(VEM, "fragmentHeader", {
          value: `${VEM.fragmentHeader}\n        uniform bool gmVision;\n    `,
          writable: true, configurable: true, enumerable: true,
        });
      }
    } catch (err) {
      console.error(`${MODULE} | GM Vision: failed to patch VisualEffectsMaskingFilter.defaultUniforms/fragmentHeader — darkness/fog brightening will not work, but the hidden-token outline (isVisible) is unaffected. Original error:`, err);
    }

    // Static METHOD — genuinely lib-wrapper-eligible.
    libWrapper.register(MODULE, "CONFIG.Canvas.visualEffectsMaskingFilter.fragmentPostProcess", function (wrapped, postProcessModes) {
      return `
            ${wrapped(postProcessModes)}

            if (mode == ${this.FILTER_MODES.ILLUMINATION} && gmVision) {
                finalColor.rgb = sqrt(finalColor.rgb) * 0.5 + 0.5;
            }
        `;
    }, "WRAPPER");

    Hooks.on("drawCanvasVisibility", drawCanvasVisibility);
    Hooks.on("sightRefresh", sightRefresh);
    Hooks.on("drawCanvasDarknessEffects", drawCanvasDarknessEffects);

    console.log(`${MODULE} | GM Vision ready (lib-wrapper hooks registered, active=${state.active}).`);
  },

  initialize() {
    // Keeps the icon weight (outline/solid) and the green "on" class in
    // sync on every Scene Controls render. `getSceneControlButtons` below
    // sets the *initial* icon each time controls are rebuilt, but the tool
    // definition is otherwise static per render pass — this hook is the
    // reliable place to react to state changes that happen without a full
    // controls rebuild.
    Hooks.on("renderSceneControls", (_app, element) => updateToolVisual(element));
  },

  getSceneControlButtons(controls) {
    if (!controls.tokens || !game.user.isGM) return;

    controls.tokens.tools[TOOL_NAME] = {
      name: TOOL_NAME,
      title: "JSD.GMVision.ToolTitle",
      icon: state.active ? "fa-solid fa-eye" : "fa-regular fa-eye",
      order: Object.keys(controls.tokens.tools).length,
      toggle: true,
      active: state.active,
      visible: true,
      onChange: (_event, active) => {
        console.log(`${MODULE} | GM Vision icon clicked, setting active=${active}`);
        game.settings.set(MODULE, SETTING_ACTIVE, active);
      },
    };
  },
};
