# Wrangle

> A modern, feature-rich desktop Markdown editor built with Electron, React, and TypeScript

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Version](https://img.shields.io/badge/version-1.0.0-green.svg)

Wrangle is a powerful desktop Markdown editor that combines the Monaco Editor with live preview, syntax highlighting, mathematical formula rendering, and diagram support. Whether you're writing documentation, taking notes, or creating content, Wrangle provides a seamless editing experience with professional-grade features.

## Quick Start

Install globally via npm:

```bash
npm install -g wrangle
```

Then launch from anywhere:

```bash
wrangle
```

Open a file directly:

```bash
wrangle path/to/file.md
```

## Key Features

- **Monaco Editor** - The same powerful code editor that powers VS Code
- **Live Preview** - Real-time Markdown rendering with scroll synchronization
- **Math Support** - Beautiful mathematical formulas with KaTeX
- **Diagrams** - Create flowcharts, sequence diagrams, and more with Mermaid
- **Multi-tab Interface** - Work with multiple files simultaneously
- **Smart Image Handling** - Drag-and-drop images with automatic asset management
- **Dark/Light Themes** - Choose your preferred visual style

---

## Features

### Advanced Editor
- **Monaco Editor Integration** - Professional code editing experience with IntelliSense-like features
- **Multi-tab File Management** - Open and switch between multiple Markdown files
- **Auto-save Functionality** - Never lose your work with automatic draft recovery
- **Keyboard Shortcuts** - Efficient text editing with comprehensive shortcuts
- **Syntax Highlighting** - Code blocks with syntax highlighting via highlight.js

### Live Markdown Preview
- **Real-time Rendering** - See changes instantly as you type
- **GitHub Flavored Markdown (GFM)** - Full support for GFM extensions
- **Scroll Synchronization** - Editor and preview scroll together
- **Front Matter Support** - YAML front matter parsing with gray-matter

### Mathematical Rendering
- **Inline Math** - Use `$...$` syntax for inline formulas
- **Block Math** - Use `$$...$$` syntax for display formulas
- **KaTeX Integration** - Fast and beautiful mathematical typesetting

### Diagram Support
- **Mermaid Diagrams** - Create diagrams directly in Markdown
- **Multiple Diagram Types** - Flowcharts, sequence diagrams, class diagrams, state diagrams, and more
- **Live Rendering** - Diagrams render in real-time in the preview pane

### Image Handling
- **Drag-and-Drop** - Simply drag images into the editor
- **Automatic Organization** - Images saved to `assets/` folders relative to your Markdown files
- **Duplicate Handling** - Intelligent filename collision resolution
- **Copy & Paste** - Paste images directly from clipboard

### Multiple View Modes
- **Editor-Only Mode** - Focus on writing (Ctrl+1)
- **Split View Mode** - See editor and preview side-by-side (Ctrl+2)
- **Preview-Only Mode** - Focus on the rendered output (Ctrl+3)
- **Resizable Panes** - Adjust the split ratio to your preference

### Formatting Toolbar
- **Headings** - H1 through H6 heading styles
- **Text Formatting** - Bold, Italic, Strikethrough, Inline Code
- **Links & Images** - Quick insertion helpers
- **Code Blocks** - Fenced code blocks with language support
- **Lists** - Bullet lists, numbered lists, and task lists
- **Blockquotes** - Quote formatting
- **Tables** - Markdown table insertion
- **Horizontal Rules** - Visual dividers

### File Management
- **Multiple Formats** - Support for .md, .markdown, .mdown, .mkd, .mdwn, .txt
- **Save & Save As** - Standard file operations with shortcuts
- **Draft Recovery** - Automatic recovery of unsaved work
- **Temp File Management** - Intelligent temporary file cleanup

### Themes
- **Light Theme** - Clean, bright interface for daytime work
- **Dark Theme** - Easy on the eyes for low-light environments
- **Theme Persistence** - Your preference is remembered

---

## Installation

### Prerequisites
- **Node.js** (v18 or higher recommended)
- **npm** or **yarn** package manager

### Setup

1. Clone the repository:
```bash
git clone https://github.com/yourusername/wrangle.git
cd wrangle
```

2. Install dependencies:
```bash
npm install
```

3. Run the application:
```bash
npm start
```

---

## Usage

### Running the Application

**Development mode**:
```bash
npm run build
npm start
```

### Keyboard Shortcuts

| Action | Shortcut |
|--------|----------|
| **File Operations** |
| Open File | `Ctrl+O` |
| Save File | `Ctrl+S` |
| Save As | `Ctrl+Shift+S` |
| Exit | `Ctrl+Q` |
| **View Modes** |
| Editor Only | `Ctrl+1` |
| Split View | `Ctrl+2` |
| Preview Only | `Ctrl+3` |
| **Text Formatting** |
| Bold | `Ctrl+B` |
| Italic | `Ctrl+I` |
| Inline Code | ``Ctrl+` `` |
| Insert Link | `Ctrl+K` |
| **Editor** |
| Undo | `Ctrl+Z` |
| Redo | `Ctrl+Y` |
| Cut | `Ctrl+X` |
| Copy | `Ctrl+C` |
| Paste | `Ctrl+V` |
| Select All | `Ctrl+A` |

### Working with Images

1. **Drag and Drop**: Drag an image file from your file explorer directly into the editor
2. **Automatic Organization**: The image is automatically copied to an `assets/` folder next to your Markdown file
3. **Relative Paths**: Markdown image syntax is inserted with the correct relative path
4. **Preview**: The image appears in the preview pane immediately

### View Modes

- **Editor-Only**: Maximum space for writing, preview hidden
- **Split View**: Default mode with resizable editor and preview panes
- **Preview-Only**: See the fully rendered document without the editor

---

## Development

### Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development mode with hot reload |
| `npm run build` | Build TypeScript and bundle with Vite |
| `npm run preview` | Run the built application |
| `npm start` | Alias for `npm run preview` |

### Project Structure

```
wrangle/
├── src/
│   ├── main/                    # Main process (Node.js)
│   │   ├── index.ts            # Application entry point
│   │   ├── ipc/                # IPC handlers
│   │   │   ├── index.ts        # Handler registration
│   │   │   ├── file-handler.ts # File operations
│   │   │   └── window-handler.ts
│   │   ├── menu/
│   │   │   └── menu-template.ts # Application menu
│   │   └── utils/
│   │       └── temp-dir-manager.ts
│   ├── preload/                 # Preload script (bridge)
│   │   ├── index.ts            # IPC API exposure
│   │   └── electron.d.ts        # TypeScript definitions
│   └── renderer/                # Renderer process (React)
│       └── src/
│           ├── App.tsx          # Root component
│           ├── main.tsx         # React entry point
│           ├── components/
│           │   ├── Editor/      # Monaco editor wrapper
│           │   ├── Preview/     # Markdown preview
│           │   ├── Tabs/        # Tab management UI
│           │   ├── Layout/      # Split layout
│           │   └── UI/          # Toolbar components
│           ├── hooks/           # Custom React hooks
│           ├── store/           # Redux store
│           │   ├── index.ts
│           │   ├── tabsSlice.ts
│           │   ├── layoutSlice.ts
│           │   └── themeSlice.ts
│           ├── utils/
│           │   ├── markdown-commands.ts
│           │   └── markdown-renderer.ts
│           └── styles/
├── electron.vite.config.ts      # Build configuration
├── package.json
├── tsconfig.json
└── CLAUDE.md                    # Development guide
```

### Architecture

Wrangle follows the standard Electron multi-process architecture:

#### Three-Process Model

**Main Process** ([src/main/](src/main/))
- Manages application lifecycle and native OS integration
- Creates and controls browser windows
- Handles file system operations (open, save, image copying)
- Manages native application menu
- Registers IPC handlers for renderer communication

**Renderer Process** ([src/renderer/](src/renderer/))
- React application running in a Chromium browser window
- Monaco Editor integration for text editing
- Markdown preview rendering pipeline
- Redux state management for tabs, layout, and theme
- UI components and user interactions

**Preload Script** ([src/preload/](src/preload/))
- Security bridge between main and renderer processes
- Exposes type-safe `window.electron` API to renderer
- Prevents direct Node.js access from renderer for security
- Type definitions in [electron.d.ts](src/preload/electron.d.ts)

#### Inter-Process Communication (IPC)

All communication between main and renderer uses IPC channels:

**File Operations** (main → renderer):
- `window.electron.file.open()` - Opens file picker, returns file data
- `window.electron.file.save(path, content)` - Saves to existing path
- `window.electron.file.saveAs(content)` - Shows save dialog, returns new path
- `window.electron.file.copyImage(sourcePath, markdownPath)` - Copies image to assets folder

**Window Controls** (renderer → main):
- `window.electron.window.minimize/maximize/close()` - Window management

**Menu Commands** (main → renderer):
- `window.electron.onMenuCommand(callback)` - Receives menu actions

#### State Management

Redux Toolkit manages application state with three slices:

```typescript
{
  tabs: {
    tabs: Tab[],           // Array of open file tabs
    activeTabId: string    // Currently focused tab
  },
  layout: {
    viewMode: 'split' | 'editor' | 'preview',
    splitRatio: number,    // Pane split ratio (0.2-0.8)
    previewSync: boolean   // Scroll sync enabled
  },
  theme: {
    currentTheme: 'light' | 'dark'
  }
}
```

#### Markdown Rendering Pipeline

1. Parse YAML front matter with `gray-matter`
2. Process Markdown with `marked` + extensions (`marked-highlight`, `marked-gfm-heading-id`)
3. Apply syntax highlighting via `highlight.js`
4. Render math expressions via `KaTeX` (inline: `$...$`, block: `$$...$$`)
5. Render diagrams via `Mermaid` (code blocks with `mermaid` language)
6. Display sanitized HTML in preview pane

### Build Configuration

- **Build Tool**: electron-vite (combines Vite for renderer, esbuild for main/preload)
- **Config File**: [electron.vite.config.ts](electron.vite.config.ts)
- **Path Alias**: `@/` → `src/renderer/src` (renderer only)
- **TypeScript**: Strict mode enabled, ES2020 target
- **Output Directory**: `out/` (main, preload, renderer subdirectories)

### Contributing

Contributions are welcome! Please follow these guidelines:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

For development guidance and architecture details, see [CLAUDE.md](CLAUDE.md).

---

## Built With

### Core Framework
- **[Electron](https://www.electronjs.org/)** 28.0.0 - Cross-platform desktop application framework
- **[React](https://react.dev/)** 18.2.0 - UI component library
- **[TypeScript](https://www.typescriptlang.org/)** 5.3.3 - Type-safe JavaScript

### Editor & UI
- **[Monaco Editor](https://microsoft.github.io/monaco-editor/)** 0.45.0 - The code editor that powers VS Code
- **[@monaco-editor/react](https://github.com/suren-atoyan/monaco-react)** 4.6.0 - React wrapper for Monaco
- **[Allotment](https://github.com/johnwalley/allotment)** 1.20.0 - Resizable split pane component
- **[react-hotkeys-hook](https://github.com/JohannesKlauss/react-hotkeys-hook)** 4.4.1 - Keyboard shortcut hooks

### Markdown Processing
- **[Marked](https://marked.js.org/)** 12.0.0 - Markdown parser and compiler
- **[marked-highlight](https://github.com/markedjs/marked-highlight)** 2.1.0 - Code block syntax highlighting
- **[marked-gfm-heading-id](https://github.com/markedjs/marked-gfm-heading-id)** 3.1.3 - GitHub-style heading IDs
- **[highlight.js](https://highlightjs.org/)** 11.11.1 - Syntax highlighting for code blocks
- **[gray-matter](https://github.com/jonschlinkert/gray-matter)** 4.0.3 - Front matter parsing

### Math & Diagrams
- **[KaTeX](https://katex.org/)** 0.16.9 - Fast mathematical typesetting
- **[Mermaid](https://mermaid.js.org/)** 10.7.0 - Diagram and flowchart generation

### State Management
- **[@reduxjs/toolkit](https://redux-toolkit.js.org/)** 2.0.1 - Redux state management
- **[react-redux](https://react-redux.js.org/)** 9.0.4 - React bindings for Redux

### Build Tools
- **[electron-vite](https://electron-vite.org/)** 2.0.0 - Lightning-fast Electron build tool
- **[Vite](https://vitejs.dev/)** 5.0.10 - Next-generation frontend tooling
- **[electron-builder](https://www.electron.build/)** 24.9.1 - Application packaging and distribution

### Utilities
- **[electron-updater](https://www.electron.build/auto-update)** 6.1.7 - Auto-update functionality

---

## License

This project is licensed under the MIT License - see the [package.json](package.json) for details.

---

## Acknowledgments

- Built with [Electron](https://www.electronjs.org/), [React](https://react.dev/), and [TypeScript](https://www.typescriptlang.org/)
- Editor powered by [Monaco Editor](https://microsoft.github.io/monaco-editor/)
- Markdown rendering by [Marked](https://marked.js.org/)
- Math rendering by [KaTeX](https://katex.org/)
- Diagrams by [Mermaid](https://mermaid.js.org/)

---

Made with care for Markdown enthusiasts everywhere.
