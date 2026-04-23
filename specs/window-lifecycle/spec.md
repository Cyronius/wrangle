# Window Lifecycle Specification

## Overview

This specification defines the behavior of the Wrangle main window's lifecycle: creation, sizing, zoom control, export operations (PDF/HTML), single-instance enforcement, graceful shutdown, and menu-to-renderer command dispatch. It is adjacent to but distinct from the `window-drag` spec, which governs drag regions and custom titlebar chrome.

**Feature Prefix:** `WIN` (Window Lifecycle)

---

## Requirements

### WIN-001: Window Show Race

- **Status:** Active
- **Added:** 2026-04-23

The main window must become visible even if the renderer stalls before first paint. Three triggers race: `ready-to-show`, `did-finish-load`, and a 3-second safety timer. The first to fire calls `win.show()` exactly once.

**Behavior:**
- The window is constructed with `show: false`
- A `shown` latch guard ensures `win.show()` is invoked at most once
- A 3000ms `setTimeout` fires `showNow('safety-timeout-3s')` as a fallback
- The timer is cleared on window `closed`
- If the window is destroyed before any trigger fires, the show is skipped
- In `NODE_ENV=test` the actual `win.show()` call is suppressed (latch still flips)

**Interface Contract:**
- Implemented in `createWindow()` in `src/main/index.ts`
- Reason string is logged via `logStartup('window.show', { reason })`
- Allowed reasons: `'ready-to-show'`, `'did-finish-load'`, `'safety-timeout-3s'`

---

### WIN-002: Default Window Size and Minimum

- **Status:** Active
- **Added:** 2026-04-23

The main window opens at a default size of 1200x800 with a hard minimum of 400x300.

**Behavior:**
- `BrowserWindow` constructed with `width: 1200, height: 800`
- `minWidth: 400, minHeight: 300` prevents the user from resizing below usable dimensions
- Constraints apply on initial creation; future persistence of user-resized dimensions is out of scope for this requirement

**Interface Contract:**
- Constants live in the `BrowserWindow` options object in `createWindow()` (`src/main/index.ts`)

---

### WIN-003: Zoom Level Clamp

- **Status:** Active
- **Added:** 2026-04-23

The zoom level applied via the `window:zoom` IPC is clamped to the inclusive range `[-3, +3]` (approximately 50% to 200%).

**Behavior:**
- Handler reads `webContents.getZoomLevel()`, computes `current + delta * 0.5`, and clamps with `Math.max(-3, Math.min(3, next))`
- The `window:resetZoom` IPC sets level to `0`
- The `window:getZoom` IPC returns the current level (defaults to `0` if no window)
- Clamping does not throw on out-of-range input — it silently saturates

**Interface Contract:**
- `ipcMain.on('window:zoom', (event, delta: number) => void)`
- `ipcMain.on('window:resetZoom', (event) => void)`
- `ipcMain.handle('window:getZoom', (event) => number)`
- Implemented in `src/main/ipc/window-handler.ts`

---

### WIN-004: Export as PDF

- **Status:** Active
- **Added:** 2026-04-23

The `window:exportPdf` IPC renders supplied HTML to PDF and writes it to a user-chosen path, or returns `null` if the user cancels or an error occurs.

**Behavior:**
- Shows a save dialog with default filename `${title}.pdf` and PDF extension filter
- On cancel, returns `null` immediately without creating a file
- Renders HTML in a hidden offscreen `BrowserWindow` sized 816x1056 (US Letter at 96 DPI)
- Waits 500ms after load before invoking `printToPDF` to allow async rendering (math, diagrams) to settle
- Uses `printBackground: true` and 0.5-inch margins on all sides
- Writes the resulting buffer to the chosen path and returns that path
- On any thrown error, logs and returns `null`
- The hidden window is always destroyed in a `finally` block

**Interface Contract:**
- `ipcMain.handle('window:exportPdf', (event, html: string, title: string) => Promise<string | null>)`
- Return value: absolute file path on success, `null` on cancel or failure
- Implemented in `src/main/ipc/window-handler.ts`

---

### WIN-005: Export as HTML

- **Status:** Active
- **Added:** 2026-04-23

The `window:exportHtml` IPC writes supplied HTML to a user-chosen path, or returns `null` if the user cancels or an error occurs.

**Behavior:**
- Shows a save dialog with default filename `${title}.html` and HTML extension filter
- On cancel, returns `null` immediately
- Writes the HTML string UTF-8 encoded to the chosen path
- Returns the chosen path on success
- On write error, logs and returns `null`

**Interface Contract:**
- `ipcMain.handle('window:exportHtml', (event, html: string, title: string) => Promise<string | null>)`
- Implemented in `src/main/ipc/window-handler.ts`

---

### WIN-006: Single-Instance Lock

- **Status:** Active
- **Added:** 2026-04-23

Only one Wrangle instance may run at a time. A second launch delegates to the existing instance and exits.

**Behavior:**
- `app.requestSingleInstanceLock()` is called at module load
- If the lock is not acquired, the second process calls `app.quit()` immediately
- On `second-instance`, the existing process:
  - Recreates `mainWindow` if it was closed/destroyed
  - Restores the window if minimized
  - Shows the window if hidden and focuses it
  - Parses the second invocation's `argv` for a supported text file path; if present, reads the file and forwards `{path, content}` to the renderer via `file:openFromPath`
- File path extraction skips flags (args starting with `-`), requires `isTextFile(arg)` to be true, and requires the path to exist on disk

**Interface Contract:**
- Single module-level `mainWindow: BrowserWindow | null` reference in `src/main/index.ts`
- Renderer receives `file:openFromPath` with `{ path: string, content: string }`

---

### WIN-007: Graceful Shutdown and Running Marker

- **Status:** Active
- **Added:** 2026-04-23

The running marker (used by crash recovery) must be cleared on every graceful shutdown path: `will-quit`, `SIGINT`, and `SIGTERM`.

**Behavior:**
- `app.on('will-quit')` unregisters all global shortcuts and calls `clearRunningMarker()` (errors swallowed)
- `process.on('SIGINT')` and `process.on('SIGTERM')` each call `clearRunningMarker()` and then `app.quit()`
- `window-all-closed` quits the app on non-macOS platforms
- Marker clearing uses `.catch(() => {})` so shutdown is never blocked by a failed filesystem operation

**Interface Contract:**
- `clearRunningMarker()` from `src/main/utils/crash-recovery.ts` returns a Promise
- Absence of the running marker on next launch indicates a clean shutdown; its presence indicates a crash (see crash-recovery spec)

---

### WIN-008: Menu-to-Renderer Command Dispatch

- **Status:** Active
- **Added:** 2026-04-23

Application menu clicks emit the `menu:command` IPC channel with a documented command-name vocabulary. The renderer dispatches Redux actions or triggers editor operations based on the command name.

**Behavior:**
- Menu item `click` handlers call `mainWindow.webContents.send('menu:command', <commandName>)`
- Command names are stable identifiers; renaming is a breaking change
- System roles (`undo`, `redo`, `cut`, `copy`, `paste`, `selectAll`, `reload`, `forceReload`, `toggleDevTools`, `resetZoom`, `zoomIn`, `zoomOut`, `togglefullscreen`) use Electron's built-in role behavior and do NOT emit `menu:command`

**Interface Contract:**

Command-name vocabulary (current):

| Command | Accelerator | Trigger |
|---------|-------------|---------|
| `file:new` | CmdOrCtrl+N | File → New |
| `file:open` | CmdOrCtrl+O | File → Open |
| `file:save` | CmdOrCtrl+S | File → Save |
| `file:saveAs` | CmdOrCtrl+Shift+S | File → Save As |
| `workspace:openFolder` | CmdOrCtrl+K CmdOrCtrl+O | File → Open Folder as Workspace |
| `view:editor-only` | CmdOrCtrl+1 | View → Editor Only |
| `view:split` | CmdOrCtrl+2 | View → Split View |
| `view:preview-only` | CmdOrCtrl+3 | View → Preview Only |
| `theme:light` | — | View → Theme → Light |
| `theme:dark` | — | View → Theme → Dark |

- Implemented in `src/main/menu/menu-template.ts`
- Exit menu item does NOT emit a command — it calls `mainWindow.close()` directly

---

## Key Files

| File | Purpose |
|------|---------|
| `src/main/index.ts` | Window creation, show race, single-instance lock, shutdown handlers |
| `src/main/ipc/window-handler.ts` | Zoom, min/max/close, print, PDF/HTML export IPC handlers |
| `src/main/menu/menu-template.ts` | Application menu and `menu:command` dispatch |
| `src/main/utils/crash-recovery.ts` | Running marker primitives (`createRunningMarker`, `clearRunningMarker`) |
| `src/main/utils/startup-log.ts` | Structured startup logging used by the show race |

---

## Related Specs

- `specs/window-drag/spec.md` — drag regions, titlebar overlay, frameless window chrome
- `specs/crash-recovery/spec.md` (if present) — running marker semantics and orphaned draft discovery
