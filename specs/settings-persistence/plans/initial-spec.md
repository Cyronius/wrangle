# Plan: Initial Settings Persistence Spec (Retroactive)

## Context

Settings persistence, the IPC contract, and the Preferences dialog shell already exist in the codebase. This plan retroactively documents the current behavior as the baseline specification so future changes have a spec to diff against.

Scope covers:
- `electron-store` defaults and schema
- IPC API surface (`settings:*` channels)
- Storage location per OS
- Preferences dialog shell (not the individual tab content)
- Dialog open/close/persistence behavior

Per-tab functionality (theme editor internals, shortcut recorder internals) is NOT covered here and should be specified under separate feature prefixes when those features get their own specs.

## Proposed Changes

### New Requirements

- **STG-001: Default Settings Values** — Documents the default values seeded by `electron-store` on first launch and reset (theme=Dark, splitRatio=0.5, previewSyncLocked=false, vimMode=false, shortcuts=default).
- **STG-002: IPC Contract** — Documents the six IPC channels: `getAll`, `get`, `set`, `setMultiple`, `reset`, `getPath`.
- **STG-003: Storage Location** — Documents the per-OS filesystem path for `settings.json` under Electron's userData directory.
- **STG-004: Preferences Dialog Structure** — Documents the two-tab structure (Theme Editor, Keyboard Shortcuts), drag/resize behavior, and bounds persistence.
- **STG-005: Preferences Dialog Open/Close Behavior** — Documents open triggers, close triggers (X button, Escape, overlay click), and persistence semantics.

### Modified Requirements

None. This is the initial spec.

### Removed Requirements

None.

## Spec Impact

- [x] New requirements added to spec
- [ ] Existing requirements updated in spec
- [ ] Tests created/updated referencing requirement IDs
- [ ] Plan moved to archive

_Tests unchecked: this plan is retroactive documentation of existing behavior. Test coverage will be addressed in a follow-up plan once each requirement's test category is assigned and real tests are authored. Stub/placeholder tests are explicitly disallowed by the doctrine._

_Archive unchecked: keep this plan in `plans/` until test coverage follow-up lands, so the outstanding work remains visible._
