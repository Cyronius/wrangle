# Plan: Initial Preview-Sync Spec (Retroactive)

## Context

Editor/preview scroll synchronization has shipped and is in use, but no canonical spec existed for the `preview-sync` feature. This plan retroactively documents the existing behavior of `EditorLayout`, `MarkdownPreview`, and `SyncLockIcon` so future changes have a spec to trace against.

No code changes are proposed here — this plan exclusively codifies current behavior as requirements `SYN-001` through `SYN-005`.

## Proposed Changes

### New Requirements

- **SYN-001: Sync Lock Toggle** — Documents the `SyncLockIcon` component, its Redux binding (`layout.previewSync`, `togglePreviewSync`), and its visual/tooltip states.
- **SYN-002: Locked Editor Scroll Drives Preview** — Documents how editor `onScroll` offsets drive `previewRef.scrollToSourceId` via source-map lookup, including the re-entrancy guard.
- **SYN-003: Preview Click Maps to Editor Cursor** — Documents how preview-reported source IDs are converted (via `denormalizeOffset` → `model.getPositionAt` → `revealLineInCenter`) into editor cursor moves.
- **SYN-004: CRLF/LF Offset Normalization** — Documents `normalizeOffset` / `denormalizeOffset` and the boundaries at which each is applied.
- **SYN-005: Unlocked State Decouples Scrolling** — Documents that `previewSync === false` disables both scroll listeners and keeps the surfaces independent.

### Modified Requirements

- None.

### Removed Requirements

- None.

## Spec Impact

- [x] New requirements added to spec
- [ ] Existing requirements updated in spec
- [ ] Tests created/updated referencing requirement IDs
- [ ] Plan moved to archive

_Tests are intentionally deferred; this plan captures existing behavior only. Subsequent plans may add `unit` tests for the CRLF helpers and `e2e` procedures for SYN-001/002/003/005._
