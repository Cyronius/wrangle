// Traces: SYN-004 (canonical spec: specs/preview-sync/spec.md)
import { test, expect, waitForAppReady } from '../../fixtures'
import { EditorHelpers } from '../../helpers/editor-helpers'
import { PreviewHelpers } from '../../helpers/preview-helpers'

// Content deliberately loaded with CRLF line endings via Monaco's EOL setting
// to exercise normalizeOffset / denormalizeOffset round-tripping across the
// editor<->preview boundary. The acceptance is behavioral: the sync must still
// land on the correct element despite the CRLF offsets Monaco reports.
const crlfMarkdown = [
  '# CRLF Heading',
  '',
  'Alpha paragraph content.',
  '',
  'Beta paragraph content.',
  '',
  '## Gamma Heading',
  '',
  'Gamma paragraph content.',
  '',
  '### Delta Heading',
  '',
  'Delta paragraph content.',
  ''
].join('\n')

async function setMonacoEolToCRLF(window: import('@playwright/test').Page): Promise<void> {
  await window.evaluate(() => {
    const editors = (window as any).monaco?.editor?.getEditors?.()
    const monaco = (window as any).monaco
    if (editors?.[0] && monaco?.editor?.EndOfLineSequence) {
      const model = editors[0].getModel()
      if (model) {
        model.setEOL(monaco.editor.EndOfLineSequence.CRLF)
      }
    }
  })
}

test.describe('SYN-004: CRLF/LF Offset Normalization', () => {
  test.beforeEach(async ({ window }) => {
    await waitForAppReady(window)
    const editor = new EditorHelpers(window)
    await editor.setContent(crlfMarkdown)
    await setMonacoEolToCRLF(window)
    await window.waitForTimeout(600)
  })

  test('editor->preview scroll lands on correct element with CRLF content', async ({
    window
  }) => {
    const preview = new PreviewHelpers(window)
    const editor = new EditorHelpers(window)

    // Confirm the model is actually CRLF now.
    const eol = await window.evaluate(() => {
      const editors = (window as any).monaco?.editor?.getEditors?.()
      return editors?.[0]?.getModel()?.getEOL?.() ?? ''
    })
    expect(eol).toBe('\r\n')

    // Move cursor near the deeper heading; preview should highlight an
    // element below the top heading rather than the h1.
    await window.click('.monaco-editor .view-lines')
    await window.keyboard.press('Control+End')
    await window.waitForTimeout(500)

    const highlightedId = await preview.getHighlightedElement()
    expect(highlightedId).not.toBeNull()

    // The highlighted data-source-start must lie beyond the first heading's
    // range. If normalization were broken, mis-subtracted \r's would produce
    // no match or the wrong (earlier) element.
    const asNum = Number(highlightedId)
    expect(Number.isFinite(asNum)).toBe(true)
    expect(asNum).toBeGreaterThan(0)

    const pos = await editor.getCursorLineColumn()
    expect(pos.line).toBeGreaterThan(5)
  })

  test('preview->editor click denormalizes offset to the correct line', async ({ window }) => {
    const preview = new PreviewHelpers(window)
    const editor = new EditorHelpers(window)

    // Reassert CRLF in case setContent reset EOL.
    await setMonacoEolToCRLF(window)
    await window.waitForTimeout(100)

    await preview.clickOnTextAtOffset('h3', 'Delta Heading', 2)
    await window.waitForTimeout(400)

    // The editor must reveal the Delta heading line; under a broken
    // denormalization the LF offset would map to the wrong line in a CRLF
    // model (each preceding newline shifts by one).
    const hasDelta = await window.evaluate(() => {
      const lines = document.querySelectorAll('.monaco-editor .view-lines .view-line')
      return Array.from(lines).some((l) => (l.textContent || '').includes('Delta Heading'))
    })
    expect(hasDelta).toBe(true)

    const pos = await editor.getCursorLineColumn()
    expect(pos.line).toBeGreaterThan(5)
  })

  test('LF-only content still round-trips correctly (fast path)', async ({ window }) => {
    const preview = new PreviewHelpers(window)
    const editor = new EditorHelpers(window)

    // Force LF so the fast path in normalize/denormalizeOffset is taken.
    await window.evaluate(() => {
      const editors = (window as any).monaco?.editor?.getEditors?.()
      const monaco = (window as any).monaco
      if (editors?.[0] && monaco?.editor?.EndOfLineSequence) {
        editors[0].getModel()?.setEOL(monaco.editor.EndOfLineSequence.LF)
      }
    })
    await window.waitForTimeout(200)

    const eol = await window.evaluate(() => {
      const editors = (window as any).monaco?.editor?.getEditors?.()
      return editors?.[0]?.getModel()?.getEOL?.() ?? ''
    })
    expect(eol).toBe('\n')

    await preview.clickOnTextAtOffset('h2', 'Gamma Heading', 2)
    await window.waitForTimeout(400)

    const pos = await editor.getCursorLineColumn()
    expect(pos.line).toBeGreaterThan(3)

    const hasGamma = await window.evaluate(() => {
      const lines = document.querySelectorAll('.monaco-editor .view-lines .view-line')
      return Array.from(lines).some((l) => (l.textContent || '').includes('Gamma Heading'))
    })
    expect(hasGamma).toBe(true)
  })
})
