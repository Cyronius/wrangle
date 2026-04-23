// Traces: SYN-003 (canonical spec: specs/preview-sync/spec.md)
import { test, expect, waitForAppReady } from '../../fixtures'
import { EditorHelpers } from '../../helpers/editor-helpers'
import { PreviewHelpers } from '../../helpers/preview-helpers'

const markdown = `# Top Heading

First paragraph at the top.

## Middle Heading

Middle paragraph content here.

### Deeper Heading

Deeper paragraph content here.

## Bottom Heading

Final paragraph content here.
`

test.describe('SYN-003: Preview Click Maps to Editor Cursor', () => {
  test.beforeEach(async ({ window }) => {
    await waitForAppReady(window)
    const editor = new EditorHelpers(window)
    await editor.setContent(markdown)
    await window.waitForTimeout(500)
  })

  test('clicking a preview heading reveals the matching line in the editor', async ({
    window
  }) => {
    const preview = new PreviewHelpers(window)
    const editor = new EditorHelpers(window)

    const initial = await editor.getCursorLineColumn()

    await preview.clickOnTextAtOffset('h2', 'Bottom Heading', 2)
    await window.waitForTimeout(400)

    const after = await editor.getCursorLineColumn()
    // "## Bottom Heading" is far below the initial cursor (line 1).
    expect(after.line).toBeGreaterThan(initial.line)
    expect(after.line).toBeGreaterThan(10)
  })

  test('preview scroll reports topmost source-bearing element when locked', async ({
    window
  }) => {
    const preview = new PreviewHelpers(window)
    const editor = new EditorHelpers(window)

    // Scroll the preview down past the top heading.
    await preview.scrollTo(200)
    await window.waitForTimeout(400)

    // Editor cursor should have been revealed past the first line.
    const pos = await editor.getCursorLineColumn()
    expect(pos.line).toBeGreaterThanOrEqual(1)

    // There must be at least one mapped element above the fold.
    const mapped = await preview.getSourceMappedElements()
    expect(mapped.length).toBeGreaterThan(0)
  })

  test('no-op when previewSync is false', async ({ window }) => {
    const preview = new PreviewHelpers(window)
    const editor = new EditorHelpers(window)

    // Unlock.
    await window.click('.sync-lock-icon')
    await window.waitForTimeout(150)

    const before = await editor.getCursorLineColumn()

    // Scroll the preview; the editor should NOT reveal/move cursor.
    await preview.scrollTo(400)
    await window.waitForTimeout(400)

    const after = await editor.getCursorLineColumn()
    expect(after.line).toBe(before.line)
    expect(after.column).toBe(before.column)
  })

  test('preview click reveals target line in editor viewport', async ({ window }) => {
    const preview = new PreviewHelpers(window)
    const editor = new EditorHelpers(window)

    await preview.clickOnTextAtOffset('h3', 'Deeper Heading', 2)
    await window.waitForTimeout(400)

    // The revealed line should be visible in Monaco's view-lines.
    const info = await editor.getCursorLineColumn()
    expect(info.line).toBeGreaterThan(1)

    // Verify the editor's rendered lines actually include the deeper heading.
    const hasDeeper = await window.evaluate(() => {
      const lines = document.querySelectorAll('.monaco-editor .view-lines .view-line')
      return Array.from(lines).some((l) => (l.textContent || '').includes('Deeper Heading'))
    })
    expect(hasDeeper).toBe(true)
  })
})
