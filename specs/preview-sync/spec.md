# Preview Sync Specification

## Overview

This specification defines the behavior of editor/preview scroll synchronization in Wrangle's split-view layout. It covers the user-facing sync-lock toggle, bidirectional position mapping between the Monaco editor and the rendered Markdown preview, and the line-ending normalization required to keep source offsets consistent across both surfaces.

**Feature Prefix:** `SYN` (Preview Sync)

---

## Requirements

### SYN-001: Sync Lock Toggle

- **Status:** Active
- **Added:** 2026-04-23

Users can toggle editor/preview scroll synchronization via a lock icon rendered on top of the split layout. The toggle state is persisted in Redux.

**Behavior:**
- The `SyncLockIcon` component renders only in split view (alongside `EditorLayout`'s `Allotment` panes).
- Clicking the icon dispatches `togglePreviewSync`, flipping `layout.previewSync` between `true` and `false`.
- When locked (`previewSync === true`), the icon uses a connected-chain-link SVG and the class `synced`.
- When unlocked (`previewSync === false`), the icon uses a broken-chain-link SVG and the class `unsynced`.
- The tooltip text reflects the current state ("Preview scroll is synced - click to unlock" / "Preview scroll is unlocked - click to sync").

**Interface Contract:**
- Redux: `layoutSlice` exposes `previewSync: boolean` and the `togglePreviewSync()` action.
- Component: `src/renderer/src/components/Layout/SyncLockIcon.tsx`.
- Consumers: `EditorLayout` reads `previewSync` from Redux and forwards it to the child editor and `MarkdownPreview` (`syncScroll` prop).

---

### SYN-002: Locked Editor Scroll Drives Preview

- **Status:** Active
- **Added:** 2026-04-23

While the sync lock is engaged, scrolling the Monaco editor causes the preview to scroll to the element whose source range contains the editor's current scroll offset.

**Behavior:**
- Monaco's `onScroll` callback delivers a character offset into the document.
- `EditorLayout` normalizes the offset via `normalizeOffset` (see SYN-004) before consulting the source map.
- `SourceMap.findElementByOffset(offset)` returns the element ID whose range contains the normalized offset; `SourceMap.getEntry(id)` returns its `sourceRange`.
- `EditorLayout` calls `previewRef.current.scrollToSourceId(String(entry.sourceRange.start))`, which scrolls the DOM node with matching `data-source-start`.
- A re-entrancy guard (`isEditorScrollingRef`) is set for 100ms around the preview scroll to prevent the preview-scroll handler from bouncing back into the editor.
- If `previewSync` is false, the source map is missing, or a preview-driven scroll is already in flight, the editor-scroll handler is a no-op.

**Interface Contract:**
- `MarkdownPreviewHandle.scrollToSourceId(sourceId: string)` scrolls the preview container to the element matching `[data-source-start="${sourceId}"]`.
- `EditorLayout` owns both `isEditorScrollingRef` and `isPreviewScrollingRef`; exactly one direction is active at a time.

---

### SYN-003: Preview Click Maps to Editor Cursor

- **Status:** Active
- **Added:** 2026-04-23

Clicking or selecting text inside the preview maps the click/selection position to a character offset in the Markdown source and reveals that line in the editor.

**Behavior:**
- `usePreviewCursor` tracks DOM selection changes inside the preview's `contentRef` and reports an offset range via `onSelectionChange`.
- When locked, scroll-driven reporting uses `data-source-start` on the topmost visible source-bearing element; `onScroll(sourceId)` fires with that offset as a string (or `null` if no element is visible).
- `EditorLayout.handlePreviewScroll`:
  1. Parses `sourceId` as an integer LF offset.
  2. Denormalizes it to a CRLF offset via `denormalizeOffset` (see SYN-004).
  3. Converts the offset to a `{ lineNumber, column }` via `model.getPositionAt`.
  4. Calls `editor.revealLineInCenter(position.lineNumber)`.
- A re-entrancy guard (`isPreviewScrollingRef`) is set for 100ms around the editor reveal.
- If `previewSync` is false, the editor ref is missing, the source ID is null, or an editor-driven scroll is already in flight, the handler is a no-op.

**Interface Contract:**
- `MarkdownPreviewProps.onScroll?: (sourceId: string | null) => void`.
- `MarkdownPreviewProps.onSelectionChange?: (selection: { start: number; end: number } | null) => void` — offsets are already in LF coordinates (derived from the source map).

---

### SYN-004: CRLF/LF Offset Normalization

- **Status:** Active
- **Added:** 2026-04-23

Source-map offsets are computed against LF-normalized content, but Monaco may hold CRLF line endings. All cross-boundary offsets must be normalized when moving between the two coordinate systems.

**Behavior:**
- `normalizeOffset(content, crlfOffset)` returns the equivalent LF offset by subtracting the count of `\r` characters appearing before `crlfOffset`. Fast path: if `content` contains no `\r`, the input is returned unchanged.
- `denormalizeOffset(content, lfOffset)` walks `content` counting non-`\r` characters and returns the index at which the `lfOffset`-th non-`\r` character sits. Fast path: if `content` contains no `\r`, returns `min(lfOffset, content.length)`. If the walk exhausts the content, returns `content.length`.
- Normalization is applied on editor→preview (SYN-002) before source-map lookup; denormalization is applied on preview→editor (SYN-003) before `model.getPositionAt`.
- Both helpers are pure and live in `EditorLayout.tsx`.

**Interface Contract:**
- `normalizeOffset(content: string, offset: number): number`
- `denormalizeOffset(content: string, lfOffset: number): number`

---

### SYN-005: Unlocked State Decouples Scrolling

- **Status:** Active
- **Added:** 2026-04-23

When the sync lock is disengaged, neither surface drives the other; the editor and preview scroll independently.

**Behavior:**
- `MarkdownPreview` only attaches its scroll listener when `syncScroll === true`; when unlocked, no `onScroll` callbacks fire.
- `EditorLayout.handleEditorScroll` short-circuits on `!previewSyncRef.current` and performs no preview scroll.
- `EditorLayout.handlePreviewScroll` short-circuits on `!previewSync` and performs no editor reveal.
- The sync lock icon remains interactive regardless of state and is the only way to re-enable synchronization.
- `preview-only` view passes `syncScroll={false}` explicitly; `editor-only` view does not mount the preview, so no sync occurs.

**Interface Contract:**
- `MarkdownPreviewProps.syncScroll?: boolean` gates the preview-side scroll listener.
- `previewSyncRef` mirrors `layout.previewSync` for use inside Monaco-captured callbacks to avoid stale closures.

---

## Key Files

| File | Purpose |
|------|---------|
| `src/renderer/src/components/Layout/EditorLayout.tsx` | Split view, owns sync refs, CRLF helpers, scroll handlers |
| `src/renderer/src/components/Layout/SyncLockIcon.tsx` | Sync lock toggle button |
| `src/renderer/src/components/Layout/SyncLockIcon.css` | Sync lock button styling |
| `src/renderer/src/components/Preview/MarkdownPreview.tsx` | Renders preview, emits topmost source ID, exposes `scrollToSourceId` |
| `src/renderer/src/hooks/usePreviewCursor.ts` | Tracks preview selection, reports LF offsets |
| `src/renderer/src/utils/source-map.ts` | `SourceMap` with `findElementByOffset` / `getEntry` |
| `src/renderer/src/utils/remark-source-positions.ts` | Tags AST nodes with source offsets |
| `src/renderer/src/utils/rehype-source-positions.ts` | Emits `data-source-start` / `data-source-end` on DOM |
| `src/renderer/src/store/layoutSlice.ts` | `previewSync` state and `togglePreviewSync` action |
