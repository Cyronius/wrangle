# Plan: Initial Keyboard Commands Spec (Retroactive)

## Context

The keyboard command system — central registry, preset-based bindings, Monaco/global scope dispatch, markdown formatting with WYSIWYG preview-selection support, and the Preferences Keyboard Shortcuts tab — already exists in code and ships to users. This plan documents the existing behavior retroactively so future changes have a canonical spec to reference.

No code changes are proposed here. This plan's sole purpose is to establish the baseline requirements KBD-001 through KBD-010 in `spec.md`.

## Proposed Changes

### New Requirements

- **KBD-001: Command Registry Shape** — `CommandDefinition` fields (`id`, `label`, `category`, `defaultBinding`, `execute`, optional `readOnly`/`bindingDisplay`) and the exported `commandMap` / category helpers.
- **KBD-002: Built-in "default" Preset Is Immutable** — Derived from `defaultBinding` values; cannot be edited; new commands auto-populate on launch.
- **KBD-003: User Preset CRUD** — Create, copy-from-current, update, delete custom presets; unique names; deleting active preset falls back to `default`; debounced persistence via `saveShortcutSettings`.
- **KBD-004: Editor-Scoped vs Global-Scoped Dispatch** — Monaco `addAction` path for editor commands; window `keydown` path for global commands; input-focus allowlist for save/open/preferences and markdown formatting.
- **KBD-005: Markdown Formatting Commands** — Inline-wrap, line-prefix, link, code-block, table, image, HR; cursor placement rules; default bindings.
- **KBD-006: WYSIWYG `applyPreviewSelection` Path** — Preview selection offsets re-target Monaco selection before formatting runs.
- **KBD-007: Menu Accelerators Reflect Active Preset** — Native menu template rebuilt on preset change; null bindings render no accelerator.
- **KBD-008: Preferences → Keyboard Shortcuts Tab Lists All Commands** — Category grouping, search, read-only notice, Vim mode toggle.
- **KBD-009: `ShortcutRecorder` Capture, Escape Cancel, Conflict Surfacing** — Live keystroke capture, modifier-only filtering, Escape/click-outside cancel, conflict CSS modifier via `findConflicts`.
- **KBD-010: Reset-Command and Reset-Preset to Defaults** — Per-command reset via `updateShortcutBinding` to `defaultBinding`; full-preset reset via `updateCustomPreset` to `builtInPresets.default`; distinct from the clear (`null`) action.

### Modified Requirements

None — this is the initial spec.

### Removed Requirements

None.

## Spec Impact

- [x] New requirements added to spec
- [ ] Existing requirements updated in spec
- [ ] Tests created/updated referencing requirement IDs
- [ ] Plan moved to archive

_Tests and archival deferred: this plan captures behavior that already ships. Tests will be added as individual follow-up plans (one per requirement, or grouped by area) so that each KBD-NNN requirement gets a real executable test per the project's TDD doctrine. This plan remains in `plans/` until those tests exist or the team explicitly accepts the requirements as "verified by existing manual QA" and archives it._
