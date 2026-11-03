/**
 * file-picker-space-display.mjs — Feature: show readable names instead of "%20" / "%C3%87"
 *
 * Foundry stores and serves paths URL-encoded ("Infused%20Mana%20Crystal",
 * "ANIMA%C3%87%C3%95ES"). This feature changes ONLY what is displayed:
 * every valid %XX sequence is shown decoded ("Infused Mana Crystal",
 * "ANIMAÇÕES", "[2]"; see utils/percent-decode.mjs for the safety rules).
 * Nothing in the data layer is touched: paths, data-* attributes, setting
 * values and every input's real `value` stay encoded, so other modules and
 * Foundry's own navigation/saving keep working exactly as before.
 *
 * Two display-only mechanisms:
 *   A) File Browser window (FilePicker): visible text nodes (favorites,
 *      folder/file names) and title/data-tooltip attributes are rewritten;
 *      originals are remembered and restored when the feature is turned off.
 *   B) Text inputs that hold a path (the "Tile Image or Video" style fields,
 *      i.e. any <input> inside a <file-picker> element in ANY window, plus
 *      the text inputs of the File Browser itself): the input is NEVER
 *      edited. Its text is made transparent and a non-interactive overlay
 *      <span> draws the decoded text on top, also while the field is focused
 *      (so a long path stays readable; hovering shows the full decoded name
 *      in a tooltip). The overlay's text and the real text have different
 *      geometry, so caret, partial selection and typing can NOT be trusted
 *      while it is shown. Therefore:
 *        - copy always puts the WHOLE real value on the clipboard;
 *        - select-all, and replacing the whole value (typing/paste over a
 *          select-all), work as usual (index-independent);
 *        - any other edit (typing, delete, partial paste/cut, undo) is
 *          swallowed ONCE: the field flips to the real text ("edit mode")
 *          and nothing is inserted at a misaligned position. Edit mode ends
 *          when the field loses focus.
 *      Because `input.value` is never written, saving a document can only
 *      ever submit the real encoded path.
 *
 * Live on/off (all write the same user setting, all apply instantly):
 *   1) JSD setting "File Picker: Show Readable Names (decode %20, %C3...)"
 *   2) toggle button in the window header of the File Browser AND of every
 *      window with path fields (Scene/Tile config...). The same button also
 *      copies the CLEAN (decoded) path: right-click or Shift+click.
 *   3) toggle tool in the JSD Panel (Scene Controls)
 *
 * DOM ASSUMPTIONS (not captured from a live world; guarded and logged):
 *   - the File Browser frame has a `.window-header`;
 *   - path fields are `<input>` inside a `<file-picker>` custom element;
 *   - the JSD Panel is the scene-controls group `jsd` (macro-library.mjs).
 */

import { decodeForDisplay, hasDecodableText } from "../utils/percent-decode.mjs";

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
const SELECTALL_CLASS = "jsd-fpsd-selectall";
const COPIED_CLASS = "jsd-fpsd-copied";
const SCROLLING_CLASS = "jsd-fpsd-scrolling";
const TEXT_INPUT_TYPES = new Set(["", "text", "search"]);
const HTML_SIGNIFICANT = /[<>&]/;
const ON_COLOR = "#2ecc71";
const HINT_THROTTLE_MS = 4000;
let lastHintAt = 0;

const SKIP_TAGS = new Set(["INPUT", "TEXTAREA", "SELECT", "OPTION", "SCRIPT", "STYLE"]);

/** Text node -> original (encoded) string. */
const TEXT_ORIGINALS = new WeakMap();
/** Text node -> the decoded string we wrote (so our own output is never decoded twice). */
const TEXT_WRITTEN = new WeakMap();
/** Element -> { title, tooltip, titleOut, tooltipOut } originals and what we wrote. */
const ATTR_ORIGINALS = new WeakMap();
/** FilePicker app -> MutationObserver. */
const OBSERVERS = new WeakMap();
/** input -> { overlay, observer } for inputs currently masked. */
const MASKS = new WeakMap();
/** Last path input focused per window, so "copy clean path" knows which field you mean. */
const LAST_INPUT = new WeakMap();
/** Inputs currently in edit mode (real text shown, overlay off) until blur. */
const EDITING = new WeakSet();
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
  if (!hasDecodableText(value)) return 0;
  const parent = node.parentElement;
  if (parent && SKIP_TAGS.has(parent.tagName)) return 0;
  // The overlay already holds decoded text; decoding it again would corrupt
  // names that legitimately contain e.g. "%41" after a first decode.
  if (parent?.closest(`.${OVERLAY_CLASS}`)) return 0;
  if (TEXT_WRITTEN.get(node) === value) return 0; // our own output
  const decoded = decodeForDisplay(value);
  // A node that still decodes to something different is raw by definition, so
  // always refresh the stored original (covers content rewritten later).
  TEXT_ORIGINALS.set(node, value);
  TEXT_WRITTEN.set(node, decoded);
  node.nodeValue = decoded;
  return 1;
}

function convertAttrs(el) {
  if (MASKS.has(el)) return 0; // its title is written by maskInput(), already decoded
  let changed = 0;
  const saved = ATTR_ORIGINALS.get(el) ?? {};
  for (const [attr, key] of [["title", "title"], ["data-tooltip", "tooltip"]]) {
    const value = el.getAttribute(attr);
    if (!hasDecodableText(value) || value === saved[`${key}Out`]) continue;
    const decoded = decodeForDisplay(value);
    // data-tooltip may be rendered as HTML by Foundry; decoding must never
    // introduce markup characters there. (title is plain text, always safe.)
    if (attr === "data-tooltip" && HTML_SIGNIFICANT.test(decoded) && !HTML_SIGNIFICANT.test(value)) continue;
    saved[key] = value;
    saved[`${key}Out`] = decoded;
    el.setAttribute(attr, decoded);
    changed++;
  }
  if (changed) ATTR_ORIGINALS.set(el, saved);
  return changed;
}

/** Converts a node and everything under it. Returns how many things changed. */
function convertSubtree(node) {
  let changed = 0;
  if (node.nodeType === Node.TEXT_NODE) return convertTextNode(node);
  if (node.nodeType !== Node.ELEMENT_NODE) return 0;
  if (node.classList.contains(OVERLAY_CLASS)) return 0;

  changed += convertAttrs(node);
  for (const el of node.querySelectorAll("[title*='%'], [data-tooltip*='%']")) {
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
    if (original !== undefined && TEXT_WRITTEN.get(current) === current.nodeValue) {
      current.nodeValue = original;
    }
    TEXT_ORIGINALS.delete(current);
    TEXT_WRITTEN.delete(current);
    current = walker.nextNode();
  }
  for (const el of root.querySelectorAll("[title], [data-tooltip]")) {
    const saved = ATTR_ORIGINALS.get(el);
    if (!saved) continue;
    if (saved.title !== undefined && el.getAttribute("title") === saved.titleOut) {
      el.setAttribute("title", saved.title);
    }
    if (saved.tooltip !== undefined && el.getAttribute("data-tooltip") === saved.tooltipOut) {
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
    entry = { overlay, observer, prevTitle: input.getAttribute("title") };
    MASKS.set(input, entry);
  }
  const decoded = decodeForDisplay(input.value);
  entry.overlay.textContent = decoded;
  // Hover shows the whole decoded name even when it does not fit the field.
  // Native `title` on purpose: always plain text, whereas Foundry's
  // data-tooltip may be rendered as HTML and decoding can produce "<".
  input.setAttribute("title", decoded);
  layoutOverlay(input, entry.overlay);
  input.classList.add(MASK_CLASS);
  if (document.activeElement === input) startScrollSync(input);
}

/**
 * The real (hidden) text scrolls when the caret moves or the mouse drags past
 * the field edge, but the overlay is a different string with a different
 * width. Mirror the scroll position proportionally so the user can read the
 * rest of a long decoded name by dragging/arrowing/End, as in a normal field.
 */
function syncOverlayScroll(input) {
  const entry = MASKS.get(input);
  if (!entry) return;
  const inputMax = input.scrollWidth - input.clientWidth;
  const overlayMax = entry.overlay.scrollWidth - entry.overlay.clientWidth;
  entry.overlay.scrollLeft =
    inputMax > 0 && overlayMax > 0 ? Math.round((input.scrollLeft / inputMax) * overlayMax) : 0;
}

/** Runs only while the masked input has focus (the only time it can scroll). */
function startScrollSync(input) {
  const entry = MASKS.get(input);
  if (!entry || entry.syncing) return;
  entry.syncing = true;
  // text-overflow: ellipsis truncates the line to the box width BEFORE painting,
  // so scrolling would only slide that already-truncated line out of view
  // (blank field). While focused the full line must exist, so no ellipsis.
  entry.overlay.classList.add(SCROLLING_CLASS);
  const tick = () => {
    const current = MASKS.get(input);
    if (!current || document.activeElement !== input) {
      if (current) current.syncing = false;
      return;
    }
    syncOverlayScroll(input);
    current.frame = requestAnimationFrame(tick);
  };
  tick();
}

function resetScroll(input) {
  const entry = MASKS.get(input);
  if (!entry) return;
  entry.syncing = false;
  if (entry.frame) cancelAnimationFrame(entry.frame);
  input.scrollLeft = 0;
  entry.overlay.scrollLeft = 0;
  entry.overlay.classList.remove(SCROLLING_CLASS); // ellipsis back when not focused
}

function unmaskInput(input) {
  const entry = MASKS.get(input);
  input.classList.remove(MASK_CLASS);
  if (!entry) return;
  entry.syncing = false;
  if (entry.frame) cancelAnimationFrame(entry.frame);
  entry.observer.disconnect();
  entry.overlay.remove();
  MASKS.delete(input);
  if (entry.prevTitle === null) input.removeAttribute("title");
  else input.setAttribute("title", entry.prevTitle);
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
    !EDITING.has(input) &&
    hasDecodableText(input.value);
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
  for (const input of root.querySelectorAll("input")) {
    EDITING.delete(input);
    unmaskInput(input);
  }
}

/** Whole real value selected: replacing it is independent of any caret position. */
function isWholeSelected(input) {
  return input.value.length > 0 && input.selectionStart === 0 && input.selectionEnd === input.value.length;
}

/** Flips a masked input to its real text. Nothing is written to the value. */
function enterEditMode(input) {
  EDITING.add(input);
  unmaskInput(input);
}

function setOverlayClass(input, cls, on) {
  MASKS.get(input)?.overlay.classList.toggle(cls, on);
}

/**
 * Blocks one edit that would land at a misaligned caret and switches the field
 * to its real text instead. `always` also blocks it when everything is selected
 * (undo/redo act on invisible history, so they are never safe to let through).
 */
function guardEdit(event, input, { always = false } = {}) {
  if (!always && isWholeSelected(input)) return;
  event.preventDefault();
  enterEditMode(input);
  showEditHint();
}

/** Tells the user why their first keystroke/paste did nothing (throttled). */
function showEditHint() {
  const now = Date.now();
  if (now - lastHintAt < HINT_THROTTLE_MS) return;
  lastHintAt = now;
  try { ui.notifications?.info(game.i18n.localize("JSD.FilePickerSpaceDisplay.EditHint")); } catch { /* cosmetic */ }
}

/** One delegated set of listeners per window element. */
function bindInputEvents(app) {
  const root = app.element;
  if (root.dataset[BOUND_KEY]) return;
  root.dataset[BOUND_KEY] = "1";

  const masked = (event) => {
    const target = event.target;
    return target instanceof HTMLInputElement && MASKS.has(target) ? target : null;
  };

  root.addEventListener("focusin", (event) => {
    const target = event.target;
    if (target instanceof HTMLInputElement && inScope(target, app)) LAST_INPUT.set(app, target);
    const input = masked(event);
    if (input) startScrollSync(input);
  });

  root.addEventListener("focusout", (event) => {
    const input = event.target;
    if (!(input instanceof HTMLInputElement)) return;
    resetScroll(input);
    EDITING.delete(input);
    refreshInput(input, app);
    setOverlayClass(input, SELECTALL_CLASS, false);
  });

  root.addEventListener("pointerdown", (event) => {
    const input = masked(event);
    if (input) setOverlayClass(input, SELECTALL_CLASS, false);
  });

  root.addEventListener("keydown", (event) => {
    const input = masked(event);
    if (!input) return;
    const altGr = event.getModifierState?.("AltGraph");
    if (event.altKey && !altGr) return;
    const shortcut = (event.ctrlKey || event.metaKey) && !event.altKey;
    if (shortcut) {
      const key = event.key.toLowerCase();
      if (key === "a") setOverlayClass(input, SELECTALL_CLASS, true); // native select-all
      else if (key === "x" || key === "v") guardEdit(event, input);
      else if (key === "z" || key === "y") guardEdit(event, input, { always: true });
      return; // "c" is served by the copy event below
    }
    if (event.isComposing || event.key === "Process" || event.key === "Dead" ||
        event.key.length === 1 || event.key === "Backspace" || event.key === "Delete") {
      guardEdit(event, input);
    } else if (!event.shiftKey) {
      setOverlayClass(input, SELECTALL_CLASS, false);
    }
  });

  // Safety net for edits that do not come from a keydown (context-menu paste,
  // drag and drop, IME, spellcheck, undo from the menu).
  root.addEventListener("beforeinput", (event) => {
    const input = masked(event);
    if (!input) return;
    guardEdit(event, input, { always: event.inputType?.startsWith("history") });
  });
  root.addEventListener("paste", (event) => {
    const input = masked(event);
    if (input) guardEdit(event, input);
  });
  root.addEventListener("cut", (event) => {
    const input = masked(event);
    if (input) guardEdit(event, input);
  });

  // Copy always yields the WHOLE real (encoded) value: a partial selection is
  // made on invisible text with different geometry, so it could not be trusted.
  root.addEventListener("copy", (event) => {
    const input = masked(event);
    if (!input || !event.clipboardData) return;
    event.preventDefault();
    event.clipboardData.setData("text/plain", input.value);
    setOverlayClass(input, COPIED_CLASS, true);
    setTimeout(() => setOverlayClass(input, COPIED_CLASS, false), 300);
  });

  // Replace-all edits are let through; refresh the overlay with the new value.
  root.addEventListener("input", (event) => {
    const input = event.target;
    if (input instanceof HTMLInputElement && !EDITING.has(input)) refreshInput(input, app);
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
    // Our own edits re-enter here, but TEXT_WRITTEN / the overlay guard make
    // the handlers no-ops, so it settles after one pass.
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

/**
 * On/off look, applied INLINE as well as through the stylesheet. An inline
 * `!important` beats every layered core rule and does not depend on
 * jack-small-details.css being the fresh copy (a stale cached stylesheet left
 * the active icon uncoloured).
 */
function paintState(el, on) {
  if (!el) return;
  if (on) el.style.setProperty("color", ON_COLOR, "important");
  else el.style.removeProperty("color");
}

function updateHeaderToggle(btn) {
  const on = isOn();
  btn.classList.toggle(ON_CLASS, on);
  paintState(btn, on);
  if (on) btn.style.removeProperty("opacity");
  else btn.style.setProperty("opacity", "0.6");
  btn.setAttribute("aria-pressed", String(on));
  const label = game.i18n.localize(on ? "JSD.FilePickerSpaceDisplay.TooltipOn" : "JSD.FilePickerSpaceDisplay.TooltipOff");
  btn.dataset.tooltip = label;
  btn.setAttribute("aria-label", label);
}

/**
 * Which path field does "copy clean path" mean? The last one the user focused
 * in this window, else the first visible one that has encoded text, else the
 * first visible one with any value.
 */
function resolveCopyTarget(app) {
  const all = [...app.element.querySelectorAll("input")].filter((i) => inScope(i, app) && i.value);
  const visible = all.filter((i) => i.getClientRects().length > 0);
  const pool = visible.length ? visible : all;
  const last = LAST_INPUT.get(app);
  if (last && pool.includes(last)) return last;
  return pool.find((i) => hasDecodableText(i.value)) ?? pool[0] ?? null;
}

async function writeClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try { // Fallback for contexts where the async clipboard API is refused.
      const area = document.createElement("textarea");
      area.value = text;
      area.style.cssText = "position:fixed;opacity:0;pointer-events:none;";
      document.body.append(area);
      area.select();
      const ok = document.execCommand("copy");
      area.remove();
      return ok;
    } catch {
      return false;
    }
  }
}

/** Copies the DECODED text of the target field. Never writes to the field. */
async function copyCleanPath(app) {
  const input = resolveCopyTarget(app);
  if (!input) {
    ui.notifications?.warn(game.i18n.localize("JSD.FilePickerSpaceDisplay.CopyNothing"));
    return;
  }
  const clean = decodeForDisplay(input.value);
  if (!(await writeClipboard(clean))) {
    ui.notifications?.warn(game.i18n.localize("JSD.FilePickerSpaceDisplay.CopyFailed"));
    return;
  }
  // Fixed text on purpose: the path itself may contain markup characters once decoded.
  ui.notifications?.info(game.i18n.localize("JSD.FilePickerSpaceDisplay.CopyDone"));
  setOverlayClass(input, COPIED_CLASS, true);
  setTimeout(() => setOverlayClass(input, COPIED_CLASS, false), 300);
  console.log(`${LOG} copied the clean path (${clean.length} chars) from "${input.name || input.id || "input"}" in "${app.id}".`);
}

function ensureHeaderToggle(app) {
  const header = app.element?.querySelector(".window-header");
  if (!header) {
    warnOnce(app, "'.window-header' not found; header toggle not injected (JSD Panel tool and setting still work).");
    return;
  }
  let btn = header.querySelector(`.${TOGGLE_CLASS}`);
  if (!btn) {
    btn = document.createElement("button");
    btn.type = "button"; // never submit a form (learning #024)
    btn.className = `header-control icon fa-solid fa-text-width ${TOGGLE_CLASS}`;
    // Click: on/off. Shift+click or right-click: copy the clean path.
    btn.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (event.shiftKey) copyCleanPath(app);
      else game.settings.set(MODULE, SETTING_ENABLED, !isOn());
    });
    btn.addEventListener("contextmenu", (event) => {
      event.preventDefault();
      event.stopPropagation();
      copyCleanPath(app);
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
  paintState(btn, on);
  paintState(btn.querySelector("i"), on);
}

function onRender(app) {
  try {
    if (!app.element || !isRelevant(app)) return;
    ensureHeaderToggle(app);
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
