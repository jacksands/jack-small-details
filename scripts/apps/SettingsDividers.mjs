/**
 * SettingsDividers.mjs
 *
 * Foundry V14's SettingsConfig (now a CategoryBrowser) renders every
 * registered `game.settings.register` field and every `registerMenu`
 * button for a module into ONE flat list of `.form-group` elements inside
 * `section[data-category="<module-id>"]` — confirmed via a diagnostic
 * script run against a live V14 world (captured outerHTML), not just
 * reading the API docs, which only document class methods, not the
 * template markup.
 *
 * That flat list is ordered "all menus first (registration order), then
 * all settings (registration order)" — also confirmed the same way, not
 * assumed. This means settings and menus belonging to the same feature
 * (e.g. Journal Scaler's "Journal Scaler" toggle and its "Reset All"
 * menu button) always end up far apart, getting worse as more features
 * are added. There is no registration-order trick that fixes this,
 * because the type-based split happens before our code has any influence
 * over it — the only fix is physically reordering the rendered DOM nodes
 * after the fact.
 *
 * This module does exactly that: it moves each feature's `.form-group`
 * elements to sit contiguously, in the order each feature declares via
 * its own `settingsGroup.keys`, and injects a small header before each
 * group. `game.settings.registerMenu`'s "Instructions" entry is treated
 * as an ungrouped, header-less item pinned to the very top, since it's
 * general documentation for the whole module rather than one feature.
 */

const DIVIDER_CLASS = "jsd-settings-divider";

/**
 * @param {string} moduleId
 * @param {{settingsGroup?: {label: string, keys: string[]}}[]} features
 * @param {string[]} ungroupedFirstKeys - keys (without module prefix) shown
 *   before any feature group, with no header (e.g. "instructions").
 */
export function registerSettingsDividers(moduleId, features, ungroupedFirstKeys = []) {
  Hooks.on("renderApplicationV2", (app) => {
    if (!(app instanceof foundry.applications.settings.SettingsConfig)) return;
    applyDividers(app, moduleId, features, ungroupedFirstKeys);
  });
}

function applyDividers(app, moduleId, features, ungroupedFirstKeys) {
  const root = app.element;
  const section = root?.querySelector(`section[data-category="${moduleId}"]`);
  if (!section) return;

  // Idempotent: strip any dividers from a previous pass before rebuilding,
  // so re-renders (e.g. after changing a setting) never pile up duplicates.
  section.querySelectorAll(`.${DIVIDER_CLASS}`).forEach((el) => el.remove());

  const formGroups = Array.from(section.querySelectorAll(":scope > .form-group"));
  if (!formGroups.length) return;

  const byKey = new Map();
  for (const el of formGroups) {
    const key = extractKey(el, moduleId);
    if (key) byKey.set(key, el);
  }

  const fragment = document.createDocumentFragment();
  const placed = new Set();

  const place = (el, key) => {
    fragment.appendChild(el); // moves the live node out of `section`
    placed.add(key);
  };

  // 1. Ungrouped items first (e.g. "Instructions") — no header.
  for (const key of ungroupedFirstKeys) {
    const el = byKey.get(key);
    if (el) place(el, key);
  }

  // 2. One block per feature, in FEATURES array order, each preceded by a
  //    header. A feature with no settingsGroup, or whose keys aren't
  //    present (e.g. a required setting failed to register), is skipped
  //    silently rather than producing an empty header.
  for (const feature of features) {
    const group = feature.settingsGroup;
    if (!group) continue;

    const groupEls = group.keys
      .map((key) => [key, byKey.get(key)])
      .filter(([, el]) => Boolean(el));
    if (!groupEls.length) continue;

    const header = document.createElement("div");
    header.className = DIVIDER_CLASS;
    header.innerHTML = `<hr><h3>${game.i18n.localize(group.label)}</h3>`;
    fragment.appendChild(header);

    for (const [key, el] of groupEls) place(el, key);
  }

  // 3. Anything left over (future settings not yet added to a
  //    settingsGroup, or unrecognized third-party injections into this
  //    same category) — appended as-is, in original relative order, so
  //    nothing is ever silently dropped from the Settings page.
  for (const el of formGroups) {
    if (!fragment.contains(el)) fragment.appendChild(el);
  }

  section.appendChild(fragment);
}

/** @returns {string|null} the setting/menu key with the module prefix stripped, or null. */
function extractKey(formGroupEl, moduleId) {
  const prefix = `${moduleId}.`;

  const input = formGroupEl.querySelector("[name]");
  if (input?.name?.startsWith(prefix)) return input.name.slice(prefix.length);

  const menuButton = formGroupEl.querySelector("[data-key]");
  if (menuButton?.dataset?.key?.startsWith(prefix)) return menuButton.dataset.key.slice(prefix.length);

  return null;
}
