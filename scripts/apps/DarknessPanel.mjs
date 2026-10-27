/**
 * DarknessPanel.mjs  —  v1.7.2
 *
 * Adicionado abaixo do slider de darkness:
 *   • Toggle: Token Vision          (scene.tokenVision)
 *   • Toggle: Global Illumination   (scene.environment.globalLight.enabled)
 *   • Dropdown: Fog Exploration     (scene.fog.mode: 0=None / 1=Individual / 2=Shared)
 *
 * Comportamento por modo:
 *   realtime — cada alteração aplica imediatamente ao documento da cena.
 *   apply    — alterações ficam pendentes; Apply salva tudo em uma única
 *              chamada scene.update(); Cancel reverte o preview de darkness
 *              e fecha (os outros controles não têm preview, então não há
 *              nada a reverter na cena).
 *
 * V14 API:
 *   Darkness  read: canvas.scene.environment.darknessLevel
 *             write: scene.update({ "environment.darknessLevel": v })
 *             preview: canvas.environment.initialize({ darkness: v })
 *   TokenVis  read: canvas.scene.tokenVision
 *             write: scene.update({ tokenVision: bool })
 *   GlobalLit read: canvas.scene.environment.globalLight.enabled
 *             write: scene.update({ "environment.globalLight.enabled": bool })
 *   FogMode   read: canvas.scene.fog.mode   (0 / 1 / 2)
 *             write: scene.update({ "fog.mode": n })
 */

const { ApplicationV2 } = foundry.applications.api;

// Fog exploration mode labels (matches Foundry's scene-config Visibility tab)
const FOG_MODES = [
  { value: 0, label: "None"       },
  { value: 1, label: "Individual" },
  { value: 2, label: "Shared"     },
];

export class DarknessPanel extends ApplicationV2 {

  static DEFAULT_OPTIONS = {
    id:       "jsd-darkness-panel",
    window:   { frame: false },
    position: { width: 280, height: "auto" },
    classes:  ["jsd-darkness-panel"],
  };

  #triggerElement  = null;
  #updateMode      = "apply";
  #debounceTimer   = null;
  #abortController = null;

  // ── Original values (captured on open, used for Cancel revert) ────────────
  #origDarkness  = 0;
  #origTokenVis  = true;
  #origGlobalLit = true;
  #origFogMode   = 2;

  // ── Current pending values (may differ from scene during apply-mode) ──────
  #curDarkness  = 0;
  #curTokenVis  = true;
  #curGlobalLit = true;
  #curFogMode   = 2;

  constructor(options = {}) {
    super(options);
    this.#triggerElement = options.triggerElement ?? null;
    this.#updateMode     = options.updateMode     ?? "apply";
  }

  // ── Scene readers ──────────────────────────────────────────────────────────

  get #sceneDarkness()  { return canvas.scene?.environment?.darknessLevel ?? canvas.scene?.darkness ?? 0; }
  get #sceneTokenVis()  { return canvas.scene?.tokenVision ?? true; }
  get #sceneGlobalLit() { return canvas.scene?.environment?.globalLight?.enabled ?? true; }
  get #sceneFogMode()   { return canvas.scene?.fog?.mode ?? 2; }

  // ── Preview (canvas only, no document write) ───────────────────────────────

  #previewDarkness(v) {
    try { canvas.environment?.initialize?.({ darkness: v }); } catch (_) {}
  }

  // ── Scene updates ──────────────────────────────────────────────────────────

  /** Apply all pending changes in one update() call. */
  async #applyAll(darkness, tokenVis, globalLit, fogMode) {
    if (!canvas.scene) return;
    await canvas.scene.update({
      "environment.darknessLevel":        darkness,
      "tokenVision":                      tokenVis,
      "environment.globalLight.enabled":  globalLit,
      "fog.mode":                         fogMode,
    });
  }

  /** Apply a single key immediately (used in realtime mode for toggles / dropdown). */
  async #applyPartial(key, value) {
    if (!canvas.scene) return;
    await canvas.scene.update({ [key]: value });
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  async _renderHTML(_context, _options) {
    // Snapshot current scene state
    this.#origDarkness  = this.#sceneDarkness;
    this.#origTokenVis  = this.#sceneTokenVis;
    this.#origGlobalLit = this.#sceneGlobalLit;
    this.#origFogMode   = this.#sceneFogMode;

    this.#curDarkness  = this.#origDarkness;
    this.#curTokenVis  = this.#origTokenVis;
    this.#curGlobalLit = this.#origGlobalLit;
    this.#curFogMode   = this.#origFogMode;

    const d       = this.#curDarkness;
    const pct     = Math.round(d * 100);
    const scene   = canvas.scene?.name ?? game.i18n.localize("JSD.DarknessPanel.NoScene");
    const isApply = this.#updateMode === "apply";
    const tv      = this.#curTokenVis;
    const gl      = this.#curGlobalLit;
    const fm      = this.#curFogMode;

    const fogOpts = FOG_MODES.map(m =>
      `<option value="${m.value}"${fm === m.value ? " selected" : ""}>${m.label}</option>`
    ).join("");

    const div = document.createElement("div");
    div.innerHTML = `
      <div class="jsd-panel-header">
        <i class="fa-solid fa-moon-stars"></i>
        <span class="jsd-panel-title">${game.i18n.localize("JSD.DarknessPanel.Title")}</span>
        <span class="jsd-scene-name" title="${scene}">${scene}</span>
        <button type="button" class="jsd-close-btn"><i class="fa-solid fa-xmark"></i></button>
      </div>

      <div class="jsd-panel-body">
        <!-- ── Darkness slider ── -->
        <div class="jsd-slider-row">
          <input type="range"  class="jsd-slider"      min="0" max="1" step="0.01" value="${d}"/>
          <input type="number" class="jsd-value-input" min="0" max="1" step="0.01" value="${d.toFixed(2)}"/>
        </div>
        <div class="jsd-darkness-bar" title="${pct}% darkness">
          <div class="jsd-darkness-fill" style="width:${pct}%"></div>
        </div>

        <!-- ── Scene quick-controls ── -->
        <div class="jsd-extra-controls">

          <div class="jsd-extra-row">
            <span class="jsd-extra-label">Token Vision</span>
            <button type="button" class="jsd-toggle${tv ? " on" : ""}"
                    data-ctrl="tokenVision" title="Toggle Token Vision">
              <span class="jsd-toggle-track"><span class="jsd-toggle-thumb"></span></span>
              <span class="jsd-toggle-state">${tv ? "ON" : "OFF"}</span>
            </button>
          </div>

          <div class="jsd-extra-row">
            <span class="jsd-extra-label">Global Light</span>
            <button type="button" class="jsd-toggle${gl ? " on" : ""}"
                    data-ctrl="globalLight" title="Toggle Global Illumination">
              <span class="jsd-toggle-track"><span class="jsd-toggle-thumb"></span></span>
              <span class="jsd-toggle-state">${gl ? "ON" : "OFF"}</span>
            </button>
          </div>

          <div class="jsd-extra-row">
            <span class="jsd-extra-label">Fog Exploration</span>
            <select class="jsd-fog-select" data-ctrl="fogMode" title="Fog of War Exploration Mode">
              ${fogOpts}
            </select>
          </div>

        </div>

        <!-- ── Footer (apply-mode only) ── -->
        ${isApply ? `
          <div class="jsd-panel-footer">
            <button type="button" class="jsd-btn jsd-btn-cancel">
              ${game.i18n.localize("JSD.DarknessPanel.Cancel")}
            </button>
            <button type="button" class="jsd-btn jsd-btn-apply">
              <i class="fa-solid fa-check"></i> ${game.i18n.localize("JSD.DarknessPanel.Apply")}
            </button>
          </div>` : ""}
      </div>`;

    return div;
  }

  _replaceHTML(result, content) { content.replaceChildren(result); }

  // ── Events ─────────────────────────────────────────────────────────────────

  async _onRender(_context, _options) {
    const el = this.element;

    this.#abortController?.abort();
    this.#abortController = new AbortController();
    const { signal } = this.#abortController;

    // Position next to trigger button
    if (this.#triggerElement) {
      const r = this.#triggerElement.getBoundingClientRect();
      this.setPosition({ left: r.right + 8, top: Math.max(r.top - 8, 4) });
    }

    const slider = el.querySelector(".jsd-slider");
    const numIn  = el.querySelector(".jsd-value-input");
    const fill   = el.querySelector(".jsd-darkness-fill");
    const bar    = el.querySelector(".jsd-darkness-bar");

    // ── Helpers ───────────────────────────────────────────────────────────────

    const syncDarknessUI = (raw) => {
      const v = Math.max(0, Math.min(1, parseFloat(raw) || 0));
      this.#curDarkness = v;
      if (slider) slider.value = v;
      if (numIn)  numIn.value  = v.toFixed(2);
      const pct = Math.round(v * 100);
      if (fill) fill.style.width = `${pct}%`;
      if (bar)  bar.title = `${pct}% darkness`;
    };

    const syncToggleUI = (btn, value) => {
      btn.classList.toggle("on", value);
      const stateEl = btn.querySelector(".jsd-toggle-state");
      if (stateEl) stateEl.textContent = value ? "ON" : "OFF";
    };

    // ── Close button ──────────────────────────────────────────────────────────

    el.querySelector(".jsd-close-btn")
      ?.addEventListener("click", () => this.close({ animate: false }), { signal });

    // ── Darkness slider ───────────────────────────────────────────────────────

    slider?.addEventListener("input", (e) => {
      const v = parseFloat(e.target.value);
      syncDarknessUI(v);
      if (this.#updateMode === "realtime") {
        clearTimeout(this.#debounceTimer);
        this.#previewDarkness(v);
        this.#debounceTimer = setTimeout(
          () => this.#applyPartial("environment.darknessLevel", v), 250,
        );
      }
    }, { signal });

    slider?.addEventListener("change", async (e) => {
      const v = parseFloat(e.target.value);
      syncDarknessUI(v);
      clearTimeout(this.#debounceTimer);
      if (this.#updateMode === "realtime")
        await this.#applyPartial("environment.darknessLevel", v);
    }, { signal });

    numIn?.addEventListener("change", async (e) => {
      const v = Math.max(0, Math.min(1, parseFloat(e.target.value) || 0));
      syncDarknessUI(v);
      if (this.#updateMode === "realtime")
        await this.#applyPartial("environment.darknessLevel", v);
    }, { signal });

    // ── Token Vision toggle ───────────────────────────────────────────────────

    el.querySelector('[data-ctrl="tokenVision"]')
      ?.addEventListener("click", async (e) => {
        const btn     = e.currentTarget;
        const newVal  = !this.#curTokenVis;
        this.#curTokenVis = newVal;
        syncToggleUI(btn, newVal);
        if (this.#updateMode === "realtime")
          await this.#applyPartial("tokenVision", newVal);
      }, { signal });

    // ── Global Illumination toggle ────────────────────────────────────────────

    el.querySelector('[data-ctrl="globalLight"]')
      ?.addEventListener("click", async (e) => {
        const btn    = e.currentTarget;
        const newVal = !this.#curGlobalLit;
        this.#curGlobalLit = newVal;
        syncToggleUI(btn, newVal);
        if (this.#updateMode === "realtime")
          await this.#applyPartial("environment.globalLight.enabled", newVal);
      }, { signal });

    // ── Fog Exploration dropdown ──────────────────────────────────────────────

    el.querySelector('[data-ctrl="fogMode"]')
      ?.addEventListener("change", async (e) => {
        const newVal = parseInt(e.target.value, 10);
        this.#curFogMode = newVal;
        if (this.#updateMode === "realtime")
          await this.#applyPartial("fog.mode", newVal);
      }, { signal });

    // ── Apply (apply-mode only) ───────────────────────────────────────────────

    el.querySelector(".jsd-btn-apply")
      ?.addEventListener("click", async () => {
        await this.#applyAll(
          this.#curDarkness,
          this.#curTokenVis,
          this.#curGlobalLit,
          this.#curFogMode,
        );
        this.close({ animate: false });
      }, { signal });

    // ── Cancel (apply-mode only) ──────────────────────────────────────────────
    // Reverts the darkness canvas preview; the other controls were never
    // written to the scene in apply-mode, so no revert needed for them.

    el.querySelector(".jsd-btn-cancel")
      ?.addEventListener("click", () => {
        this.#previewDarkness(this.#origDarkness);
        this.close({ animate: false });
      }, { signal });

    // ── Click outside closes ──────────────────────────────────────────────────

    setTimeout(() => {
      if (signal.aborted) return;
      document.addEventListener("mousedown", (e) => {
        if (!el.contains(e.target) && !this.#triggerElement?.contains(e.target))
          this.close({ animate: false });
      }, { signal });
    }, 120);
  }

  async _onClose() {
    clearTimeout(this.#debounceTimer);
    this.#abortController?.abort();
    this.#abortController = null;
  }
}
