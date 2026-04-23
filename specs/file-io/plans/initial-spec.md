# Plan: Initial File I/O Specification

## Context

This is a retroactive plan that codifies the existing file I/O behavior already implemented in Wrangle's main process. The behavior covered here (open dialog, read-by-path, save, save-as, auto-save, binary detection, CLI argument handling, second-instance forwarding) has been in production for several releases but has not previously had a canonical spec. This plan establishes the `file-io` feature (prefix `FIO`) and enumerates the requirements that describe current behavior so future changes can trace to stable IDs.

No behavioral change is proposed — this plan documents what already exists.

## Proposed Changes

### New Requirements

- **FIO-001: Open File Dialog With Filters And Multi-Select** — Open dialog exposes Markdown/Text/All filters and `multiSelections`, returns UTF-8 `FileData[]`.
- **FIO-002: Binary File Detection** — Extension whitelist short-circuits to text; otherwise scan first 8KB for null bytes.
- **FIO-003: Read File By Path** — Returns `FileData`, `{ error: 'binary' }`, or `null` on read failure.
- **FIO-004: Save To Known Path** — UTF-8 write to a known path; error dialog + `false` on failure.
- **FIO-005: Save-As With Dialog And Default Filename** — Save dialog defaults to `untitled.md` (or `${suggestedName}.md`); returns chosen path or `null`.
- **FIO-006: Auto-Save To Draft Or Known Path** — Writes to known path when set, otherwise to tab-scoped temp draft; silent on failure.
- **FIO-007: CLI File Argument Opens On First Launch** — Scans `argv` for a text file path and dispatches `file:openFromPath` after `ready-to-show`.
- **FIO-008: Second-Instance File Forwarding** — Single-instance lock forwards CLI file from subsequent launches to the primary window.
- **FIO-009: Unreadable Files Skipped With Logged Error** — `file:open` batch continues on individual read errors; partial results returned with errors logged.

### Modified Requirements

None — this is the initial spec.

### Removed Requirements

None.

## Spec Impact

- [x] New requirements added to spec
- [ ] Existing requirements updated in spec
- [ ] Tests created/updated referencing requirement IDs
- [ ] Plan moved to archive
