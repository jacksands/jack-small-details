# Jack Small Details

A personal collection of small quality-of-life improvements for Foundry VTT V14.

---

## Features

- [Darkness Slider](#darkness-slider)
- [Scene Defaults](#scene-defaults)
- [Background Volume Slider](#background-volume-slider)
- [Journal Scaler](#journal-scaler)
- [Module Filter](#module-filter)
- [File Picker Folder Filter](#file-picker-folder-filter)
- [File Picker: Readable Names](#file-picker-readable-names)
- [GM Clear Vision](#gm-clear-vision)
- [Fix Blank Line Spacing](#fix-blank-line-spacing)
- [Sort Status Effects](#sort-status-effects)
- [JSD Panel and Macro Library](#jsd-panel-and-macro-library)

---

## Darkness Slider

A floating quick-access panel to adjust scene darkness without opening the full Scene Configuration.

### How to use

1. Activate the **Lighting** layer controls (left sidebar, light bulb icon).
2. Click the **moon icon** (`🌙`) that appears at the bottom of the toolbar.
3. A small panel opens next to the button with a slider and a numeric input (0.00 – 1.00).
4. Adjust the darkness level and confirm (or cancel) depending on the active update mode.

### Settings

| Setting | Description |
|---------|-------------|
| **Darkness Slider** | Enable or disable this feature entirely. Requires reload. |
| **Update Mode** | Controls when changes are committed to the scene. |

**Update Modes:**

- **On Apply** *(default)* — Changes are only saved when you click the **Apply** button. Click **Cancel** to revert to the original value.
- **Real-time** — The scene darkness updates live as you drag the slider. Every change is immediately saved. There is no cancel.

### Notes

- Only visible to **GMs**.
- Clicking outside the panel closes it automatically.
- Works on any active scene.

---

## Scene Defaults

Automatically applies predefined configuration values to every newly created scene. When you create a scene, the full Scene Configuration form opens pre-populated with your saved defaults instead of Foundry's blank defaults.

### How to configure

1. Go to **Settings → Module Settings → Jack Small Details**.
2. Click **Configure Scene Defaults**.
3. The full Scene Configuration editor opens, loaded with the currently saved defaults (or Foundry's defaults if not yet configured).
4. Adjust any fields you want to set as defaults: Grid, Lighting, Environment, Vision, etc.
5. Click **Save Changes** (the standard form submit button). The defaults are saved — the temporary scene used for editing is automatically deleted.

### How it works when creating scenes

1. A new scene is created (via the Scene Directory **+** button or any other method).
2. Foundry opens the Scene Configuration form for the new scene.
3. The module detects the new scene and injects your saved defaults directly into the form.
4. You can review and adjust anything before clicking **Update Scene** as you normally would.
5. **The defaults are only pre-filled in the form — nothing is saved to the database until you submit the form normally.**

### What is and is not affected

| Affected | Not affected |
|----------|-------------|
| New scenes created via the Scene Directory | Scenes imported from adventure packs or compendiums |
| Any configurable field in Scene Config | Scene name, dimensions, background image path |
| Lighting, Environment, Vision, Grid settings | Scene-level thumbnail, folder, ownership |

### Known limitation

- **Level elevation (height)** values in the **Levels** tab are currently not saved by the defaults configuration. All other Level properties (e.g. level name) function normally. This is a known issue for a future fix.

### Settings

| Setting | Description |
|---------|-------------|
| **Apply Scene Defaults to New Scenes** | Enable or disable automatic injection of defaults into new scenes. |
| **Configure Scene Defaults** | Opens the configuration editor to define your default values. |

### Notes

- Settings are **per-world** (`scope: "world"`). Defaults configured in one world are independent from other worlds. You must configure defaults separately in each world.
- Only the GM can configure Scene Defaults.
- The configuration editor creates a temporary scene that is automatically deleted when you save or close the editor.

---

## Background Volume Slider

Adds a per-scene volume control for background videos directly inside the Scene Configuration window. Useful for scenes that use video backgrounds — lets you set a custom volume level independently of the global Ambient Volume slider.

### How to use

1. Open any scene's configuration (double-click the scene in the Scene Directory, or right-click → Configure).
2. A **Background Volume** slider appears at the top of the scene configuration form.
3. Drag the slider to set the desired video volume for this scene (0 = muted, 1 = full volume).
4. The change takes effect immediately on the current canvas preview.
5. The volume is permanently saved per-scene when the form is submitted normally.

### How volume is calculated

The final playback volume is: `Global Ambient Volume × Scene Background Volume`.

So if the global Ambient volume is at 50% and the scene volume is set to 0.8, the video plays at 40% of its maximum volume.

### Settings

| Setting | Description |
|---------|-------------|
| **Background Volume Slider** | Enable or disable this feature entirely. Requires reload. |

### Notes

- The volume value is stored as a **flag** on the scene document (`jack-small-details.backgroundVolume`), so it persists across sessions without affecting the core scene data.
- The slider applies to **all video Levels** of the scene simultaneously.
- Volume automatically re-applies whenever you switch to a scene or change the global Ambient Volume slider.

---

## Journal Scaler

Scale journal text and images without leaving the journal window.

### Controls

- **CTRL + Mouse Wheel** — scale the journal text up or down.
- **CTRL + SHIFT + Mouse Wheel** — also scale images (only needed if "Always scale images" is disabled below).
- **SHIFT + =** (rebindable in **Configure Controls**) — reset the journal page currently under your cursor back to 100% text and image scale.

While scaling, a small badge briefly appears in the corner of the journal window showing the current percentage (e.g. `120%`, or `Text 120% · Image 100%` if they differ).

### Settings

| Setting | Description |
|---------|-------------|
| **Journal Scaler** | Enable or disable the feature entirely, for yourself. Requires reload. |
| **Always scale images** | When enabled, images scale together with text on every CTRL + Wheel action. When disabled, hold SHIFT as well to scale images. Turning this off immediately resets any already-enlarged images in your currently open journals back to 100% (text scale is not affected). |
| **Reset All** | Erases the saved scale for every journal page you have ever resized, including pages that are not currently open. Asks for confirmation first. This cannot be undone. |

### Remembering your scale

Your text and image scale is remembered **per journal page**, per browser. It is a personal reading preference — it is **not** shared with other players, and reopening a page later restores the last scale you set for it there. Scaling one page does not affect other pages in the same journal entry.

### Compatibility

- Works with core Foundry journal sheets, including entries with multiple pages open/scrolled at once.
- Works with Monk's Enhanced Journal, if installed.

### Notes

- Every setting here is **per-player** (`scope: "client"`), including the on/off toggle — this feature has no effect on other players and each player can enable or disable it independently.
- The SHIFT + = reset only affects the specific page under your mouse cursor at the moment you press it, not the whole journal or all open journals.
- If a specific page's scale still seems to affect a different page in the same journal entry, please report it — this relies on detecting a page identifier from the page's rendered HTML that could not be fully confirmed from Foundry's API documentation.

---

## Module Filter

Adds a second search field just below Foundry's native Settings search box, in the sidebar module list.

- The **native** search box (top) searches setting names/hints and highlights matching modules — it never hides anything from the list, and this feature does not change that behavior at all.
- The **new** search field (right below it) does the opposite on purpose: typing hides every module in the sidebar list whose name doesn't contain what you typed. It ignores settings content entirely — it only looks at the module's name.

Example: typing `jack` in the new field leaves only **Jack Small Details** visible in the list; everything else (Core, system, other modules) is hidden until you clear the field.

The typed text is not remembered — it's always empty again the next time you open Settings.

### Settings

| Setting | Description |
|---------|-------------|
| **Module Filter** | Enable or disable this second search field, for yourself. Requires reload. |

---

## File Picker Folder Filter

Adds a second field next to the **Filter Results** field in Foundry's File Picker, splitting that row in two.

- The **native** field (left) is unchanged: it still filters folders and files together.
- The **new** field (right, "Filter folders…") hides only the **folders** (left pane) whose name doesn't contain what you typed. Files are never affected.
- When you **open a folder**, the new field clears itself, so you can filter again inside the new folder. Press **Esc** in the field to clear it without closing the picker.

### Settings

| Setting | Description |
|---------|-------------|
| **File Picker Folder Filter** | Enable or disable the second field, for yourself. Requires reload. |

---

## File Picker: Readable Names

Foundry stores paths URL-encoded: a favorite named "Infused Mana Crystal" shows up as `Infused%20Mana%20Crystal`, and a folder named "ANIMAÇÕES" as `ANIMA%C3%87%C3%95ES`. This feature displays the readable text instead, **only on screen**.

- Decodes every valid `%XX` sequence for display: `%20` becomes a space, `%C3%87` becomes `Ç`, `%5B` / `%5D` become `[` / `]`, and so on.
- Affects visible text in the File Browser (favorites, folder and file names, tooltips) **and** path fields such as *Tile Image or Video*, *Background Image* and the File Browser's *Selected* field, in any window.
- In path fields the readable text is *drawn* over the real one and **stays visible while the field is focused**, so long names remain readable. Hover the field to see the full decoded name in a tooltip, or move the cursor / drag the mouse / press **End** to scroll the readable text along and read the rest of a long name. The real value (and what gets saved) always stays encoded.
- **Ctrl+C** (or Copy) always copies the **whole real path**, even if you selected only part of it. **Ctrl+A** selects everything, and typing or pasting over a select-all replaces the whole value as usual.
- Any other edit (typing, Delete/Backspace, a partial paste or cut, undo) **switches the field to its real text** and ignores that first keystroke, so nothing is ever inserted at the wrong place. A notice tells you to repeat your action; the real text is now visible and editable (paste or type again). To replace the whole path in one go, press **Ctrl+A** and then paste. The readable text returns when you leave the field.
- Does **not** touch real paths, `data-*` attributes or saved data, so other modules keep working.
- Safe by design: a lone `%` is left alone, invalid sequences are not decoded, and control characters stay encoded.
- The folder filter understands it too: typing "mana crystal" finds `Mana%20Crystal`, and "ações" finds `ANIMA%C3%87%C3%95ES`.
- Applies **instantly**, also to windows that are already open.

### Turning it on and off

- **Setting:** *File Picker: Show Readable Names* (per user).
- **Window header:** the **Aa** button next to the window menu, in the File Browser **and** in every window that has path fields (Scene configuration, Tile configuration...). Green means on.
- **Copy the clean path:** **right-click** (or **Shift+click**) that same **Aa** button. It copies the readable text of the path field you last used in that window (or the first visible one) to the clipboard. It works whether the feature is on or off, and never changes the field.
- **Scene Controls:** the same icon in the **JSD Panel** (GM only). Green means on.

---

## GM Clear Vision

Adds an eye icon to the **Token Tools** toolbar (left sidebar, arrow icon) that lets the GM see hidden/undetected tokens and darken/brighten unexplored fog of war — without revealing anything to players.

### How to use

1. Click the **eye icon** in Token Tools (outline eye = off) or press **Ctrl + G**.
2. While active, the icon turns **solid and green**, and the darkness/fog of the scene is brightened for you (players see no change).
3. Click again or press **Ctrl + G** to turn it off.

The dashed outline shown over hidden/undetected tokens is a **separate, independent effect** — see the "Hidden Token Outline" setting below for how to control when it appears.

### Requirements

- Requires the **lib-wrapper** module to be installed and active. Without it, GM Clear Vision silently disables itself for the session (a warning is logged to the console) — it will not crash the module or affect other features.

### Notes

- **GM only.** The entire feature — hooks, icon, and CONFIG patches — is only ever registered when the current user is a GM. A player's client never runs any of this code, regardless of the toggle state.
- The eye icon's own on/off state is personal (per browser), so each GM client remembers its own state independently.
- Does not persist anything to any document — purely a local rendering overlay.
- **Multi-level scenes (V14 Levels):** the dashed outline and reveal apply to hidden tokens on the level you are currently **viewing**. For tokens on any other level, they apply only if no surface (Define Surface region with *Restricts Sight* or *Cull Tokens*) covers it, so a token seen through a hole in the floor still shows, while one hidden under solid floor does not. The check samples five points of the token (center and four inner points), so a token straddling the edge of a hole or surface is treated like Foundry itself treats it: still shown.

### Settings

| Setting | Description |
|---------|-------------|
| **GM Clear Vision** | Master on/off for the entire feature (icon, keybinding, and all effects). Requires reload. |
| **GM Clear Vision — Hidden Token Outline** | Controls when the dashed outline over hidden/undetected tokens appears, independently of the eye icon's darkness/fog effect: <br>• **Always on** (default) — shown whenever the feature is enabled, regardless of the eye icon. <br>• **Only while the eye icon is active** — tied to the same toggle as the darkness/fog brightening. <br>• **Always off** — never shown. |

---

## Fix Blank Line Spacing

By default, Foundry collapses multiple blank lines you type in a journal/sheet/chat editor down to zero visible space once saved — three empty Enter presses between two paragraphs end up looking like no gap at all. This feature gives each blank line real height so what you typed is what you see.

- Applies to journal entry pages, Actor/Item sheet description fields, and chat message content.
- The number of blank lines you type is preserved proportionally — 3 blank lines stay visually bigger than 1, they aren't collapsed into one fixed-size gap.
- Purely visual: nothing about your saved document content changes, ever.

### Settings

| Setting | Description |
|---------|-------------|
| **Fix Blank Line Spacing** | Enable or disable this feature. **World setting** — the GM sets it once and it applies identically for every connected user, live, no reload needed. |

### Known limitations

- If a specific sheet or chat card still collapses blank lines, its content container may use a class name other than `.editor-content` / `.message-content` — inspect it in devtools and report the actual class so the CSS selector can be added.
- Exporting journal content outside of Foundry (e.g. a PDF export macro) will only preserve this spacing if the exporting tool also has this module's CSS loaded in the same browser context.

---

## Sort Status Effects

Sorts the status effects palette of the **Token HUD** alphabetically.

- If the game system groups its own effects separately from Foundry's core effects (for example Daggerheart), **each group is sorted on its own**; the group labels and the "clear all" button stay where they are.
- Purely visual and personal: it does not change any token or effect.

### Settings

| Setting | Description |
|---------|-------------|
| **Sort Status Effects** | Enable or disable, for yourself only (per user, per world). Off by default. Requires reload. |

---

## JSD Panel and Macro Library

GM only. A **toolbox icon** (amber) in the Scene Controls opens the **JSD Panel**: a group of quick-access buttons for this module, in this order:

| Button | What it does |
|--------|--------------|
| **Darkness Level** (moon) | Opens the same darkness slider as the Darkness Slider feature, anchored next to the button. Click again to close. Needs an active scene. |
| **Macro Library** (`</>`) | Opens a small panel listing the macros of the **JSD Macro Library** compendium, each with its description. **Click a macro to run it.** The panel also has a button to manage the library. |
| **Scene Defaults** (film) | Opens the Scene Defaults configuration. |
| **GM Clear Vision** (eye) | Toggles GM Clear Vision, same as the eye in the Token Tools. |
| **Readable names** (Aa) | Turns the *File Picker: Readable Names* feature on or off. |
| **JSD Module Settings** (gear) | Opens the Foundry settings directly on the Jack Small Details tab. |

### Macro Library

- The module ships with its own compendium (**JSD — Macro Library**). On first load it is filled with the default macros: *Item to Journal*, *Lock Token Rotation*, *Mass Scene Editor*, *Ownership Manager*, *Scene & Door Control*, *Scene Rescaler* and *Hide Camera Bar*.
- **Settings → Jack Small Details → Manage Macro Library** (GM only) opens the **Macro Library Manager**: add macros, remove them, edit the description shown in the panel, **Importar Config** (import a configuration file) and **Reset ao Padrão** (restore the default set). Import and reset roll back automatically if something fails.
- The panel and the manager stay in sync with the compendium: any change, including edits made directly in the Foundry compendium window, updates open JSD windows within a moment.

### Settings

| Setting | Description |
|---------|-------------|
| **Macro Library Panel** | Shows the JSD Panel icon, with the Darkness Level and Macro Library buttons. **World setting.** Requires reload. |

Note: if this setting is off, the JSD Panel icon is still created for GMs when another feature needs it (for example the *Readable names* button).

---

## Installation

1. Download the latest release zip.
2. Extract the zip and copy the contents of the `jack-small-details` folder into your Foundry `Data/modules/jack-small-details/` directory (replace existing files).
3. Restart Foundry or reload the world.
4. Enable **Jack Small Details** in **Settings → Manage Modules**.

## Compatibility

- **Foundry VTT**: V14 (minimum: 14, verified: 14)
- **Game Systems**: Compatible with any system. Tested with SWADE and Daggerheart.
