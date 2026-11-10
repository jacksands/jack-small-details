# Jack Small Details

> A personal collection of small quality-of-life improvements for Foundry VTT v14+.

[![Foundry v14](https://img.shields.io/badge/Foundry-v14%2B-9f1a1c)](https://foundryvtt.com)
[![Module Version](https://img.shields.io/badge/version-1.9.3-blue)](https://github.com/jacksands/jack-small-details)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Requires: lib-wrapper](https://img.shields.io/badge/requires-lib--wrapper-orange)](https://github.com/ruipin/fvtt-lib-wrapper)

---

## 🎯 Overview

**Jack Small Details (JSD)** bundles 13 independent features into a single module. Each feature can be enabled/disabled individually in **Module Settings → Jack Small Details**. No mandatory dependencies between features — enable only what you need.

| Category | Features |
|----------|----------|
| **Scene & Lighting** | Darkness Slider, Scene Defaults, Background Volume, GM Clear Vision |
| **File Management** | File Picker Folder Filter, File Picker Readable Names |
| **UI & UX** | Journal Scaler, Module Filter, Text Spacing Fix, Status Sort |
| **Automation** | Macro Library Panel, Broadcast (window sharing), Macro Library Compendium |

---

## 📦 Installation

### Via Manifest (Recommended)
```
https://raw.githubusercontent.com/jacksands/jack-small-details/refs/heads/main/module.json
```
Paste into **Foundry Setup → Add-on Modules → Install Module → Manifest URL**.

### Manual
1. Download latest release from [Releases](https://github.com/jacksands/jack-small-details/releases)
2. Extract to `Data/modules/jack-small-details/`
3. Enable in **Manage Modules**

### Required Dependency
- **[lib-wrapper](https://github.com/ruipin/fvtt-lib-wrapper)** (v1.13.0+) — Required for **GM Clear Vision** only. Other features work without it.

---

## ⚙️ Features

### 1. Darkness Slider
**Settings:** `Darkness Slider` + `Update Mode` (Realtime / On Apply)

Adds a darkness level slider to the **Lighting Layer controls** (top-left canvas toolbar). Adjust scene darkness without opening Scene Configuration.

- **Realtime:** Updates scene darkness as you drag
- **On Apply:** Only saves when you click "Apply" button
- GM only; persists per scene

---

### 2. Scene Defaults
**Settings:** `Apply Scene Defaults to New Scenes` + `Configure Scene Defaults` (menu)

Define default values for new scenes (darkness, grid, vision, fog, etc.). When enabled, every new scene you create inherits these settings.

- Does not affect imported scenes (adventure packs, compendiums)
- Opens native Scene Config with your defaults pre-filled
- World setting

---

### 3. Background Volume
**Settings:** `Background Volume` (enabled by default)

Adds a volume slider to the **Playlist directory header** for quick ambient/background audio control without opening the playlist folder.

---

### 4. Journal Scaler
**Settings:** `Journal Scaler` + `Always scale images` + `Reset All Scales` (menu) + Keybinding: `Reset Journal Scale`

**Ctrl + Mouse Wheel** on any journal entry/page scales text (and optionally images) for comfortable reading.

- Per-user, per-journal-page persistence
- `Always scale images`: images scale with text (default: off — hold **Ctrl+Shift** to scale images only)
- `Reset All Scales`: nuclear option — clears all saved scales across all journals
- Keybinding resets the journal under cursor to 100%

---

### 5. Module Filter
**Settings:** `Module Filter` (requires reload)

Adds a second search field **below Foundry's native Settings search** in the sidebar. Filters the module list by name only.

- Native search unchanged (still searches descriptions, authors, etc.)
- Type "jack" → only Jack Small Details remains visible
- Client setting, requires reload

---

### 6. File Picker Folder Filter
**Settings:** `File Picker Folder Filter` (requires reload)

Adds a **"Filter folders…" field next to the native "Filter Results"** in the File Browser.

- Filters **only the left folder pane** (never files)
- **Auto-clears** when you open a folder — filter again inside the new folder
- Native filter remains fully functional
- Client setting, requires reload

---

### 7. File Picker: Show Readable Names (Decode %20, %C3…)
**Settings:** `File Picker: Show Readable Names` + **Header toggle** (🔤 icon) + **Scene Controls tool** (JSD Panel)

Decodes URL-encoded paths **for display only** — stored values never change.

| Encoded | Displayed |
|---------|-----------|
| `%20` | space |
| `%C3%87` | `Ç` |
| `%C3%95` | `Õ` |
| `%5B` / `%5D` | `[` / `]` |

**Works in:**
- File Browser (folder/file names, tooltips)
- Path input fields (Tile Image, Scene Background, Journal cover, etc.) — shows decoded overlay while focused
- **Ctrl+C** copies the **real encoded path** (safe for saving)
- First edit (typing, delete, partial paste) switches to real text without inserting garbage
- Hover any path field → tooltip shows full decoded name

**Toggle:** Header icon (🔤) in any window with path fields, or JSD Panel tool in Scene Controls. **Right-click / Shift+click** the icon → copies clean decoded path to clipboard.

---

### 8. GM Clear Vision
**Settings:** `GM Clear Vision` (master toggle, requires reload, requires lib-wrapper) + `Hidden Token Outline` mode + Keybinding: `Toggle GM Clear Vision`

**GM-only** vision enhancer with two independent effects:

| Effect | Control |
|--------|---------|
| **Darkness/Fog Brightening** | Scene Controls tool (eye icon) or **Ctrl+G** — toggles fullbright vision |
| **Hidden Token Outline** | Dashed outline on hidden/undetected tokens — three modes: `Always`, `Linked to eye icon`, `Off` |

- Token Tools icon (eye) only appears for GMs
- Outline color respects token vision config
- Requires **lib-wrapper** for canvas shader injection

---

### 9. Fix Blank Line Spacing
**Settings:** `Fix Blank Line Spacing` (world setting, no reload)

Preserves visible blank lines in:
- Journal entries (`.journal-page-content p`)
- Sheet descriptions (`.editor-content p`)
- Chat messages (`.message-content p`)

Instead of collapsing empty `<p></p>` or `<p><br></p>` to zero height, gives them `min-height: 1.5em`.

---

### 10. Sort Status Effects
**Settings:** `Sort Status Effects` (requires reload)

Sorts the **Token HUD status effects palette** alphabetically within each group.

- If the active system groups effects separately (e.g., Daggerheart), each group sorted independently
- Personal preference (client setting)

---

### 11. Macro Library Panel
**Settings:** `Macro Library Panel` (requires reload) + `Manage Macro Library` (menu, GM only)

Adds a **JSD Panel button** (toolbox icon) to Scene Controls sidebar with:
- **Darkness Slider** (copy of Lighting layer control)
- **Macro Library launcher** → opens frameless panel with your macros
- **Scene Defaults** quick access
- **GM Clear Vision** toggle
- **Module Settings** shortcut

**Macro Library Panel features:**
- Lists macros from module compendium `jack-small-details.jsd-macros`
- Click ▶ to execute macro
- Custom descriptions per macro (stored in compendium flags)
- **Auto-sync:** Changes in compendium (Foundry editor, drag-drop, settings menu) refresh open panels within 300ms
- **Manage Library** menu: add/remove/edit macros, import/export JSON, reset to seed

**Compendium:** Module-level (cross-world), seeded on first run from `packs/jsd-macros-seed.json`.

---

### 12. Broadcast (Window Sharing)
**Settings:** `Broadcast` (requires reload) + `Accept From: GM only / Anyone` (world)

**Lets ANY macro show a read-only window to other connected users.**

```
GM → Players    ✅ Always
Player → GM     ✅ If "Accept From: Anyone"
Player → Player ❌ Not directly (use GM as relay)
```

**How it works:**
1. Sender macro builds a **static HTML+CSS snapshot** and calls:
   ```js
   game.modules.get("jack-small-details").api.broadcast.show({
     id: "my-unique-id",        // Re-send same ID to update in place
     title: "Window Title",
     html: "<div>Content</div>", // Sanitized on receiver
     css: ".my-class { color: red }", // Scoped to window
     width: 600,
     height: 400
   }, { to: "all" });           // "all" | "gm" | "players" | [userIds]
   ```
2. Every target client opens a generic **BroadcastWindow** (ApplicationV2) with sanitized content
3. No macro code executes on receivers — security by design

**Security:**
- Receiver sanitizes: strips `<script>`, `on*`, `javascript:` URLs, iframes, forms, `data-action`
- CSS scoped to window's `#id` via native CSS nesting
- Target filtering done **client-side** — payload travels to all, don't send secrets
- `senderId` not cryptographically authenticated — "GM only" is convenience, not a wall

**Convenience API:**
```js
// Snapshot a live window and broadcast it
broadcastAPI.attachButton(windowElement, { id: "my-id", to: "gm" });
// Adds "Mostrar aos Conectados" (📡) icon to window header
```

---

### 13. Macro Library Compendium
**Included pack:** `JSD — Macro Library` (`jack-small-details.jsd-macros`)

Pre-seeded with useful macros. Manage via **Module Settings → Macro Library → Manage Macro Library** (GM only).

---

## 🎮 JSD Panel (Scene Controls)

The **toolbox icon** in Scene Controls (left sidebar) opens a frameless panel with quick access to:

| Button | Action |
|--------|--------|
| 🌙 Darkness | Opens Darkness Panel (if Darkness Slider enabled) |
| 📜 Macro Library | Opens Macro Library Panel |
| 🎬 Scene Defaults | Opens Scene Defaults menu |
| 👁️ GM Clear Vision | Toggles GM Clear Vision (if enabled) |
| ⚙️ Settings | Opens JSD Module Settings tab |

Other JSD features (File Picker Readable Names, etc.) also register tools here.

---

## 🔧 Macro API Reference

### Broadcast
```js
const api = game.modules.get("jack-small-details").api.broadcast;

api.show(payload, { to, local });      // Show window to others
api.close(id, { to, local });          // Close window on targets
api.snapshot(element, opts);           // Get { html, css } from live window
api.attachButton(element, opts);       // Add broadcast button to window header
api.esc(string);                       // HTML escape helper
```

### Macro Library
```js
const pack = game.packs.get("jack-small-details.jsd-macros");
// Standard CompendiumCollection API
await pack.getDocuments();
await Macro.create(data, { pack: "jack-small-details.jsd-macros" });
```

---

## ⌨️ Keybindings

| Action | Default | Scope |
|--------|---------|-------|
| Toggle GM Clear Vision | `Ctrl+G` | GM only |
| Reset Journal Scale | (none) | User |
| Toggle File Picker Readable Names | (none) | User |

Configure in **Game Settings → Keybindings → Jack Small Details**.

---

## 🌐 Localization

English (`en.json`) included. To add a language:
1. Copy `lang/en.json` → `lang/{code}.json`
2. Translate values
3. Add to `module.json` → `languages` array
4. PR welcome!

---

## 🏗️ Architecture (For Developers)

### Feature Interface
Each feature in `scripts/features/*.mjs` exports a `Feature` object:

```js
export const MyFeature = {
  settingsGroup: { label: "I18N.Key", keys: ["setting.key"] },
  isEnabled() { return game.settings.get(MODULE, "setting.key"); },
  registerSettings() { game.settings.register(...); },
  setup() { /* called on "setup" hook */ },
  initialize() { /* called on "ready" hook */ },
  getSceneControlButtons(controls) { /* add to controls.jsd */ },
};
```

### Main Entry (`scripts/main.mjs`)
- Registers all features in `FEATURES[]`
- Safe-call wrapper with error logging
- Hooks: `init` → `setup` → `ready` → `getSceneControlButtons`

### CSS Variables (Modern UI)
All panels scope variables to their root ID (per `UI_Modern.md`):

```css
#jsd-darkness-panel,
#jsd-macro-lib-panel,
#jsd-instructions {
  --jsd-bg-primary:     #1e1812;
  --jsd-accent:         #d4a574;
  /* ... 20+ variables */
}
```
Override per-panel: `#jsd-darkness-panel { --jsd-accent: #00ff00; }`

### Socket Channel
`module.jack-small-details` — currently used only by Broadcast (`feature: "broadcast"`).

---

## 🐛 Troubleshooting

| Issue | Fix |
|-------|-----|
| Broadcast not working | Ensure `"socket": true` in module.json (v1.9.3+), reload world |
| GM Clear Vision missing | Install **lib-wrapper**, enable in settings, reload |
| File Picker names not decoding | Toggle header icon (🔤) or JSD Panel tool; check setting enabled |
| Macro Library empty | Wait for auto-seed (first run) or use Manage Library → Import |
| Settings not showing | Clear browser cache, reload Foundry |
| CSS looks broken | Hard refresh (Ctrl+F5) — CSS cached aggressively |

---

## 📄 License

MIT — see [LICENSE](LICENSE).

---

## 🔗 Links

- **Repository:** https://github.com/jacksands/jack-small-details
- **Issues:** https://github.com/jacksands/jack-small-details/issues
- **Manifest:** https://raw.githubusercontent.com/jacksands/jack-small-details/refs/heads/main/module.json
- **Foundry Hub:** https://foundryvtt.com/packages/jack-small-details/

---

## 🙏 Credits

- **lib-wrapper** by [ruipin](https://github.com/ruipin) — GM Clear Vision dependency
- **Foundry VTT** by [League of Extraordinary Developers](https://foundryvtt.com)
- Inspiration from various community modules (Journal Scaler, Darkness Slider patterns)

---

> **Jack Small Details** — because the small details matter.