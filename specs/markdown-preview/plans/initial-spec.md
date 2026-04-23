# Plan: Initial Markdown Preview Spec (Retroactive)

## Context

The markdown preview pipeline already exists and ships in Wrangle. This plan retroactively documents it as a canonical spec so subsequent changes to the preview have a stable traceability surface. No code changes are introduced by this plan; it captures the as-built behavior of the rendering pipeline in `MarkdownPreview.tsx` and its supporting utilities.

Scroll synchronization between editor and preview is intentionally excluded; it is owned by the separate `preview-sync` spec. Theming is also out of scope.

## Proposed Changes

### New Requirements

- **MDP-001: YAML Front Matter Extraction and Rendering** — Front matter is parsed out of the markdown source and rendered as a collapsible HTML table above the body.
- **MDP-002: GitHub Flavored Markdown Support** — Tables, strikethrough, task lists, and autolinks render via `remark-gfm`.
- **MDP-003: KaTeX Math Rendering** — Inline `$...$` and block `$$...$$` math typeset by KaTeX via `remark-math` + `rehype-katex`.
- **MDP-004: Mermaid Diagram Rendering** — Fenced `mermaid` code blocks render as SVG diagrams. Re-statused to Deferred on 2026-04-23 after verification confirmed no wiring in `CodeRenderer`/`PreRenderer`.
- **MDP-005: Code Block Syntax Highlighting** — Fenced code blocks tokenized by `rehype-highlight` / highlight.js.
- **MDP-006: Raw HTML Passthrough** — Raw block and inline HTML preserved via `rehype-raw`.
- **MDP-007: Source Position Attributes on Rendered Nodes** — `data-source-start` / `data-source-end` attributes emitted to support click-to-edit and scroll sync.
- **MDP-008: Error Boundary with Content-Change Recovery** — `PreviewErrorBoundary` catches plugin crashes and auto-resets when content changes.

### Modified Requirements

None — this is the initial spec.

### Removed Requirements

None — this is the initial spec.

## Spec Impact

- [x] New requirements added to spec
- [ ] Existing requirements updated in spec
- [ ] Tests created/updated referencing requirement IDs
- [ ] Plan moved to archive

_Tests are not written as part of this retroactive documentation plan; they will be added in follow-up plans that modify individual requirements. The plan is intentionally left unarchived until the test backfill is scheduled._
