/**
 * file-picker-space-display.mjs — Feature: show spaces instead of "%20"
 *
 * Foundry stores and serves paths URL-encoded ("Infused%20Mana%20Crystal").
 * This feature changes ONLY what is displayed. Nothing in the data layer is
 * touched: paths, data-* attributes, setting values and every input's real
 * `value` keep "%20", so other modules and Foundry's own navigation/saving
 * keep working exactly as before.
 *
 * Two display-only mechanisms:
 *   A) File Browser window (FilePicker): visible text nodes (favorites,
 *      folder/file names) and title/data-tooltip attributes are rewritten;
 *      originals are remembered and restored when the feature is turned off.
 *   B) Text inputs that hold a path (the "Tile Image or Video" style fields,
 *      i.e. any <input> inside a <file-picker> element in ANY window, plus
 *      the text inputs of the File Browser itself): the input is NEVER
 *      edited. While it is not focused its text is made transparent and a
 *      non-interactive overlay <span> draws the same text with spaces on top.
 *      Focusing the field removes the overlay so you edit/see the real value.
 *      Because `input.value` is never written, saving a document can only
 *      ever submit the real "%20" path.
 *
 * Live on/off (all write the same user setting, all apply instantly):
 *   1) JSD setting "File Picker: Show Spaces Instead of %20"
 *   2) toggle button in the File Browser window header
 *   3) toggle tool in the JSD Panel (Scene Controls)
 *
 * DOM ASSUMPTIONS (not captured from a live world; guarded and logged):
 *   - the File Browser frame has a `.window-header`;
 *   - path fields are `<input>` inside a `<file-picker>` custom element;
 *   - the JSD Panel is the scene-controls group `jsd` (macro-library.mjs).
 */

const MODULE = "jack-small-details";
const SETTING_ENABLED = "filePickerSpaceDisplay.enabled";
const TOOL_NAME = "jsd-fp-space-display";
const TOGGLE_CLASS = "jsd-fpsd-toggle";
const ON_CLASS = "jsd-fpsd-on";
const LOG = "jack-small-details | File Picker Space Display:";

const OVERLAY_CLASS = "jsd-fpsd-overlay";
const MASK_CLASS = "jsd-fpsd-masked";
const PARENT_POS_KEY = "jsdFpsdPos";
const BOUND_KEY = "jsdFpsdBound";
const TEXT_INPUT_TYPES = new Set(["", "text", "search"]);

const PATTERN = /%20/g;
const SKIP_TAGS = new Set(["INPUT", "TEXTAREA", "SELECT", "OPTION", "SCRIPT", "STYLE"]);

/** Text node -> original string. */
const TEXT_ORIGINALS = new WeakMap();
/** Element -> { title, tooltip } originals. */
const ATTR_ORIGINALS = new WeakMap();
/** FilePicker app -> MutationObserver. */
const OBSERVERS = new WeakMap();
/** input -> { overlay, observer } for inputs currently masked. */
const MASKS = new WeakMap();
/** Apps already logged / warned about. */
const LOGGED = new WeakSet();
const WARNED = new WeakSet();

function isOn() {
  try { return game.settings.get(MODULE, SETTING_ENABLED); } catch { return true; }
}

function warnOnce(app, message, details) {
  if (WARNED.has(app)) return;
  WARNED.add(app);
  console.warn(`${LOG} ${message}`, details ?? "");
}

function getApps() {
  const apps =
    foundry.applications.api.ApplicationV2.instances?.() ??
    foundry.applications.instances?.values?.() ??
    [];
  return [...apps];
}

function isFilePickerApp(app) {
  const FilePicker = foundry.applications.apps?.FilePicker;
  return Boolean(FilePicker && app instanceof FilePicker);
}

/* -------------------------------------------- */
/* Conversion (display only)                    */
/* -------------------------------------------- */

function convertTextNode(node) {
  const value = node.nodeValue;
  if (!value || !value.includes("%20")) return 0;
  if (node.parentElement && SKIP_TAGS.has(node.parentElement.tagName)) return 0;
  // A node still containing "%20" is raw by definition, so always refresh the
  // stored original (covers content rewritten by core/other modules later).
  TEXT_ORIGINALS.set(node, value);
  node.nodeValue = value.replace(PATTERN, " ");
  return 1;
}

function convertAttrs(el) {
  let changed = 0;
  const title = el.getAttribute("title");
  const tip = el.getAttribute("data-tooltip");
  const hasTitle = title?.includes("%20");
  const hasTip = tip?.includes("%20");
  if (!hasTitle && !hasTip) return 0;
  const saved = ATTR_ORIGINALS.get(el) ?? {};
  if (hasTitle) {
    saved.title = title;
    el.setAttribute("title", title.replace(PATTERN, " "));
    changed++;
  }
  if (hasTip) {
    saved.tooltip = tip;
    el.setAttribute("data-tooltip", tip.replace(PATTERN, " "));
    changed++;
  }
  ATTR_ORIGINALS.set(el, saved);
  return changed;
}

/** Converts a node and everything under it. Returns how many things changed. */
function convertSubtree(node) {
  let changed = 0;
  if (node.nodeType === Node.TEXT_NODE) return convertTextNode(node);
  if (node.nodeType !== Node.ELEMENT_NODE) return 0;

  changed += convertAttrs(node);
  for (const el of node.querySelectorAll("[title*='%20'], [data-tooltip*='%20']")) {
    changed += convertAttrs(el);
  }
  const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
  let current = walker.nextNode();
  while (current) {
    changed += convertTextNode(current);
    current = walker.nextNode();
  }
  return changed;
}

/**
 * Restores originals. A node is only restored if its current value is still
 * what we wrote, so content that something else rewrote in the meantime is
 * never clobbered.
 */
function restoreSubtree(root) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let current = walker.nextNode();
  while (current) {
    const original = TEXT_ORIGINALS.get(current);
    if (original !== undefined && original.replace(PATTERN, " ") === current.nodeValue) {
      current.nodeValue = original;
    }
    TEXT_ORIGINALS.delete(current);
    current = walker.nextNode();
  }
  for (const el of root.querySelectorAll("[title], [data-tooltip]")) {
    const saved = ATTR_ORIGINALS.get(el);
    if (!saved) continue;
    if (saved.title !== undefined && el.getAttribute("title") === saved.title.replace(PATTERN, " ")) {
      el.setAttribute("title", saved.title);
    }
    if (saved.tooltip !== undefined && el.getAttribute("data-tooltip") === saved.tooltip.replace(PATTERN, " ")) {
      el.setAttribute("data-tooltip", saved.tooltip);
    }
    ATTR_ORIGINALS.delete(el);
  }
}

/* -------------------------------------------- */
/* Input masking (overlay, never edits value)   */
/* -------------------------------------------- */

/** Is this input one we may mask in this app? */
function inScope(input, app) {
  if (!(input instanceof HTMLInputElement)) return false;
  if (!TEXT_INPUT_TYPES.has(input.type)) return false;
  if (input.classList.contains("jsd-fpff-input") || input.name === "filter") return false;
  return isFilePickerApp(app) || Boolean(input.closest("file-picker"));
}

function layoutOverlay(input, overlay) {
  const cs = getComputedStyle(input);
  const st = overlay.style;
  st.left = `${input.offsetLeft}px`;
  st.top = `${input.offsetTop}px`;
  st.width = `${input.offsetWidth}px`;
  st.height = `${input.offsetHeight}px`;
  st.lineHeight = `${input.offsetHeight}px`;
  st.paddingLeft = cs.paddingLeft;
  st.paddingRight = cs.paddingRight;
  st.borderLeft = `${cs.borderLeftWidth} solid transparent`;
  st.borderRight = `${cs.borderRightWidth} solid transparent`;
  st.font = cs.font;
  st.letterSpacing = cs.letterSpacing;
  st.textAlign = cs.textAlign;
  st.color = cs.color;
}

function maskInput(input) {
  let entry = MASKS.get(input);
  if (!entry) {
    const parent = input.parentElement;
    if (!parent) return;
    // Overlay must live in the same scroll/positioning context as the input,
    // otherwise it would stay put while a scrolled form moves under it.
    const parentPosition = getComputedStyle(parent).position;
    if (!(PARENT_POS_KEY in parent.dataset) && (parentPosition === "static" || parentPosition === "")) {
      parent.dataset[PARENT_POS_KEY] = parent.style.position;
      parent.style.position = "relative";
    }
    const overlay = document.createElement("span");
    overlay.className = OVERLAY_CLASS;
    overlay.setAttribute("aria-hidden", "true");
    input.after(overlay);
    // Keeps geometry right when a hidden tab becomes visible or the window resizes.
    const observer = new ResizeObserver(() => layoutOverlay(input, overlay));
    observer.observe(input);
    observer.observe(parent);
    entry = { overlay, observer };
    MASKS.set(input, entry);
  }
  entry.overlay.textContent = input.value.replace(PATTERN, " ");
  layoutOverlay(input, entry.overlay);
  input.classList.add(MASK_CLASS);
}

function unmaskInput(input) {
  const entry = MASKS.get(input);
  input.classList.remove(MASK_CLASS);
  if (!entry) return;
  entry.observer.disconnect();
  entry.overlay.remove();
  MASKS.delete(input);
  const parent = input.parentElement;
  if (parent && PARENT_POS_KEY in parent.dataset && !parent.querySelector(`.${OVERLAY_CLASS}`)) {
    parent.style.position = parent.dataset[PARENT_POS_KEY];
    delete parent.dataset[PARENT_POS_KEY];
  }
}

/** Masks/unmasks one input according to the current state. Returns 1 if masked. */
function refreshInput(input, app) {
  const shouldMask =
    isOn() &&
    inScope(input, app) &&
    document.activeElement !== input &&
    input.value.includes("%20");
  if (shouldMask) { maskInput(input); return 1; }
  unmaskInput(input);
  return 0;
}

function refreshInputsIn(node, app) {
  if (node.nodeType !== Node.ELEMENT_NODE) return 0;
  let masked = 0;
  if (node instanceof HTMLInputElement) masked += refreshInput(node, app);
  for (const input of node.querySelectorAll("input")) masked += refreshInput(input, app);
  return masked;
}

function unmaskAll(root) {
  for (const input of root.querySelectorAll(`input.${MASK_CLASS}`)) unmaskInput(input);
}

/** One delegated set of listeners per window element. */
function bindInputEvents(app) {
  const root = app.element;
  if (root.dataset[BOUND_KEY]) return;
  root.dataset[BOUND_KEY] = "1";
  root.addEventListener("focusin", (event) => {
    if (event.target instanceof HTMLInputElement) unmaskInput(event.target);
  });
  root.addEventListener("focusout", (event) => {
    if (event.target instanceof HTMLInputElement) refreshInput(event.target, app);
  });
  // A <file-picker> element fires "change" after choosing a file, without
  // focus changes, so re-evaluate its input one tick later.
  root.addEventListener("change", (event) => {
    const target = event.target;
    setTimeout(() => {
      if (target instanceof Element) refreshInputsIn(target, app);
    }, 0);
  });
}

/* -------------------------------------------- */
/* Per-picker lifecycle                         */
/* -------------------------------------------- */

function startObserver(app) {
  if (OBSERVERS.has(app)) return;
  const observer = new MutationObserver((mutations) => {
    if (!isOn()) return;
    const fp = isFilePickerApp(app);
    // Our own edits re-enter here, but they no longer contain "%20" (and the
    // overlay is already in place), so the handlers are no-ops and it settles.
    for (const mutation of mutations) {
      if (mutation.type === "characterData") {
        if (fp) convertTextNode(mutation.target);
      } else if (mutation.type === "attributes") {
        if (fp) convertAttrs(mutation.target);
      } else {
        mutation.addedNodes.forEach((node) => {
          if (fp) convertSubtree(node);
          refreshInputsIn(node, app);
        });
      }
    }
  });
  observer.observe(app.element, {
    childList: true,
    subtree: true,
    characterData: true,
    attributes: true,
    attributeFilter: ["title", "data-tooltip"],
  });
  OBSERVERS.set(app, observer);
}

function stopObserver(app) {
  OBSERVERS.get(app)?.disconnect();
  OBSERVERS.delete(app);
}

/** Does this window have anything this feature handles? */
function isRelevant(app) {
  return isFilePickerApp(app) || Boolean(app.element?.querySelector("file-picker"));
}

function applyToApp(app, { reason } = {}) {
  const root = app.element;
  if (!root || !isRelevant(app)) return;
  const fp = isFilePickerApp(app);
  if (isOn()) {
    const converted = fp ? convertSubtree(root) : 0;
    const masked = refreshInputsIn(root, app);
    startObserver(app);
    if (!LOGGED.has(app) || reason === "toggle") {
      LOGGED.add(app);
      console.log(`${LOG} ON (${reason ?? "render"}) in "${app.id}": ${converted} text/attribute item(s) converted, ${masked} input(s) masked.`);
    }
  } else {
    stopObserver(app);
    if (fp) restoreSubtree(root);
    unmaskAll(root);
    if (reason === "toggle") console.log(`${LOG} OFF in "${app.id}": originals restored, input overlays removed.`);
  }
}

/* -------------------------------------------- */
/* Toggle UI: window header button + scene tool */
/* -------------------------------------------- */

function updateHeaderToggle(btn) {
  const on = isOn();
  btn.classList.toggle(ON_CLASS, on);
  btn.setAttribute("aria-pressed", String(on));
  const label = game.i18n.localize(on ? "JSD.FilePickerSpaceDisplay.TooltipOn" : "JSD.FilePickerSpaceDisplay.TooltipOff");
  btn.dataset.tooltip = label;
  btn.setAttribute("aria-label", label);
}

function ensureHeaderToggle(app) {
  const header = app.element?.querySelector(".window-header");
  if (!header) {
    warnOnce(app, "'.window-header' not found; header toggle not injected (scene tool and setting still work).");
    return;
  }
  let btn = header.querySelector(`.${TOGGLE_CLASS}`);
  if (!btn) {
    btn = document.createElement("button");
    btn.type = "button"; // never submit a form (learning #024)
    btn.className = `header-control icon fa-solid fa-text-width ${TOGGLE_CLASS}`;
    btn.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      game.settings.set(MODULE, SETTING_ENABLED, !isOn());
    });
    const anchor =
      header.querySelector('[data-action="toggleControls"]') ??
      header.querySelector('[data-action="close"]');
    if (anchor) anchor.before(btn);
    else header.append(btn);
  }
  updateHeaderToggle(btn);
}

function updateToolVisual(element) {
  const btn = element?.querySelector?.(`[data-tool="${TOOL_NAME}"]`);
  if (!btn) return;
  const on = isOn();
  btn.classList.toggle(ON_CLASS, on);
  btn.classList.toggle("active", on);
  btn.setAttribute("aria-pressed", String(on));
}

function onRender(app) {
  try {
    if (!app.element || !isRelevant(app)) return;
    if (isFilePickerApp(app)) ensureHeaderToggle(app);
    bindInputEvents(app);
    applyToApp(app, { reason: "render" });
  } catch (err) {
    console.error(`${LOG} render handler failed:`, err);
  }
}

/** Applies the current setting value to everything already open. */
function refreshAll() {
  for (const app of getApps()) {
    if (!app.element || !isRelevant(app)) continue;
    applyToApp(app, { reason: "toggle" });
    const btn = app.element.querySelector(`.${TOGGLE_CLASS}`);
    if (btn) updateHeaderToggle(btn);
  }
  try { ui.controls?.render?.(); } catch (err) { console.warn(`${LOG} could not refresh Scene Controls.`, err); }
}

export const FilePickerSpaceDisplayFeature = {
  settingsGroup: {
    label: "JSD.Settings.FilePickerSpaceDisplay.Label",
    keys: [SETTING_ENABLED],
  },

  // Always loaded on purpose: the setting itself is the live on/off, and the
  // toggle icons must still exist while it is off so it can be turned back on.
  isEnabled() { return true; },

  registerSettings() {
    game.settings.register(MODULE, SETTING_ENABLED, {
      name: "JSD.Settings.FilePickerSpaceDisplay.Label",
      hint: "JSD.Settings.FilePickerSpaceDisplay.Hint",
      scope: "user",
      config: true,
      type: Boolean,
      default: true,
      requiresReload: false,
      onChange: () => refreshAll(),
    });
  },

  initialize() {
    Hooks.on("renderApplicationV2", onRender);
    Hooks.on("renderSceneControls", (_app, element) => updateToolVisual(element));
  },

  /**
   * Adds the toggle to the JSD Panel group (`controls.jsd`). macro-library.mjs
   * owns that group and runs after this feature, so it merges into whatever
   * tools already exist here instead of replacing them. If the Macro Library
   * feature is disabled the group would not exist, so it is created here.
   */
  getSceneControlButtons(controls) {
    if (!game.user.isGM) return;
    controls.jsd ??= {
      name: "jsd",
      title: game.i18n.localize("JSD.Panel.Title"),
      icon: "fa-solid fa-toolbox",
      visible: true,
      tools: {},
    };
    controls.jsd.tools[TOOL_NAME] = {
      name: TOOL_NAME,
      title: "JSD.FilePickerSpaceDisplay.ToolTitle",
      icon: "fa-solid fa-text-width",
      order: 4.5, // after GM Clear Vision (4), before JSD Module Settings (5)
      toggle: true,
      active: isOn(),
      visible: true,
      onChange: (_event, active) => {
        game.settings.set(MODULE, SETTING_ENABLED, active);
      },
    };
  },
};
