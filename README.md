# Jack Small Details

A personal collection of small quality-of-life improvements for **Foundry VTT v14**.

![Foundry v14](https://img.shields.io/badge/Foundry-v14-9f1a1c)
![Version](https://img.shields.io/badge/version-1.9.4-blue)
![License: MIT](https://img.shields.io/badge/license-MIT-green)
![Requires lib-wrapper](https://img.shields.io/badge/requires-lib--wrapper-orange)

Jack Small Details (JSD) bundles twelve independent features in one module. Each one has its
own on/off switch in **Settings → Module Settings → Jack Small Details**; turning one off does
not affect the others.

| Area | Features |
|------|----------|
| Scenes and lighting | [Darkness Slider](#darkness-slider), [Scene Defaults](#scene-defaults), [Background Volume](#background-volume), [GM Clear Vision](#gm-clear-vision) |
| File Browser | [Folder Filter](#file-picker-folder-filter), [Readable Names](#file-picker-readable-names) |
| Interface | [Journal Scaler](#journal-scaler), [Module Filter](#module-filter), [Fix Blank Line Spacing](#fix-blank-line-spacing), [Sort Status Effects](#sort-status-effects) |
| Macros | [JSD Panel and Macro Library](#jsd-panel-and-macro-library), [Broadcast](#broadcast) |

The in-game guide (**Settings → Jack Small Details → Open Instructions**) is `INSTRUCTIONS.md`
and covers every feature step by step. Developer notes are in `technical-instructions.md`.

---

## Requirements

- **Foundry VTT v14** (`compatibility.minimum` and `verified` are both 14).
- **[lib-wrapper](https://github.com/ruipin/fvtt-lib-wrapper) 1.13.0.0 or newer.** It is a hard
  requirement in `module.json`, so Foundry will not let you enable JSD without it. Only
  GM Clear Vision actually uses it; if lib-wrapper is missing at runtime that feature disables
  itself and logs a warning.

## Installation

**Manifest (recommended).** In *Setup → Add-on Modules → Install Module*, paste:

```
https://raw.githubusercontent.com/jacksands/jack-small-details/refs/heads/main/module.json
```

**Manual.** Copy the module folder to `Data/modules/jack-small-details/` (the folder name must be
exactly `jack-small-details`) and enable it in your world.

---

## Features

### Darkness Slider

A floating panel to change a scene's darkness without opening Scene Configuration. Activate the
**Lighting** controls and click the **moon icon** at the bottom of the toolbar. GM only.

- **On Apply** (default): changes are saved when you press Apply, Cancel reverts.
- **Real-time**: the scene darkness updates and saves while you drag.
- Settings: *Darkness Slider* (world, reload) and *Update Mode* (world).

### Scene Defaults

New scenes open their configuration form pre-filled with your saved defaults (grid, lighting,
environment, vision...). Nothing is saved until you submit the form as usual. Imported scenes
(adventures, compendiums) are not touched.

- Settings: *Apply Scene Defaults to New Scenes* (world) and the **Configure Scene Defaults** menu.
- Known limitation: Level elevation values on the Levels tab are not stored by the defaults.

### Background Volume

A per-scene volume slider for **video backgrounds**, added at the top of Scene Configuration.
Final volume is *global Ambient volume x scene volume*. The value is stored as a flag on the
scene (`jack-small-details.backgroundVolume`). Setting: *Background Volume Slider* (world, reload).

### Journal Scaler

Scale journal text and images without leaving the page.

| Control | Action |
|---------|--------|
| `Ctrl` + wheel | Scale text (and images, if *Always scale images* is on) |
| `Ctrl` + `Shift` + wheel | Also scale images when *Always scale images* is off |
| `Shift` + `=` | Reset the page under the cursor to 100% (rebindable) |

The scale is remembered per journal page and per browser; it is never shared with other players.
Settings (all per client): *Journal Scaler* (reload), *Always scale images*, and the
**Reset All** menu.

### Module Filter

A second search field under the native search in the Settings sidebar. Typing hides every module
whose **name** does not contain the text. Setting: *Module Filter* (client, reload).

### File Picker Folder Filter

Adds a **Filter folders...** field next to the native *Filter Results* field of the File Browser.

- Filters only the folder pane, never the files. The native filter keeps working.
- Clears itself when you open a folder; `Esc` clears it without closing the picker.
- Searches the *readable* name: typing `ações` finds `ANIMA%C3%87%C3%95ES` (accents must match).
- Setting: *File Picker Folder Filter* (client, reload).

### File Picker: Readable Names

Foundry stores paths URL-encoded (`Infused%20Mana%20Crystal`, `ANIMA%C3%87%C3%95ES`). This feature
**displays** them decoded (`Infused Mana Crystal`, `ANIMAÇÕES`, `[2]`), without ever changing
a stored value.

- Works in the File Browser (names, favorites, tooltips) and in path fields such as *Tile Image*
  and *Scene Background* in any window.
- In path fields the readable text is drawn over the real one and stays visible while the field
  is focused. Hover for the full decoded name.
- `Ctrl+C` always copies the **whole real path**. `Ctrl+A` then typing/pasting replaces it.
  Any other edit switches the field to the real text first, ignoring that first keystroke, so
  nothing is ever inserted at a wrong position.
- A header button (the `Aa` icon) appears in the File Browser and in every window with path
  fields: **click** to turn it on/off, **right-click or Shift+click** to copy the *clean* decoded
  path. The same toggle is in the JSD Panel (GM).
- Decoder rules: only valid `%XX` runs, one pass (`%2541` becomes `%41`), invalid UTF-8 never
  throws, control characters stay encoded.
- Setting: *File Picker: Show Readable Names* (per user, applies instantly).

### GM Clear Vision

GM-only. An **eye icon** in the Token Tools (or `Ctrl+G`) brightens darkness and unexplored fog
for you only. Hidden or undetected tokens get a dashed outline.

- Setting *Hidden Token Outline*: always on (default), only while the eye is active, or off.
- **Multi-level scenes:** hidden tokens are revealed on the level you are viewing. For other
  levels they are revealed only when no sight-blocking surface covers them, so a token seen
  through a hole in the floor still shows and one under solid floor does not.
- Settings: *GM Clear Vision* (world, reload), *Hidden Token Outline* (world). Needs lib-wrapper.

### Fix Blank Line Spacing

Blank lines typed in journals, sheet descriptions and chat messages keep a visible height instead
of collapsing to zero. Purely visual. Setting: *Fix Blank Line Spacing* (world, no reload).

### Sort Status Effects

Sorts the Token HUD status-effect palette alphabetically. If the system groups effects
separately (for example Daggerheart) each group is sorted on its own. Setting:
*Sort Status Effects* (per user, off by default, reload).

### JSD Panel and Macro Library

GM-only. A **toolbox icon** in the Scene Controls opens the **JSD Panel**:

| Button | Action |
|--------|--------|
| Darkness Level | The darkness slider, plus Token Vision, Global Light and Fog Exploration controls |
| Macro Library | Lists the macros of the module compendium; click one to run it |
| Scene Defaults | Opens the Scene Defaults configuration |
| GM Clear Vision | Toggles GM Clear Vision |
| Readable names | Toggles File Picker: Readable Names |
| JSD Module Settings | Opens Settings on the Jack Small Details tab |

The library lives in the module compendium `jack-small-details.jsd-macros` and is seeded on first
load with seven macros (*Item to Journal*, *Lock Token Rotation*, *Mass Scene Editor*,
*Ownership Manager*, *Scene & Door Control*, *Scene Rescaler*, *Hide Camera Bar*). **Manage Macro
Library** (settings menu, GM) lets you add, remove and describe macros, and export, import or reset
the configuration. Changes made anywhere, even directly in the compendium window, refresh the open
JSD windows. Setting: *Macro Library Panel* (world, reload).

### Broadcast

Infrastructure for macros: show a **read-only window** to other connected users. It does nothing by
itself; macros that support it add an *Exibir para Conectados* button.

| Direction | Allowed |
|-----------|---------|
| GM to players | always |
| Player to GM | only if *accept windows from* is **Any connected user** |
| Player to player | not directly |

The sender sends a static HTML and CSS snapshot, never code. Receivers sanitize it (scripts, event
attributes, `javascript:` URLs, iframes, forms and `data-action` are removed) and scope its CSS to
the window. Target filtering is done on each client, so do not send secrets: the payload reaches
every connected client, and the sender is not cryptographically authenticated.

Settings: *Broadcast* (world, reload) and *Broadcast: accept windows from* (world).

```js
const bc = game.modules.get("jack-small-details")?.api?.broadcast;
if (!bc) return ui.notifications.warn("JSD Broadcast unavailable.");

bc.show({ id: "my-window", title: "Loot", html: "<p>Content</p>", css: "p { margin: 0 }" },
        { to: "all" });          // "all" | "gm" | "players" | [userId, ...]

bc.close("my-window");           // close it on the targets
bc.attachButton(windowElement, { id: "my-window", to: "players" }); // header button
bc.snapshot(windowElement);      // { html, css } of a live window
bc.esc(userText);                // HTML-escape helper for interpolated text
```

`module.json` must keep `"socket": true`. The full macro-side contract is in section 10 of
`technical-instructions.md`.

---

## Keybindings

Configure in **Game Settings → Configure Controls → Jack Small Details**.

| Action | Default | Who |
|--------|---------|-----|
| Toggle GM Clear Vision | `Ctrl+G` | GM |
| Reset Journal Scale | `Shift+=` | everyone |

## Settings scope at a glance

| Scope | Settings |
|-------|----------|
| **World** (shared) | Darkness Slider + update mode, Scene Defaults, Background Volume, GM Clear Vision + outline mode, Fix Blank Line Spacing, Macro Library Panel, Broadcast + accept-from |
| **Client** (per browser) | Journal Scaler (+ images, page scales), Module Filter, File Picker Folder Filter, GM Clear Vision eye state |
| **User** (per user, per world) | File Picker: Readable Names, Sort Status Effects |

## Architecture

Each feature is one file in `scripts/features/` exporting an object with the same shape:

```js
export const MyFeature = {
  settingsGroup: { label: "I18N.Key", keys: ["setting.key"] },
  isEnabled() { /* read the on/off setting */ },
  registerSettings() { /* runs at "init", always */ },
  setup() { /* "setup" hook, only if enabled */ },
  initialize() { /* "ready" hook, only if enabled */ },
  getSceneControlButtons(controls) { /* only if enabled; add tools to controls.jsd */ },
};
```

`scripts/main.mjs` lists every feature in `FEATURES` and calls each method through a `safeCall`
wrapper, so one failing feature cannot stop the others. Adding a feature means one file, one
import and one entry in that array.

- **Theme:** the panels use the Modern palette (`UI_Modern.md`). `--jsd-*` variables are defined
  once, on the window roots (`#jsd-darkness-panel`, `#jsd-macro-lib-panel`, `#jsd-instructions`,
  `#jsd-mls-root`, `.jsd-settings-divider`), never on `:root`.
- **Socket channel:** `module.jack-small-details`, shared by socket features, each tagged with its
  own `feature` field (Broadcast uses `"broadcast"`).
- **Compendium:** `packs/jsd-macros` (Macro), module-level, so it is shared across worlds.

## Troubleshooting

| Problem | What to check |
|---------|---------------|
| A macro says *JSD Broadcast indisponivel* | JSD must be enabled, the *Broadcast* setting on, and `module.json` must contain `"socket": true`. Reload the world after changing it. |
| GM Clear Vision missing | lib-wrapper must be installed and active; the feature is GM-only. |
| A style change has no effect (for example an icon that never turns green) | The browser is serving a cached `jack-small-details.css`. Hard refresh with `Ctrl+F5`. |
| File Browser names still show `%20` | The *Show Readable Names* toggle may be off: click the `Aa` icon in the window header. |
| Macro Library is empty | It is seeded on the first load by a GM; or use *Manage Macro Library → Importar Config*. |

## License

MIT, see [LICENSE](LICENSE).

## Links

- Repository: https://github.com/jacksands/jack-small-details
- Manifest: https://raw.githubusercontent.com/jacksands/jack-small-details/refs/heads/main/module.json

Built on [lib-wrapper](https://github.com/ruipin/fvtt-lib-wrapper) by ruipin.
