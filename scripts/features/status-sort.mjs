/**
 * status-sort.mjs
 * Feature: Sort Status Effects — sorts the Token HUD status effects palette
 * alphabetically within each group.
 *
 * DOM structure (Daggerheart, confirmed in live V14):
 *
 *   div.status-effects
 *     div.effect-control.effect-control-container  [data-tooltip-text="Vulnerable"]
 *     div.effect-control.effect-control-container  [data-tooltip-text="Hidden"]
 *     ...more system effects...
 *     label.palette-category-title                 "Foundry Effects"
 *     div.effect-control.effect-control-container  [data-tooltip-text="Asleep"]
 *     ...more core effects...
 *     div.clear-all                                "clear all"
 *
 * Algorithm: scans direct children, detects contiguous runs of
 * `.effect-control-container` elements, sorts each run independently by
 * `data-tooltip-text` (case-insensitive, locale-aware). Non-effect nodes
 * (LABEL separators, the clear-all button) act as group anchors and stay
 * in place. If a future system uses a different separator tag, no changes
 * needed — the detector is tag-agnostic.
 *
 * Scope "user": personal display preference, per user per world.
 * Reload required: the hook is registered once on ready.
 */

const MODULE = "jack-small-details";
const SETTING = "statusSort.enabled";

function sortEffectsInHUD(app, html) {
  const effectsEl = html.querySelector(".status-effects");
  if (!effectsEl) return;

  const isEffect = (el) => el.classList.contains("effect-control-container");
  const children = [...effectsEl.children];

  let i = 0;
  while (i < children.length) {
    // Skip non-effect nodes (labels, clear-all, etc.)
    if (!isEffect(children[i])) { i++; continue; }

    // Find the end of this contiguous run of effect elements.
    let j = i;
    while (j < children.length && isEffect(children[j])) j++;

    // Sort the run alphabetically by display name.
    const group = children.slice(i, j).sort((a, b) =>
      (a.dataset.tooltipText ?? "").localeCompare(
        b.dataset.tooltipText ?? "",
        undefined,
        { sensitivity: "base" }
      )
    );

    // Re-insert sorted elements before the anchor (next non-effect node,
    // or null to append). children[] is a snapshot so anchor is stable.
    const anchor = children[j] ?? null;
    for (const el of group) effectsEl.insertBefore(el, anchor);

    i = j;
  }
}

export const StatusSortFeature = {
  settingsGroup: {
    label: "JSD.Settings.StatusSort.Label",
    keys: [SETTING],
  },

  isEnabled() {
    return game.settings.get(MODULE, SETTING);
  },

  registerSettings() {
    game.settings.register(MODULE, SETTING, {
      name: "JSD.Settings.StatusSort.Label",
      hint: "JSD.Settings.StatusSort.Hint",
      scope: "user",
      config: true,
      type: Boolean,
      default: false,
      requiresReload: true,
    });
  },

  initialize() {
    Hooks.on("renderTokenHUD", sortEffectsInHUD);
  },
};
