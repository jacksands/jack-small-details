/**
 * MacroLibraryPanel.mjs — v1.7.0
 * PACK_ID atualizado para "jack-small-details.jsd-macros" (module pack).
 */

import { MacroLibrarySettings } from "./MacroLibrarySettings.mjs";

const { ApplicationV2 } = foundry.applications.api;

const MODULE  = "jack-small-details";
const PACK_ID = "jack-small-details.jsd-macros";   // module pack (cross-world)

export class MacroLibraryPanel extends ApplicationV2 {

  static DEFAULT_OPTIONS = {
    id:       "jsd-macro-lib-panel",
    window:   { frame: false },
    position: { width: 320, height: "auto" },
    classes:  ["jsd-macro-lib-panel"],
  };

  #trigger = null;
  #abort   = null;

  constructor(options = {}) {
    super(options);
    this.#trigger = options.triggerElement ?? null;
  }

  async _renderHTML(_ctx, _opts) {
    const pack   = game.packs.get(PACK_ID);
    let   macros = [];

    if (pack) {
      const docs = await pack.getDocuments();
      macros = docs.map(m => ({
        id:          m.id,
        name:        m.name,
        img:         m.img || "icons/svg/d20-black.svg",
        description: m.getFlag(MODULE, "description") ?? "",
        native:      m.getFlag(MODULE, "native") ?? false,
      }));
    }

    const noPackMsg = !pack
      ? `<div class="jsd-ml-panel-empty">
           Module compendium not found.<br>Reload the world.
         </div>`
      : "";

    const listHTML = macros.length === 0 && pack
      ? `<div class="jsd-ml-panel-empty">
           No macros yet.<br>
           Use <em>Manage Library</em> to add some.
         </div>`
      : macros.map(m => `
          <div class="jsd-ml-panel-row">
            <img class="jsd-ml-panel-icon" src="${m.img}" alt="">
            <div class="jsd-ml-panel-info">
              <div class="jsd-ml-panel-name">
                ${m.name}${m.native ? ' <span class="jsd-ml-badge">JSD</span>' : ""}
              </div>
              ${m.description ? `<div class="jsd-ml-panel-desc">${m.description}</div>` : ""}
            </div>
            <button type="button" class="jsd-ml-panel-run" data-id="${m.id}" title="Execute">
              <i class="fa-solid fa-play"></i>
            </button>
          </div>`
        ).join("");

    const div = document.createElement("div");
    div.innerHTML = `
      <div class="jsd-ml-panel-header">
        <i class="fa-solid fa-code"></i>
        <span class="jsd-ml-panel-title">MACRO LIBRARY</span>
        <button type="button" class="jsd-ml-panel-close">
          <i class="fa-solid fa-xmark"></i>
        </button>
      </div>
      <div class="jsd-ml-panel-body">${noPackMsg}${listHTML}</div>
      ${game.user.isGM ? `
        <div class="jsd-ml-panel-footer">
          <button type="button" class="jsd-ml-panel-manage">
            <i class="fa-solid fa-gear"></i> Manage Library
          </button>
        </div>` : ""}
    `;
    return div;
  }

  _replaceHTML(result, content) { content.replaceChildren(result); }

  async _onRender(_ctx, _opts) {
    const el  = this.element;
    this.#abort?.abort();
    this.#abort = new AbortController();
    const sig = this.#abort.signal;

    if (this.#trigger) {
      const r = this.#trigger.getBoundingClientRect();
      this.setPosition({ left: r.right + 8, top: Math.max(r.top - 8, 4) });
    }

    el.querySelector(".jsd-ml-panel-close")
      ?.addEventListener("click", () => this.close({ animate: false }), { signal: sig });

    el.querySelector(".jsd-ml-panel-manage")
      ?.addEventListener("click", () => {
        this.close({ animate: false });
        new MacroLibrarySettings().render({ force: true });
      }, { signal: sig });

    el.querySelectorAll(".jsd-ml-panel-run").forEach(btn => {
      btn.addEventListener("click", async () => {
        const pack = game.packs.get(PACK_ID);
        if (!pack) { ui.notifications.warn("Macro library not found."); return; }
        try {
          const macro = await pack.getDocument(btn.dataset.id);
          if (!macro) { ui.notifications.error("Macro not found."); return; }
          await macro.execute();
        } catch (err) {
          console.error("[JSD] Macro error:", err);
          ui.notifications.error(`Macro error: ${err.message}`);
        }
      }, { signal: sig });
    });

    setTimeout(() => {
      if (sig.aborted) return;
      document.addEventListener("mousedown", (e) => {
        if (!el.contains(e.target) && !this.#trigger?.contains(e.target))
          this.close({ animate: false });
      }, { signal: sig });
    }, 120);
  }

  async _onClose() { this.#abort?.abort(); this.#abort = null; }
}
