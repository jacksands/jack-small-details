/**
 * broadcast.mjs, JSD v1.8.0
 * Feature: Broadcast. Lets ANY macro show a window to the other connected users
 * (GM -> players, player -> GM, anyone -> anyone).
 *
 * WHY THIS EXISTS
 *   A macro only runs on the client of whoever clicked it. It cannot open
 *   windows on other clients, and a listener registered inside a macro only
 *   exists on that one client. JSD is active on every client, so JSD owns the
 *   socket listener and renders what it receives.
 *
 * HOW IT WORKS
 *   The sender macro builds a STATIC snapshot (html + css strings) and calls
 *   game.modules.get("jack-small-details").api.broadcast.show({...}).
 *   Every receiving client opens a generic read-only window (BroadcastWindow)
 *   with that snapshot. No macro code is ever executed on the receiver.
 *   Sending again with the same `id` updates the window in place.
 *
 * SECURITY MODEL (read before changing)
 *   - Receiver sanitizes all HTML (scripts, on* handlers, javascript: URLs,
 *     iframes, forms, data-action are removed) and scopes all CSS under the
 *     window's own #id. Nothing a sender sends can run code or restyle the UI.
 *   - Target filtering ("gm", "players", [ids]) is done CLIENT-SIDE by the
 *     receiver. The payload still travels to every client, so do NOT use it for
 *     secrets a player must not see. senderId is also not authenticated by
 *     Foundry's socket; "acceptFrom: gm" is a convenience filter, not a wall.
 *   - One socket channel per module ("module.jack-small-details"), so every
 *     message carries { feature: "broadcast" }. Future socket features in JSD
 *     must use their own `feature` tag on the same channel.
 *
 * Requires "socket": true in module.json.
 */

const MODULE          = "jack-small-details";
const CHANNEL         = `module.${MODULE}`;
const FEATURE_TAG     = "broadcast";
const SETTING_ENABLED = "broadcast.enabled";
const SETTING_ACCEPT  = "broadcast.acceptFrom";
const MAX_CHARS       = 400_000;
const BCAST_ICON_COLOR = "#e8a030"; // header icon color (Amber "warning" orange)

// ─── Helpers ─────────────────────────────────────────────────────────────────

const appIdFor = (id) => `jsdb-${String(id).replace(/[^\w-]/g, "_")}`;
const cssIdFor = (id) => `jsd-bcast-css-${String(id).replace(/[^\w-]/g, "_")}`;

const BLOCKED_TAGS = [
  "script", "style", "iframe", "frame", "frameset", "object", "embed", "applet",
  "link", "meta", "base", "form", "noscript", "template",
].join(",");

const URL_ATTRS = ["href", "src", "xlink:href", "action", "formaction", "srcdoc", "data", "poster"];

function isDangerousUrl(value) {
  const v = String(value).replace(/[\u0000-\u0020\u007f-\u009f]/g, "").toLowerCase();
  return v.startsWith("javascript:") || v.startsWith("vbscript:") || v.startsWith("data:text/html");
}

/** Returns an inert DocumentFragment with only safe markup. */
function sanitizeToFragment(html) {
  const tpl = document.createElement("template");
  tpl.innerHTML = String(html ?? "");
  const root = tpl.content;

  root.querySelectorAll(BLOCKED_TAGS).forEach((n) => n.remove());

  root.querySelectorAll("*").forEach((el) => {
    for (const attr of [...el.attributes]) {
      const name = attr.name.toLowerCase();
      if (name.startsWith("on") || name === "data-action") { el.removeAttribute(attr.name); continue; }
      if (URL_ATTRS.includes(name) && isDangerousUrl(attr.value)) el.removeAttribute(attr.name);
    }
    if (el.tagName === "A" && el.hasAttribute("href")) {
      el.setAttribute("target", "_blank");
      el.setAttribute("rel", "noopener noreferrer");
    }
  });
  return root;
}

/**
 * Scopes CSS under a root selector using native CSS nesting.
 * Limitation: @keyframes / @font-face are not valid inside a nested rule and are
 * silently dropped by the browser. Use inline styles for animations if needed.
 */
function scopeCSS(css, rootSelector) {
  const clean = String(css ?? "").replace(/@import[^;]*;?/gi, "");
  return `${rootSelector}{${clean}}`;
}

function injectCSS(id, css) {
  let el = document.getElementById(id);
  if (!el) {
    el = document.createElement("style");
    el.id = id;
    document.head.appendChild(el);
  }
  el.textContent = css;
}

function getAcceptFrom() {
  try { return game.settings.get(MODULE, SETTING_ACCEPT); } catch { return "gm"; }
}

function isTargetedAtMe(to) {
  if (to === "all" || to == null) return true;
  if (to === "gm") return game.user.isGM;
  if (to === "players") return !game.user.isGM;
  if (Array.isArray(to)) return to.includes(game.user.id);
  return false;
}

/** Validates and normalizes an incoming/outgoing payload. Returns null if invalid. */
function normalizePayload(p) {
  if (!p || typeof p !== "object") return null;
  if (typeof p.id !== "string" || !p.id.trim() || p.id.length > 100) return null;
  if (typeof p.html !== "string") return null;
  const width = Number.isFinite(+p.width) ? Math.min(1400, Math.max(200, +p.width)) : 560;
  const height = Number.isFinite(+p.height) ? Math.min(1400, Math.max(100, +p.height)) : "auto";
  return {
    id: p.id.trim(),
    title: typeof p.title === "string" ? p.title.slice(0, 200) : "",
    html: p.html,
    css: typeof p.css === "string" ? p.css : "",
    width,
    height,
    padding: typeof p.padding === "string" && /^[\d.\s%a-z-]{1,40}$/i.test(p.padding) ? p.padding : "0",
  };
}

// ─── Generic read-only window ────────────────────────────────────────────────

class BroadcastWindow extends foundry.applications.api.ApplicationV2 {

  constructor(payload) {
    super({
      id: appIdFor(payload.id),
      window: { title: payload.title || "JSD", resizable: true, minimizable: true },
      position: { width: payload.width, height: payload.height },
    });
    this._payload = payload;
  }

  get title() { return this._payload?.title || "JSD"; }

  setPayload(payload) { this._payload = payload; }

  async _renderHTML() {
    return sanitizeToFragment(this._payload.html);
  }

  _replaceHTML(result, content) {
    content.replaceChildren(result);
  }

  _onRender() {
    const root = `#${this.id}`;
    const base = `.window-content{padding:${this._payload.padding};}`;
    injectCSS(cssIdFor(this._payload.id), scopeCSS(base + this._payload.css, root));
    const titleEl = this.element?.querySelector(".window-title");
    if (titleEl) titleEl.textContent = this.title;
  }

  _onClose() {
    document.getElementById(cssIdFor(this._payload.id))?.remove();
  }
}

function openWindow(payload) {
  const appId = appIdFor(payload.id);
  const existing = foundry.applications.instances.get(appId);
  if (existing instanceof BroadcastWindow) {
    existing.setPayload(payload);
    existing.render({ force: true });
    existing.bringToTop?.();
    return existing;
  }
  const app = new BroadcastWindow(payload);
  app.render({ force: true });
  return app;
}

function closeWindow(id) {
  const existing = foundry.applications.instances.get(appIdFor(id));
  if (existing instanceof BroadcastWindow) existing.close();
}

// ─── Socket receiver ─────────────────────────────────────────────────────────

function onSocketMessage(data) {
  if (data?.feature !== FEATURE_TAG) return;
  if (!data.senderId || data.senderId === game.user.id) return;

  const sender = game.users.get(data.senderId);
  if (!sender) return;
  if (getAcceptFrom() === "gm" && !sender.isGM) return;
  if (!isTargetedAtMe(data.to)) return;

  try {
    if (data.action === "show") {
      const payload = normalizePayload(data.payload);
      if (payload) openWindow(payload);
    } else if (data.action === "close" && typeof data.id === "string") {
      closeWindow(data.id);
    }
  } catch (err) {
    console.error("JSD | Broadcast receive failed:", err);
  }
}


// ─── DOM snapshot (used by attachButton) ─────────────────────────────────────

const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Builds { html, css } from a LIVE window. The DOM is the source of truth, so
 * whatever the user typed/selected at click time is what gets sent.
 *  - live control values are baked into attributes (value/checked/selected/textarea text)
 *  - <form> wrappers are unwrapped (the receiver sanitizer drops <form> and its children)
 *  - footers/dialog buttons are removed, remaining buttons and controls are disabled
 *  - <style> inside the content, plus head styles listed in opts.styles, become css
 *  - selectors that target the window frame (#frame-id, .frame-only-class, :root) become "&"
 */
function snapshotFromElement(el, { hide = [], styles = [], css = "" } = {}) {
  const frame = el.closest?.(".window-app, .application") ?? el;
  const content = frame.querySelector(".window-content") ?? el;
  const clone = content.cloneNode(true);

  const srcCtl = content.querySelectorAll("input, select, textarea");
  const cloCtl = clone.querySelectorAll("input, select, textarea");
  srcCtl.forEach((src, i) => {
    const dst = cloCtl[i];
    if (!dst) return;
    if (src.tagName === "INPUT") {
      if (src.type === "checkbox" || src.type === "radio") {
        if (src.checked) dst.setAttribute("checked", ""); else dst.removeAttribute("checked");
      } else dst.setAttribute("value", src.value);
    } else if (src.tagName === "TEXTAREA") {
      dst.textContent = src.value;
    } else if (src.tagName === "SELECT") {
      [...dst.options].forEach((opt, j) => {
        if (src.options[j]?.selected) opt.setAttribute("selected", ""); else opt.removeAttribute("selected");
      });
    }
  });

  // CSS first (before anything is removed)
  const cssParts = [];
  clone.querySelectorAll("style").forEach((st) => { cssParts.push(st.textContent); st.remove(); });
  for (const id of styles) {
    const txt = document.getElementById(id)?.textContent;
    if (txt) cssParts.push(txt);
  }
  if (css) cssParts.push(css);

  // Unwrap forms
  clone.querySelectorAll("form").forEach((form) => {
    const div = document.createElement("div");
    if (form.id) div.id = form.id;
    if (form.className) div.className = form.className;
    if (form.getAttribute("style")) div.setAttribute("style", form.getAttribute("style"));
    div.append(...form.childNodes);
    form.replaceWith(div);
  });

  // Remove native footers and caller-specified action elements
  const kill = ["[data-jsd-skip]", "footer", ".form-footer", ".dialog-buttons", ...hide].join(",");
  clone.querySelectorAll(kill).forEach((n) => n.remove());

  // Everything left is inert
  clone.querySelectorAll("input, select, textarea, button").forEach((n) => n.setAttribute("disabled", ""));
  clone.querySelectorAll("[contenteditable]").forEach((n) => n.removeAttribute("contenteditable"));
  clone.querySelectorAll("[autofocus]").forEach((n) => n.removeAttribute("autofocus"));

  // Selectors that point at the window frame must point at the receiver's frame ("&")
  let allCss = cssParts.join("\n").replace(/:root\b/g, "&");
  const frameSelectors = [];
  if (frame.id) frameSelectors.push(`#${frame.id}`);
  for (const cls of frame.classList) {
    if (!clone.querySelector(`.${CSS.escape(cls)}`)) frameSelectors.push(`.${cls}`);
  }
  for (const sel of frameSelectors) {
    allCss = allCss.replace(new RegExp(`(?<![\\w-])${escapeRegex(sel)}(?![\\w-])`, "g"), "&");
  }

  return { html: clone.innerHTML, css: allCss, frame };
}

function sendSnapshot(el, opts = {}) {
  const { html, css, frame } = snapshotFromElement(el, opts);
  const title = opts.title ?? frame.querySelector(".window-title")?.textContent?.trim() ?? "JSD";
  const width = opts.width ?? Math.round(frame.getBoundingClientRect().width || 560);
  const ok = broadcastAPI.show(
    { id: opts.id ?? `snap-${frame.id || "window"}`, title, html, css, width },
    { to: opts.to ?? "all" }
  );
  if (ok) ui.notifications.info("Prévia enviada aos conectados. Clique de novo para atualizar.");
  return ok;
}

// ─── Public API ──────────────────────────────────────────────────────────────

function canSend() {
  if (game.user.isGM) return true;
  if (getAcceptFrom() === "gm") {
    ui.notifications.warn("JSD Broadcast: o GM desativou o envio por jogadores (Settings > Jack Small Details > Broadcast).");
    return false;
  }
  return true;
}

const broadcastAPI = {
  /**
   * Show a read-only window to other connected users.
   * @param {object} payload
   * @param {string} payload.id       Stable id. Re-sending the same id updates the window in place.
   * @param {string} payload.html     Static HTML snapshot (sanitized by the receiver).
   * @param {string} [payload.css]    CSS for the snapshot. Written WITHOUT a root prefix; JSD scopes it.
   * @param {string} [payload.title]
   * @param {number} [payload.width=560]
   * @param {number} [payload.height]   Omit for auto.
   * @param {string} [payload.padding="0"]  CSS padding of .window-content.
   * @param {object} [opts]
   * @param {"all"|"gm"|"players"|string[]} [opts.to="all"]  Targets (never includes the sender).
   * @param {boolean} [opts.local=false]    Also open the same window on the sender.
   * @returns {boolean} true if sent/opened
   */
  show(payload, { to = "all", local = false } = {}) {
    const p = normalizePayload(payload);
    if (!p) { console.warn("JSD Broadcast.show: payload invalido (id e html sao obrigatorios).", payload); return false; }
    if (p.html.length + p.css.length > MAX_CHARS) {
      ui.notifications.warn("JSD Broadcast: conteudo grande demais para enviar.");
      return false;
    }
    if (local) openWindow(p);
    if (!canSend()) return local;
    game.socket.emit(CHANNEL, { feature: FEATURE_TAG, action: "show", senderId: game.user.id, to, payload: p });
    return true;
  },

  /** Close a broadcast window on targets (and optionally on the sender). */
  close(id, { to = "all", local = false } = {}) {
    if (local) closeWindow(id);
    if (!canSend()) return;
    game.socket.emit(CHANNEL, { feature: FEATURE_TAG, action: "close", senderId: game.user.id, to, id });
  },


  /**
   * Snapshot of a live window as { html, css } (see snapshotFromElement).
   * @param {HTMLElement} el  Window frame or its .window-content
   */
  snapshot(el, opts = {}) {
    const { html, css } = snapshotFromElement(el, opts);
    return { html, css };
  },

  /**
   * Adds a "Mostrar aos Conectados" icon button to the window header. On click it
   * snapshots the window as it is at that moment and shows it read-only to others.
   * Idempotent: safe to call on every render.
   * @param {HTMLElement} el   Window frame or its .window-content (ApplicationV2, DialogV2 or legacy Dialog)
   * @param {object} [opts]
   * @param {string}   [opts.id]      Stable id of the broadcast window (default: snap-<frame id>)
   * @param {string}   [opts.title]   Title (default: the window title)
   * @param {number}   [opts.width]   Width in px (default: current window width)
   * @param {string[]} [opts.hide]    Selectors removed from the snapshot (action buttons)
   * @param {string[]} [opts.styles]  ids of <style> elements in document.head to include
   * @param {string}   [opts.css]     Extra css (unprefixed)
   * @param {"all"|"gm"|"players"|string[]} [opts.to="all"]
   */
  attachButton(el, opts = {}) {
    const frame = el?.closest?.(".window-app, .application");
    const header = frame?.querySelector(".window-header");
    if (!frame || !header || header.querySelector(".jsd-bcast-btn")) return null;

    const label = "Mostrar aos Conectados";
    const v2 = !!header.querySelector(".header-control");
    let btn;
    if (v2) {
      btn = document.createElement("button");
      btn.type = "button";
      btn.className = "header-control icon fa-solid fa-tower-broadcast jsd-bcast-btn";
      btn.dataset.tooltip = label;
      btn.setAttribute("aria-label", label);
      const anchor = header.querySelector('[data-action="toggleControls"]') ?? header.querySelector('[data-action="close"]');
      header.insertBefore(btn, anchor ?? null);
    } else {
      btn = document.createElement("a");
      btn.className = "header-button jsd-bcast-btn";
      btn.title = label;
      btn.innerHTML = '<i class="fa-solid fa-tower-broadcast"></i>';
      header.insertBefore(btn, header.querySelector(".close") ?? null);
    }
    btn.style.color = BCAST_ICON_COLOR;
    btn.addEventListener("click", (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      try { sendSnapshot(frame, opts); }
      catch (err) { console.error("JSD | Broadcast snapshot failed:", err); ui.notifications.error("JSD Broadcast: falha ao gerar a prévia (veja o console)."); }
    });
    return btn;
  },

  /** Escape helper for user-typed text interpolated into html strings. */
  esc(value) {
    return foundry.utils.escapeHTML ? foundry.utils.escapeHTML(String(value ?? "")) :
      String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  },
};

// ─── Feature ─────────────────────────────────────────────────────────────────

export const BroadcastFeature = {

  settingsGroup: {
    label: "JSD.Settings.Broadcast.Label",
    keys:  [SETTING_ENABLED, SETTING_ACCEPT],
  },

  isEnabled() {
    try { return game.settings.get(MODULE, SETTING_ENABLED); } catch { return true; }
  },

  registerSettings() {
    game.settings.register(MODULE, SETTING_ENABLED, {
      name: "JSD.Settings.Broadcast.Label",
      hint: "JSD.Settings.Broadcast.Hint",
      scope: "world", config: true, type: Boolean, default: true, requiresReload: true,
    });
    game.settings.register(MODULE, SETTING_ACCEPT, {
      name: "JSD.Settings.Broadcast.AcceptFrom.Label",
      hint: "JSD.Settings.Broadcast.AcceptFrom.Hint",
      scope: "world", config: true, type: String, default: "gm",
      choices: {
        gm:     "JSD.Settings.Broadcast.AcceptFrom.GM",
        anyone: "JSD.Settings.Broadcast.AcceptFrom.Anyone",
      },
    });
  },

  setup() {
    const mod = game.modules.get(MODULE);
    if (mod) mod.api = { ...(mod.api ?? {}), broadcast: broadcastAPI };
  },

  initialize() {
    game.socket.on(CHANNEL, onSocketMessage);
    console.log("JSD | Broadcast listener registered.");
  },
};
