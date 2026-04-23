# Plan: Initial Workspaces Spec (Retroactive)

## Context

The workspaces feature has been implemented in `src/main/utils/workspace-manager.ts` and `src/main/ipc/workspace-handler.ts` without a canonical spec. This plan retroactively captures the current behavior as the authoritative `WSP` spec so future changes have a baseline to reference.

Scope is limited to: folder opening, per-workspace config and session files, the app-level session, file-tree listing (recursive + non-recursive), and the hidden-file toggle. Tab bar behavior (`WTB`) and file I/O (`FIO`) are explicitly excluded.

## Proposed Changes

### New Requirements

- **WSP-001: Open Folder Dialog** — `workspace:openFolder` IPC handler shows a native directory picker, creates-or-updates the workspace config, and returns `{ path, config }` or `null`.
- **WSP-002: Color Assignment On First Open** — New workspaces get a color from `WORKSPACE_COLORS` not in `usedColors`, wrapping by modulo when all are claimed.
- **WSP-003: `lastOpenedAt` Updated On Re-Open** — Re-opening an existing workspace refreshes `lastOpenedAt` and persists it; other fields are preserved.
- **WSP-004: Per-Workspace Config File Shape** — `.wrangle/workspace.json` (constants `WRANGLE_DIR`, `WORKSPACE_CONFIG_FILE`); JSON with `{ id, name, color, createdAt, lastOpenedAt }`.
- **WSP-005: Per-Workspace Session File Shape** — `.wrangle/session.json` (constant `SESSION_FILE`); JSON holding the `WorkspaceSession` payload owned by dependent features.
- **WSP-006: App-Level Session File Shape** — `~/.wrangle/app-session.json` (constants `APP_DATA_DIR`, `APP_SESSION_FILE`) with `AppSession` shape including `openWorkspaces`, `activeWorkspacePath`, `lastSavedAt`, and optional visibility/focus fields.
- **WSP-007: Non-Recursive File Listing (Depth 1)** — `workspace:listFiles` returns a single level of `FileTreeNode`, skipping `.wrangle` and (optionally) dotfiles, sorted directories-first then alphabetically.
- **WSP-008: Recursive File Listing (maxDepth 5)** — `workspace:listFilesRecursive` returns a nested tree; IPC default `maxDepth = 5`, helper default `10`.
- **WSP-009: Hidden-File Toggle** — `showHidden` flag on both listing helpers controls inclusion of dotfile entries; `.wrangle` is always excluded regardless.
- **WSP-010: Folder Watch (Deferred)** — `workspace:watchFolder` / `workspace:unwatchFolder` are registered as no-op stubs; live watching is deferred.

### Modified Requirements

None (initial spec).

### Removed Requirements

None (initial spec).

## Spec Impact

- [x] New requirements added to spec
- [ ] Existing requirements updated in spec
- [ ] Tests created/updated referencing requirement IDs
- [ ] Plan moved to archive

_Tests are intentionally unchecked: this is a retroactive capture of existing behavior and no test suite currently traces `WSP-*` IDs. A follow-up plan should add real unit/integration tests for WSP-001 through WSP-009 (WSP-010 stays Deferred until implemented)._

_Archive is intentionally unchecked: the plan remains in `plans/` until the follow-up test coverage plan lands, so reviewers can see the retroactive origin in one place._
