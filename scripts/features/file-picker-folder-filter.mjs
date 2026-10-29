/**
 * file-picker-folder-filter.mjs — Feature: File Picker "Filter folders" field
 *
 * Foundry's native File Picker filter ("Filter Results") filters BOTH the
 * folder list and the file list, and its text stays in place when you open
 * another folder. This feature adds a SECOND field right next to it
 * (side by side, splitting the same row in two) that:
 *   - hides only FOLDERS (left pane) whose name doesn't contain the text
 *     (case-insensitive), never files;
 *   - clears itself automatically whenever you open a folder, so you can
 *     filter again inside the new folder.
 * The native filter is left active and untouched (same element, same
 * listeners — it is only moved into a flex wrapper).
 *
 * DOM ASSUMPTIONS (not captured from a live world, so every lookup is
 * defensive and logs a warning with what it found instead of failing
 * silently):
 *   - app id "file-picker" (confirmed), parts: tabs, subheader, body,
 *     subfooter, footer (confirmed).
 *   - native filter:  input[name="filter"]  (fallback: input[type="search"]
 *     inside the subheader part).
 *   - folder list:    ul.directory > li     (matches the user's existing
 *     Custom CSS for "#file-picker ul.directory").
 */

const MODULE = "jack-small-details";
const SETTING_ENABLED = "filePickerFolderFilter.enabled";
const ROW_CLASS = "jsd-fpff-row";
const INPUT_CLASS = "jsd-fpff-input";
const HIDDEN_CLASS = "jsd-fpff-hidden";
const BOUND_FLAG = "jsdFpffBound";
const LOG = "jack-small-details | File Picker Folder Filter:";

/** Last seen folder per FilePicker instance, to detect navigation. */
const STATE = new WeakMap();
/** Instances we already warned about, to avoid console spam on re-render. */
const WARNED = new WeakSet();

function warnOnce(app, message, details) {
  if (WARNED.has(app)) return;
  WARNED.add(app);
  console.warn(`${LOG} ${message}`, details ?? "");
}

function findNativeFilter(root) {
  return (
    root.querySelector(`input[name="filter"]:not(.${INPUT_CLASS})`) ??
    root.querySelector(`[data-application-part="subheader"] input[type="search"]:not(.${INPUT_CLASS})`)
  );
}

function getFolderItems(root) {
  const direct = root.querySelectorAll("ul.directory > li");
  return direct.length ? direct : root.querySelectorAll("ul.directory li");
}

/** Lowercase + literal "%20" read as a space, so "mana crystal" finds "Mana%20Crystal". */
function normalize(text) {
  return (text ?? "").replace(/%20/gi, " ").trim().toLowerCase();
}

function applyFilter(root, rawTerm) {
  const term = normalize(rawTerm);
  for (const li of getFolderItems(root)) {
    const name = normalize(li.textContent);
    li.classList.toggle(HIDDEN_CLASS, Boolean(term) && !name.includes(term));
  }
}

function currentTarget(app) {
  try {
    return (
      app.target ??
      app.result?.target ??
      app.element?.querySelector('input[name="target"]')?.value ??
      null
    );
  } catch {
    return null;
  }
}

/**
 * Builds (once) a flex row holding the native filter input plus our own.
 * Our input is a shallow clone of the native one so it inherits the exact
 * same core styling; id/name are stripped so no form handler or
 * SearchFilter ever picks it up.
 */
function ensureField(app) {
  const root = app.element;
  const native = findNativeFilter(root);
  if (!native) {
    warnOnce(app, "native filter input not found, field not injected. Inputs found:",
      Array.from(root.querySelectorAll("input")).map((i) => `${i.name}|${i.type}|${i.placeholder}`));
    return null;
  }

  let row = native.closest(`.${ROW_CLASS}`);
  if (!row) {
    row = document.createElement("div");
    row.className = ROW_CLASS;
    native.before(row);
    row.append(native); // moved, not cloned: native listeners survive
  }

  let input = row.querySelector(`.${INPUT_CLASS}`);
  if (!input) {
    const placeholder = game.i18n.localize("JSD.FilePickerFolderFilter.Placeholder");
    input = native.cloneNode(false);
    input.removeAttribute("id");
    input.removeAttribute("name");
    input.removeAttribute("autofocus");
    input.value = "";
    input.placeholder = placeholder;
    input.setAttribute("aria-label", placeholder);
    input.setAttribute("autocomplete", "off");
    input.setAttribute("spellcheck", "false");
    input.classList.add(INPUT_CLASS);
    input.addEventListener("input", () => applyFilter(app.element, input.value));
    input.addEventListener("keydown", (event) => {
      if (event.key !== "Escape" || !input.value) return;
      event.stopPropagation(); // don't let Escape close the whole picker
      input.value = "";
      applyFilter(app.element, "");
    });
    row.append(input);
  }
  return input;
}

/** Clears the field as soon as a folder entry is clicked (before re-render). */
function bindClearOnFolderClick(app) {
  const root = app.element;
  if (root.dataset[BOUND_FLAG]) return;
  root.dataset[BOUND_FLAG] = "1";
  root.addEventListener("click", (event) => {
    if (!event.target.closest?.("ul.directory li")) return;
    const input = root.querySelector(`.${INPUT_CLASS}`);
    if (!input?.value) return;
    input.value = "";
    applyFilter(root, "");
  });
}

function onRender(app) {
  try {
    const FilePicker = foundry.applications.apps?.FilePicker;
    if (!FilePicker || !(app instanceof FilePicker)) return;

    const input = ensureField(app);
    if (!input) return;
    bindClearOnFolderClick(app);

    // Navigation detected between renders (covers the case where only the
    // body part re-rendered and our input, living in the subheader, survived).
    const target = currentTarget(app);
    const previous = STATE.get(app);
    if (previous && previous.target !== target) input.value = "";
    STATE.set(app, { target });

    if (!getFolderItems(app.element).length) {
      warnOnce(app, "no folder entries matched 'ul.directory li'; filter has nothing to act on yet.");
    }
    // Re-apply: a body re-render recreates the <li> and drops our hidden class.
    applyFilter(app.element, input.value);
  } catch (err) {
    console.error(`${LOG} render handler failed:`, err);
  }
}

export const FilePickerFolderFilterFeature = {
  settingsGroup: {
    label: "JSD.Settings.FilePickerFolderFilter.Label",
    keys: [SETTING_ENABLED],
  },

  isEnabled() {
    try { return game.settings.get(MODULE, SETTING_ENABLED); } catch { return true; }
  },

  registerSettings() {
    game.settings.register(MODULE, SETTING_ENABLED, {
      name: "JSD.Settings.FilePickerFolderFilter.Label",
      hint: "JSD.Settings.FilePickerFolderFilter.Hint",
      scope: "client",
      config: true,
      type: Boolean,
      default: true,
      requiresReload: true,
    });
  },

  initialize() {
    Hooks.on("renderApplicationV2", onRender);
  },
};
