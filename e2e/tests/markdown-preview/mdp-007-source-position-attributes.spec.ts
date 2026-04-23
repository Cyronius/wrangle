// Traces: MDP-007 (canonical spec: specs/markdown-preview/spec.md)
import { test, expect, waitForAppReady } from '../../fixtures'
import { EditorHelpers } from '../../helpers/editor-helpers'
import { PreviewHelpers } from '../../helpers/preview-helpers'

test.describe('MDP-007: Source Position Attributes on Rendered Nodes', () => {
  test.beforeEach(async ({ window }) => {
    await waitForAppReady(window)
  })

  test('block-level elements carry numeric data-source-start attributes', async ({ window }) => {
    const editor = new EditorHelpers(window)
    const content = `# Heading One

First paragraph.

Second paragraph.
`
    await editor.setContent(content)
    await window.waitForTimeout(1000)

    const sourceElements = await window.evaluate(() => {
      const els = document.querySelectorAll('.markdown-body [data-source-start]')
      return Array.from(els).map((el) => ({
        tag: el.tagName.toLowerCase(),
        start: el.getAttribute('data-source-start'),
        end: el.getAttribute('data-source-end')
      }))
    })

    // At least the heading and two paragraphs carry source positions
    expect(sourceElements.length).toBeGreaterThanOrEqual(3)

    // Every data-source-start value must be a non-empty numeric string
    for (const el of sourceElements) {
      expect(el.start).not.toBeNull()
      expect(el.start).toMatch(/^\d+$/)
    }

    // A heading element should be among them
    expect(sourceElements.some((e) => e.tag === 'h1')).toBe(true)
    // At least one paragraph
    expect(sourceElements.some((e) => e.tag === 'p')).toBe(true)
  })

  test('data-source-end attributes are present on block-level elements where applicable', async ({
    window
  }) => {
    const editor = new EditorHelpers(window)
    await editor.setContent('# Title\n\nA paragraph of text.\n')
    await window.waitForTimeout(1000)

    const withEnd = await window.evaluate(() => {
      const els = document.querySelectorAll('.markdown-body [data-source-end]')
      return els.length
    })

    expect(withEnd).toBeGreaterThan(0)

    // end > start for each element that has both
    const pairs = await window.evaluate(() => {
      const els = document.querySelectorAll(
        '.markdown-body [data-source-start][data-source-end]'
      )
      return Array.from(els).map((el) => ({
        start: Number(el.getAttribute('data-source-start')),
        end: Number(el.getAttribute('data-source-end'))
      }))
    })
    expect(pairs.length).toBeGreaterThan(0)
    for (const { start, end } of pairs) {
      expect(end).toBeGreaterThan(start)
    }
  })

  test('elements can be located by data-source-start to resolve a sourceId (via PreviewHelpers)', async ({
    window
  }) => {
    const editor = new EditorHelpers(window)
    const preview = new PreviewHelpers(window)
    await editor.setContent('# Findable\n\nLocateable paragraph.\n')
    await window.waitForTimeout(1000)

    const mapped = await preview.getSourceMappedElements()
    expect(mapped.length).toBeGreaterThan(0)

    // Pick the first and round-trip via data-source-start
    const first = mapped[0]
    const el = await preview.getElementBySourceId(first.id)
    expect(el).not.toBeNull()
    expect(el!.tagName).toBe(first.tagName)
  })

  test('a source map is available after render (exposed via MarkdownPreview onSourceMapReady)', async ({
    window
  }) => {
    const editor = new EditorHelpers(window)
    await editor.setContent('# A\n\n# B\n\n# C\n')
    await window.waitForTimeout(1000)

    // The source map is built from the DOM — we verify its observable footprint:
    // every heading carries a data-source-start attribute that can back a map entry.
    const starts = await window.evaluate(() => {
      const headings = document.querySelectorAll('.markdown-body h1')
      return Array.from(headings).map((h) => h.getAttribute('data-source-start'))
    })

    expect(starts.length).toBe(3)
    for (const s of starts) {
      expect(s).toMatch(/^\d+$/)
    }
    // All start offsets are unique (each heading maps to a distinct source range)
    expect(new Set(starts).size).toBe(3)
  })
})
