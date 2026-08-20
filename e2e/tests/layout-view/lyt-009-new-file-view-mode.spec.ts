// Traces: LYT-009 (canonical spec: specs/layout-view/spec.md)
import { test, expect, waitForAppReady } from '../../fixtures'
import { AppHelpers } from '../../helpers/app-helpers'

/**
 * LYT-009: Creating a new file while in preview-only mode must switch to
 * split so the new (empty) document has an editor pane to type into.
 */

async function getViewMode(window: import('@playwright/test').Page): Promise<string> {
  return window.evaluate(() => (window as any).__REDUX_STORE__.getState().layout.viewMode)
}

async function setViewMode(window: import('@playwright/test').Page, mode: string): Promise<void> {
  await window.evaluate(
    (m) => (window as any).__REDUX_STORE__.dispatch({ type: 'layout/setViewMode', payload: m }),
    mode
  )
}

test.describe('LYT-009: New File Never Opens in Preview-Only', () => {
  test.beforeEach(async ({ window }) => {
    await waitForAppReady(window)
  })

  test('new file in preview-only switches to split with an editor present', async ({
    window,
    electronApp
  }) => {
    const app = new AppHelpers(window, electronApp)

    // Need an existing tab to be able to enter preview-only meaningfully
    await app.sendMenuCommand('file.new')
    await window.waitForTimeout(300)

    await setViewMode(window, 'preview-only')
    expect(await getViewMode(window)).toBe('preview-only')

    await app.sendMenuCommand('file.new')
    await window.waitForTimeout(300)

    expect(await getViewMode(window)).toBe('split')
    // The editor pane actually renders
    expect(await window.locator('.monaco-editor').count()).toBeGreaterThan(0)
  })

  test('new file in editor-only keeps editor-only', async ({ window, electronApp }) => {
    const app = new AppHelpers(window, electronApp)

    await setViewMode(window, 'editor-only')
    await app.sendMenuCommand('file.new')
    await window.waitForTimeout(300)

    expect(await getViewMode(window)).toBe('editor-only')
  })
})
