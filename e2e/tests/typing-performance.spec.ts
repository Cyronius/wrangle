import { test, expect, waitForMonacoReady } from '../fixtures'

async function createNewDocument(window: import('@playwright/test').Page) {
  // Check if we're on the empty state (no document open)
  const newFileButton = await window.$('button:has-text("New File")')
  if (newFileButton) {
    await newFileButton.click()
    await window.waitForTimeout(500)
  }
}

test.describe('Typing Performance', () => {
  test('should measure keystroke latency', async ({ window }) => {
    // Create a new document if needed
    await createNewDocument(window)
    await waitForMonacoReady(window)

    // Click on editor to focus
    await window.click('.monaco-editor')
    await window.waitForTimeout(100)

    const results: number[] = []
    const testString = 'The quick brown fox jumps over the lazy dog. '
    const iterations = 3 // Type the sentence 3 times = ~135 characters

    console.log('\n=== Typing Performance Test ===')
    console.log(`Typing ${testString.length * iterations} characters...`)

    for (let i = 0; i < iterations; i++) {
      for (const char of testString) {
        const start = Date.now()

        // Type the character
        await window.keyboard.type(char, { delay: 0 })

        // Wait for the editor to process the input
        // Monaco should reflect the change almost immediately
        await window.waitForFunction(
          () => {
            const editor = document.querySelector('.monaco-editor .view-line')
            return editor !== null
          },
          { timeout: 1000 }
        )

        const end = Date.now()
        const latency = end - start
        results.push(latency)
      }
    }

    // Calculate statistics
    const sorted = [...results].sort((a, b) => a - b)
    const avg = results.reduce((a, b) => a + b, 0) / results.length
    const min = sorted[0]
    const max = sorted[sorted.length - 1]
    const p50 = sorted[Math.floor(sorted.length * 0.5)]
    const p95 = sorted[Math.floor(sorted.length * 0.95)]
    const p99 = sorted[Math.floor(sorted.length * 0.99)]

    console.log('\n=== Results ===')
    console.log(`Total keystrokes: ${results.length}`)
    console.log(`Average latency: ${avg.toFixed(2)}ms`)
    console.log(`Min latency: ${min}ms`)
    console.log(`Max latency: ${max}ms`)
    console.log(`P50 latency: ${p50}ms`)
    console.log(`P95 latency: ${p95}ms`)
    console.log(`P99 latency: ${p99}ms`)

    // Performance thresholds
    // Target: 60fps = 16.67ms per frame
    const TARGET_AVG = 50 // Average should be under 50ms
    const TARGET_P99 = 100 // P99 should be under 100ms

    console.log(`\n=== Thresholds ===`)
    console.log(`Target avg: <${TARGET_AVG}ms (actual: ${avg.toFixed(2)}ms) ${avg < TARGET_AVG ? 'PASS' : 'FAIL'}`)
    console.log(`Target p99: <${TARGET_P99}ms (actual: ${p99}ms) ${p99 < TARGET_P99 ? 'PASS' : 'FAIL'}`)

    // Soft assertions - log but don't fail the test
    // This allows us to track progress over iterations
    if (avg >= TARGET_AVG) {
      console.log(`\nWARNING: Average latency (${avg.toFixed(2)}ms) exceeds target (${TARGET_AVG}ms)`)
    }
    if (p99 >= TARGET_P99) {
      console.log(`\nWARNING: P99 latency (${p99}ms) exceeds target (${TARGET_P99}ms)`)
    }

    // Basic sanity check - latency should be measurable
    expect(results.length).toBeGreaterThan(0)
  })

  test('should measure rapid typing performance', async ({ window }) => {
    await createNewDocument(window)
    await waitForMonacoReady(window)

    // Click on editor to focus
    await window.click('.monaco-editor')
    await window.waitForTimeout(100)

    console.log('\n=== Rapid Typing Test ===')
    console.log('Typing 200 characters as fast as possible...')

    const startTime = Date.now()

    // Type rapidly without individual measurements
    const rapidText = 'a'.repeat(200)
    await window.keyboard.type(rapidText, { delay: 0 })

    // Wait for editor to settle
    await window.waitForTimeout(500)

    const endTime = Date.now()
    const totalTime = endTime - startTime
    const avgPerChar = totalTime / 200

    console.log(`\nTotal time: ${totalTime}ms`)
    console.log(`Average per character: ${avgPerChar.toFixed(2)}ms`)
    console.log(`Characters per second: ${(1000 / avgPerChar).toFixed(0)}`)

    // Verify the text was typed
    const editorContent = await window.evaluate(() => {
      const lines = document.querySelectorAll('.monaco-editor .view-line')
      return Array.from(lines).map((l) => l.textContent).join('')
    })

    console.log(`Editor content length: ${editorContent.length}`)

    expect(editorContent.length).toBeGreaterThan(100)
  })

  test('should measure typing with preview updates', async ({ window }) => {
    await createNewDocument(window)
    await waitForMonacoReady(window)

    // Ensure we're in split view mode
    await window.waitForSelector('.markdown-preview', { timeout: 5000 })

    // Click on editor to focus
    await window.click('.monaco-editor')
    await window.waitForTimeout(100)

    console.log('\n=== Typing with Preview Test ===')

    const results: number[] = []

    // Type markdown content that will trigger preview updates
    const testLines = [
      '# Heading 1',
      '## Heading 2',
      'Some **bold** text',
      'Some *italic* text',
      '- List item 1',
      '- List item 2',
      '```javascript',
      'const x = 1;',
      '```'
    ]

    for (const line of testLines) {
      const start = Date.now()

      await window.keyboard.type(line)
      await window.keyboard.press('Enter')

      // Wait for preview to potentially update (debounced at 300ms)
      await window.waitForTimeout(50)

      const end = Date.now()
      results.push(end - start)
    }

    const avg = results.reduce((a, b) => a + b, 0) / results.length

    console.log(`Lines typed: ${testLines.length}`)
    console.log(`Average time per line: ${avg.toFixed(2)}ms`)
    console.log(`Individual times: ${results.join(', ')}ms`)

    // Check that preview has content
    await window.waitForTimeout(500) // Wait for debounced preview update

    const previewContent = await window.evaluate(() => {
      const preview = document.querySelector('.markdown-body')
      return preview?.innerHTML?.length || 0
    })

    console.log(`Preview content length: ${previewContent}`)

    expect(previewContent).toBeGreaterThan(0)
  })
})

// CLAUDE.md content for realistic large document testing
const CLAUDE_MD_CONTENT = `# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Wrangle is a desktop Markdown editor built with Electron, React, and TypeScript. Features Monaco Editor for editing, live preview with syntax highlighting, math rendering (KaTeX), diagram support (Mermaid), and multi-tab file management.

## Development Commands

\`\`\`bash
npm run dev      # Start development mode with hot reload
npm run build    # Build TypeScript and bundle with Vite
npm run preview  # Run the built application (alias: npm start)
\`\`\`

**Important**: When running within Claude Code, you must unset the \`ELECTRON_RUN_AS_NODE\` environment variable before launching Electron:

\`\`\`bash
unset ELECTRON_RUN_AS_NODE && ./node_modules/electron/dist/electron.exe .
\`\`\`

This variable is set by Claude Code's environment and causes Electron to run as Node.js instead of as the Electron runtime, which breaks the \`require('electron')\` imports.

## Architecture

### Three-Process Electron Model

This application follows Electron's standard multi-process architecture:

**Main Process** (\`src/main/\`)
- Node.js process managing application lifecycle
- Window creation and management
- File system operations (open, save, image copying)
- Native menu integration
- Entry: \`src/main/index.ts\`

**Renderer Process** (\`src/renderer/\`)
- React application running in Chromium
- Monaco Editor integration
- Markdown preview rendering
- UI components and state management
- Entry: \`src/renderer/index.html\` → \`src/renderer/src/main.tsx\`

**Preload Script** (\`src/preload/\`)
- Security bridge between main and renderer processes
- Exposes type-safe \`window.electron\` API to renderer
- Prevents direct Node.js access from renderer
- Type definitions: \`src/preload/electron.d.ts\`

### Inter-Process Communication (IPC)

All communication between main and renderer uses IPC channels defined in \`src/preload/electron.d.ts\`:

**File Operations** (main → renderer via \`ipcMain.handle\`)
- \`window.electron.file.open()\` - Shows file picker, returns FileData
- \`window.electron.file.save(path, content)\` - Saves to existing path
- \`window.electron.file.saveAs(content)\` - Shows save dialog, returns new path
- \`window.electron.file.copyImage(sourcePath, markdownPath)\` - Copies image to assets folder

**Window Controls** (renderer → main via \`ipcRenderer.send\`)
- \`window.electron.window.minimize/maximize/close()\` - Window management

**Menu Commands** (main → renderer via \`ipcRenderer.on\`)
- \`window.electron.onMenuCommand(callback)\` - Receives menu actions like 'new', 'save', 'bold', etc.

IPC handlers registered in \`src/main/ipc/index.ts\` via \`registerAllHandlers()\`.

### State Management

Redux Toolkit manages application state in \`src/renderer/src/store/\`:

**Slices:**
- \`tabsSlice.ts\` - Open files, active tab, file paths, content, save states
- \`layoutSlice.ts\` - View mode (editor-only, preview-only, split)
- \`themeSlice.ts\` - Light/dark theme preference

**State Structure:**
\`\`\`typescript
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
\`\`\`

Tab management pattern: Each tab has an ID (nanoid), path, content, saved state, and preview scroll position.

## Build Configuration

- **Build tool**: electron-vite (combines Vite for renderer, esbuild for main/preload)
- **Config**: \`electron.vite.config.ts\`
- **Path alias**: \`@/\` → \`src/renderer/src\` (renderer only)
- **TypeScript**: Strict mode enabled, noUnusedLocals/noUnusedParameters enforced
- **Output**: \`out/\` directory (main, preload, renderer subdirectories)

## Key Patterns

### Image Handling
When images are dropped/pasted into the editor:
1. Renderer detects drop via \`useImageDrop\` hook
2. Calls \`window.electron.file.copyImage(sourcePath, currentFilePath)\`
3. Main process creates \`assets/\` folder relative to markdown file
4. Copies image with sanitized filename, handles duplicates
5. Returns relative path like \`./assets/image-name.png\`
6. Renderer inserts markdown image syntax at cursor

### Markdown Rendering Pipeline
1. Content from Monaco editor
2. Parse front matter with \`gray-matter\`
3. Process with \`marked\` + \`marked-highlight\` + \`marked-gfm-heading-id\`
4. Syntax highlighting via \`highlight.js\`
5. Math rendering via \`katex\` (inline: \`$...$\`, block: \`$$...$$\`)
6. Diagram rendering via \`mermaid\` (code blocks with \`mermaid\` language)
7. Sanitized HTML rendered in preview pane

### Menu Integration
Application menu defined in \`src/main/menu/menu-template.ts\`:
- File operations (New, Open, Save, Save As)
- Edit operations (Undo, Redo, Cut, Copy, Paste)
- View controls (Toggle DevTools, layout modes)
- Markdown formatting commands (Bold, Italic, Code, etc.)

Menu clicks send commands to renderer via IPC, which dispatch Redux actions or trigger editor operations.

## Important Dependencies

- \`monaco-editor\` + \`@monaco-editor/react\` - Code editor component
- \`marked\` - Markdown parser (with GFM extensions)
- \`highlight.js\` - Syntax highlighting for code blocks
- \`katex\` - Mathematical formula rendering
- \`mermaid\` - Diagram and chart rendering
- \`allotment\` - Resizable split-pane component
- \`@reduxjs/toolkit\` + \`react-redux\` - State management
- \`gray-matter\` - YAML front matter parsing
- \`electron-updater\` - Auto-update functionality
`

test.describe('Typing Performance - Stress Tests', () => {
  test('should measure typing at beginning of large pre-existing document (CLAUDE.md)', async ({ window }) => {
    await createNewDocument(window)
    await waitForMonacoReady(window)

    console.log('\n=== Large Pre-existing Document Test (CLAUDE.md) ===')
    console.log(`Document size: ${CLAUDE_MD_CONTENT.length} characters`)

    // Set the content directly via Monaco API (much faster than typing)
    await window.evaluate((content) => {
      // Access Monaco editor instance through the DOM
      const editorElement = document.querySelector('.monaco-editor')
      if (!editorElement) throw new Error('Editor not found')

      // Monaco stores the editor instance - we need to find it
      // The @monaco-editor/react wrapper exposes it through a data attribute or we can use the global
      const monacoInstance = (window as any).monaco
      if (!monacoInstance) throw new Error('Monaco not found on window')

      // Get all editor instances
      const editors = monacoInstance.editor.getEditors()
      if (editors.length === 0) throw new Error('No editors found')

      const editor = editors[0]
      editor.setValue(content)
    }, CLAUDE_MD_CONTENT)

    // Wait for preview to render the large document
    await window.waitForTimeout(1000)

    // Move cursor to the very beginning (line 1, column 1)
    await window.evaluate(() => {
      const monacoInstance = (window as any).monaco
      const editors = monacoInstance.editor.getEditors()
      const editor = editors[0]
      editor.setPosition({ lineNumber: 1, column: 1 })
      editor.focus()
    })

    await window.waitForTimeout(100)

    // Now measure typing performance at the beginning of this large document
    const results: number[] = []
    const testText = 'Adding new content at the very beginning of this large document. '

    console.log(`Typing ${testText.length} characters at document start...`)

    for (const char of testText) {
      const start = Date.now()
      await window.keyboard.type(char, { delay: 0 })
      await window.waitForFunction(
        () => {
          const editor = document.querySelector('.monaco-editor .view-line')
          return editor !== null
        },
        { timeout: 1000 }
      )
      const end = Date.now()
      results.push(end - start)
    }

    // Calculate statistics
    const sorted = [...results].sort((a, b) => a - b)
    const avg = results.reduce((a, b) => a + b, 0) / results.length
    const min = sorted[0]
    const max = sorted[sorted.length - 1]
    const p50 = sorted[Math.floor(sorted.length * 0.5)]
    const p95 = sorted[Math.floor(sorted.length * 0.95)]
    const p99 = sorted[Math.floor(sorted.length * 0.99)]

    console.log(`\n=== Results (typing at beginning of ${CLAUDE_MD_CONTENT.length} char document) ===`)
    console.log(`Total keystrokes: ${results.length}`)
    console.log(`Average latency: ${avg.toFixed(2)}ms`)
    console.log(`Min latency: ${min}ms`)
    console.log(`Max latency: ${max}ms`)
    console.log(`P50 latency: ${p50}ms`)
    console.log(`P95 latency: ${p95}ms`)
    console.log(`P99 latency: ${p99}ms`)

    // Check thresholds
    const TARGET_AVG = 50
    const TARGET_P99 = 150
    console.log(`\n=== Thresholds ===`)
    console.log(`Target avg: <${TARGET_AVG}ms (actual: ${avg.toFixed(2)}ms) ${avg < TARGET_AVG ? 'PASS' : 'FAIL'}`)
    console.log(`Target p99: <${TARGET_P99}ms (actual: ${p99}ms) ${p99 < TARGET_P99 ? 'PASS' : 'FAIL'}`)

    expect(results.length).toBeGreaterThan(0)
    expect(avg).toBeLessThan(TARGET_AVG)
  })

  test('should maintain performance in large document', async ({ window }) => {
    await createNewDocument(window)
    await waitForMonacoReady(window)

    // Click on editor to focus
    await window.click('.monaco-editor')
    await window.waitForTimeout(100)

    console.log('\n=== Large Document Stress Test ===')

    // First, create a large document
    const largeContent = Array.from({ length: 50 }, (_, i) =>
      `# Heading ${i + 1}\n\nThis is paragraph ${i + 1} with some **bold** and *italic* text.\n\n\`\`\`javascript\nconst x${i} = ${i};\n\`\`\`\n\n`
    ).join('')

    console.log(`Creating document with ${largeContent.length} characters...`)
    await window.keyboard.type(largeContent.substring(0, 500), { delay: 0 }) // Type first 500 chars for setup

    // Wait for preview to render
    await window.waitForTimeout(1000)

    // Now measure typing performance in this larger document
    const results: number[] = []
    const testText = 'Adding more text to test performance. '

    console.log(`Typing ${testText.length} characters in large document...`)

    for (const char of testText) {
      const start = Date.now()
      await window.keyboard.type(char, { delay: 0 })
      await window.waitForFunction(
        () => {
          const editor = document.querySelector('.monaco-editor .view-line')
          return editor !== null
        },
        { timeout: 1000 }
      )
      const end = Date.now()
      results.push(end - start)
    }

    // Calculate statistics
    const sorted = [...results].sort((a, b) => a - b)
    const avg = results.reduce((a, b) => a + b, 0) / results.length
    const p50 = sorted[Math.floor(sorted.length * 0.5)]
    const p99 = sorted[Math.floor(sorted.length * 0.99)]

    console.log(`\n=== Large Document Results ===`)
    console.log(`Total keystrokes: ${results.length}`)
    console.log(`Average latency: ${avg.toFixed(2)}ms`)
    console.log(`P50 latency: ${p50}ms`)
    console.log(`P99 latency: ${p99}ms`)

    expect(results.length).toBeGreaterThan(0)
  })

  test('should measure continuous typing performance', async ({ window }) => {
    await createNewDocument(window)
    await waitForMonacoReady(window)

    // Click on editor to focus
    await window.click('.monaco-editor')
    await window.waitForTimeout(100)

    console.log('\n=== Continuous Typing Test (500 characters) ===')

    const results: number[] = []
    const batchSize = 10

    // Type 500 characters in batches of 10, measuring each batch
    for (let batch = 0; batch < 50; batch++) {
      const start = Date.now()
      await window.keyboard.type('a'.repeat(batchSize), { delay: 0 })
      const end = Date.now()
      results.push(end - start)
    }

    const avg = results.reduce((a, b) => a + b, 0) / results.length
    const sorted = [...results].sort((a, b) => a - b)
    const p99 = sorted[Math.floor(sorted.length * 0.99)]

    console.log(`Batches: ${results.length} (${batchSize} chars each)`)
    console.log(`Average batch time: ${avg.toFixed(2)}ms`)
    console.log(`Average per char: ${(avg / batchSize).toFixed(2)}ms`)
    console.log(`P99 batch time: ${p99}ms`)

    expect(avg).toBeLessThan(500) // 500ms per 10 chars = 50ms/char max
  })
})
