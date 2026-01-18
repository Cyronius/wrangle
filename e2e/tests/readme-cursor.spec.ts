import { test, expect, waitForAppReady } from '../fixtures'
import { PreviewHelpers } from '../helpers/preview-helpers'
import { EditorHelpers } from '../helpers/editor-helpers'
import fs from 'fs'
import path from 'path'

test.describe('README.md Cursor Tests', () => {
  test.beforeEach(async ({ window }) => {
    await waitForAppReady(window)
    // Capture console logs for debugging
    window.on('console', (msg) => {
      const text = msg.text()
      if (
        text.includes('CURSOR') ||
        text.includes('SOURCEMAP') ||
        text.includes('[MarkdownPreview]') ||
        text.includes('[EditorLayout]')
      ) {
        console.log('[BROWSER]', text)
      }
    })
  })

  test('cursor appears when clicking on elements in README.md', async ({ window }) => {
    const preview = new PreviewHelpers(window)
    const editor = new EditorHelpers(window)

    // Load README.md content
    const readmePath = path.resolve(__dirname, '../../README.md')
    const content = fs.readFileSync(readmePath, 'utf-8')
    await editor.setContent(content)

    // Wait for markdown to render and source map to be ready
    await window.waitForTimeout(1500)

    // Get all source-mapped elements
    const elements = await preview.getSourceMappedElements()
    console.log(`Found ${elements.length} source-mapped elements`)

    // Verify we have source-mapped elements
    expect(elements.length).toBeGreaterThan(0)

    // Group elements by tag name to test one of each type
    const elementsByTag = new Map<string, string>()
    for (const el of elements) {
      if (!elementsByTag.has(el.tagName)) {
        elementsByTag.set(el.tagName, el.id)
      }
    }

    console.log('Element types found:', Array.from(elementsByTag.keys()).join(', '))

    // Test cursor on each element type
    const failures: Array<{ tagName: string; id: string }> = []

    for (const [tagName, id] of elementsByTag) {
      console.log(`\n--- Testing cursor on ${tagName} (${id}) ---`)

      // Click on the element in preview
      const selector = `[data-source-id="${id}"]`
      const element = await window.$(selector)

      if (!element) {
        console.error(`Element not found: ${selector}`)
        failures.push({ tagName, id })
        continue
      }

      // Scroll element into view first
      await element.scrollIntoViewIfNeeded()
      await window.waitForTimeout(200)

      // Get element bounds for debugging
      const bounds = await element.boundingBox()
      console.log(`Element bounds: ${bounds ? `x=${bounds.x}, y=${bounds.y}, w=${bounds.width}, h=${bounds.height}` : 'null'}`)

      await element.click()
      await window.waitForTimeout(500)

      // Check if cursor is visible
      const visible = await preview.isPseudoCursorVisible()
      console.log(`Cursor visible: ${visible}`)

      if (!visible) {
        console.error(`FAILED: Cursor not visible on ${tagName} (${id})`)
        failures.push({ tagName, id })

        // Get debug info
        const pos = await preview.getPseudoCursorPosition()
        console.log('Cursor position:', pos)

        const highlighted = await preview.getHighlightedElement()
        console.log('Highlighted element:', highlighted)
      } else {
        const pos = await preview.getPseudoCursorPosition()
        console.log(`Cursor position: top=${pos?.top}, left=${pos?.left}, height=${pos?.height}`)
      }
    }

    // Report all failures
    if (failures.length > 0) {
      console.error('\n=== FAILURES ===')
      for (const f of failures) {
        console.error(`- ${f.tagName} (${f.id})`)
      }
    }

    expect(failures).toHaveLength(0)
  })

  test('cursor appears on H1 heading', async ({ window }) => {
    const preview = new PreviewHelpers(window)
    const editor = new EditorHelpers(window)

    // Load README.md
    const readmePath = path.resolve(__dirname, '../../README.md')
    const content = fs.readFileSync(readmePath, 'utf-8')
    await editor.setContent(content)
    await window.waitForTimeout(1000)

    // Click on first H1
    const h1 = await window.$('.markdown-body h1')
    expect(h1).not.toBeNull()
    await h1!.click()
    await window.waitForTimeout(300)

    // Check cursor
    const visible = await preview.isPseudoCursorVisible()
    expect(visible).toBe(true)
  })

  test('cursor appears on paragraph', async ({ window }) => {
    const preview = new PreviewHelpers(window)
    const editor = new EditorHelpers(window)

    // Load README.md
    const readmePath = path.resolve(__dirname, '../../README.md')
    const content = fs.readFileSync(readmePath, 'utf-8')
    await editor.setContent(content)
    await window.waitForTimeout(1000)

    // Click on first paragraph
    const p = await window.$('.markdown-body p')
    expect(p).not.toBeNull()
    await p!.click()
    await window.waitForTimeout(300)

    // Check cursor
    const visible = await preview.isPseudoCursorVisible()
    expect(visible).toBe(true)
  })

  test('cursor appears on table', async ({ window }) => {
    const preview = new PreviewHelpers(window)
    const editor = new EditorHelpers(window)

    // Load README.md
    const readmePath = path.resolve(__dirname, '../../README.md')
    const content = fs.readFileSync(readmePath, 'utf-8')
    await editor.setContent(content)
    await window.waitForTimeout(1000)

    // Click on first table
    const table = await window.$('.markdown-body table')
    if (table) {
      await table.scrollIntoViewIfNeeded()
      await table.click()
      await window.waitForTimeout(300)

      // Check cursor
      const visible = await preview.isPseudoCursorVisible()
      expect(visible).toBe(true)
    } else {
      console.log('No table found in README.md')
    }
  })

  test('cursor appears on code block', async ({ window }) => {
    const preview = new PreviewHelpers(window)
    const editor = new EditorHelpers(window)

    // Load README.md
    const readmePath = path.resolve(__dirname, '../../README.md')
    const content = fs.readFileSync(readmePath, 'utf-8')
    await editor.setContent(content)
    await window.waitForTimeout(1000)

    // Click on first code block (pre element)
    const pre = await window.$('.markdown-body pre')
    if (pre) {
      await pre.scrollIntoViewIfNeeded()
      await pre.click()
      await window.waitForTimeout(300)

      // Check cursor
      const visible = await preview.isPseudoCursorVisible()
      expect(visible).toBe(true)
    } else {
      console.log('No code block found in README.md')
    }
  })

  test('cursor appears on list items', async ({ window }) => {
    const preview = new PreviewHelpers(window)
    const editor = new EditorHelpers(window)

    // Load README.md
    const readmePath = path.resolve(__dirname, '../../README.md')
    const content = fs.readFileSync(readmePath, 'utf-8')
    await editor.setContent(content)
    await window.waitForTimeout(1000)

    // Click on first unordered list
    const ul = await window.$('.markdown-body ul')
    if (ul) {
      await ul.scrollIntoViewIfNeeded()
      await ul.click()
      await window.waitForTimeout(300)

      // Check cursor
      const visible = await preview.isPseudoCursorVisible()
      expect(visible).toBe(true)
    } else {
      console.log('No unordered list found in README.md')
    }
  })

  test('DEBUG: interactive cursor test', async ({ window }) => {
    const preview = new PreviewHelpers(window)
    const editor = new EditorHelpers(window)

    // Load README.md
    const readmePath = path.resolve(__dirname, '../../README.md')
    const content = fs.readFileSync(readmePath, 'utf-8')
    await editor.setContent(content)
    await window.waitForTimeout(1000)

    // Get all elements
    const elements = await preview.getSourceMappedElements()
    console.log('Source-mapped elements:')
    for (const el of elements.slice(0, 20)) {
      console.log(`  ${el.id}: ${el.tagName}`)
    }

    // Click on first H1
    const h1 = await window.$('.markdown-body h1')
    if (h1) {
      await h1.click()
      await window.waitForTimeout(500)

      const visible = await preview.isPseudoCursorVisible()
      const pos = await preview.getPseudoCursorPosition()
      console.log('H1 click - cursor visible:', visible, 'pos:', pos)

      // Pause for manual inspection
      // Uncomment the line below to pause and use Playwright inspector:
      // await window.pause()
    }
  })

  test('cursor highlights correct element when clicking different elements', async ({ window }) => {
    const preview = new PreviewHelpers(window)
    const editor = new EditorHelpers(window)

    // Load README.md
    const readmePath = path.resolve(__dirname, '../../README.md')
    const content = fs.readFileSync(readmePath, 'utf-8')
    await editor.setContent(content)
    await window.waitForTimeout(1000)

    // Click on first H1 (at top)
    const h1 = await window.$('.markdown-body h1')
    expect(h1).not.toBeNull()
    await h1!.click()
    await window.waitForTimeout(300)

    // Check which element is highlighted
    const highlighted1 = await preview.getHighlightedElement()
    console.log('After clicking H1, highlighted element:', highlighted1)
    expect(highlighted1).not.toBeNull()

    // Get the H1's source id
    const h1SourceId = await h1!.getAttribute('data-source-id')
    console.log('H1 source id:', h1SourceId)
    expect(highlighted1).toBe(h1SourceId)

    // Cursor should be visible
    const visible1 = await preview.isPseudoCursorVisible()
    expect(visible1).toBe(true)

    // Click on a paragraph further down
    const paragraphs = await window.$$('.markdown-body p')
    expect(paragraphs.length).toBeGreaterThan(2)

    // Get the 3rd paragraph which is a different element
    const p3 = paragraphs[2]
    const p3SourceId = await p3.getAttribute('data-source-id')
    console.log('P3 source id:', p3SourceId)

    await p3.scrollIntoViewIfNeeded()
    await window.waitForTimeout(200)
    await p3.click()
    await window.waitForTimeout(500)

    // Check which element is now highlighted
    const highlighted2 = await preview.getHighlightedElement()
    console.log('After clicking P3, highlighted element:', highlighted2)
    expect(highlighted2).not.toBeNull()

    // The highlighted element should be the paragraph, not the H1
    expect(highlighted2).toBe(p3SourceId)
    expect(highlighted2).not.toBe(highlighted1)

    // Cursor should still be visible
    const visible2 = await preview.isPseudoCursorVisible()
    expect(visible2).toBe(true)

    console.log('Cursor correctly moved from', highlighted1, 'to', highlighted2)
  })
})
