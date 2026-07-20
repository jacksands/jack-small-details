# Jack Small Details — Technical Instructions (for future development)

Internal reference for whoever (human or AI assistant) adds the next feature
to this module. Not shown to end users — `INSTRUCTIONS.md` is the
player/GM-facing doc; this one is developer-facing.

---

## 1. Architecture: the Feature Registry

`scripts/main.mjs` is the single entry point declared in `module.json`
(`esmodules: ["scripts/main.mjs"]`). It does **not** contain feature logic —
it only imports each feature and drives four generic Foundry hooks:

```js
Hooks.once("init", () => {
  for (const Feature of FEATURES) Feature.registerSettings?.();
  // + registers the single "Instructions" settings menu
});

Hooks.once("ready", () => {
  for (const Feature of FEATURES) {
    if (Feature.isEnabled?.()) Feature.initialize?.();
  }
});

Hooks.on("getSceneControlButtons", (controls) => {
  for (const Feature of FEATURES) {
    if (Feature.isEnabled?.()) Feature.getSceneControlButtons?.(controls);
  }
});
```

Every feature is a **plain exported object**, not a class, implementing
whichever of these optional methods it needs:

| Method | Called | Purpose |
|---|---|---|
| `registerSettings()` | Always, at `init` | Register `game.settings`, `registerMenu`, `game.keybindings.register`. Runs regardless of whether the feature is enabled. |
| `isEnabled()` | Anywhere it's needed | Returns `Boolean`. Should never throw — always wrap `game.settings.get` in try/catch with a sane default, since settings may not exist yet in edge cases. |
| `initialize()` | At `ready`, only if `isEnabled()` | Attach global listeners, register feature-specific hooks (e.g. `Hooks.on("render...")`), do first-run setup. |
| `getSceneControlButtons(controls)` | On `getSceneControlButtons`, only if `isEnabled()` | Inject toolbar buttons into scene controls (see Darkness Slider for the pattern). |

Additionally, a feature may export a **`settingsGroup`** property (not called —
just read by `main.mjs`/`SettingsDividers.mjs`):

```js
settingsGroup: {
  label: "JSD.Settings.MyFeature.Label", // or a literal string
  keys: ["myFeature.enabled", "myFeature.someOption", "myFeatureSomeMenu"],
}
```

This is what groups the feature's rows together with a header on the
Settings page — see section 7 for why this is necessary and how it works.
It's optional: a feature with no `settingsGroup` just has its rows appear
wherever Foundry's default ordering puts them, ungrouped.

### To add a new feature

1. Create `scripts/features/my-feature.mjs` (single file) **or**
   `scripts/features/my-feature/` (subfolder with an `index.mjs` entry
   point) if the feature needs more than ~300 lines split across concerns
   (see Journal Scaler for this pattern: `constants.js`, `scaling.js`,
   `persistence.js`, etc., all imported by `index.mjs`, which is the only
   thing `main.mjs` imports).
2. Export a Feature object implementing the interface above.
3. Import it in `main.mjs` and add it to the `FEATURES` array. **Array
   order = display order in the Settings page** (both for the ungrouped
   default order and for where its `settingsGroup` header lands among the
   others).
4. If the feature registers more than one setting/menu, add a
   `settingsGroup` (see above) listing every key it owns, enabled-toggle
   first — otherwise its rows will scatter across the Settings page (see
   section 7).
5. Add any new i18n keys to `lang/en.json`.
6. Add a new `##` section to `INSTRUCTIONS.md` (see conventions below).
7. Bump `version` in `module.json`.

No changes to `module.json`'s `esmodules`/`styles`/`languages` arrays are
needed for a new feature *unless* it needs its own CSS file — everything
else funnels through the existing single entry points.

---

## 2. Settings namespace

All features share **one** module namespace: `game.settings.register("jack-small-details", key, ...)`.
Because of this, **every setting key must be prefixed per-feature** to avoid
collisions, e.g.:

- `darknessSlider.enabled`, `darknessSlider.updateMode`
- `sceneDefaults.enabled`, `sceneDefaults.data`
- `backgroundVolume.enabled`
- `journalScaler.enabled`, `journalScaler.scaleImages`, `journalScaler.pageScales`

Settings menus (`registerMenu`) and keybindings (`game.keybindings.register`)
also share the module namespace as their first argument, and their **second
argument (the menu/keybinding key)** should also be prefixed or otherwise
unique, e.g. `journalScalerResetAll`, `journalScalerResetScale`.

**Scope conventions observed so far:**
- `world` scope + `requiresReload: true` — for GM-facing features that
  affect the whole game world or every player uniformly (Darkness Slider,
  Scene Defaults, Background Volume).
- `client` scope — for features that are purely personal preference with
  zero effect on other players (Journal Scaler's enable toggle, its
  "always scale images" toggle, and its per-page scale data).

When adding a new feature's master enable/disable toggle, pick the scope
based on *whether it affects other players or the shared world state*, not
by default/habit.

---

## 3. Instructions viewer (single, unified)

There is exactly **one** in-Foundry instructions viewer:
`scripts/apps/InstructionsViewer.mjs`, registered once in `main.mjs` as the
`"instructions"` settings menu (`registerMenu`, `restricted: false` — any
player can open it, not just the GM).

It works by `fetch`-ing `modules/jack-small-details/INSTRUCTIONS.md` at
render time and running it through a small built-in Markdown → HTML
converter (`#markdownToHTML`, `#inline`, `#esc` private methods). Supported
subset: `#`/`##`/`###` headings, paragraphs, `---` horizontal rules,
GFM-style pipe tables, unordered/ordered lists, fenced code blocks, and
inline `**bold**`/`*italic*`/`` `code` ``.

**Every feature should use this single viewer — do not add a second
"Open Instructions" menu or a second Markdown renderer.** Instead:
- Add a new `##` section to `INSTRUCTIONS.md` with a stable anchor
  (GitHub-style: `## My Feature` → `#my-feature`).
- Add the anchor to the `## Features` bullet list near the top of the file.
- Styling for the viewer's rendered output lives in
  `styles/jack-small-details.css`, scoped under `#jsd-instructions-body`
  (headings, tables, code blocks, lists are all already styled — a new
  feature's instructions section does not need any new CSS).

(This replaced Journal Scaler's own standalone instructions app and CSS
file when it was merged in — see section 6.)

---

## 4. Generic ApplicationV2 hooks vs. specific hooks

Two patterns exist in this codebase for reacting to sheet rendering:

- **Specific hook + `instanceof`/property check inside**, e.g. Scene
  Defaults uses `Hooks.on("renderSceneConfig", ...)`. Prefer this when you
  only care about one particular sheet class Foundry already names.
- **Generic `renderApplicationV2` hook + manual type filtering inside the
  handler**, e.g. Journal Scaler uses `Hooks.on("renderApplicationV2", ...)`
  and filters with `isJournalDocument(app?.document)` itself. Necessary
  when the actual sheet class varies (e.g. core vs. Monk's Enhanced
  Journal both need to be caught) or isn't consistently named across
  Foundry versions/third-party modules — checking `app.document instanceof
  X` is more robust than guessing the class name of the render hook.

Register feature-specific hooks (of either kind) inside that feature's
`initialize()`, never in `main.mjs`, so they're only attached if
`isEnabled()` is true.

---

## 5. Persistence patterns

- **World-scoped settings** (`scope: "world"`) — shared config values, e.g.
  Scene Defaults' saved template data. Use `game.settings.register` with
  `config: false` for the actual data blob, plus a separate `config: true`
  boolean for the on/off toggle shown in the Settings UI.
- **Client-scoped settings** (`scope: "client"`) — personal preference data
  that must NOT be shared or require document edit permission, e.g.
  Journal Scaler's per-page scale map (keyed by document UUID, or
  `${entryUuid}::${pageId}` when a dedicated page-level app instance isn't
  available — see `journal-scaler/scaling.js`).
- **Document flags** (`document.setFlag(...)`) — use only when the data is
  genuinely part of the scene/document's own state and should be visible
  to everyone who opens that document, e.g. Background Volume's
  `scene.setFlag("jack-small-details", "backgroundVolume", value)`. Do
  **not** use a flag for anything that's a personal per-player preference —
  it would require every player to have edit permission on that document
  and would force the same value on everyone.
- When persisting on high-frequency events (mouse wheel, drag), debounce
  writes to the settings store (see `journal-scaler/persistence.js`'s
  `foundry.utils.debounce(..., 500)`) and keep a synchronous in-memory
  cache (`Map`/`WeakMap`) for reads so the hot path never blocks on
  `game.settings.get`.

---

## 6. History: Journal Scaler merge (v1.3.0)

Journal Scaler was originally a standalone module (`journal-scaler-by-jack`,
a V14 fork of "Journal Scaler" by Syrious, GPLv3, merged here with the
original author's permission). Ported as `scripts/features/journal-scaler/`
(subfolder pattern, six files feeding a single `index.mjs` Feature export).

Key adaptations made during the merge (relevant if this feature needs
further changes, or as a template for future ports of standalone modules
into this one):

- **Settings namespace**: `page-scales` → `journalScaler.pageScales`,
  `scale-images` → `journalScaler.scaleImages`; added a new
  `journalScaler.enabled` client-scoped toggle (the standalone module had
  no on/off switch of its own — it was all-or-nothing as a whole module).
- **Instructions viewer**: the standalone module's own
  `instructions-app.js` (ApplicationV2 + Markdown renderer) and its
  `styles/instructions.css` were **dropped entirely** — folded into a
  `## Journal Scaler` section of the shared `INSTRUCTIONS.md` instead,
  rendered by the existing `InstructionsViewer.mjs`. Its own "Open
  Instructions" settings menu was removed for the same reason (one shared
  menu now covers all features).
- **Keybinding registration**: the Feature interface has no dedicated slot
  for keybindings, so `game.keybindings.register(...)` is called directly
  inside `registerSettings()` (which always runs at `init`, same timing
  Foundry expects for keybinding registration). The `onDown` handler
  checks `isEnabled()` itself before acting, since keybindings register
  unconditionally but the action they trigger should not.
- **`renderApplicationV2` hook**: this was the first feature in this module
  to use the generic `renderApplicationV2` hook (others use
  document/sheet-specific hooks) — needed because journal page sheets
  aren't consistently one named class across core Foundry and third-party
  sheets like Monk's Enhanced Journal.
- Internal logic (scaling math, page-detection strategy, the two-pass
  font-scale fix, the image-baseline fix) was **not modified** — see the
  code comments in `scaling.js` and `persistence.js` for the reasoning
  behind each of those, carried over from the standalone module's own
  changelog.

---

## 7. Settings page grouping (`SettingsDividers.mjs`)

**The problem.** Foundry V14's Settings window (`SettingsConfig`, now built
on `CategoryBrowser`) renders one module's settings as a single flat list
of `.form-group` elements inside `section[data-category="<module-id>"]` —
but that list is **not** in registration order. It's split into two
sub-blocks: every `registerMenu` button first (in registration order
among menus), then every `register`'d setting field after (in
registration order among settings). This is structural, confirmed by
inspecting the actual rendered DOM in a live V14 world (not documented in
the API reference, which only covers `CategoryBrowser`'s class/methods,
not its template markup) — there is no registration-order trick that
avoids it. Left alone, this means a feature with both a setting and a menu
(e.g. Journal Scaler's "Journal Scaler" toggle + its "Reset All" button)
always has them pulled apart, and it gets worse as more features are
added.

**The fix.** `scripts/apps/SettingsDividers.mjs` hooks `renderApplicationV2`,
filters for `app instanceof foundry.applications.settings.SettingsConfig`,
then physically reorders the live DOM nodes inside
`section[data-category="jack-small-details"]`:

1. Any `.form-group` whose key is in the `ungroupedFirstKeys` list passed
   from `main.mjs` (currently just `"instructions"`) is moved to the very
   top, with no header — general documentation, not tied to one feature.
2. For each feature in `FEATURES` order, if it has a `settingsGroup`, its
   listed keys are moved to sit contiguously as a block, preceded by an
   injected `<hr>` + `<h3>` header (styled via `.jsd-settings-divider` in
   `jack-small-details.css`).
3. Anything left over (a setting not yet added to any `settingsGroup`, or
   something unrelated injected into the same category by another module)
   is appended at the end, unordered but never dropped.

It reads each `.form-group`'s owning key by checking, in order: an
`input[name]`/`select[name]` (settings) or a `[data-key]` attribute on a
`button` (menus), both formatted as `<module-id>.<key>`.

**Adding a new feature**: just give it a `settingsGroup` (see section 1)
— `SettingsDividers.mjs` itself never needs to change. It re-derives
everything from the `FEATURES` array and each feature's own
`settingsGroup` metadata every time Settings renders (idempotent — it
clears its own previously-injected headers first, so repeated re-renders,
e.g. after toggling a setting, never pile up duplicates).

**Caveats / things to watch for if this breaks on a future Foundry
update:**
- Relies on the exact DOM shape confirmed above
  (`section[data-category]` > flat list of `.form-group`, `[name]` /
  `[data-key]` attributes). If a Foundry update changes `CategoryBrowser`'s
  template, this needs re-confirming the same way it was built — via a
  live diagnostic in the browser console against a running V14 world, not
  by guessing from the API docs — before touching the code again.
- Config `config: false` settings (e.g. `journalScaler.pageScales`,
  `sceneDefaults.data`) never render a `.form-group` at all, so they're
  correctly never listed in any `settingsGroup.keys`.
- If `CategoryBrowser` ever switches to lazily rendering each category's
  content only when its tab is first clicked (rather than rendering all
  categories up front and just CSS-toggling visibility, which is what was
  observed), `renderApplicationV2` firing once at window-open time would
  no longer be enough — a second hook on tab switching would be needed.
  Not currently the case, but worth checking first if the grouping ever
  silently stops working after a core update.

---

## 8. History: Module Filter feature (v1.4.0)

Adds a second search field in the Settings sidebar
(`aside[data-application-part="sidebar"]`), injected right after
Foundry's native `<search>` element via
`insertAdjacentElement("afterend", ...)`. Confirmed the sidebar's exact
markup the same way as sections 6/7 — a live DOM capture, not a guess:

```
aside[data-application-part="sidebar"]
├── <search><input id="settings-config-search-filter">...</search>   ← native, untouched
├── <nav class="tabs vertical scrollable">
│   └── button[data-tab="<category-id>"] > span (name), span.count (badge)
└── <footer>...</footer>
```

Key points if this needs revisiting:
- The **native** search box was confirmed to only re-count/highlight
  matches — it never hides sidebar entries, even at zero matches. This
  feature's own field does the opposite (hides non-matching entries) on
  purpose, and only touches its own new input — the native field's
  element and listeners are never modified or removed.
- Reuses the plain `<search>` HTML tag (not a styled `<div>`) so it
  automatically inherits the same core CSS as the native search field,
  with zero extra styling needed beyond a small top margin.
- Same idempotent-on-render pattern as `SettingsDividers.mjs`: remove any
  previously-injected copy before adding a new one, so repeated
  `renderApplicationV2` fires never duplicate the field. The filter text
  is intentionally never preserved across re-renders or Settings window
  reopenings (confirmed preference — always starts empty).
- Registered as its own Feature (`module-filter.mjs`) with a
  `client`-scope `moduleFilter.enabled` toggle, `requiresReload: true` —
  same reasoning as Journal Scaler's toggle: this only affects what the
  current player sees in their own Settings window, never other players
  or world state.
- Third use in this module of the generic `renderApplicationV2` +
  `instanceof` pattern (after Journal Scaler's journal-render hook and
  `SettingsDividers.mjs`'s use for the settings content pane) — by now
  the established approach for anything that needs to react to
  ApplicationV2 renders whose exact hook name isn't confirmed or reliable
  across contexts.
- **Found during real-world testing**: the new input initially rendered
  with huge, bold, uppercase placeholder text. The native search box is
  evidently styled by Foundry via a specific selector (its id or a class),
  not generically by the `<search>` tag — so a new `<search>`/`<input>`
  can't safely assume it will inherit the native one's look. Some other
  cascade rule (likely meant for headings/labels elsewhere in the app)
  was leaking onto our unstyled input instead. Fixed by resetting the
  input explicitly (`all: revert` first, then explicit `font-size`,
  `font-weight`, `text-transform: none`) rather than relying on
  inheritance — see `.jsd-module-filter input[type="search"]` in
  `jack-small-details.css`. Lesson for next time something reuses a core
  Foundry tag for "free" styling: verify it visually in a live world
  before considering it done, don't assume tag-level reuse is safe.

## 9. v1.4.1 bugfixes + memory-leak audit

**Bug: Background Volume didn't survive a reload.** Reported symptom: mute
a scene via the slider, it works for the rest of that session, but the
scene has sound again after fully restarting Foundry. The saved value
(`scene.getFlag("jack-small-details", "backgroundVolume")`) turned out to
be persisting correctly the whole time — the bug was in *applying* it on
load, not storing it. `updateBackgroundVolume()` only ran once, synchronously,
on `canvasReady`, and looked for the target video element via
`canvas.primary.videoMeshes`. Background video textures can still be mid-load
at the exact moment `canvasReady` fires (a known async-loading quirk with
Foundry's video texture pipeline, not specific to this module) — if the mesh
isn't in that list yet, the single attempt silently finds nothing to mute,
and nothing ever retries for the rest of the session unless some unrelated
Scene update or ambient-volume change happens to re-trigger it. This matches
the reported pattern exactly (works when manually adjusted mid-session,
fails on a fresh load).

**Fix**: `canvasReady` now schedules `updateBackgroundVolume()` at
`[0, 200, 500, 1000, 2000, 4000]`ms via `scheduleBackgroundVolumeUpdate()`
instead of calling it once. Cheap and idempotent — each retry just
re-applies the same target volume to whatever video meshes currently
exist, so it's harmless even on the (usual) case where the mesh was
already there on the first attempt. If this pattern needs to repeat for a
future feature that has to touch canvas objects on load, prefer this
retry-window approach over guessing at a more specific "resource actually
loaded" hook name unless one is confirmed via a live diagnostic first.

**Also while in this code**: `Hooks.on("updateDocument", ...)` was
swapped for the more specific `Hooks.on("updateScene", ...)`.
`updateDocument` is a wildcard that fires for every document type in the
world on every update (any actor, token, item, journal, etc.) — this
handler only ever cared about Scene updates, so the `instanceof Scene`
check inside it was doing that filtering the expensive way, on every
single document update in a potentially busy game. Not a leak by itself
(the callback doesn't accumulate anything), just unnecessary overhead —
worth remembering as a general rule for any future feature: prefer the
specific `update<DocumentType>` hook over generic `updateDocument` /
`createDocument` / `deleteDocument` unless genuinely reacting to every
document type.

**Memory-leak / hook-loop audit (general slowness report).** Went through
every `Hooks.on`/`Hooks.once`, `addEventListener`, and `setInterval`/
`setTimeout` call in the module (`grep -rn` across `scripts/`) checking
specifically for hooks or listeners registered inside a function that
runs more than once per session without ever being torn down — the usual
shape of this kind of leak. Findings:
- Every `Hooks.on(...)` call across the whole module lives inside a
  Feature's `registerSettings()` or `initialize()`, or inside
  `SettingsDividers.mjs`/`main.mjs`'s init block — all of which run
  **exactly once per session** (see section 1). None of these ever
  register a new hook per render/per open — no accumulation there.
- `DarknessPanel.mjs`'s `_onRender()` attaches several listeners
  (including one on `document` itself, for click-outside-closes) scoped
  to a per-render `AbortController`, aborted in `_onClose()` — correct
  cleanup, **provided `_onRender` never fires twice on the same open
  instance without a close in between**. The current open/close flow
  (`darkness-slider.mjs#_onTogglePanel`) always either closes an existing
  instance or creates a brand new one, never re-renders an already-open
  one — so this wasn't reproducible as an actual leak in the current code
  path. Hardened anyway (`this.#abortController?.abort()` before
  creating the new one in `_onRender`), since it's a one-line, zero-risk
  fix for a scenario that would otherwise silently orphan a
  `document`-level listener on every occurrence.
- `background-volume.mjs`'s `renderSceneConfig` handler re-runs on every
  Scene Config open, but attaches its listeners to a **freshly-created**
  slider element each time (from the template render) — old listeners
  die with the old DOM node when Scene Config closes/re-renders. No leak.
- `scene-defaults.mjs`'s `_onRenderSceneConfig` already has an explicit
  own-recursion guard (`app._jsdDefaultsApplied`) preventing the
  `app.render()` call inside it from looping — comment in the code
  literally says "evitar loops infinitos". No issue found here.

**Conclusion**: no clear leak or hook-loop pattern was found in this
module that would explain a *general, worsening-over-the-session*
slowdown — everything hook-related here registers once and stays
constant regardless of session length. The two changes above are real
fixes/hardening worth keeping, but if the overall Foundry slowness
persists after this update, it's more likely coming from somewhere else
(another module, world/scene size, or browser-level texture/GPU memory
growth over a long session). If it needs to be pinned down: Chrome
DevTools → Performance Monitor / Memory tab, watch listener count and JS
heap size over a session with only this module enabled vs. others
disabled one at a time.
