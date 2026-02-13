# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Wrangle is a desktop Markdown editor built with Electron, React, and TypeScript. Features Monaco Editor for editing, live preview with syntax highlighting, math rendering (KaTeX), diagram support (Mermaid), and multi-tab file management.

## Development Commands

```bash
npm run dev      # Start development mode with hot reload
npm run build    # Build TypeScript and bundle with Vite
npm run preview  # Run the built application (alias: npm start)
```

**Important**: When running within Claude Code, you must unset the `ELECTRON_RUN_AS_NODE` environment variable before launching Electron:

```bash
unset ELECTRON_RUN_AS_NODE && ./node_modules/electron/dist/electron.exe .
```

This variable is set by Claude Code's environment and causes Electron to run as Node.js instead of as the Electron runtime, which breaks the `require('electron')` imports.

## Architecture

### Three-Process Electron Model

This application follows Electron's standard multi-process architecture:

**Main Process** (`src/main/`)
- Node.js process managing application lifecycle
- Window creation and management
- File system operations (open, save, image copying)
- Native menu integration
- Entry: `src/main/index.ts`

**Renderer Process** (`src/renderer/`)
- React application running in Chromium
- Monaco Editor integration
- Markdown preview rendering
- UI components and state management
- Entry: `src/renderer/index.html` → `src/renderer/src/main.tsx`

**Preload Script** (`src/preload/`)
- Security bridge between main and renderer processes
- Exposes type-safe `window.electron` API to renderer
- Prevents direct Node.js access from renderer
- Type definitions: `src/preload/electron.d.ts`

### Inter-Process Communication (IPC)

All communication between main and renderer uses IPC channels defined in `src/preload/electron.d.ts`:

**File Operations** (main → renderer via `ipcMain.handle`)
- `window.electron.file.open()` - Shows file picker, returns FileData
- `window.electron.file.save(path, content)` - Saves to existing path
- `window.electron.file.saveAs(content)` - Shows save dialog, returns new path
- `window.electron.file.copyImage(sourcePath, markdownPath)` - Copies image to assets folder

**Window Controls** (renderer → main via `ipcRenderer.send`)
- `window.electron.window.minimize/maximize/close()` - Window management

**Menu Commands** (main → renderer via `ipcRenderer.on`)
- `window.electron.onMenuCommand(callback)` - Receives menu actions like 'new', 'save', 'bold', etc.

IPC handlers registered in `src/main/ipc/index.ts` via `registerAllHandlers()`.

### State Management

Redux Toolkit manages application state in `src/renderer/src/store/`:

**Slices:**
- `tabsSlice.ts` - Open files, active tab, file paths, content, save states
- `layoutSlice.ts` - View mode (editor-only, preview-only, split)
- `themeSlice.ts` - Light/dark theme preference

**State Structure:**
```typescript
{
  tabs: {
    tabs: Tab[]              // Array of open file tabs
    activeTabId: string      // Currently focused tab
  },
  layout: {
    mode: 'split' | 'editor' | 'preview'
  },
  theme: {
    mode: 'light' | 'dark'
  }
}
```

Tab management pattern: Each tab has an ID (nanoid), path, content, saved state, and preview scroll position.

## Build Configuration

- **Build tool**: electron-vite (combines Vite for renderer, esbuild for main/preload)
- **Config**: `electron.vite.config.ts`
- **Path alias**: `@/` → `src/renderer/src` (renderer only)
- **TypeScript**: Strict mode enabled, noUnusedLocals/noUnusedParameters enforced
- **Output**: `out/` directory (main, preload, renderer subdirectories)

## Key Patterns

### Image Handling
When images are dropped/pasted into the editor:
1. Renderer detects drop via `useImageDrop` hook
2. Calls `window.electron.file.copyImage(sourcePath, currentFilePath)`
3. Main process creates `assets/` folder relative to markdown file
4. Copies image with sanitized filename, handles duplicates
5. Returns relative path like `./assets/image-name.png`
6. Renderer inserts markdown image syntax at cursor

### Markdown Rendering Pipeline
1. Content from Monaco editor
2. Parse front matter with `gray-matter`
3. Process with `marked` + `marked-highlight` + `marked-gfm-heading-id`
4. Syntax highlighting via `highlight.js`
5. Math rendering via `katex` (inline: `$...$`, block: `$$...$$`)
6. Diagram rendering via `mermaid` (code blocks with `mermaid` language)
7. Sanitized HTML rendered in preview pane

### Menu Integration
Application menu defined in `src/main/menu/menu-template.ts`:
- File operations (New, Open, Save, Save As)
- Edit operations (Undo, Redo, Cut, Copy, Paste)
- View controls (Toggle DevTools, layout modes)
- Markdown formatting commands (Bold, Italic, Code, etc.)

Menu clicks send commands to renderer via IPC, which dispatch Redux actions or trigger editor operations.

## Important Dependencies

- `monaco-editor` + `@monaco-editor/react` - Code editor component
- `marked` - Markdown parser (with GFM extensions)
- `highlight.js` - Syntax highlighting for code blocks
- `katex` - Mathematical formula rendering
- `mermaid` - Diagram and chart rendering
- `allotment` - Resizable split-pane component
- `@reduxjs/toolkit` + `react-redux` - State management
- `gray-matter` - YAML front matter parsing
- `electron-updater` - Auto-update functionality


# Claude Code – Spec-Driven Development Guide

## Core Principle

Every project follows **spec-driven development**. The `specs/` directory is the single source of truth for what the system should do. Requirements drive implementation, implementation drives tests, and tests reference requirements. Nothing ships without spec traceability.

---

## Directory Structure

```
specs/
├── {feature-name}/           # One subdirectory per major capability
│   ├── spec.md               # Living specification (the authority)
│   ├── plans/                # Short-lived change plans
│   │   └── {plan-name}.md   # Specific change plan
│   └── archive/              # Completed plans (merged into spec)
│       └── {plan-name}.md
```

### Naming Conventions

- Feature directories: kebab-case matching the capability name (e.g., `source-to-course/`, `user-auth/`, `power-bar-assistant/`)
- Spec files: always `spec.md` at the feature root
- Plan files: kebab-case with a short descriptive name (e.g., `add-bulk-import.md`, `fix-token-refresh.md`)

---

## Spec Format (`spec.md`)

Every spec follows this structure:

```markdown
# {Feature Name} Specification

## Overview
Brief description of the capability and its purpose.

## Requirements

### {FEATURE-PREFIX}-{NNN}: {Requirement Title}
- **Status:** Active | Deprecated | Deferred
- **Added:** {date}  |  **Updated:** {date}
- **Source plan:** {plan-name} (if originated from a plan)

{Requirement description — clear, testable, unambiguous.}

**Behavior:**
- {Specific behavioral expectations, edge cases, and constraints.}

**Interface Contract:**
- {API signatures, input/output shapes, event contracts, or UI contracts as applicable.}

---
```

### Requirement IDs

Requirement IDs are **permanent and stable**. They must never be renumbered or reused.

- Format: `{FEATURE-PREFIX}-{NNN}` (e.g., `STC-001`, `AUTH-012`, `PBA-003`)
- The feature prefix is a short uppercase abbreviation chosen when the spec is created. Record it in the spec's Overview section.
- Numbers are zero-padded to three digits and assigned sequentially.
- If a requirement is removed, mark its status as `Deprecated` — do not delete the entry or reuse the ID.

---

## Plans

Plans are **short-lived change documents** that describe a proposed modification to a feature. They live in `specs/{feature}/plans/` while active.

### Plan Format

```markdown
# Plan: {Short Title}

## Context
Why this change is needed.

## Proposed Changes

### New Requirements
- **{FEATURE-PREFIX}-{NNN}: {Title}** — {Description}

### Modified Requirements
- **{FEATURE-PREFIX}-{NNN}** — {What changes and why}

### Removed Requirements
- **{FEATURE-PREFIX}-{NNN}** — {Why it's being deprecated}

## Spec Impact
- [ ] New requirements added to spec
- [ ] Existing requirements updated in spec
- [ ] Tests created/updated referencing requirement IDs
- [ ] Plan moved to archive

_If this plan has NO spec impact, explain why:_
_{Justification — e.g., "Pure refactor with no behavioral change."}_
```

### Plan Lifecycle

1. **Create** the plan in `specs/{feature}/plans/` before writing code.
2. **Implement** the changes described in the plan.
3. **Merge** durable requirements from the plan into `spec.md` — add new requirements, update modified ones, deprecate removed ones.
4. **Move** the completed plan to `specs/{feature}/archive/`.
5. **Never** leave a completed plan in `plans/` — it must be archived or deleted once its requirements are merged.

---

## Workflow: How to Handle Any Task

### When receiving a feature request or change:

1. **Identify the feature scope.** Determine which `specs/{feature}/` directory this belongs to. If none exists, create one with a new `spec.md`.
2. **Check the existing spec.** Read `specs/{feature}/spec.md` to understand current requirements before proposing anything.
3. **Create a plan.** Write a plan in `specs/{feature}/plans/` that describes the proposed changes, new requirements, and any modifications to existing requirements. Assign new requirement IDs using the next available number.
4. **Implement.** Write the code to satisfy the plan.
5. **Write or update tests.** Every test that validates a requirement must reference the requirement ID (see Testing section below).
6. **Update the spec.** Merge the plan's durable requirements into `spec.md`.
7. **Archive the plan.** Move it to `specs/{feature}/archive/`.

### When receiving a bug fix:

1. **Identify the requirement** the bug violates. Search specs for the relevant requirement ID.
2. **If the requirement exists:** Fix the code and ensure tests for that requirement ID cover the bug scenario. Add test cases if they're missing. No spec change needed unless the requirement's wording was ambiguous and needs clarification.
3. **If no requirement exists:** This is an undocumented behavior. Create a plan that adds the missing requirement, then follow the standard workflow.

### When receiving a refactor or tech-debt task:

1. **Determine spec impact.** If the refactor changes no observable behavior, create a plan with an explicit "No spec impact" declaration and justification.
2. **If behavior changes** (even subtly — error messages, response shapes, timing), follow the full workflow.

---

## Testing & Traceability

### Referencing Requirements in Tests

Every test that validates a spec requirement must include the requirement ID. Use comments or test naming conventions appropriate to the framework:

```javascript
// JavaScript/TypeScript (Jest, Playwright, etc.)
describe('STC-001: Source document parsing', () => {
  test('STC-001: extracts text content from PDF uploads', () => { ... });
  test('STC-001: rejects files exceeding 50MB limit', () => { ... });
});
```

```python
# Python (pytest)
class TestSTC001_SourceDocumentParsing:
    def test_stc001_extracts_text_from_pdf(self): ...
    def test_stc001_rejects_oversized_files(self): ...
```

```csharp
// C# (xUnit/NUnit)
[Fact]
[Trait("Requirement", "STC-001")]
public void STC001_ExtractsTextFromPdf() { ... }
```

### Test Coverage Rules

- **Every Active requirement** must have at least one test referencing its ID.
- **Every behavioral assertion** in the spec's "Behavior" section should have a corresponding test case.
- When adding a new requirement, write the tests in the same commit/PR as the implementation.
- When deprecating a requirement, mark associated tests as skipped with a note, or remove them.

### Traceability Check

Before considering any task complete, verify:

- [ ] All new/modified requirements have corresponding tests
- [ ] All tests reference their requirement IDs
- [ ] The spec is updated and consistent with the implementation
- [ ] No active plan remains in `plans/` that should be archived

---

## Rules & Constraints

1. **Spec is authoritative.** If the code and spec disagree, the spec is assumed correct unless a plan explicitly changes it.
2. **No behavioral change without spec impact.** Every PR/change that modifies observable behavior must either update a spec requirement or include an explicit "No spec impact" declaration with justification.
3. **Requirement IDs are forever.** Never reuse, renumber, or silently delete a requirement ID.
4. **Plans before code.** Always create or review the plan before starting implementation. The plan is your design step.
5. **Tests prove requirements.** A requirement without a test is unverified. A test without a requirement ID is untraced. Both are problems.
6. **Archive, don't abandon.** Completed plans move to archive. The `plans/` directory should only contain active, in-progress work.
7. **Read before writing.** Always read the existing spec before proposing changes. Duplicate or conflicting requirements waste everyone's time.
8. **One feature, one spec.** Don't split a feature across multiple spec files or merge unrelated features into one spec. If scope is unclear, ask.    