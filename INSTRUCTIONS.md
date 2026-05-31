# Jack Small Details

A personal collection of small quality-of-life improvements for Foundry VTT V14.

---

## Features

- [Darkness Slider](#darkness-slider)
- [Scene Defaults](#scene-defaults)
- [Background Volume Slider](#background-volume-slider)

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

## Installation

1. Download the latest release zip.
2. Extract the zip and copy the contents of the `jack-small-details` folder into your Foundry `Data/modules/jack-small-details/` directory (replace existing files).
3. Restart Foundry or reload the world.
4. Enable **Jack Small Details** in **Settings → Manage Modules**.

## Compatibility

- **Foundry VTT**: V14 (minimum: 14, verified: 14)
- **Game Systems**: Compatible with any system. Tested with SWADE and Daggerheart.
