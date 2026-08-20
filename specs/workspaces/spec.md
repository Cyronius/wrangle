# Workspaces Specification

## Overview

This specification defines how Wrangle opens, persists, and lists folder-based workspaces. A workspace is a folder on disk augmented with a `.wrangle/` subdirectory that holds per-workspace config and session data. At the application level, Wrangle tracks which workspaces were open across launches.

This spec covers: opening folders, per-workspace config and session files, the app-level session file, file-tree listing (recursive and non-recursive), and the hidden-file toggle. It explicitly does NOT cover tab bar behavior (see `WTB` / `specs/workspace-tab-bar/`) or file I/O such as open/save/image copy (see `FIO`).

**Feature Prefix:** `WSP` (Workspaces)

**Key filesystem constants** (from `src/main/utils/workspace-manager.ts`):
- `.wrangle/` — per-workspace data directory (`WRANGLE_DIR`)
- `.wrangle/workspace.json` — per-workspace config (`WORKSPACE_CONFIG_FILE`)
- `.wrangle/session.json` — per-workspace session (`SESSION_FILE`)
- `~/.wrangle/app-session.json` — app-level session (`APP_SESSION_FILE`)

---

## Requirements

### WSP-001: Open Folder Dialog

- **Status:** Active
- **Added:** 2026-04-23

The application exposes an IPC handler that opens a native folder-picker dialog and returns workspace info for the chosen folder.

**Behavior:**
- The `workspace:openFolder` IPC handler calls Electron's `dialog.showOpenDialog` with `properties: ['openDirectory']` and title `'Open Folder as Workspace'`.
- If the user cancels or selects no folder, the handler resolves to `null`.
- If the selected folder has no existing `.wrangle/workspace.json`, a new config is created via `createDefaultConfig` and persisted.
- If the selected folder already has a `.wrangle/workspace.json`, the existing config is loaded and its `lastOpenedAt` is updated (see WSP-003).
- On success, the handler resolves to `{ path: folderPath, config: WorkspaceConfig }`.
- On unexpected error, an `Electron dialog.showErrorBox` is displayed and the handler resolves to `null`.

**Interface Contract:**
- Channel: `workspace:openFolder`
- Args: `usedColors: string[]` (colors already claimed by other open workspaces)
- Returns: `{ path: string, config: WorkspaceConfig } | null`

---

### WSP-002: Color Assignment On First Open

- **Status:** Active
- **Added:** 2026-04-23

On first open of a folder (no prior `.wrangle/workspace.json`), the new workspace is assigned a color from `WORKSPACE_COLORS` that is not already in `usedColors`.

**Behavior:**
- `getNextWorkspaceColor(usedColors)` returns the first entry of `WORKSPACE_COLORS` not present in `usedColors`.
- If every color in `WORKSPACE_COLORS` is already claimed, the function wraps and returns `WORKSPACE_COLORS[usedColors.length % WORKSPACE_COLORS.length]`.
- The chosen color is written to `config.color` and persisted to `.wrangle/workspace.json`.
- Color assignment does NOT occur on subsequent opens — an existing config's color is preserved.

**Interface Contract:**
- Helper: `getNextWorkspaceColor(usedColors: string[]): string`
- Default config builder: `createDefaultConfig(folderPath, usedColors)` produces `{ id, name, color, createdAt, lastOpenedAt }`.

---

### WSP-003: `lastOpenedAt` Updated On Re-Open

- **Status:** Active
- **Added:** 2026-04-23

Each time an existing workspace is opened, its `lastOpenedAt` timestamp is refreshed and persisted.

**Behavior:**
- When `workspace:openFolder` finds an existing `.wrangle/workspace.json`, it sets `config.lastOpenedAt = Date.now()` before saving.
- The updated value is written back to `.wrangle/workspace.json` via `saveWorkspaceConfig`.
- `createdAt`, `id`, `name`, and `color` are not modified during re-open.

**Interface Contract:**
- Field: `WorkspaceConfig.lastOpenedAt: number` (ms since epoch)

---

### WSP-004: Per-Workspace Config File Shape

- **Status:** Active
- **Added:** 2026-04-23

Each workspace folder stores its config at `.wrangle/workspace.json` (filename constant: `WORKSPACE_CONFIG_FILE = 'workspace.json'`; directory constant: `WRANGLE_DIR = '.wrangle'`).

**Behavior:**
- The file is JSON, pretty-printed with 2-space indentation, UTF-8 encoded.
- `.wrangle/` is created lazily via `ensureWorkspaceDir` before any write.
- If the file is absent, `loadWorkspaceConfig` returns `null`.
- If the file exists but is unparseable, a load error is logged and `loadWorkspaceConfig` returns `null`.

**Interface Contract:**
- Path helper: `getWorkspaceConfigPath(folderPath) === join(folderPath, '.wrangle', 'workspace.json')`
- Shape (`WorkspaceConfig`):
  ```ts
  {
    id: string          // "ws-<timestamp>-<rand>"
    name: string        // basename(folderPath) at creation time
    color: string       // from WORKSPACE_COLORS
    createdAt: number   // ms since epoch
    lastOpenedAt: number // ms since epoch
  }
  ```

---

### WSP-005: Per-Workspace Session File Shape

- **Status:** Active
- **Added:** 2026-04-23

Each workspace folder stores its session at `.wrangle/session.json` (filename constant: `SESSION_FILE = 'session.json'`).

**Behavior:**
- The file is JSON, pretty-printed with 2-space indentation, UTF-8 encoded.
- `.wrangle/` is created lazily via `ensureWorkspaceDir` before any write.
- If the file is absent, `loadWorkspaceSession` returns `null`.
- If parsing fails, an error is logged and `loadWorkspaceSession` returns `null`.
- Session shape (`WorkspaceSession`) is defined in `src/shared/workspace-types` and typically holds open-tab and view state scoped to the workspace. This spec does not constrain its field set beyond "it is the JSON written by `saveWorkspaceSession`"; individual fields are owned by their respective features (e.g., WTB).

**Interface Contract:**
- Path helper: `getWorkspaceSessionPath(folderPath) === join(folderPath, '.wrangle', 'session.json')`
- Load: `loadWorkspaceSession(folderPath): Promise<WorkspaceSession | null>`
- Save: `saveWorkspaceSession(folderPath, session): Promise<boolean>`

---

### WSP-006: App-Level Session File Shape

- **Status:** Active
- **Added:** 2026-04-23
- **Updated:** 2026-08-19 (unified-sidebar-redesign: added `expandedWorkspacePaths`/`openFilesExpanded`; `visibleWorkspacePaths`/`focusedPaneWorkspacePath` deprecated)

The application persists which workspaces were open at `~/.wrangle/app-session.json` (constants: `APP_DATA_DIR = join(homedir(), '.wrangle')`, `APP_SESSION_FILE = join(APP_DATA_DIR, 'app-session.json')`).

**Behavior:**
- The file is JSON, pretty-printed with 2-space indentation, UTF-8 encoded.
- `~/.wrangle/` is created lazily via `mkdir(..., { recursive: true })` before any write.
- If the file is absent, `loadAppSession` returns `null`.
- If parsing fails, an error is logged and `loadAppSession` returns `null`.
- A parallel `~/.wrangle/default-session.json` (constant `DEFAULT_SESSION_FILE`) holds the default/untitled workspace session for tabs not associated with a folder workspace.

**Interface Contract:**
- Shape (`AppSession`):
  ```ts
  {
    openWorkspaces: string[]              // workspace root paths
    activeWorkspacePath: string | null
    lastSavedAt: number                   // ms since epoch
    expandedWorkspacePaths?: string[]     // SBR-002: workspaces with expanded sidebar sections
    openFilesExpanded?: boolean           // SBR-002: Open Files section expanded
    // Deprecated (kept for backwards compatibility on load, never read):
    visibleWorkspacePaths?: string[]
    focusedPaneWorkspacePath?: string | null
    multiPaneEnabled?: boolean
    visiblePaneWorkspacePaths?: string[]
  }
  ```
- Channels: `workspace:loadAppSession`, `workspace:saveAppSession`, `workspace:loadDefaultSession`, `workspace:saveDefaultSession`.

---

### WSP-007: Non-Recursive File Listing (Depth 1)

- **Status:** Active
- **Added:** 2026-04-23

The `workspace:listFiles` IPC handler returns a single-level listing of a directory's contents for lazy-loaded file-tree expansion.

**Behavior:**
- Returns `FileTreeNode[]` where each node has `{ name, path, isDirectory }` and no `children` field.
- The `.wrangle` directory is always skipped.
- Entries whose names start with `.` are skipped unless `showHidden === true` (see WSP-009).
- Inaccessible entries (stat failures) are skipped with a warning and do not abort the listing.
- Results are sorted: directories before files, then alphabetically by name via `localeCompare`.
- On top-level error, the handler resolves to `[]`.

**Interface Contract:**
- Channel: `workspace:listFiles`
- Args: `folderPath: string, showHidden?: boolean`
- Returns: `FileTreeNode[]`
- Helper: `listFiles(dirPath, showHidden?)`

---

### WSP-008: Recursive File Listing (maxDepth 5)

- **Status:** Active
- **Added:** 2026-04-23

The `workspace:listFilesRecursive` IPC handler returns a nested tree of a directory's contents for initial file-tree load.

**Behavior:**
- Returns `FileTreeNode[]` where directory nodes additionally carry `children: FileTreeNode[]`.
- Default `maxDepth` for the IPC handler is `5`; the underlying helper `listFilesRecursive` defaults to `10` when called directly.
- Recursion stops when `currentDepth >= maxDepth`; deeper directories return an empty children array for their parent.
- The `.wrangle` directory is always skipped at every level.
- Entries whose names start with `.` are skipped unless `showHidden === true` (see WSP-009).
- Inaccessible entries are skipped with a warning.
- At each level, results are sorted: directories before files, then alphabetically by name.
- On top-level error, the handler resolves to `[]`.

**Interface Contract:**
- Channel: `workspace:listFilesRecursive`
- Args: `folderPath: string, maxDepth: number = 5, showHidden?: boolean`
- Returns: `FileTreeNode[]`
- Helper: `listFilesRecursive(dirPath, maxDepth = 10, currentDepth = 0, showHidden?)`

---

### WSP-009: Hidden-File Toggle

- **Status:** Active
- **Added:** 2026-04-23

Both listing handlers accept an optional `showHidden` boolean that controls whether dotfile entries are included.

**Behavior:**
- When `showHidden` is falsy (`undefined`, `false`), entries whose name starts with `.` are skipped.
- When `showHidden === true`, dotfile entries are included in the result.
- The `.wrangle` directory is ALWAYS skipped regardless of `showHidden`, because it is internal application state.
- The toggle applies at every level of recursion in `listFilesRecursive`.

**Interface Contract:**
- `listFiles(dirPath, showHidden?)` and `listFilesRecursive(dirPath, maxDepth, currentDepth, showHidden?)` both honor the flag identically.
- IPC: `workspace:listFiles` and `workspace:listFilesRecursive` forward `showHidden` from the renderer.

---

### WSP-010: Folder Watch (Deferred)

- **Status:** Deferred
- **Added:** 2026-04-23

Live folder-watching with change notifications to the renderer is deferred to a future phase.

**Behavior (intended, not implemented):**
- Watch a workspace root for file/directory create, rename, modify, and delete events.
- Emit debounced change events to the renderer so the file tree can refresh incrementally.

**Current state:**
- The IPC channels `workspace:watchFolder` and `workspace:unwatchFolder` are registered as stubs that immediately resolve to `true` and perform no watching. The renderer must manually refresh the tree via `workspace:listFiles` / `workspace:listFilesRecursive` until this requirement becomes Active.

**Interface Contract (placeholder):**
- Channels: `workspace:watchFolder(folderPath)`, `workspace:unwatchFolder(folderPath)` — both currently no-ops returning `true`.

---

## Key Files

| File | Purpose |
|------|---------|
| `src/main/utils/workspace-manager.ts` | Filesystem helpers, path constants, config/session load/save, file listing, app-session |
| `src/main/ipc/workspace-handler.ts` | IPC channel registration for all `workspace:*` handlers |
| `src/shared/workspace-types.ts` | `WorkspaceConfig`, `WorkspaceSession`, `FileTreeNode`, `WORKSPACE_COLORS` |

---

## Out of Scope

- Tab bar rendering, workspace visibility in tabs, overflow: see `specs/workspace-tab-bar/` (`WTB`).
- Open/save/saveAs of markdown files, image copy into `assets/`: see the `FIO` feature spec.
