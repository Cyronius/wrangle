# Theming Specification

## Overview

This specification defines Wrangle's theming system, which provides built-in themes, user-customizable themes, live CSS editing via a Theme Editor tab in Preferences, Monaco editor theme synchronization, and CSS variable driven styling via a `data-theme` attribute on the document root.

**Feature Prefix:** `THM` (Theming)

---

## Requirements

### THM-001: Built-in Theme Registry

- **Status:** Active
- **Added:** 2026-04-23

Wrangle ships with a fixed registry of built-in themes that are always available and read-only.

**Behavior:**
- Built-in themes are defined in `src/renderer/src/styles/themes.ts` and exported as `builtInThemes` (a `Record<string, string>` mapping theme name to CSS) and `builtInThemeNames` (a `Set<string>` for membership tests).
- The set includes `Dark` and `Lightish` as the two core themes whose CSS lives in the global stylesheet and is keyed by the `data-theme` attribute. Additional built-in themes (e.g. custom-styled themes shipped in `builtInThemes`) are registered with Monaco at application startup by `ThemeProvider`.
- Built-in themes cannot be renamed, deleted, or edited in place. The Theme Editor tab displays their CSS as read-only and offers a "Copy" action to produce an editable custom theme derived from the built-in.
- The default `theme.current` value is `Dark`. A migration converts any legacy stored value of `dark` to `Dark` on settings load.

**Interface Contract:**
- `builtInThemes: Record<string, string>` — exported from `src/renderer/src/styles/themes.ts`.
- `builtInThemeNames: Set<string>` — exported from the same module; contains `Dark` and `Lightish`.
- Redux default: `settings.theme.current = 'Dark'`.

---

### THM-002: `data-theme` Attribute Drives CSS Variable Overrides

- **Status:** Active
- **Added:** 2026-04-23

The active theme is applied by setting the `data-theme` attribute on the document's `<html>` element. All theme-scoped CSS uses a `:root[data-theme='<name>']` selector to override CSS custom properties.

**Behavior:**
- When the current theme changes, `ThemeProvider` sets `document.documentElement.setAttribute('data-theme', <themeName>)`.
- Global and theme CSS declares theme-dependent values as CSS custom properties (e.g. `--app-bg`, accent colors) inside `:root[data-theme='<name>'] { ... }` blocks. Changing `data-theme` swaps the active variable set without re-rendering React components.
- Theme names containing characters valid in an HTML attribute value are accepted; custom theme CSS uses quoted attribute selectors (`:root[data-theme='<name>']`) and renames rewrite this selector.

**Interface Contract:**
- Document root carries exactly one active theme name at a time via `data-theme`.
- Custom theme CSS MUST target `:root[data-theme='<themeName>']` to participate in the override mechanism.

---

### THM-003: Custom Theme CRUD via Theme Editor Tab

- **Status:** Active
- **Added:** 2026-04-23

Users can create, edit, rename, and delete custom themes through the Theme Editor tab in the Preferences dialog.

**Behavior:**
- **Create (Copy):** The "Copy" action in the Theme Editor duplicates the currently selected theme (built-in or custom) under a generated unique name of the form `<base>-copy` or `<base>-copy N`. The new theme's CSS has its `:root[data-theme='...']` selector rewritten to the new name. The new theme becomes active immediately.
- **Edit:** For a selected custom theme, the Monaco-based CSS editor is writable. Edits are validated via `validateThemeCSS` and, when valid, dispatched through `updateCustomTheme` and persisted via `saveThemeSettings` on a debounced (1500ms) cadence.
- **Rename:** Inline pencil-edit control renames a custom theme. The rename updates the theme key in `customThemes`, rewrites the `:root[data-theme='...']` selector inside its CSS, and updates `theme.current` if the renamed theme was active. Name conflicts with existing themes (built-in or custom) are rejected.
- **Delete:** Deleting a custom theme removes it from `customThemes`. If the deleted theme was active, `theme.current` resets to `Dark`.
- Built-in themes cannot be edited, renamed, or deleted. The Theme Editor shows a read-only notice and hides Apply/Delete controls while a built-in theme is selected.

**Interface Contract:**
- Redux slice `settingsSlice` provides `addCustomTheme`, `updateCustomTheme`, `deleteCustomTheme`, `renameCustomTheme`, `setCurrentTheme`, `saveThemeSettings`.
- Custom themes stored at `settings.theme.customThemes: Record<string, string>` keyed by theme name with CSS as value.
- CSS validation via `validateThemeCSS(css)` in `src/renderer/src/utils/css-validator.ts`; template generation via `generateThemeTemplate(name, base)`.

---

### THM-004: Active Custom Theme Injection via `<style id="custom-theme-active">`

- **Status:** Active
- **Added:** 2026-04-23

When the active theme is a custom theme, its CSS is injected into the document through a single, stable-id `<style>` element.

**Behavior:**
- On activation of a custom theme, `ThemeProvider` ensures a `<style id="custom-theme-active">` element exists in `<head>` with `textContent` set to that theme's CSS. If the element already exists, its `textContent` is updated in place rather than recreating the node.
- On activation of a built-in theme, `ThemeProvider` removes any existing `<style id="custom-theme-active">` element so that only built-in theme CSS rules remain in effect.
- The `data-theme` attribute is set in coordination with this injection so that the attribute and the injected CSS always refer to the same theme.
- The Theme Editor's `applyCustomThemeCSS` helper MAY additionally inject per-theme `<style id="custom-theme-<name>">` elements when applying edits, but the canonical active-theme style element used by `ThemeProvider` is `custom-theme-active`.

**Interface Contract:**
- DOM invariant: at most one `<style id="custom-theme-active">` element exists at any time.
- When `builtInThemeNames.has(current)` is true, no `custom-theme-active` element is present.

---

### THM-005: Monaco Theme Name Mapping and Synchronization

- **Status:** Active
- **Added:** 2026-04-23

Monaco editor instances display using a theme that matches the active application theme.

**Behavior:**
- On application startup, `ThemeProvider` registers every entry in `builtInThemes` (other than `Lightish` and `Dark`, which use Monaco's native `vs`/`vs-dark` mappings) with Monaco via `registerCustomMonacoTheme(name, css)`.
- Whenever `theme.current` changes, `ThemeProvider` computes the corresponding Monaco theme name via `getMonacoThemeName(current)` and calls `monaco.editor.setTheme(name)`. Failures (e.g. Monaco not yet initialized) are swallowed so theme changes do not throw.
- When a custom theme's CSS is edited (after debounce) or created via copy, the Theme Editor calls `registerCustomMonacoTheme` so Monaco reflects the new colors the next time `setTheme` runs.
- The Theme Editor's own Monaco instance uses `getMonacoThemeName(currentTheme)` as its `theme` prop so the CSS editor itself matches the active theme.

**Interface Contract:**
- `registerCustomMonacoTheme(name: string, css: string): void` — in `src/renderer/src/utils/monaco-theme-generator.ts`.
- `getMonacoThemeName(themeName: string): string` — returns a Monaco-registered theme identifier for any app theme name, including built-ins.

---

### THM-006: Live Preview While Editing in Theme Editor

- **Status:** Active
- **Added:** 2026-04-23

Changes made in the Theme Editor tab are reflected in the running application without requiring a manual save or restart.

**Behavior:**
- Typing in the CSS editor for a custom theme triggers a 1500ms debounced save: `validateThemeCSS` runs, and on success `updateCustomTheme` dispatches (updating Redux), `registerCustomMonacoTheme` re-registers the Monaco theme, and `saveThemeSettings` persists to electron-store. Because the active theme's CSS is read from Redux by `ThemeProvider`, the `<style id="custom-theme-active">` element is updated and the rest of the UI re-themes immediately.
- Validation errors are displayed inline beneath the editor and prevent the debounced save from dispatching, but the edited text remains in local state so the user can correct it.
- The "Apply" button performs an immediate, non-debounced apply: it runs `validateThemeCSS`, injects the CSS via `applyCustomThemeCSS`, and re-registers the Monaco theme.
- The debounced save captures the theme name at the time of the change (via a ref) to avoid saving edits against a newly-switched theme.

**Interface Contract:**
- Debounce hook: `useDebounce` from `src/renderer/src/hooks/useKeyboardShortcuts.ts` with 1500ms delay.
- Validation: `validateThemeCSS(css): { valid: boolean; errors: string[] }`.
- Apply helper: `applyCustomThemeCSS(name, css)` in `ThemeEditorTab.tsx` injects `<style id="custom-theme-<name>">` and sets `data-theme`.

---

## Key Files

| File | Purpose |
|------|---------|
| `src/renderer/src/components/ThemeProvider.tsx` | Applies active theme: sets `data-theme`, injects `custom-theme-active` style, syncs Monaco theme. |
| `src/renderer/src/store/settingsSlice.ts` | Redux state and actions for `theme.current` and `theme.customThemes`; persistence via `saveThemeSettings`. |
| `src/renderer/src/styles/themes.ts` | `builtInThemes` registry and `builtInThemeNames` set. |
| `src/renderer/src/components/Preferences/ThemeEditorTab.tsx` | Theme Editor UI: select, copy, rename, edit, delete, apply. |
| `src/renderer/src/utils/monaco-theme-generator.ts` | `registerCustomMonacoTheme`, `getMonacoThemeName`. |
| `src/renderer/src/utils/css-validator.ts` | `validateThemeCSS`, `generateThemeTemplate`. |

---

## Test File Structure

```
specs/theming/tests/
├── thm-001-builtin-registry.test.ts
├── thm-002-data-theme-attribute.test.ts
├── thm-003-custom-theme-crud.test.ts
├── thm-004-style-injection.test.ts
├── thm-005-monaco-sync.test.ts
└── thm-006-live-preview.test.ts
```
