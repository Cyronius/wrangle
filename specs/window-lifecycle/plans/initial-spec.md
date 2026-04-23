# Plan: Initial Window Lifecycle Spec (Retroactive)

## Context

Window lifecycle behavior (creation, show race, zoom clamp, export, single-instance, shutdown, menu dispatch) has been implemented in `src/main/index.ts`, `src/main/ipc/window-handler.ts`, and `src/main/menu/menu-template.ts` for some time without a canonical spec. This plan retroactively captures the existing behavior as a baseline so future changes have a traceability anchor.

This is distinct from the adjacent `window-drag` spec, which covers drag regions and titlebar chrome — those concerns remain in that spec.

## Proposed Changes

### New Requirements

- **WIN-001: Window Show Race** — `ready-to-show` OR `did-finish-load` OR 3s safety timer, whichever fires first, with a one-shot latch.
- **WIN-002: Default Window Size and Minimum** — 1200x800 default, 400x300 minimum.
- **WIN-003: Zoom Level Clamp** — Clamp `webContents.setZoomLevel` inputs to the inclusive range `[-3, +3]`.
- **WIN-004: Export as PDF** — Save dialog → hidden offscreen render at US Letter → `printToPDF` with 0.5in margins → write path or `null`.
- **WIN-005: Export as HTML** — Save dialog → UTF-8 write → path or `null`.
- **WIN-006: Single-Instance Lock** — `requestSingleInstanceLock` gate; `second-instance` focuses existing window and opens any passed file path.
- **WIN-007: Graceful Shutdown and Running Marker** — `will-quit`, `SIGINT`, `SIGTERM` all clear the crash-recovery running marker.
- **WIN-008: Menu-to-Renderer Command Dispatch** — Documented `menu:command` vocabulary for non-role menu items.

### Modified Requirements

_None — initial spec._

### Removed Requirements

_None._

## Spec Impact

- [x] New requirements added to spec
- [ ] Existing requirements updated in spec
- [ ] Tests created/updated referencing requirement IDs
- [ ] Plan moved to archive

_Tests and archival deferred: this is a retroactive capture of existing behavior. Test coverage will be added in a follow-up plan before any behavioral change to these requirements._
