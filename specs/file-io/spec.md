# File I/O Specification

## Overview

This specification defines how Wrangle opens, reads, saves, and auto-saves text files, including binary-file detection, command-line file arguments, and second-instance file forwarding. It covers the IPC file API exposed by the main process to the renderer, as well as startup/second-instance file handling performed in the main process. This spec does NOT cover image asset handling, workspace file-tree listing, or crash recovery — those live in their own specs.

**Feature Prefix:** `FIO` (File I/O)

---

## Requirements

### FIO-001: Open File Dialog With Filters And Multi-Select

- **Status:** Active
- **Added:** 2026-04-23

Invoking the open-file action shows a native file-picker dialog configured for text/markdown files and supports selecting multiple files at once.

**Behavior:**
- The open dialog uses `properties: ['openFile', 'multiSelections']`
- Filter list (in order): Markdown Files (`md`, `markdown`, `mdown`, `mkd`, `mdwn`); Text Files (`txt`); All Files (`*`)
- If the user cancels or selects nothing, an empty array is returned
- Each selected path is read as UTF-8 and returned as a `FileData` record (`{ path, content }`)
- If any individual file fails to read, the error is logged and that file is omitted from the result, but remaining files are still returned (see FIO-009)

**Interface Contract:**
- IPC: `file:open` → `Promise<FileData[]>`
- Preload: `window.electron.file.open()`
- Handler: `src/main/ipc/file-handler.ts` (`ipcMain.handle('file:open', ...)`)

**E2E Test Plan:**
- Trigger File → Open; dialog appears with Markdown/Text/All filters
- Select a single `.md` file; verify one tab opens with its UTF-8 content
- Select three files via Ctrl/Cmd-click; verify three tabs open
- Cancel the dialog; verify no tabs open and no error surfaces

---

### FIO-002: Binary File Detection

- **Status:** Active
- **Added:** 2026-04-23

Files whose extension is not in the known text-extension whitelist are scanned for null bytes in their first 8KB to determine whether they are binary.

**Behavior:**
- If the file extension (lower-cased) is present in the shared `TEXT_EXTENSIONS` set, the file is always treated as text and no content scan is performed
- Otherwise, the first 8192 bytes of the file are read; if any byte equals `0x00` the file is classified binary
- Files with no extension are scanned by content
- If the scan itself throws (e.g. permission error on open), the file is treated as non-binary so the downstream read attempt can surface the real error

**Interface Contract:**
- Internal helper `isBinaryFile(filePath: string): Promise<boolean>` in `src/main/ipc/file-handler.ts`
- Text extension whitelist: `src/shared/file-extensions.ts` (`TEXT_EXTENSIONS`)
- Scan buffer size: 8192 bytes, starting at offset 0

**E2E Test Plan:**
- Call `readByPath` on a `.md` file → no binary classification (extension whitelisted)
- Call `readByPath` on a `.png` file → classified binary, error `'binary'` returned
- Call `readByPath` on an extensionless file containing only ASCII → classified text
- Call `readByPath` on an extensionless file containing a null byte in the first 8KB → classified binary

---

### FIO-003: Read File By Path

- **Status:** Active
- **Added:** 2026-04-23

The renderer can request the contents of an arbitrary file path; the main process returns content, a binary error, or `null` on failure.

**Behavior:**
- If `isBinaryFile(path)` returns true, the handler returns `{ error: 'binary' }` and does not read the file contents
- Otherwise the file is read as UTF-8 and returned as `{ path, content }`
- Any thrown error is logged to stderr and `null` is returned
- The returned shape is never a partial/undefined — it is always one of the three documented values

**Interface Contract:**
- IPC: `file:readByPath` → `Promise<FileData | { error: 'binary' } | null>`
- Preload: `window.electron.file.readByPath(filePath)`
- Encoding: UTF-8

**E2E Test Plan:**
- Request a valid markdown path → receive `{ path, content }` with UTF-8 content
- Request a PNG path → receive `{ error: 'binary' }`
- Request a non-existent path → receive `null` and see an error logged

---

### FIO-004: Save To Known Path

- **Status:** Active
- **Added:** 2026-04-23

Saving a file with a known path writes UTF-8 content to that exact path, reporting success or surfacing an error dialog on failure.

**Behavior:**
- Content is written with UTF-8 encoding to the supplied path (no atomic-write, no backup — direct `writeFile`)
- On success, returns `true`
- On failure, the error is logged, a native `showErrorBox('File Save Error', ...)` is displayed, and `false` is returned
- The path is used verbatim — no extension coercion, no directory creation

**Interface Contract:**
- IPC: `file:save` → `Promise<boolean>`
- Preload: `window.electron.file.save(path, content)`
- Uses `fs/promises.writeFile(path, content, 'utf-8')`

**E2E Test Plan:**
- Save an open tab with a known path → file content on disk matches editor; handler returns `true`
- Revoke write permission on the file and save → error dialog appears; handler returns `false`
- Save with content containing unicode characters → file round-trips correctly as UTF-8

---

### FIO-005: Save-As With Dialog And Default Filename

- **Status:** Active
- **Added:** 2026-04-23

Save-As shows a native save dialog with markdown-first filters and a default filename; on confirm it writes the file and returns the chosen path.

**Behavior:**
- Dialog filters (in order): Markdown Files (`md`), Text Files (`txt`), All Files (`*`)
- Default filename: `${suggestedName}.md` when `suggestedName` is provided, otherwise `untitled.md`
- If the user cancels, the handler returns `null` and nothing is written
- On confirm, content is written as UTF-8 to the chosen path; on success the chosen path is returned
- On write failure, the error is logged, a native error dialog is shown, and `null` is returned

**Interface Contract:**
- IPC: `file:saveAs` → `Promise<string | null>`
- Preload: `window.electron.file.saveAs(content, suggestedName?)`
- Uses `dialog.showSaveDialog({ filters, defaultPath })`

**E2E Test Plan:**
- Trigger Save As on an untitled tab with no suggested name → dialog default filename is `untitled.md`
- Trigger Save As with suggestedName `"notes"` → dialog default filename is `notes.md`
- Confirm the dialog → handler returns the chosen path; file exists on disk with the correct content
- Cancel the dialog → handler returns `null`; nothing is written

---

### FIO-006: Auto-Save To Draft Or Known Path

- **Status:** Active
- **Added:** 2026-04-23

Auto-save writes the current tab content to the tab's known path, or to a tab-scoped temp draft when the tab has no path yet.

**Behavior:**
- When `filePath` is non-null, content is written as UTF-8 to that path
- When `filePath` is null, the tab's temp directory is ensured (`ensureTempDir(tabId)`) and content is written to the tab's draft path (`getTempDraftPath(tabId)`)
- On success, the path that was written (real or temp draft) is returned, so the caller can track where the draft lives
- On failure, the error is logged and `null` is returned — no dialog is shown (auto-save is silent)

**Interface Contract:**
- IPC: `file:autoSave` → `Promise<string | null>`
- Preload: `window.electron.file.autoSave(tabId, content, filePath | null)`
- Temp-dir helpers: `src/main/utils/temp-dir-manager.ts`

**E2E Test Plan:**
- Auto-save a saved tab → returned path equals the tab's file path; file on disk updated
- Auto-save an untitled tab → returned path is under the temp directory for that `tabId`; draft file exists with current content
- Auto-save with an invalid path (e.g. deleted directory) → returns `null`, no dialog appears, error logged

---

### FIO-007: CLI File Argument Opens On First Launch

- **Status:** Active
- **Added:** 2026-04-23
- **Updated:** 2026-06-08

When Wrangle is launched with a file path as a command-line argument — including when the OS launches it via a file-type association (e.g. double-clicking a `.md` in the file manager) — that file is opened in the first window after the renderer is ready.

**Behavior:**
- The argv scan offset depends on packaging, because Electron's `process.argv` leading entries differ:
  - **Packaged** (installed app): `[exe, <file>, ...]` → scan from index **1** (`argv.slice(1)`)
  - **Unpackaged** (dev / e2e): `[electron, mainScript, <file>, ...]` → scan from index **2** (`argv.slice(2)`)
  - The offset is selected by `app.isPackaged`. Using a fixed offset of 2 in a packaged build drops the file path at `argv[1]`, which is the OS-supplied path — this was the cause of "Wrangle launches but the file does not open" when opening from Explorer.
- The sliced args are scanned for the first argument that (a) does not start with `-`, (b) passes `isTextFile(arg)` (extension is in the shared whitelist), and (c) exists on disk
- If found, the file is read as UTF-8 on the `ready-to-show` event of the main window
- The renderer receives the content via the `file:openFromPath` IPC event as `{ path, content }`
- Errors during the read are logged but do not block window startup
- If no matching argument is present, no file is auto-opened

**Interface Contract:**
- Main-process scanner: `getFilePathFromArgs(argv: string[], isPackaged: boolean): string | null` in `src/main/utils/cli-args.ts`
- IPC event (main → renderer): `file:openFromPath` with payload `{ path: string; content: string }`
- Preload: `window.electron.onFileOpenedFromPath(callback)`

**E2E Test Plan:**
- Launch `wrangle.exe path\to\file.md` → a tab opens showing that file's content
- Launch `wrangle.exe --some-flag` → no tab is auto-opened
- Launch `wrangle.exe nonexistent.md` → no tab opens, an error is logged
- Launch `wrangle.exe image.png` → no tab opens (extension not in text whitelist)

---

### FIO-008: Second-Instance File Forwarding

- **Status:** Active
- **Added:** 2026-04-23

Only one instance of Wrangle runs at a time; subsequent launches forward their CLI file argument to the existing instance and focus its window.

**Behavior:**
- `app.requestSingleInstanceLock()` is called at startup; if the lock is not obtained, the current process quits immediately
- When the primary instance receives a `second-instance` event, it recreates `mainWindow` if destroyed, restores/minimizes→visible/focus the existing window
- If the second-instance `argv` contains a valid text file path (same rules as FIO-007), the file is read and sent to the renderer via `file:openFromPath`
- Read errors in the second-instance flow are logged but do not crash the primary instance

**Interface Contract:**
- Main-process: `app.on('second-instance', (event, argv) => ...)` in `src/main/index.ts`
- Reuses `getFilePathFromArgs(argv, app.isPackaged)` (see FIO-007) and the `file:openFromPath` IPC event

**E2E Test Plan:**
- Launch Wrangle; then launch `wrangle.exe other.md` again → original window gains focus and opens `other.md` as a new tab
- With the first window minimized, launch a second instance with a file → window is restored, brought to front, and the file opens
- Launch second instance with no file → original window is focused; no new tab opens
- Launch second instance with a binary/non-text path → original window focuses; no tab opens; error logged

---

### FIO-009: Unreadable Files Skipped With Logged Error

- **Status:** Active
- **Added:** 2026-04-23

When a batch file-open operation encounters a file it cannot read, it logs the error and continues processing remaining files instead of failing the whole batch.

**Behavior:**
- In `file:open` (FIO-001), each selected path is read inside its own try/catch; a failed read logs `console.error('Error reading file:', filePath, error)` and the loop continues to the next file
- The returned array contains only successfully read files; callers observing a shorter array than the selection size can infer partial success
- No user-facing error dialog is shown for individual file read failures in `file:open` (in contrast with `file:save`/`file:saveAs`, which do show dialogs per FIO-004/FIO-005)

**Interface Contract:**
- Error logging via `console.error` (captured by the main-process stdio stream)
- Affected handler: `file:open` in `src/main/ipc/file-handler.ts`

**E2E Test Plan:**
- Select three files where one has been deleted between the dialog showing and the read completing → two tabs open; one error is logged; no dialog shown
- Select three files where one is unreadable due to permissions → two tabs open; permission error logged
- Select one file that cannot be read → handler returns an empty array; error is logged

---

### FIO-010: OS-Opened File Workspace Placement And Focus

- **Status:** Active
- **Added:** 2026-06-08
- **Applies to:** wrangle (renderer)
- **Test category:** unit (placement function) + manual (focus/visibility wiring)

When a file is delivered to the renderer via the `file:openFromPath` event (FIO-007 first launch / FIO-008 second instance — i.e. opened from the OS file manager or "Open with"), it is placed in a workspace and surfaced for immediate editing. This differs from the file-picker and file-tree flows, which fall back to the *active* workspace; OS-opened files fall back to the *default* workspace.

**Behavior:**
- **Placement:** If an open folder-backed workspace's `rootPath` is an ancestor of the file path (ancestor containment, normalized across `\` and `/`), the file's tab is created in that workspace. Otherwise it is created in the default workspace (`__default__`) — *not* the currently active workspace. When more than one folder workspace contains the path (nested roots), the first match in workspace order wins.
- **Already open:** If a tab with the same `path` already exists, no duplicate is created; its existing tab and workspace are used as the target.
- **Focus:** The target workspace is made active (`setActiveWorkspace`) and focused (`setFocusedPane`), the target tab is activated (`setActiveTab`), and the editor is given keyboard focus after the active-tab-driven re-render commits (`requestAnimationFrame(() => editorRef.current?.focus())`). Because the editor pane is driven by `useEditorPane(activeWorkspaceId)`, switching the active workspace is required for the opened file to be visible.

**Interface Contract:**
- Pure placement helper: `findFolderWorkspaceForPath(workspaces, filePath): WorkspaceState | null` in `src/renderer/src/store/workspacesSlice.ts` (returns `null` when no folder workspace owns the path; caller substitutes the default workspace). `selectWorkspaceForPath` delegates to it.
- Renderer handler: `onFileOpenedFromPath` effect in `src/renderer/src/App.tsx`.

**Test Plan:**
- *unit* — `findFolderWorkspaceForPath`: ancestor match, nested-subfolder match, no-match → `null`, only-default → `null`, `\`/`/` normalization, sibling prefix not matched (`projects` vs `projects-archive`), nested-roots first-match-wins, `undefined` path → `null`. Parity: `selectWorkspaceForPath` still returns the default workspace on no match.
- *manual* — (1) file outside any folder workspace opens in Default, which becomes active/focused with the editor focused; (2) file inside an open folder workspace opens in that workspace, active/focused; (3) an already-open file is surfaced (workspace + tab activated) with no duplicate tab.

---

## Key Files

| File | Purpose |
|------|---------|
| `src/main/ipc/file-handler.ts` | Registers `file:open`, `file:readByPath`, `file:save`, `file:saveAs`, `file:autoSave` handlers and `isBinaryFile` helper |
| `src/main/utils/cli-args.ts` | `getFilePathFromArgs` — packaging-aware argv scan for the OS-supplied file path |
| `src/main/index.ts` | `ready-to-show` CLI file load, `second-instance` handler, single-instance lock |
| `src/renderer/src/store/workspacesSlice.ts` | `findFolderWorkspaceForPath` / `selectWorkspaceForPath` — workspace placement for opened files (FIO-010) |
| `src/renderer/src/App.tsx` | `onFileOpenedFromPath` effect — places OS-opened files (FIO-010) and gives editor focus |
| `src/shared/file-extensions.ts` | `TEXT_EXTENSIONS` set and `isTextFile` helper used by binary detection and CLI arg filtering |
| `src/main/utils/temp-dir-manager.ts` | `ensureTempDir`, `getTempDraftPath` used by auto-save for unsaved tabs |
| `src/preload/electron.d.ts` | Types for `window.electron.file.*` and `onFileOpenedFromPath` |
| `src/shared/types.ts` | `FileData` shape |

---

## E2E Test File Structure

```
tests/e2e/file-io/
├── fio-001-open-dialog.spec.ts
├── fio-002-binary-detection.spec.ts
├── fio-003-read-by-path.spec.ts
├── fio-004-save.spec.ts
├── fio-005-save-as.spec.ts
├── fio-006-auto-save.spec.ts
├── fio-007-cli-argument.spec.ts
├── fio-008-second-instance.spec.ts
└── fio-009-partial-success.spec.ts
```

Each test file tests its corresponding requirement using the test plans defined above.
