/**
 * journal-scaler/indicator.js
 * Ported unchanged from journal-scaler-by-jack v1.4.1.
 */

import { loc } from "./constants.js";

const FADE_DELAY_MS = 1500;

/**
 * Keyed by the journal app's root element (not by app instance) so a
 * closed-then-reopened sheet — which gets a fresh element — naturally
 * gets a fresh badge, with the old one garbage collected.
 */
const badgeRegistry = new WeakMap();

/**
 * Styles are set inline rather than via a CSS class. This badge is
 * injected into journal windows we don't own (core or third-party, e.g.
 * Monk's Enhanced Journal), so there is no window/root id of ours to
 * scope a stylesheet selector to — inline styles avoid that problem
 * entirely, at the cost of being slightly more verbose here.
 */
function createBadgeElement() {
  const el = document.createElement("div");
  el.style.cssText = [
    "position:absolute",
    "top:8px",
    "right:8px",
    "z-index:100",
    "pointer-events:none",
    "background:rgba(20,15,10,0.85)",
    "color:#f5e6d3",
    "font-size:12px",
    "font-weight:700",
    "letter-spacing:0.5px",
    "padding:4px 9px",
    "border-radius:6px",
    "box-shadow:0 2px 6px rgba(0,0,0,0.4)",
    "opacity:0",
    "transition:opacity 0.15s ease",
    "white-space:nowrap"
  ].join(";");
  return el;
}

function ensureBadge(root) {
  let entry = badgeRegistry.get(root);
  if (entry) return entry;

  const el = createBadgeElement();
  root.appendChild(el);

  entry = { el, timeoutId: null };
  badgeRegistry.set(root, entry);
  return entry;
}

/**
 * Show a fading "120%" (or "Text 120% · Image 100%" when they diverge)
 * badge over the given journal app for a couple of seconds.
 * @param {object} app - The owning ApplicationV2 instance.
 * @param {number} fontScale
 * @param {number} imageScale
 */
export function showScaleIndicator(app, fontScale, imageScale) {
  const root = app?.element?.closest?.(".application, .window-app") ?? app?.element;
  if (!root) return;

  const entry = ensureBadge(root);
  const fontPct = Math.round(fontScale * 100);
  const imagePct = Math.round(imageScale * 100);

  entry.el.textContent =
    fontPct === imagePct
      ? loc("JOURNALSCALER.Indicator.Single", { value: fontPct })
      : loc("JOURNALSCALER.Indicator.Split", { text: fontPct, image: imagePct });

  entry.el.style.opacity = "1";

  if (entry.timeoutId) clearTimeout(entry.timeoutId);
  entry.timeoutId = setTimeout(() => {
    entry.el.style.opacity = "0";
  }, FADE_DELAY_MS);
}
