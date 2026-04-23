# Image Assets Specification

## Overview

This specification defines how Wrangle handles images embedded in Markdown documents: drag-and-drop copying, filename sanitization, collision avoidance, per-tab temporary asset storage for unsaved drafts, migration of temp assets to the final saved location, reading images as data URLs for preview rendering, and editor insertion of Markdown image syntax at the cursor.

**Feature Prefix:** `IMG` (Image Assets)

---

## Requirements

### IMG-001: Drag-and-Drop Image Copy IPC

- **Status:** Active
- **Added:** 2026-04-23

When a user drags an image file onto the editor, the renderer invokes the `file:copyImage` IPC channel to copy the image into the correct assets directory and obtain a relative Markdown path.

**Behavior:**
- The renderer (`useImageDrop`) detects dropped files whose extension matches a known image type and delegates each one to the main process
- The main handler accepts `(sourcePath, tabId, markdownFilePath | null)` and returns the relative path on success or `null` on failure
- On failure the main process surfaces an error dialog (`Image Copy Error`) and the renderer logs the error without inserting any Markdown

**Interface Contract:**
- IPC channel: `file:copyImage`
- Main handler: `ipcMain.handle('file:copyImage', (_event, sourcePath: string, tabId: string, markdownFilePath: string | null) => Promise<string | null>)`
- Renderer API: `window.electron.file.copyImage(sourcePath, tabId, currentFilePath | null)`

---

### IMG-002: Filename Sanitization

- **Status:** Active
- **Added:** 2026-04-23

Image basenames are sanitized before they are used as target filenames.

**Behavior:**
- The file extension is preserved as-is from the source (e.g., `.png`, `.jpg`)
- The basename (filename without extension) has every character not matching `[a-zA-Z0-9-_]` replaced with an underscore `_`
- Sanitization applies regardless of whether the destination is a saved-file assets directory or a temp assets directory

**Interface Contract:**
- Sanitization regex: `/[^a-zA-Z0-9-_]/g` → replacement `_`
- Implemented in `src/main/ipc/file-handler.ts` `file:copyImage` handler

---

### IMG-003: Collision Counter Suffix

- **Status:** Active
- **Added:** 2026-04-23

When the sanitized target filename already exists in the assets directory, a numeric suffix is appended to produce a unique filename.

**Behavior:**
- Initial candidate is `{sanitizedBasename}{ext}`
- If that path exists, the candidate becomes `{sanitizedBasename}_1{ext}`, then `_2`, `_3`, etc., until a non-existing path is found
- The counter starts at 1 and increments by 1 per collision
- The extension is always preserved; the suffix is inserted between the basename and extension

**Interface Contract:**
- Collision loop in `file:copyImage` handler: `while (existsSync(path.join(assetsDir, targetFilename))) { targetFilename = \`${imageBasename}_${counter}${imageExt}\`; counter++ }`

---

### IMG-004: Saved-File Asset Directory

- **Status:** Active
- **Added:** 2026-04-23

When the active tab corresponds to a Markdown file that has been saved to disk, copied images are placed in an `assets/` folder sibling to the Markdown file.

**Behavior:**
- If `markdownFilePath` is a non-null path, the assets directory is `{dirname(markdownFilePath)}/assets`
- The assets directory is created with `mkdir -p` semantics if it does not exist
- The image is copied into this directory using the sanitized, collision-resolved filename

**Interface Contract:**
- `assetsDir = path.join(path.dirname(markdownFilePath), 'assets')`
- Directory creation: `mkdir(assetsDir, { recursive: true })` when `!existsSync(assetsDir)`

---

### IMG-005: Unsaved-File Temp Asset Directory

- **Status:** Active
- **Added:** 2026-04-23

When the active tab has no saved file path (draft/unsaved document), copied images are placed in a per-tab temporary assets directory under the user's home directory.

**Behavior:**
- If `markdownFilePath` is `null`, the assets directory is `{homedir}/.wrangle/drafts/{tabId}/assets`
- The temp directory hierarchy is created on demand via `ensureTempAssetDir(tabId)` before the copy
- Each tab gets its own isolated asset directory identified by its `tabId`

**Interface Contract:**
- Path: `join(homedir(), '.wrangle', 'drafts', tabId, 'assets')` (via `getTempAssetDir(tabId)`)
- Ensured by `ensureTempAssetDir(tabId)` in `src/main/utils/temp-dir-manager.ts`

---

### IMG-006: Relative Path Return Value

- **Status:** Active
- **Added:** 2026-04-23

The `file:copyImage` IPC handler returns a POSIX-style relative path suitable for direct insertion into Markdown image syntax.

**Behavior:**
- The returned string is always of the form `./assets/{finalFilename}` where `finalFilename` is the sanitized, collision-resolved filename produced by IMG-002 and IMG-003
- The path uses forward slashes regardless of platform
- The same relative path shape is returned for both saved-file (IMG-004) and temp (IMG-005) destinations, because the preview layer resolves the path against the correct base directory
- On error the handler returns `null` (see IMG-001)

**Interface Contract:**
- Return value: `` `./assets/${targetFilename}` ``

---

### IMG-007: Temp Asset Migration on First Save

- **Status:** Active
- **Added:** 2026-04-23

When an unsaved draft (whose images live in the temp asset directory per IMG-005) is saved to a real file path for the first time, its temp assets are migrated to the saved location's `assets/` directory.

**Behavior:**
- Migration is triggered by the `file:moveTempFiles` IPC channel with `(tabId, savedPath)`
- If the tab's temp assets directory does not exist, migration is a no-op
- The target assets directory is `{dirname(savedPath)}/assets`, created if missing
- Every regular file in the temp assets directory is copied (with overwrite) into the target assets directory using its existing filename
- Subdirectories inside the temp assets directory are not recursively migrated (only regular files)
- After a successful copy of all files, the entire per-tab temp directory (`{homedir}/.wrangle/drafts/{tabId}`) is removed
- If the copy fails the error is rethrown and the temp directory is left in place so no data is lost

**Interface Contract:**
- Main function: `moveTempToSaved(tabId: string, savedPath: string): Promise<void>` in `src/main/utils/temp-dir-manager.ts`
- IPC channel: `file:moveTempFiles` returns `true` on success, `false` and shows an error dialog on failure

---

### IMG-008: Read Image as Data URL with MIME Detection

- **Status:** Active
- **Added:** 2026-04-23

To render images in the preview pane without relying on `file://` URLs, Wrangle exposes an IPC that reads an image from disk and returns a base64-encoded data URL with the correct MIME type.

**Behavior:**
- The handler reads the raw bytes of the given absolute image path
- MIME type is derived from the lowercased file extension using the table below
- If the extension is not recognized, the MIME type defaults to `image/png`
- The returned string is of the form `data:{mime};base64,{base64Payload}`
- On any read error the handler returns `null` and logs the error; it does not show a dialog

**MIME Type Map:**

| Extension | MIME |
|-----------|------|
| `.png` | `image/png` |
| `.jpg` | `image/jpeg` |
| `.jpeg` | `image/jpeg` |
| `.gif` | `image/gif` |
| `.svg` | `image/svg+xml` |
| `.webp` | `image/webp` |

**Interface Contract:**
- IPC channel: `file:readImageAsDataURL`
- Main handler: `(_event, imagePath: string) => Promise<string | null>`

---

### IMG-009: Editor Inserts Markdown Image Syntax at Cursor

- **Status:** Active
- **Added:** 2026-04-23

When an image copy succeeds, the editor inserts Markdown image syntax at the current cursor selection.

**Behavior:**
- The inserted text is `![{originalFilename}]({relativePath})\n`, where `originalFilename` is the dropped file's `name` property and `relativePath` is the value returned by `file:copyImage` (see IMG-006)
- Insertion uses Monaco's `executeEdits` against the current selection, replacing any selected text
- If no Monaco editor reference is available, the insertion step is skipped but the optional `onImageInsert` callback is still invoked with the relative path
- Multiple images dropped in a single drop event are processed sequentially, each inserted after the previous

**Interface Contract:**
- Hook: `useImageDrop` in `src/renderer/src/hooks/useImageDrop.ts`
- Edit call: `editor.executeEdits('', [{ range: selection, text: imageMarkdown + '\n' }])`
- Callback: `onImageInsert?(relativePath: string)` invoked after successful insert

---

## Key Files

| File | Purpose |
|------|---------|
| `src/main/ipc/file-handler.ts` | `file:copyImage`, `file:readImageAsDataURL`, `file:moveTempFiles` IPC handlers |
| `src/main/utils/temp-dir-manager.ts` | Temp directory paths, `ensureTempAssetDir`, `moveTempToSaved`, `cleanupTempDir` |
| `src/renderer/src/hooks/useImageDrop.ts` | Drag-and-drop detection and editor insertion |
| `src/preload/electron.d.ts` | Type definitions for `window.electron.file.copyImage`, `readImageAsDataURL` |
| `src/shared/file-extensions.ts` | `isImageFile` classification used by the drop hook |

---

## Test File Structure

```
specs/image-assets/tests/
├── img-001-copy-image-ipc.test.ts
├── img-002-filename-sanitization.test.ts
├── img-003-collision-counter.test.ts
├── img-004-saved-file-assets-dir.test.ts
├── img-005-unsaved-temp-assets-dir.test.ts
├── img-006-relative-path-return.test.ts
├── img-007-temp-migration.test.ts
├── img-008-read-image-data-url.test.ts
└── img-009-editor-insert.test.ts
```
