/**
 * MacroLibrarySettings.mjs  —  v1.7.2
 *
 * Correções de sync:
 *   - Add / Remove: removidos os this.render() manuais; os hooks
 *     createMacro / deleteMacro acionados automaticamente atualizam a UI.
 *   - Descrição (blur): feedback visual (flash âmbar) confirma o salvamento.
 *     Rastreia o valor original com data-original para não sobrescrever
 *     descrições existentes com string vazia ao clicar acidentalmente.
 *   - Import / Reset: mantêm render manual imediato para feedback de progresso.
 *
 * Arquitetura de sync (v1.7.2):
 *   Compendium → UI: hooks createMacro / updateMacro / deleteMacro
 *                    (registrados em MacroLibraryFeature.initialize())
 *   UI → Compendium: operações de escrita aqui; hooks disparam o refresh.
 */

const { ApplicationV2 } = foundry.applications.api;

const MODULE  = "jack-small-details";
const PACK_ID = "jack-small-details.jsd-macros";

export class MacroLibrarySettings extends ApplicationV2 {

  static DEFAULT_OPTIONS = {
    id:       "jsd-macro-lib-settings",
    window:   { title: "JSD — Macro Library Manager", resizable: true },
    position: { width: 600, height: 680 },
  };

  // ── Render ─────────────────────────────────────────────────────────────────

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

    const packWarning = !pack
      ? `<div class="jsd-mls-warn">
           <i class="fa-solid fa-triangle-exclamation"></i>
           Compendium "jack-small-details.jsd-macros" not found.
           Verify module.json packs declaration and packs/jsd-macros/ directory.
         </div>`
      : "";

    const listHTML = macros.length === 0
      ? `<div class="jsd-mls-empty">
           <i class="fa-solid fa-inbox"></i><br>
           No macros yet. Drag any macro from the Macro Directory or Hotbar.
         </div>`
      : macros.map(m => `
          <div class="jsd-mls-row" data-id="${m.id}">
            <img class="jsd-mls-icon" src="${m.img}" alt="">
            <div class="jsd-mls-info">
              <div class="jsd-mls-name">
                ${m.name}
                ${m.native ? '<span class="jsd-mls-badge">JSD</span>' : ""}
              </div>
              <!-- data-original tracks the last-saved value to avoid
                   overwriting with empty string on accidental focus+blur. -->
              <div class="jsd-mls-desc"
                   contenteditable="true"
                   spellcheck="false"
                   data-id="${m.id}"
                   data-original="${m.description.replace(/"/g, "&quot;")}"
                   title="Click to edit description"
              >${m.description
                  ? m.description
                  : '<span class="jsd-mls-placeholder">no description — click to add</span>'
              }</div>
            </div>
            <button type="button" class="jsd-mls-remove" data-id="${m.id}" title="Remove from library">
              <i class="fa-solid fa-trash-can"></i>
            </button>
          </div>`
        ).join("");

    const div = document.createElement("div");
    div.id = "jsd-mls-root";
    div.innerHTML = `
      ${packWarning}

      <div class="jsd-mls-section-label">ADD MACROS</div>
      <div class="jsd-mls-dropzone" id="jsd-mls-dropzone">
        <i class="fa-solid fa-hand-holding-box"></i>
        <p>Drag a macro here to add it to the library</p>
        <small>From the Macro Directory sidebar or the Hotbar</small>
      </div>

      <div class="jsd-mls-section-label">
        LIBRARY
        <span class="jsd-mls-count">${macros.length} macro${macros.length !== 1 ? "s" : ""}</span>
      </div>
      <div class="jsd-mls-list" id="jsd-mls-list">${listHTML}</div>

      <div class="jsd-mls-section-label jsd-mls-section-export">
        EXPORT &amp; RESTORE
        <span class="jsd-mls-hint-inline">rollback automático em caso de falha</span>
      </div>
      <div class="jsd-mls-export-row">
        <button type="button" class="jsd-mls-action-btn jsd-mls-export-btn" id="jsd-mls-export">
          <i class="fa-solid fa-file-export"></i> Exportar Config
        </button>
        <button type="button" class="jsd-mls-action-btn jsd-mls-import-btn" id="jsd-mls-import">
          <i class="fa-solid fa-file-import"></i> Importar Config
        </button>
        <button type="button" class="jsd-mls-action-btn jsd-mls-reset-btn" id="jsd-mls-reset">
          <i class="fa-solid fa-rotate-left"></i> Reset ao Padrão
        </button>
      </div>
      <input type="file" id="jsd-mls-file" accept=".json" style="display:none">

      <div class="jsd-mls-footer-note">
        <i class="fa-solid fa-circle-info"></i>
        Flag de descrição: <code>jack-small-details.description</code>.
        O compendium é do módulo — persiste em todos os mundos.
        Alterações no compendium do Foundry são sincronizadas automaticamente.
      </div>
    `;
    return div;
  }

  _replaceHTML(result, content) { content.replaceChildren(result); }

  // ── Events ─────────────────────────────────────────────────────────────────

  async _onRender(_ctx, _opts) {
    const el = this.element;

    // Size management.
    requestAnimationFrame(() => {
      const content = el.querySelector(".window-content");
      const header  = el.querySelector(".window-header");
      const inner   = el.querySelector("#jsd-mls-root");
      if (!content || !inner) return;
      function applyH() {
        const avail = window.innerHeight - 40 - (header?.offsetHeight ?? 40);
        content.style.setProperty("height", `${Math.max(320, avail)}px`, "important");
        content.style.setProperty("overflow-y", "auto", "important");
      }
      applyH();
      new ResizeObserver(applyH).observe(inner);
    });

    // ── Drop zone ─────────────────────────────────────────────────────────────
    const dz = el.querySelector("#jsd-mls-dropzone");
    dz?.addEventListener("dragover",  (e) => { e.preventDefault(); dz.classList.add("drag-over"); });
    dz?.addEventListener("dragleave", () => dz.classList.remove("drag-over"));
    dz?.addEventListener("drop", async (e) => {
      e.preventDefault();
      dz.classList.remove("drag-over");
      let data;
      try { data = JSON.parse(e.dataTransfer.getData("text/plain") || "{}"); }
      catch { data = {}; }
      if (data.type !== "Macro") {
        ui.notifications.warn("Only macros can be added to the library.");
        return;
      }
      const macro = await fromUuid(data.uuid).catch(() => null);
      if (!macro) { ui.notifications.error("Macro not found."); return; }
      // _addMacro creates the document → fires createMacro hook → auto-refresh.
      await this._addMacro(macro);
      // No this.render() here — the hook handles it.
    });

    // ── Remove buttons ────────────────────────────────────────────────────────
    el.querySelectorAll(".jsd-mls-remove").forEach(btn => {
      btn.addEventListener("click", async () => {
        const pack = game.packs.get(PACK_ID);
        if (!pack) return;
        const doc  = await pack.getDocument(btn.dataset.id).catch(() => null);
        const name = doc?.name ?? "???";

        const ok = await foundry.applications.api.DialogV2.wait({
          window:  { title: "Confirmar Remoção" },
          content: `<p>Remover <strong>${name}</strong> da biblioteca?<br>
                    Não afeta a macro original no mundo.</p>`,
          buttons: [
            { action:"yes", label:"Remover", icon:"fas fa-trash", default:true, callback:()=>true  },
            { action:"no",  label:"Cancelar", callback:()=>false },
          ],
          rejectClose: false,
        });
        if (!ok) return;

        try {
          await pack.configure({ locked: false });
          await doc?.delete();
          // doc.delete() fires deleteMacro hook → auto-refresh via MacroLibraryFeature hooks.
        } catch (err) {
          ui.notifications.error(`Error removing: ${err.message}`);
        } finally {
          await pack.configure({ locked: true });
        }
      });
    });

    // ── Inline description editing ────────────────────────────────────────────
    el.querySelectorAll(".jsd-mls-desc[contenteditable]").forEach(descEl => {
      // On focus: clear the placeholder span so the user types into a clean field.
      // Store original value to detect no-op blurs.
      descEl.addEventListener("focus", () => {
        if (descEl.querySelector(".jsd-mls-placeholder")) {
          descEl.dataset.original = "";
          descEl.innerHTML = "";
        }
      });

      // On blur: save only if text changed, then flash amber to confirm.
      descEl.addEventListener("blur", async () => {
        const newDesc  = descEl.textContent.trim();
        const origDesc = descEl.dataset.original ?? "";

        // No change — restore placeholder if still empty.
        if (newDesc === origDesc) {
          if (!newDesc) {
            descEl.innerHTML = '<span class="jsd-mls-placeholder">no description — click to add</span>';
          }
          return;
        }

        const pack = game.packs.get(PACK_ID);
        if (!pack) return;

        try {
          await pack.configure({ locked: false });
          const macro = await pack.getDocument(descEl.dataset.id).catch(() => null);
          if (macro) {
            await macro.setFlag(MODULE, "description", newDesc);
            // Update the tracked original so a second blur is a no-op.
            descEl.dataset.original = newDesc;
            // Visual confirmation: brief amber flash.
            // The updateMacro hook (fired by setFlag) will also trigger a
            // debounced re-render of this settings window in ~300 ms.
            descEl.style.setProperty("background", "rgba(212,165,116,0.25)");
            descEl.style.setProperty("border-radius", "4px");
            setTimeout(() => {
              descEl.style.removeProperty("background");
              descEl.style.removeProperty("border-radius");
            }, 700);
          }
        } catch (err) {
          console.error("[JSD] description save:", err);
          ui.notifications.warn("JSD: Erro ao salvar descrição. Veja o console.");
          // Revert display to placeholder if the value is empty.
          if (!newDesc) {
            descEl.innerHTML = '<span class="jsd-mls-placeholder">no description — click to add</span>';
          }
        } finally {
          await pack.configure({ locked: true });
        }
      });

      // Enter = confirm, no newline.
      descEl.addEventListener("keydown", (e) => {
        if (e.key === "Enter") { e.preventDefault(); descEl.blur(); }
      });
    });

    // ── Export ────────────────────────────────────────────────────────────────
    el.querySelector("#jsd-mls-export")?.addEventListener("click", async () => {
      await this._exportConfig();
    });

    // ── Import ────────────────────────────────────────────────────────────────
    el.querySelector("#jsd-mls-import")?.addEventListener("click", () => {
      el.querySelector("#jsd-mls-file").click();
    });
    el.querySelector("#jsd-mls-file")?.addEventListener("change", async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      await this._importConfig(file);
      e.target.value = "";
      // Import does multiple creates → hooks trigger auto-refresh,
      // but we also render immediately for quick user feedback.
      this.render({ force: true });
    });

    // ── Reset to defaults ─────────────────────────────────────────────────────
    el.querySelector("#jsd-mls-reset")?.addEventListener("click", async () => {
      const ok = await foundry.applications.api.DialogV2.wait({
        window:  { title: "Reset ao Padrão" },
        content: `<p>Isso vai <strong>apagar todas as macros</strong> do compendium
                  e restaurar apenas as macros JSD originais.<br>
                  Macros adicionadas por você serão removidas.</p>
                  <p>Em caso de falha, o estado anterior é restaurado automaticamente.</p>`,
        buttons: [
          { action:"yes", label:"Resetar",  icon:"fas fa-rotate-left", default:true, callback:()=>true  },
          { action:"no",  label:"Cancelar", callback:()=>false },
        ],
        rejectClose: false,
      });
      if (!ok) return;
      await this._resetToDefaults();
      this.render({ force: true });
    });
  }

  // ── EXPORT ─────────────────────────────────────────────────────────────────

  async _exportConfig() {
    const pack     = game.packs.get(PACK_ID);
    const macros   = [];
    const settings = {};

    if (pack) {
      const docs = await pack.getDocuments();
      for (const doc of docs) macros.push(doc.toObject());
    }

    for (const [fullKey] of game.settings.settings) {
      if (!fullKey.startsWith(`${MODULE}.`)) continue;
      const key = fullKey.slice(MODULE.length + 1);
      if (["macroLib.seeded"].includes(key)) continue;
      try { settings[key] = game.settings.get(MODULE, key); } catch {}
    }

    const data = {
      _jsd: true,
      _version: game.modules.get(MODULE)?.version ?? "?",
      _exportedAt: new Date().toISOString(),
      settings,
      macros,
    };

    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = `jsd-config-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    ui.notifications.info(`JSD: Config exported (${macros.length} macro(s)).`);
  }

  // ── IMPORT (with rollback) ─────────────────────────────────────────────────

  async _importConfig(file) {
    let data;
    try {
      const text = await file.text();
      data = JSON.parse(text);
    } catch {
      ui.notifications.error("JSD: Invalid JSON file.");
      return;
    }

    if (!data._jsd || !Array.isArray(data.macros)) {
      ui.notifications.error("JSD: File is not a valid JSD config export.");
      return;
    }

    const pack = game.packs.get(PACK_ID);

    const existingDocs = pack ? await pack.getDocuments() : [];
    const backup       = existingDocs.map(d => d.toObject());

    try {
      if (pack) {
        await pack.configure({ locked: false });
        for (const doc of existingDocs) await doc.delete();
        for (const macroData of data.macros) {
          const d = { ...macroData }; delete d._id;
          await Macro.create(d, { pack: PACK_ID });
        }
        await pack.configure({ locked: true });
      }

      if (data.settings) {
        for (const [key, value] of Object.entries(data.settings)) {
          try { await game.settings.set(MODULE, key, value); } catch {}
        }
      }

      ui.notifications.info(`JSD: Imported ${data.macros.length} macro(s) successfully.`);
    } catch (err) {
      console.error("[JSD] Import failed — rolling back:", err);
      if (pack) {
        try {
          const partial = await pack.getDocuments();
          for (const d of partial) await d.delete();
          for (const bd of backup) {
            const r = { ...bd }; delete r._id;
            await Macro.create(r, { pack: PACK_ID });
          }
        } catch (rbErr) {
          console.error("[JSD] Rollback error:", rbErr);
        } finally {
          await pack.configure({ locked: true });
        }
      }
      ui.notifications.error("JSD: Import failed. Previous state restored automatically.");
    }
  }

  // ── RESET TO DEFAULTS (with rollback) ─────────────────────────────────────

  async _resetToDefaults() {
    const pack = game.packs.get(PACK_ID);

    const existingDocs = pack ? await pack.getDocuments() : [];
    const backup       = existingDocs.map(d => d.toObject());

    try {
      const resp = await fetch(`/modules/${MODULE}/packs/jsd-macros-seed.json`);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const { macros: seedMacros } = await resp.json();

      if (pack) {
        await pack.configure({ locked: false });
        for (const doc of existingDocs) await doc.delete();
        for (const data of seedMacros) await Macro.create(data, { pack: PACK_ID });
        await pack.configure({ locked: true });
      }

      await game.settings.set(MODULE, "macroLib.seeded", true);
      ui.notifications.info(`JSD: Compendium reset to defaults (${seedMacros.length} macros).`);
    } catch (err) {
      console.error("[JSD] Reset failed — rolling back:", err);
      if (pack) {
        try {
          const partial = await pack.getDocuments();
          for (const d of partial) await d.delete();
          for (const bd of backup) {
            const r = { ...bd }; delete r._id;
            await Macro.create(r, { pack: PACK_ID });
          }
        } catch (rbErr) {
          console.error("[JSD] Rollback error:", rbErr);
        } finally {
          await pack.configure({ locked: true });
        }
      }
      ui.notifications.error("JSD: Reset failed. Previous state restored automatically.");
    }
  }

  // ── Add macro helper ──────────────────────────────────────────────────────

  async _addMacro(macro) {
    const pack = game.packs.get(PACK_ID);
    if (!pack) { ui.notifications.error("Module compendium not found."); return false; }

    const index = await pack.getIndex();
    if (index.find(e => e.name === macro.name)) {
      ui.notifications.warn(`"${macro.name}" is already in the library.`);
      return false;
    }

    try {
      await pack.configure({ locked: false });
      const data = macro.toObject(); delete data._id;
      await Macro.create(data, { pack: PACK_ID });
      // createMacro hook fires automatically → MacroLibraryFeature refreshes UI.
      ui.notifications.info(`"${macro.name}" added to the Macro Library.`);
      return true;
    } catch (err) {
      console.error("[JSD] Add macro error:", err);
      ui.notifications.error(`Failed to add "${macro.name}": ${err.message}`);
      return false;
    } finally {
      await pack.configure({ locked: true });
    }
  }
}
