# Plan: Initial Crash Recovery Spec (Retroactive)

## Context

Crash recovery was implemented in `src/main/utils/crash-recovery.ts`, `src/main/ipc/crash-recovery-handler.ts`, `src/main/utils/temp-dir-manager.ts`, `src/main/index.ts`, and `src/renderer/src/hooks/useEditorPane.ts` before a canonical spec existed. This plan retroactively documents the shipped behavior so that future changes have a stable requirement surface to trace against.

No code changes are introduced by this plan; it captures existing behavior only.

## Proposed Changes

### New Requirements

- **CRR-001: Running Marker Lifecycle** — PID-bearing `~/.wrangle/.running` file, created on `whenReady`, cleared on `will-quit` / `SIGINT` / `SIGTERM`.
- **CRR-002: Dead-PID Crash Detection** — marker-present + PID-not-alive (or corrupt marker) infers a crash via `process.kill(pid, 0)` probing.
- **CRR-003: Orphan Draft Discovery** — scan `~/.wrangle/drafts/{tabId}/draft.md` for non-empty drafts when a crash is detected.
- **CRR-004: Cached Recovery Info Served Over IPC** — assemble `{ didCrash, orphanedDrafts }` once at startup, expose via `crashRecovery:check`.
- **CRR-005: Auto-Save to Per-Tab Draft** — renderer writes to the per-tab draft path with a 2500 ms debounce via `window.electron.file.autoSave`.
- **CRR-006: 7-Day Draft Cleanup With Crash Skip** — `initTempRoot` sweeps draft directories older than 7 days unless crash recovery has orphans to present.

### Modified Requirements

- None (retroactive baseline).

### Removed Requirements

- None.

## Spec Impact

- [x] New requirements added to spec
- [x] Existing requirements updated in spec
- [ ] Tests created/updated referencing requirement IDs
- [ ] Plan moved to archive

_Tests are not added in this retroactive capture; they will be introduced by future plans that modify any of CRR-001 through CRR-006. The plan is held in `plans/` until that happens, rather than being archived immediately, so the lack of test coverage remains visible._
