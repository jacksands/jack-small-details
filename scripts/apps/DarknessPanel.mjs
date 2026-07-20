/**
 * DarknessPanel.mjs
 * Frameless floating panel for quick scene darkness control.
 *
 * V14 API notes:
 *   Read   : canvas.scene.environment.darknessLevel
 *   Persist: canvas.scene.update({ "environment.darknessLevel": value })
 *   Preview: canvas.environment.initialize({ darkness: value })  [best-effort]
 */

const { ApplicationV2 } = foundry.applications.api;

export class DarknessPanel extends ApplicationV2 {

  static DEFAULT_OPTIONS = {
    id: "jsd-darkness-panel",
    window: { frame: false },
    position: { width: 270, height: "auto" },
    classes: ["jsd-darkness-panel"],
  };

  #triggerElement  = null;
  #updateMode      = "apply";
  #debounceTimer   = null;
  #originalValue   = 0;
  #currentValue    = 0;
  #abortController = null;

  constructor(options = {}) {
    super(options);
    this.#triggerElement = options.triggerElement ?? null;
    this.#updateMode     = options.updateMode     ?? "apply";
  }

  get #sceneDarkness() {
    return canvas.scene?.environment?.darknessLevel ?? canvas.scene?.darkness ?? 0;
  }

  #previewDarkness(value) {
    try { canvas.environment?.initialize?.({ darkness: value }); } catch (_e) {}
  }

  async #applyDarkness(value) {
    if (!canvas.scene) return;
    await canvas.scene.update({ "environment.darknessLevel": value });
  }

  async _renderHTML(_context, _options) {
    this.#originalValue = this.#sceneDarkness;
    this.#currentValue  = this.#originalValue;

    const d       = this.#currentValue;
    const pct     = Math.round(d * 100);
    const scene   = canvas.scene?.name ?? game.i18n.localize("JSD.DarknessPanel.NoScene");
    const isApply = this.#updateMode === "apply";

    const div = document.createElement("div");
    div.innerHTML = `
      <div class="jsd-panel-header">
        <i class="fa-solid fa-moon-stars"></i>
        <span class="jsd-panel-title">${game.i18n.localize("JSD.DarknessPanel.Title")}</span>
        <span class="jsd-scene-name" title="${scene}">${scene}</span>
        <button type="button" class="jsd-close-btn"><i class="fa-solid fa-xmark"></i></button>
      </div>
      <div class="jsd-panel-body">
        <div class="jsd-slider-row">
          <input type="range"  class="jsd-slider"      min="0" max="1" step="0.01" value="${d}"/>
          <input type="number" class="jsd-value-input" min="0" max="1" step="0.01" value="${d.toFixed(2)}"/>
        </div>
        <div class="jsd-darkness-bar" title="${pct}% darkness">
          <div class="jsd-darkness-fill" style="width:${pct}%"></div>
        </div>
        ${isApply ? `
          <div class="jsd-panel-footer">
            <button type="button" class="jsd-btn jsd-btn-cancel">${game.i18n.localize("JSD.DarknessPanel.Cancel")}</button>
            <button type="button" class="jsd-btn jsd-btn-apply">
              <i class="fa-solid fa-check"></i> ${game.i18n.localize("JSD.DarknessPanel.Apply")}
            </button>
          </div>` : ""}
      </div>`;
    return div;
  }

  _replaceHTML(result, content) { content.replaceChildren(result); }

  async _onRender(_context, _options) {
    const el = this.element;

    // Defensive: if _onRender were ever called again on this same
    // instance without an intervening close (not expected given how the
    // panel is opened/closed today — see darkness-slider.mjs — but cheap
    // to guard against), abort the PREVIOUS controller first. Otherwise
    // its listeners — including the global `document` mousedown listener
    // below — would be silently orphaned rather than removed, since only
    // the newest controller reference would be kept.
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

    const syncUI = (raw) => {
      const v = Math.max(0, Math.min(1, parseFloat(raw) || 0));
      this.#currentValue = v;
      if (slider) slider.value = v;
      if (numIn)  numIn.value  = v.toFixed(2);
      const pct = Math.round(v * 100);
      if (fill) fill.style.width = `${pct}%`;
      if (bar)  bar.title = `${pct}% darkness`;
    };

    el.querySelector(".jsd-close-btn")
      ?.addEventListener("click", () => this.close({ animate: false }), { signal });

    slider?.addEventListener("input", (e) => {
      const v = parseFloat(e.target.value);
      syncUI(v);
      if (this.#updateMode === "realtime") {
        clearTimeout(this.#debounceTimer);
        this.#previewDarkness(v);
        this.#debounceTimer = setTimeout(() => this.#applyDarkness(v), 250);
      }
    }, { signal });

    slider?.addEventListener("change", async (e) => {
      const v = parseFloat(e.target.value);
      syncUI(v);
      clearTimeout(this.#debounceTimer);
      if (this.#updateMode === "realtime") await this.#applyDarkness(v);
    }, { signal });

    numIn?.addEventListener("change", async (e) => {
      const v = Math.max(0, Math.min(1, parseFloat(e.target.value) || 0));
      syncUI(v);
      if (this.#updateMode === "realtime") await this.#applyDarkness(v);
    }, { signal });

    el.querySelector(".jsd-btn-apply")
      ?.addEventListener("click", async () => {
        await this.#applyDarkness(this.#currentValue);
        this.close({ animate: false });
      }, { signal });

    el.querySelector(".jsd-btn-cancel")
      ?.addEventListener("click", () => {
        this.#previewDarkness(this.#originalValue);
        this.close({ animate: false });
      }, { signal });

    // Click outside closes the panel
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
