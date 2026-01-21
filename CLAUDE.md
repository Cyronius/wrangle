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
