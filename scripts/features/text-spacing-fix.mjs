/**
 * text-spacing-fix.mjs
 * Feature: Fix Blank Line Spacing — preserves visible blank lines in
 * rendered (non-editing) rich text, instead of Foundry's default of
 * collapsing empty <p></p> elements to zero height.
 *
 * Inspired by the "Fix Journal Spacing" setting in the MD Madness module
 * (confirmed present there, journal-only, client-scoped). This is a
 * broadened port — Option A discussed in chat:
 *
 *   1. Scope changed from "client" to "world". This is a shared *display
 *      policy* (Erich's explicit requirement: "todo mundo ver igual"), not
 *      a personal reading preference like Journal Scaler's per-user zoom —
 *      see LEARNINGS #030's scope decision guide. World scope also means
 *      Foundry broadcasts the change live to every connected client via
 *      its own settings socket, so no extra sync code is needed for
 *      "everyone sees it update immediately when the GM toggles it".
 *   2. Selector coverage widened from journal-only to also include the
 *      generic `.editor-content` wrapper (Actor/Item sheet description
 *      fields, and anywhere else `TextEditor.enrichHTML()` output is
 *      displayed through Foundry's standard editor component) and chat
 *      message content (`.message-content`).
 *
 * Confidence note (Erich: please confirm live before relying on this):
 *   `.journal-entry-page .journal-page-content` is confirmed working in
 *   MD Madness in production. `.editor-content` and `.message-content` are
 *   the standard Foundry class names for those areas per common convention,
 *   but were NOT individually verified against a live V14 DOM in this
 *   session — if blank lines still collapse in a specific sheet or chat
 *   card, inspect that element in devtools and tell me the actual class so
 *   I can add the exact selector rather than guessing further.
 *
 * Pure CSS — never touches saved document content. No reload required;
 * toggling the setting applies instantly for every connected client.
 */

const MODULE = "jack-small-details";
const SETTING = "textSpacingFix.enabled";
const BODY_CLASS = "jsd-fix-text-spacing";

function applyBodyClass(enabled) {
  document.body.classList.toggle(BODY_CLASS, !!enabled);
}

export const TextSpacingFixFeature = {
  settingsGroup: {
    label: "JSD.Settings.TextSpacingFix.Label",
    keys: [SETTING],
  },

  // Unlike GM Vision's enabled/active split, this feature has a single
  // setting that already IS the on/off switch (via the body class in CSS).
  // main.mjs only calls initialize() when isEnabled() is truthy, so this
  // must always return true — otherwise initialize() (which applies the
  // body class, including turning it OFF) would never run at all.
  isEnabled() {
    return true;
  },

  registerSettings() {
    game.settings.register(MODULE, SETTING, {
      name: "JSD.Settings.TextSpacingFix.Label",
      hint: "JSD.Settings.TextSpacingFix.Hint",
      scope: "world",
      config: true,
      type: Boolean,
      default: true,
      requiresReload: false,
      onChange: applyBodyClass,
    });
  },

  initialize() {
    applyBodyClass(game.settings.get(MODULE, SETTING));
  },
};
