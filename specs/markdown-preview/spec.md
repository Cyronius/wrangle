# Markdown Preview Specification

## Overview

This specification defines the markdown preview rendering pipeline in Wrangle. The preview transforms raw markdown text into rendered HTML, supporting front matter, GitHub Flavored Markdown, math expressions, Mermaid diagrams, syntax-highlighted code, raw HTML, source position tracking for click-to-edit, and graceful error recovery.

Scope is limited to the rendering pipeline. Scroll synchronization between editor and preview is covered in the separate `preview-sync` spec. Theming (light/dark styling) is out of scope here.

**Feature Prefix:** `MDP` (Markdown Preview)

---

## Requirements

### MDP-001: YAML Front Matter Extraction and Rendering

- **Status:** Active
- **Added:** 2026-04-23

YAML front matter at the top of a markdown document is extracted before markdown parsing and rendered as a collapsible HTML table above the document body.

**Behavior:**
- Front matter is delimited by `---` on the first line and a matching `---` closing delimiter
- If no opening delimiter is present at offset 0, the document has no front matter and is rendered as-is
- If an opening delimiter exists but no closing delimiter is found, the document has no front matter and is rendered as-is
- Parsed key/value pairs are rendered inside a `<details class="front-matter">` element with a `<summary>` of "Front Matter" and a two-column table of keys and values
- Front matter content is removed from the markdown before it is passed to the markdown parser, so its raw text does not appear in the rendered output
- Parse failures are swallowed; the original content is rendered as if no front matter existed

**Interface Contract:**
- `extractFrontMatter(markdown: string): { content: string; data: Record<string, unknown>; hasFrontMatter: boolean }`
- `renderFrontMatter(data: Record<string, unknown>): string` returns HTML for the collapsible table
- Front matter HTML is injected via `dangerouslySetInnerHTML` ahead of the `ReactMarkdown` output

---

### MDP-002: GitHub Flavored Markdown Support

- **Status:** Active
- **Added:** 2026-04-23

The preview renders GitHub Flavored Markdown extensions beyond CommonMark.

**Behavior:**
- Pipe tables render as HTML `<table>` elements with header row and body rows
- Strikethrough syntax (`~~text~~`) renders as `<del>` elements
- Task list items (`- [ ]` and `- [x]`) render with checkbox inputs reflecting checked state
- Autolinks (bare URLs) are rendered as clickable `<a>` elements
- Standard CommonMark features (headings, lists, emphasis, links, images, blockquotes, fenced code) are preserved

**Interface Contract:**
- `remark-gfm` is included in the `remarkPlugins` array passed to `ReactMarkdown`

---

### MDP-003: KaTeX Math Rendering

- **Status:** Active
- **Added:** 2026-04-23

Math expressions embedded in markdown are rendered as typeset math via KaTeX.

**Behavior:**
- Inline math delimited by single dollar signs (`$...$`) renders inline within surrounding text
- Block math delimited by double dollar signs (`$$...$$`) renders as a centered block-level equation
- Invalid LaTeX does not crash the preview; KaTeX error output (red error text) is rendered in place
- Dollar signs that are not valid math delimiters (e.g. prices in prose) are preserved as literal text per remark-math disambiguation rules

**Interface Contract:**
- `remark-math` included in `remarkPlugins`
- `rehype-katex` included in `rehypePlugins`
- KaTeX CSS is loaded so rendered math is visually styled

---

### MDP-004: Mermaid Diagram Rendering

- **Status:** Deferred
- **Added:** 2026-04-23
- **Updated:** 2026-04-23

Fenced code blocks tagged with the `mermaid` language are rendered as diagrams rather than as syntax-highlighted source.

**Behavior:**
- A fenced block of the form ```` ```mermaid ```` is detected and passed to the Mermaid renderer
- The resulting SVG replaces the code block in the rendered output
- Invalid Mermaid source renders a diagnostic message in place of the diagram and does not crash the preview
- Diagrams re-render when the underlying source changes

**Interface Contract:**
- Wiring not yet implemented. `window.mermaid` is loaded via CDN in `src/renderer/index.html` and `.mermaid-diagram` / `.mermaid-error` styles exist in `preview.css`, but no renderer in `src/renderer/src/components/Preview/renderers/` currently detects `language-mermaid` or invokes Mermaid. A future plan will implement and re-activate this requirement.

---

### MDP-005: Code Block Syntax Highlighting

- **Status:** Active
- **Added:** 2026-04-23

Fenced code blocks with a recognized language tag are syntax-highlighted using highlight.js.

**Behavior:**
- Fenced code blocks carry a `language-<name>` class derived from the info string (e.g. ```` ```typescript ```` → `language-typescript`)
- highlight.js tokenizes the block content and wraps tokens in `<span class="hljs-*">` elements
- Unknown or missing languages render as plain text inside a `<code>` element without tokenization
- Inline code spans are not syntax-highlighted

**Interface Contract:**
- `rehype-highlight` included in `rehypePlugins`
- highlight.js CSS theme loaded to style the `hljs-*` classes

---

### MDP-006: Raw HTML Passthrough

- **Status:** Active
- **Added:** 2026-04-23

Raw HTML embedded in markdown is preserved and rendered as real HTML rather than escaped text.

**Behavior:**
- Block-level HTML (e.g. `<div>`, `<details>`, `<iframe>`) appears in the rendered DOM as actual elements
- Inline HTML (e.g. `<span>`, `<br>`, `<kbd>`) is preserved in its surrounding paragraph
- HTML is not sanitized at the markdown layer; it is trusted because content originates from the user's own files

**Interface Contract:**
- `rehype-raw` included in `rehypePlugins`, placed before `rehype-katex` and `rehype-highlight` so raw nodes are reparsed into the HAST before later plugins run

---

### MDP-007: Source Position Attributes on Rendered Nodes

- **Status:** Active
- **Added:** 2026-04-23

Rendered DOM nodes carry attributes describing their originating source offset in the markdown, enabling click-to-edit mapping between preview and editor.

**Behavior:**
- Block-level rendered elements carry a `data-source-start` attribute whose value is the character offset of the corresponding node in the original markdown source
- A `data-source-end` attribute identifies the end offset where applicable
- Consumers (scroll sync, click-to-edit) locate elements by `data-source-start` to resolve a `sourceId` back to a source range
- A source map is built from the rendered DOM after each render and exposed via the `onSourceMapReady` callback

**Interface Contract:**
- `remarkSourcePositions` plugin attaches positions during the remark pass
- `rehypeSourcePositions` plugin copies positions onto the rehype HAST so they survive to the DOM as `data-source-*` attributes
- `buildSourceMapFromDOM(containerEl)` walks the rendered DOM and produces the `SourceMap` exposed through `onSourceMapReady`

---

### MDP-008: Error Boundary with Content-Change Recovery

- **Status:** Active
- **Added:** 2026-04-23

A React error boundary wraps the markdown renderer so that a crash in any plugin or renderer shows a fallback UI instead of killing the application, and recovers automatically when the content changes.

**Behavior:**
- If `ReactMarkdown` or any remark/rehype plugin throws during render, the boundary catches the error and renders a fallback containing the error message in a muted, styled block
- The fallback does not replace the entire preview chrome; the containing `markdown-preview` and `markdown-body` elements remain mounted
- When the `content` prop changes to any value different from the content that triggered the error, the boundary resets and attempts to render again
- Errors are logged to the console with component stack information for debugging

**Interface Contract:**
- `PreviewErrorBoundary` is a class component taking `{ children, content }` props
- State shape: `{ error: Error | null; errorContent: string | null }`
- `componentDidUpdate` compares `props.content` against `state.errorContent` and clears the error state when they diverge

---

## Key Files

| File | Purpose |
|------|---------|
| `src/renderer/src/components/Preview/MarkdownPreview.tsx` | Preview component, error boundary, plugin wiring |
| `src/renderer/src/components/Preview/renderers/` | Per-element renderer components (headings, paragraphs, code, images) |
| `src/renderer/src/utils/markdown-renderer.ts` | Front matter extraction and rendering |
| `src/renderer/src/utils/remark-source-positions.ts` | Remark plugin attaching source offsets |
| `src/renderer/src/utils/rehype-source-positions.ts` | Rehype plugin propagating offsets to HAST/DOM |
| `src/renderer/src/utils/source-map.ts` | `SourceMap` type and `buildSourceMapFromDOM` |
| `src/renderer/src/components/Preview/preview.css` | Preview styling including front-matter, KaTeX, highlight.js overrides |
