// Traces: LYT-004 (canonical spec: specs/layout-view/spec.md)
import { test, expect, waitForAppReady, waitForMonacoReady } from '../../fixtures'
import { EditorHelpers } from '../../helpers/editor-helpers'

async function setZoom(window: import('@playwright/test').Page, level: number): Promise<void> {
  // Reset then apply deltas
  await window.evaluate(() => {
    const store = (window as any).__REDUX_STORE__
    store.dispatch({ type: 'layout/resetZoom' })
  })
  const action = level >= 0 ? 'layout/zoomIn' : 'layout/zoomOut'
  const steps = Math.abs(level)
  for (let i = 0; i < steps; i++) {
    await window.evaluate((t) => {
      const store = (window as any).__REDUX_STORE__
      store.dispatch({ type: t })
    }, action)
  }
}

async function getEditorFontSizePx(window: import('@playwright/test').Page): Promise<number> {
  return window.evaluate(() => {
    const el = document.querySelector('.monaco-editor .view-lines') as HTMLElement | null
    if (!el) return -1
    const fontSize = getComputedStyle(el).fontSize
    return parseFloat(fontSize)
  })
}

test.describe('LYT-004: Zoom Applies to Editor Font Size and Preview Transform', () => {
  test.beforeEach(async ({ window }) => {
    await waitForAppReady(window)
    await waitForMonacoReady(window)
    const editor = new EditorHelpers(window)
    await editor.setContent('# Zoom test\n\nParagraph for preview rendering.')
    await window.waitForTimeout(300)
    await setZoom(window, 0)
  })

  test('editor font size increases when zooming in', async ({ window }) => {
    await setZoom(window, 0)
    await window.waitForTimeout(200)
    const base = await getEditorFontSizePx(window)
    expect(base).toBeGreaterThan(0)

    await setZoom(window, 3)
    await window.waitForTimeout(300)
    const zoomed = await getEditorFontSizePx(window)

    // 14 * 1.1^3 ≈ 18.6 → rounded to 19; base is ~14
    expect(zoomed).toBeGreaterThan(base)
    expect(zoomed).toBeCloseTo(Math.round(14 * Math.pow(1.1, 3)), 0)
  })

  test('editor font size decreases when zooming out', async ({ window }) => {
    await setZoom(window, 0)
    await window.waitForTimeout(200)
    const base = await getEditorFontSizePx(window)

    await setZoom(window, -3)
    await window.waitForTimeout(300)
    const zoomed = await getEditorFontSizePx(window)

    expect(zoomed).toBeLessThan(base)
    expect(zoomed).toBeCloseTo(Math.round(14 * Math.pow(1.1, -3)), 0)
  })

  test('preview pane reflects zoom via transform or font scaling', async ({ window }) => {
    await setZoom(window, 0)
    await window.waitForTimeout(200)
    const baseMetrics = await window.evaluate(() => {
      const body = document.querySelector('.markdown-body') as HTMLElement | null
      if (!body) return null
      const cs = getComputedStyle(body)
      return { transform: cs.transform, fontSize: parseFloat(cs.fontSize) }
    })
    expect(baseMetrics).not.toBeNull()

    await setZoom(window, 3)
    await window.waitForTimeout(300)
    const zoomedMetrics = await window.evaluate(() => {
      const body = document.querySelector('.markdown-body') as HTMLElement | null
      if (!body) return null
      const cs = getComputedStyle(body)
      return { transform: cs.transform, fontSize: parseFloat(cs.fontSize) }
    })
    expect(zoomedMetrics).not.toBeNull()

    // Either the transform changed (scale applied) or the font size grew
    const transformChanged = zoomedMetrics!.transform !== baseMetrics!.transform
    const fontGrew = zoomedMetrics!.fontSize > baseMetrics!.fontSize
    expect(transformChanged || fontGrew).toBe(true)
  })

  test('zoomIn / zoomOut / resetZoom update editor and preview in sync', async ({ window }) => {
    await setZoom(window, 0)
    await window.waitForTimeout(200)
    const baseEditor = await getEditorFontSizePx(window)

    await setZoom(window, 2)
    await window.waitForTimeout(300)
    const z2Editor = await getEditorFontSizePx(window)
    expect(z2Editor).toBeGreaterThan(baseEditor)

    await setZoom(window, 0) // reset
    await window.waitForTimeout(300)
    const resetEditor = await getEditorFontSizePx(window)
    expect(resetEditor).toBeCloseTo(baseEditor, 0)
  })

  test('zoom does not affect chrome (outline/toolbar/explorer/sidebar)', async ({ window }) => {
    // Ensure toolbar is shown (default true) so we can measure it
    const toolbarSel = '.markdown-toolbar, [data-testid="markdown-toolbar"], .editor-toolbar'
    const chromeSelectors = [
      toolbarSel,
      '.file-explorer, [data-testid="file-explorer"]',
      '.outline, [data-testid="outline"]',
      '.workspace-sidebar, [data-testid="workspace-sidebar"]'
    ]

    const baselineHeights: Record<string, number> = {}
    for (const sel of chromeSelectors) {
      baselineHeights[sel] = await window.evaluate((s) => {
        const el = document.querySelector(s) as HTMLElement | null
        if (!el) return -1
        return parseFloat(getComputedStyle(el).fontSize)
      }, sel)
    }

    await setZoom(window, 5)
    await window.waitForTimeout(300)

    for (const sel of chromeSelectors) {
      const after = await window.evaluate((s) => {
        const el = document.querySelector(s) as HTMLElement | null
        if (!el) return -1
        return parseFloat(getComputedStyle(el).fontSize)
      }, sel)
      // Either element isn't present (-1) — which is fine — or its font size is unchanged.
      if (baselineHeights[sel] !== -1 && after !== -1) {
        expect(after).toBeCloseTo(baselineHeights[sel], 1)
      }
    }
  })
})
