/**
 * module-filter.mjs — Feature: Settings Module Filter
 *
 * Foundry's native Settings search box (top of the sidebar) searches
 * setting names/hints and highlights matching module categories, but it
 * never hides anything from the category list itself — confirmed by
 * inspecting a live V14 world: typing a term that matches zero settings
 * in every category just shows "[0]" everywhere, nothing disappears.
 *
 * This feature adds a SECOND search field directly below the native one
 * that does the opposite job on purpose: it hides every category button
 * in the sidebar whose visible module name doesn't contain the typed
 * text, ignoring settings content entirely. Useful once a world has many
 * modules installed and the sidebar list gets long — e.g. typing "jack"
 * leaves only "Jack Small Details" visible in the list.
 */

const MODULE = "jack-small-details";
const SETTING_ENABLED = "moduleFilter.enabled";
const FILTER_CLASS = "jsd-module-filter";

function getCategoryButtons(sidebar) {
  return Array.from(sidebar.querySelectorAll("nav.tabs > button[data-tab]"));
}

function applyFilter(sidebar, rawTerm) {
  const term = rawTerm.trim().toLowerCase();
  for (const btn of getCategoryButtons(sidebar)) {
    // The category's visible name is the first <span> that isn't the
    // "[N]" count badge — confirmed structure: <button><span>Name</span>
    // <span class="count">[N]</span></button>.
    const label = btn.querySelector("span:not(.count)")?.textContent?.trim().toLowerCase() ?? "";
    const matches = !term || label.includes(term);
    btn.style.display = matches ? "" : "none";
  }
}

/**
 * Injected fresh on every SettingsConfig render, and always starts
 * empty — the typed filter text is intentionally NOT remembered between
 * openings of the Settings window (confirmed preference).
 */
function injectModuleFilter(app) {
  if (!(app instanceof foundry.applications.settings.SettingsConfig)) return;

  const sidebar = app.element?.querySelector('aside[data-application-part="sidebar"]');
  const nativeSearch = sidebar?.querySelector("search");
  if (!sidebar || !nativeSearch) return;

  // Idempotent: drop any previous copy before re-adding, so a re-render
  // never ends up with two filter fields stacked on top of each other.
  sidebar.querySelector(`.${FILTER_CLASS}`)?.remove();

  const placeholder = game.i18n.localize("JSD.ModuleFilter.Placeholder");

  const wrapper = document.createElement("search");
  wrapper.className = FILTER_CLASS;
  wrapper.innerHTML = `<input type="search" placeholder="${placeholder}" aria-label="${placeholder}" autocomplete="off" spellcheck="false">`;

  // Reuses the <search> tag (same as Foundry's native one) so it inherits
  // the same core styling for free — only spacing needs a small CSS rule.
  nativeSearch.insertAdjacentElement("afterend", wrapper);

  wrapper.querySelector("input").addEventListener("input", (event) => {
    applyFilter(sidebar, event.currentTarget.value);
  });
}

export const ModuleFilterFeature = {
  settingsGroup: {
    label: "JSD.Settings.ModuleFilter.Label",
    keys: [SETTING_ENABLED],
  },

  isEnabled() {
    try { return game.settings.get(MODULE, SETTING_ENABLED); } catch { return true; }
  },

  registerSettings() {
    game.settings.register(MODULE, SETTING_ENABLED, {
      name: "JSD.Settings.ModuleFilter.Label",
      hint: "JSD.Settings.ModuleFilter.Hint",
      scope: "client",
      config: true,
      type: Boolean,
      default: true,
      requiresReload: true,
    });
  },

  initialize() {
    Hooks.on("renderApplicationV2", injectModuleFilter);
  },
};
