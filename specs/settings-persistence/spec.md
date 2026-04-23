# Settings Persistence Specification

## Overview

This specification defines how Wrangle persists user preferences across sessions and how the Preferences dialog hosts feature-specific settings tabs. Settings are stored via `electron-store` in the main process and exposed to the renderer through a typed IPC contract. The Preferences dialog is the shared shell that hosts per-feature configuration tabs (theme editor, keyboard shortcuts, and future additions).

**Feature Prefix:** `STG` (Settings)

---

## Requirements

### STG-001: Default Settings Values

- **Status:** Active
- **Added:** 2026-04-23

The settings store ships with a defined set of defaults that apply on first launch or after a reset. These defaults define the baseline out-of-box experience.

**Behavior:**
- On first launch (no existing `settings.json`), the store materializes with the defaults below.
- On `reset`, all user-modified values are cleared and the defaults are re-applied.
- Missing keys within an otherwise-present settings file are filled in from defaults (electron-store behavior).

**Default Values:**

| Key | Default |
|-----|---------|
| `theme.current` | `"Dark"` |
| `theme.customThemes` | `{}` |
| `shortcuts.currentPreset` | `"default"` |
| `shortcuts.customPresets` | `{}` |
| `layout.splitRatio` | `0.5` |
| `layout.previewSyncLocked` | `false` |
| `editor.vimMode` | `false` |

**Interface Contract:**
- Defaults are declared in `src/main/ipc/settings-handler.ts` as the `defaults: SettingsSchema` constant.
- `electron-store` is constructed with `{ name: 'settings', defaults }`.

---

### STG-002: IPC Contract

- **Status:** Active
- **Added:** 2026-04-23

The renderer interacts with the settings store exclusively through a fixed set of IPC channels registered on the main process.

**Behavior:**
- The main process registers handlers via `registerSettingsHandlers()` at startup.
- Each channel performs a synchronous operation against `electron-store` and returns a result to the renderer.
- `setMultiple` applies each top-level key/value as an independent `store.set` (shallow merge per key).
- `reset` clears the store and returns the post-reset state (the defaults).

**Interface Contract:**

| Channel | Args | Return |
|---------|------|--------|
| `settings:getAll` | — | Full `SettingsSchema` object |
| `settings:get` | `key: string` | Value at dotted key path, or `undefined` |
| `settings:set` | `key: string, value: unknown` | `true` |
| `settings:setMultiple` | `data: Partial<SettingsSchema>` | `true` |
| `settings:reset` | — | Full `SettingsSchema` (defaults) |
| `settings:getPath` | — | Absolute filesystem path to `settings.json` |

- Handlers live in `src/main/ipc/settings-handler.ts`.
- The renderer accesses them via the preload bridge (`window.electron.*`).

---

### STG-003: Storage Location

- **Status:** Active
- **Added:** 2026-04-23

Settings are persisted as a single JSON file in Electron's per-user application data directory, resolved by `electron-store` using Electron's `app.getPath('userData')`.

**Behavior:**
- File name is `settings.json` (derived from `new Store({ name: 'settings' })`).
- Per-OS location:
  - **Windows:** `%APPDATA%\Wrangle\settings.json`
  - **macOS:** `~/Library/Application Support/Wrangle/settings.json`
  - **Linux:** `~/.config/Wrangle/settings.json`
- The directory name `Wrangle` comes from the Electron app's product name.
- Writes are debounced/atomic per electron-store's default behavior.
- The exact path is discoverable at runtime via `settings:getPath`.

**Interface Contract:**
- No explicit path override is passed to `new Store(...)`; the default userData location is used.

---

### STG-004: Preferences Dialog Structure

- **Status:** Active
- **Added:** 2026-04-23

The Preferences dialog is a floating, draggable, resizable modal that hosts per-feature settings tabs. It is the single UI surface for user-editable preferences.

**Behavior:**
- Dialog is rendered as an overlay with a single content panel containing: header (title + close button), tab strip, and tab content area.
- Header displays the title "Preferences" and is the drag handle (cursor: move).
- Dialog supports eight resize handles (top, right, bottom, left, and four corners) with minimum dimensions of 400x300 px and default 800x600 px.
- Dialog position and size are persisted to `layout.preferencesDialog` and restored (clamped to the viewport) on next open.
- The tab strip contains exactly two tabs in the following order:
  1. **Theme Editor** (id: `themes`) — rendered by `ThemeEditorTab`
  2. **Keyboard Shortcuts** (id: `shortcuts`) — rendered by `KeyboardShortcutsTab`
- The default active tab on open is `themes`.
- While settings are loading (first open), the content area shows a "Loading settings..." placeholder instead of tab content.

**Interface Contract:**
- Component: `src/renderer/src/components/Preferences/PreferencesDialog.tsx`
- Tab components: `ThemeEditorTab`, `KeyboardShortcutsTab` (exported from `components/Preferences/index.ts`)
- Props: `{ isOpen: boolean; onClose: () => void }`
- Active tab state: local React state (`TabId = 'shortcuts' | 'themes'`)
- Bounds state: persisted via `setPreferencesDialogBounds` and `saveLayoutSettings` Redux actions

---

### STG-005: Preferences Dialog Open/Close Behavior

- **Status:** Active
- **Added:** 2026-04-23

The dialog's visibility is controlled by its parent, and it supports multiple close affordances. Bounds and settings state are persisted on interaction, not only on close.

**Behavior:**
- **Open triggers** (parent responsibility — invoking `isOpen=true`):
  - Application menu → Preferences command
  - Any in-app UI that dispatches the preferences-open action
- **On open:**
  - If settings are not yet loaded and not currently loading, dispatch `loadSettings()`.
  - If saved bounds exist, clamp them to the current viewport and apply. Otherwise center a default 800x600 dialog.
- **Close triggers:**
  - Clicking the close (X) button in the header
  - Pressing the `Escape` key while the dialog is open
  - Clicking the overlay backdrop outside the dialog panel
- **Persistence:**
  - Dialog bounds are persisted (via `saveLayoutSettings`) at the end of every drag or resize gesture, not only on close.
  - Tab-level settings changes (theme edits, shortcut edits) are persisted by their respective tabs through the STG-002 IPC contract; closing the dialog does not trigger a separate save.
- Closing the dialog does not reset the active tab selection for the current session but does not persist the active tab across reopen (active tab resets to `themes` on next open).

**Interface Contract:**
- `onClose` callback provided by parent; dialog never self-dismounts.
- Escape handler registered on `window` only while `isOpen === true`.
- Overlay click-to-close: only when `e.target === e.currentTarget` (clicking the panel itself does not close).

---

## Key Files

| File | Purpose |
|------|---------|
| `src/main/ipc/settings-handler.ts` | electron-store construction, defaults, IPC handlers |
| `src/main/ipc/index.ts` | Calls `registerSettingsHandlers()` at startup |
| `src/preload/electron.d.ts` | Type definitions for `window.electron` bridge |
| `src/renderer/src/store/settingsSlice.ts` | Redux state for loaded settings, dialog bounds, layout |
| `src/renderer/src/components/Preferences/PreferencesDialog.tsx` | Dialog shell, drag/resize, tab strip |
| `src/renderer/src/components/Preferences/ThemeEditorTab.tsx` | Theme editor tab content |
| `src/renderer/src/components/Preferences/KeyboardShortcutsTab.tsx` | Keyboard shortcuts tab content |
| `src/renderer/src/components/Preferences/index.ts` | Barrel export for Preferences components |
