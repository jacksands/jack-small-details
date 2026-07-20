/**
 * journal-scaler/reset-all-menu.js
 * Ported unchanged from journal-scaler-by-jack v1.4.1.
 */

import { loc } from "./constants.js";
import { resetAllStoredScales } from "./persistence.js";
import { getOpenJournalPageTargets, applyFontScale, applyImageScale } from "./scaling.js";

/**
 * Settings menu entries must open a real ApplicationV2 subclass. This one
 * renders nothing: it closes itself immediately and runs the reset
 * workflow instead — the same "menu triggers an action" pattern already
 * used elsewhere in this project (e.g. Scene Defaults' relay app).
 */
export class ResetAllScalesMenu extends foundry.applications.api.ApplicationV2 {
  static DEFAULT_OPTIONS = {
    id: "journal-scaler-reset-all",
    window: { title: "JOURNALSCALER.Settings.ResetAll.Name" }
  };

  async _renderHTML() {
    return null;
  }

  async _replaceHTML() {}

  async _onRender(_context, _options) {
    this.close({ animate: false });

    const confirmed = await foundry.applications.api.DialogV2.confirm({
      window: { title: loc("JOURNALSCALER.Settings.ResetAll.Name") },
      content: `<p>${loc("JOURNALSCALER.Settings.ResetAll.Confirm")}</p>`,
      modal: true
    });
    if (!confirmed) return;

    await resetAllStoredScales();

    // Also reset the live view of whatever is currently open — the
    // persisted store is cleared above, but open windows keep whatever
    // inline styles were already applied until something re-touches them.
    for (const { textBody } of getOpenJournalPageTargets()) {
      applyFontScale(textBody, 1);
      applyImageScale(textBody, 1);
    }

    ui.notifications.info(loc("JOURNALSCALER.Settings.ResetAll.Done"));
  }
}
