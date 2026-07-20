/**
 * journal-scaler/scaling.js
 * Ported from journal-scaler-by-jack v1.4.1 (standalone module).
 * No logic changes from the standalone version — see technical-instructions.md
 * for a summary of the detection strategy and the two-pass font scaling fix.
 */

import { DIRECTION, SCALE_FACTOR, MIN_IMAGE_SIZE_PX, MIN_FONT_SIZE_PX } from "./constants.js";

/**
 * Baselines are captured the first time an element is touched and reused
 * for every subsequent scale on that element. This avoids compounding
 * floating-point drift from repeatedly parsing/re-writing "Npx" strings,
 * and resets naturally whenever the sheet re-renders (new DOM elements =
 * new WeakMap entries; old ones are garbage collected).
 */
const baselineFontSizes = new WeakMap();
const baselineImageSizes = new WeakMap();

function getBaselineFontSize(element) {
  if (!baselineFontSizes.has(element)) {
    const parsed = parseFloat(window.getComputedStyle(element).fontSize);
    baselineFontSizes.set(element, Number.isFinite(parsed) ? parsed : 14);
  }
  return baselineFontSizes.get(element);
}

function getBaselineImageSize(img) {
  if (!baselineImageSizes.has(img)) {
    // Baseline must be the image's rendered/configured display size, never
    // its native file resolution (confirmed production bug — see
    // technical-instructions.md).
    const rect = img.getBoundingClientRect();
    const width = rect.width || img.offsetWidth || img.width || img.naturalWidth || 1;
    const height = rect.height || img.offsetHeight || img.height || img.naturalHeight || 1;
    baselineImageSizes.set(img, { width, height });
  }
  return baselineImageSizes.get(img);
}

/** @param {WheelEvent} event @returns {"increase"|"decrease"|null} */
export function getDirection(event) {
  if (event.deltaY < 0) return DIRECTION.INCREASE;
  if (event.deltaY > 0) return DIRECTION.DECREASE;
  return null;
}

/** @param {number} currentFactor @param {"increase"|"decrease"} direction */
export function nextFactor(currentFactor, direction) {
  return direction === DIRECTION.INCREASE ? currentFactor * SCALE_FACTOR : currentFactor / SCALE_FACTOR;
}

/**
 * Apply an absolute scale factor (relative to each element's own baseline
 * size, not relative to its current size) to an element and all of its
 * descendants.
 *
 * Two passes are required, not one recursive pass — see
 * technical-instructions.md ("font-size cascade contamination") for the
 * full explanation of why a single recursive pass corrupts descendant
 * baselines.
 */
export function applyFontScale(root, factor) {
  const elements = [root, ...root.querySelectorAll("*")];

  // Pass 1: lock in every element's baseline before any of them change.
  const baselines = elements.map((el) => getBaselineFontSize(el));

  // Pass 2: only now is it safe to apply new sizes.
  elements.forEach((el, i) => {
    const size = baselines[i] * factor;
    if (size > MIN_FONT_SIZE_PX) el.style.fontSize = `${size}px`;
  });
}

/** Apply an absolute scale factor to every <img> within a container. */
export function applyImageScale(container, factor) {
  for (const img of container.getElementsByTagName("img")) {
    const { width, height } = getBaselineImageSize(img);
    const newWidth = width * factor;
    const newHeight = height * factor;
    if (newWidth > MIN_IMAGE_SIZE_PX && newHeight > MIN_IMAGE_SIZE_PX) {
      img.style.width = `${newWidth}px`;
      img.style.height = `${newHeight}px`;
    }
  }
}

const CONTENT_SELECTOR_TIERS = [
  ".journal-page-content", // Core Foundry journal page(s)
  ".sheet-body", // Monk's Enhanced Journal
  ".editor-content",
  ".editor .ProseMirror"
];

const CONTENT_SELECTOR = CONTENT_SELECTOR_TIERS.join(", ");

/** First matching content container within root, trying tiers in priority order. */
function findContentContainer(root) {
  for (const selector of CONTENT_SELECTOR_TIERS) {
    const found = root.querySelector(selector);
    if (found) return found;
  }
  return null;
}

/** All matching content containers within root, trying tiers in priority order (stops at first non-empty tier). */
function queryPageContainers(root) {
  for (const selector of CONTENT_SELECTOR_TIERS) {
    const found = root.querySelectorAll(selector);
    if (found.length) return Array.from(found);
  }
  return [];
}

function getAppV2() {
  return foundry.applications?.api?.ApplicationV2;
}

function isPageDocument(doc) {
  return Boolean(globalThis.JournalEntryPage && doc instanceof globalThis.JournalEntryPage);
}

function isEntryDocument(doc) {
  return Boolean(globalThis.JournalEntry && doc instanceof globalThis.JournalEntry);
}

export function isJournalDocument(doc) {
  return isPageDocument(doc) || isEntryDocument(doc);
}

/**
 * Find the dedicated ApplicationV2 instance for the specific journal PAGE
 * under the cursor. Each `JournalEntryPage` shown in a `JournalEntrySheet`
 * is individually registered in `ApplicationV2.instances()` as its own
 * `JournalEntryPageProseMirrorSheet` (or similar) instance, with
 * `.document` pointing directly at that page and `.document.uuid` giving
 * its exact, page-specific UUID (`JournalEntry.<id>.JournalEntryPage.<id>`).
 * This is the PRIMARY and most reliable way to identify which page is
 * under the cursor — far more robust than guessing at DOM data attributes,
 * since it reads Foundry's own document references directly.
 */
function findPageApp(target) {
  const AppV2 = getAppV2();
  if (typeof AppV2?.instances !== "function") return null;

  for (const app of AppV2.instances()) {
    if (isPageDocument(app?.document) && app.element?.contains?.(target)) return app;
  }
  return null;
}

/** Find the parent JournalEntry-level app instance (the whole window), if any. */
function findEntryApp(target) {
  const AppV2 = getAppV2();
  if (typeof AppV2?.instances !== "function") return null;

  for (const app of AppV2.instances()) {
    if (isEntryDocument(app?.document) && app.element?.contains?.(target)) return app;
  }
  return null;
}

/**
 * Last-resort fallback for sheets that don't register individual page
 * apps at all (e.g. some third-party journal sheets). `document` stays
 * null, which downstream code treats as "can't be identified for
 * persistence", not as an error.
 */
function findFallbackByClass(target) {
  const fallbackRoot = target.closest?.(
    ".journal-sheet, .journal-entry, .journal-entry-page-sheet, .monks-journal-sheet, [class*='journal-entry']"
  );
  return fallbackRoot ? { element: fallbackRoot, document: null } : null;
}

/**
 * Best-effort DOM-based page id, used only when no dedicated page app was
 * found above.
 */
function resolvePageIdFromDom(container) {
  const withData = container.closest("[data-page-id]");
  if (withData?.dataset?.pageId) return withData.dataset.pageId;

  const withElementId = container.closest("[id^='JournalEntryPage-']");
  if (withElementId?.id) return withElementId.id;

  return null;
}

/**
 * Build a stable persistence key for a container within a journal app,
 * for the cases where a dedicated page app wasn't found: `${entryUuid}::
 * ${pageId}` when a page id can be resolved from the DOM, the bare entry
 * uuid as a degraded fallback (old, shared-per-entry behavior) when it
 * can't, or `null` when the document itself can't be identified at all.
 */
function resolveFallbackScaleKey(app, container) {
  const uuid = app?.document?.uuid;
  if (!uuid) return null;

  const pageId = resolvePageIdFromDom(container);
  return pageId ? `${uuid}::${pageId}` : uuid;
}

/**
 * Locate the scalable text container and app for the journal page under
 * the cursor.
 * @returns {{ app: object, textBody: HTMLElement, key: string|null } | null}
 */
export function findScaleTarget(eventTarget) {
  if (!(eventTarget instanceof Element)) return null;

  const pageApp = findPageApp(eventTarget);
  if (pageApp) {
    const textBody = findContentContainer(pageApp.element) ?? eventTarget.closest(CONTENT_SELECTOR);
    if (!textBody) return null;
    return { app: pageApp, textBody, key: pageApp.document.uuid };
  }

  // No dedicated page app (non-standard sheet) — fall back to locating the
  // exact container under the cursor and a best-effort DOM-based key.
  const textBody = eventTarget.closest(CONTENT_SELECTOR);
  if (!textBody) return null;

  const app = findEntryApp(eventTarget) ?? findFallbackByClass(eventTarget) ?? { element: textBody, document: null };
  const key = resolveFallbackScaleKey(app, textBody);
  return { app, textBody, key };
}

/**
 * Every currently rendered journal page/content container across all open
 * journal windows, each with its own resolved persistence key. Used by
 * "Reset All" and the "Always scale images" toggle-off handler, which need
 * to touch every visible page at once rather than whichever one is under
 * the cursor.
 * @returns {{ app: object, textBody: HTMLElement, key: string|null }[]}
 */
export function getOpenJournalPageTargets() {
  const AppV2 = getAppV2();
  if (typeof AppV2?.instances !== "function") return [];

  const results = [];
  const coveredRoots = [];

  for (const app of AppV2.instances()) {
    if (!isPageDocument(app?.document)) continue;
    const textBody = findContentContainer(app.element);
    if (!textBody) continue;
    results.push({ app, textBody, key: app.document.uuid });
    coveredRoots.push(app.element);
  }

  // Entry-level sheets whose pages aren't individually registered (not
  // the standard case, but kept as a safety net for other sheet types).
  // Anything already covered by a dedicated page app above is skipped so
  // the same content is never scaled twice.
  for (const app of AppV2.instances()) {
    if (!isEntryDocument(app?.document)) continue;
    for (const textBody of queryPageContainers(app.element)) {
      if (coveredRoots.some((root) => root.contains(textBody))) continue;
      results.push({ app, textBody, key: resolveFallbackScaleKey(app, textBody) });
    }
  }

  return results;
}

/**
 * Every page/content container tied to a single app instance, with its
 * resolved key. Used on render restoration.
 * @returns {{ app: object, textBody: HTMLElement, key: string|null }[]}
 */
export function getPageTargetsForApp(app) {
  if (!app?.element) return [];

  if (isPageDocument(app.document)) {
    const textBody = findContentContainer(app.element);
    return textBody ? [{ app, textBody, key: app.document.uuid }] : [];
  }

  return queryPageContainers(app.element).map((textBody) => ({
    app,
    textBody,
    key: resolveFallbackScaleKey(app, textBody)
  }));
}
