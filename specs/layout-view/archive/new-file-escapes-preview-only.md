# Plan: New Files Escape Preview-Only Mode

## Context

Bug: creating a new file while the view mode is `preview-only` left the user staring at an empty preview with no editor to click into or paste into. Untitled files are treated as markdown (`isMarkdownFile(undefined) === true`), so the existing "force editor-only for non-markdown" effect never rescued them. No requirement covered view-mode routing on file creation, so this plan adds one.

## Proposed Changes

### New Requirements
- **LYT-009: New File Never Opens in Preview-Only** — Creating a new file while in `preview-only` switches the view mode to `split`; the editor is focused after creation in every mode.

## Spec Impact
- [x] New requirement added to spec (LYT-009)
- [x] Test created referencing requirement ID (e2e: `e2e/tests/layout-view/lyt-009-new-file-view-mode.spec.ts`)
- [x] Plan moved to archive
