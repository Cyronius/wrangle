# Plan: Initial image-assets Specification (Retroactive)

## Context

Wrangle already ships a working image-assets pipeline: drag-and-drop image copying, filename sanitization, collision handling, per-tab temporary asset directories for unsaved drafts, temp-to-saved migration on first save, data-URL preview rendering, and Markdown insertion at the cursor. No canonical spec currently traces this behavior. This plan retroactively captures the existing implementation as requirements `IMG-001` through `IMG-009` so future changes have a source of truth and test traceability.

Because this plan documents behavior that is already implemented and shipping, it is introduced as "Active, Added 2026-04-23" without a staged rollout. Tests proving each requirement will follow.

## Proposed Changes

### New Requirements

- **IMG-001: Drag-and-Drop Image Copy IPC** — Defines the `file:copyImage` IPC contract invoked by `useImageDrop` for every image dropped onto the editor, including the failure-dialog path.
- **IMG-002: Filename Sanitization** — Specifies the `/[^a-zA-Z0-9-_]/g` → `_` basename sanitization applied before the image is written to disk.
- **IMG-003: Collision Counter Suffix** — Specifies the `_1`, `_2`, ... suffix loop used when the sanitized target filename already exists.
- **IMG-004: Saved-File Asset Directory** — When the tab has a saved `markdownFilePath`, images land in `{dir}/assets/` beside the Markdown file.
- **IMG-005: Unsaved-File Temp Asset Directory** — When there is no saved path, images land in `{homedir}/.wrangle/drafts/{tabId}/assets/`.
- **IMG-006: Relative Path Return Value** — `file:copyImage` returns `./assets/{finalFilename}` on success, `null` on failure.
- **IMG-007: Temp Asset Migration on First Save** — `moveTempToSaved(tabId, savedPath)` copies temp assets into `{dirname(savedPath)}/assets` and removes the temp directory, with no-op semantics when nothing to migrate.
- **IMG-008: Read Image as Data URL with MIME Detection** — `file:readImageAsDataURL` returns `data:{mime};base64,...` with the png/jpg/jpeg/gif/svg/webp MIME map and a `image/png` fallback.
- **IMG-009: Editor Inserts Markdown Image Syntax at Cursor** — On successful copy, insert `![originalFilename](relativePath)\n` at the current Monaco selection and invoke `onImageInsert`.

### Modified Requirements

_None — this is the initial spec._

### Removed Requirements

_None — this is the initial spec._

## Spec Impact

- [x] New requirements added to spec
- [ ] Existing requirements updated in spec
- [ ] Tests created/updated referencing requirement IDs
- [ ] Plan moved to archive
