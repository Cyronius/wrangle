# Crash Recovery Specification

## Overview

This specification defines how Wrangle detects abnormal termination of a prior session and recovers unsaved edits. A per-process running marker distinguishes clean shutdowns from crashes, orphaned drafts are surfaced to the renderer on startup, and a temp-directory auto-save cadence keeps recoverable copies of in-flight tab content on disk. A 7-day cleanup sweeps stale drafts, but is suppressed when a crash was detected so recovery data is never destroyed before the user sees it.

**Feature Prefix:** `CRR` (Crash Recovery)

---

## Requirements

### CRR-001: Running Marker Lifecycle

- **Status:** Active
- **Added:** 2026-04-23

Wrangle maintains a single-process "running marker" file that records the PID of the live main process. The marker is created on startup and removed on any graceful shutdown path.

**Behavior:**
- On `app.whenReady`, main writes the current `process.pid` to `~/.wrangle/.running` (creating `~/.wrangle/` if needed).
- The marker is cleared on the Electron `will-quit` event.
- The marker is cleared when the main process receives `SIGINT` or `SIGTERM`, after which `app.quit()` is invoked.
- Clearing the marker is best-effort: failures are swallowed so they cannot block shutdown.
- If the marker already exists at startup (e.g. a second instance), the single-instance lock owns the decision to quit; marker creation by the new instance overwrites the prior PID only after the lock is acquired.

**Interface Contract:**
- `createRunningMarker(): Promise<void>` writes `String(process.pid)` UTF-8 to `~/.wrangle/.running`.
- `clearRunningMarker(): Promise<void>` unlinks the marker if present; no-op otherwise.
- `readRunningMarkerPid(): number | null` returns the recorded PID, or `null` when missing, unreadable, or non-numeric.

---

### CRR-002: Dead-PID Crash Detection

- **Status:** Active
- **Added:** 2026-04-23

A crashed prior session is inferred when the running marker exists but its PID is no longer alive. The result drives the orphan-draft recovery flow and the cleanup skip.

**Behavior:**
- If `~/.wrangle/.running` does not exist → not a crash.
- If the marker exists but contains no valid PID → treated as a crash.
- If the marker's PID equals the current `process.pid` → treated as a crash (stale marker from a prior run with a recycled PID cannot be distinguished and is handled conservatively).
- Otherwise probe the PID with `process.kill(pid, 0)`:
  - `ESRCH` (no such process) → crash.
  - `EPERM` (exists but unsignalable) → not a crash; the prior process is still alive.
  - Success → not a crash.
- Detection runs exactly once per startup, before the new marker is written.

**Interface Contract:**
- `didCrashLastSession(): boolean` — synchronous, side-effect free.
- Called from `app.whenReady` prior to `createRunningMarker()`.

---

### CRR-003: Orphan Draft Discovery

- **Status:** Active
- **Added:** 2026-04-23

When a crash is detected, main scans the drafts directory for per-tab draft files and returns them for recovery.

**Behavior:**
- Drafts live at `~/.wrangle/drafts/{tabId}/draft.md`, one directory per tab.
- Scanning iterates every immediate child of `~/.wrangle/drafts/`; each child name is treated as a `tabId`.
- A child contributes an `OrphanedDraft` only when `draft.md` exists, is readable, and its content is non-empty after trimming.
- Unreadable drafts are skipped silently; the scan never throws.
- If `~/.wrangle/drafts/` does not exist, the scan returns an empty array.
- Discovery runs only when `didCrashLastSession()` returned `true`.

**Interface Contract:**
- `findOrphanedDrafts(): Promise<OrphanedDraft[]>`
- `OrphanedDraft = { tabId: string; content: string; lastModified: number }` where `lastModified` is `mtimeMs` of `draft.md`.

---

### CRR-004: Cached Recovery Info Served Over IPC

- **Status:** Active
- **Added:** 2026-04-23

The renderer retrieves crash-recovery state through a single IPC handle. The payload is assembled once at main startup and cached for the lifetime of the session.

**Behavior:**
- Main computes `{ didCrash, orphanedDrafts }` during `app.whenReady` and stores it via `setCrashRecoveryInfo`.
- When no crash was detected, the cache is the default `{ didCrash: false, orphanedDrafts: [] }` — orphan discovery is not invoked.
- The handler `crashRecovery:check` returns the cached object without rescanning disk.
- The renderer is responsible for reconciling orphan drafts against already-open tabs (skipping duplicates) and for deciding how to surface recovered content to the user.

**Interface Contract:**
- IPC channel: `crashRecovery:check` (invoke/handle).
- Return shape: `CrashRecoveryInfo = { didCrash: boolean; orphanedDrafts: OrphanedDraft[] }`.
- Module state: `cachedRecoveryInfo` in `crash-recovery-handler.ts`, mutated only by `setCrashRecoveryInfo`.

---

### CRR-005: Auto-Save to Per-Tab Draft

- **Status:** Active
- **Added:** 2026-04-23

The renderer persists tab content to its per-tab draft file on a debounced cadence so that an unexpected termination leaves at most the last un-flushed edits unrecoverable.

**Behavior:**
- Each tab has a stable `tabId`; its draft is written to `~/.wrangle/drafts/{tabId}/draft.md` via `window.electron.file.autoSave(tabId, content, path | null)`.
- The renderer debounces auto-save writes at 2500 ms after the most recent content change (see `useEditorPane.ts`).
- The cadence timer resets on every content change and is cleared when the pane unmounts.
- Auto-save failures are logged but do not surface to the user or interrupt editing.
- The existence of a draft file is the sole signal used by CRR-003; the save path must match the discovery path exactly.
- When a tab is saved to its real file location, the temp directory for that tab is cleaned up (see `moveTempToSaved` / `cleanupTempDir`) so stale drafts do not accumulate.

**Interface Contract:**
- Renderer API: `window.electron.file.autoSave(tabId: string, content: string, path: string | null): Promise<void>`.
- Draft path resolver: `getTempDraftPath(tabId)` → `~/.wrangle/drafts/{tabId}/draft.md`.
- Debounce source of truth: `autoSaveTimeoutRef` inside `useEditorPane` with a 2500 ms timeout.

---

### CRR-006: 7-Day Draft Cleanup With Crash Skip

- **Status:** Active
- **Added:** 2026-04-23

Old draft directories are swept on startup, but the sweep is suppressed whenever crash recovery has live data to present.

**Behavior:**
- During `initTempRoot`, each immediate child of `~/.wrangle/drafts/` whose `mtimeMs` is older than 7 days (`7 * 24 * 60 * 60 * 1000` ms) is removed recursively.
- Non-directory entries and unreadable entries are skipped with a warning; the sweep never throws out of `initTempRoot`.
- The sweep is skipped entirely when `initTempRoot(skipCleanup=true)` is invoked.
- Main passes `skipCleanup=true` iff `didCrashLastSession()` was `true` AND at least one orphan draft was found. Crash detection with zero orphans still cleans up.
- The skip only suppresses the age-based sweep; it does not prevent per-tab cleanup on successful save (CRR-005).

**Interface Contract:**
- `initTempRoot(skipCleanup?: boolean): Promise<void>` — default `false`.
- Startup wiring in `src/main/index.ts`: `await initTempRoot(hasOrphanedDrafts)` where `hasOrphanedDrafts = crashed && orphanedDrafts.length > 0`.
- Cleanup threshold constant: 7 days, expressed in ms at the call site.

---

## Key Files

| File | Purpose |
|------|---------|
| `src/main/utils/crash-recovery.ts` | Running marker read/write/clear, crash detection, orphan draft scan |
| `src/main/ipc/crash-recovery-handler.ts` | Cached recovery info and `crashRecovery:check` IPC |
| `src/main/utils/temp-dir-manager.ts` | Draft directory layout, 7-day cleanup, temp→saved migration |
| `src/main/index.ts` | Startup ordering: detect crash → discover orphans → create marker → init temp root |
| `src/renderer/src/hooks/useEditorPane.ts` | 2500 ms debounced auto-save to the per-tab draft file |
| `src/renderer/src/App.tsx` | Consumes `crashRecovery:check`, reconciles orphans against open tabs |
