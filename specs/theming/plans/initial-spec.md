# Plan: Initial Theming Spec (Retroactive)

## Context

The theming system has been implemented in Wrangle for some time without a canonical specification. This plan retroactively documents the existing behavior of the theming subsystem — built-in themes, custom theme CRUD, `data-theme`-driven CSS variable overrides, `<style id="custom-theme-active">` injection, Monaco theme synchronization, and the Theme Editor tab in Preferences — so that future changes have a traceable baseline.

No behavioral changes are proposed by this plan. It captures what the code already does as of 2026-04-23.

## Proposed Changes

### New Requirements

- **THM-001: Built-in Theme Registry** — Fix the set of built-in themes (`Dark`, `Lightish`, and any additional entries in `builtInThemes`) as read-only, registered with Monaco at startup.
- **THM-002: `data-theme` Attribute Drives CSS Variable Overrides** — Document that the active theme is applied by setting `data-theme` on `<html>`, and that theme CSS uses `:root[data-theme='<name>']` selectors to override CSS custom properties.
- **THM-003: Custom Theme CRUD via Theme Editor Tab** — Document create (copy), edit, rename, and delete flows for custom themes, including name-conflict rejection and the reset-to-`Dark` behavior when the active custom theme is deleted.
- **THM-004: Active Custom Theme Injection via `<style id="custom-theme-active">`** — Document the single-element style-injection invariant used by `ThemeProvider`.
- **THM-005: Monaco Theme Name Mapping and Synchronization** — Document `registerCustomMonacoTheme` + `getMonacoThemeName` + `monaco.editor.setTheme` flow and the swallowed-error behavior during early initialization.
- **THM-006: Live Preview While Editing in Theme Editor** — Document the 1500ms debounced validate/save/re-register cycle and the immediate Apply button path.

### Modified Requirements

None — this is the initial spec.

### Removed Requirements

None — this is the initial spec.

## Spec Impact

- [ ] New requirements added to spec
- [ ] Existing requirements updated in spec
- [ ] Tests created/updated referencing requirement IDs
- [ ] Plan moved to archive

_Retroactive baseline. Tests and archive move will follow in a subsequent change once the verification suite is written._
