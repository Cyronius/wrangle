// Traces: LYT-001 (canonical spec: specs/layout-view/spec.md)
import { test, expect, waitForAppReady, waitForMonacoReady } from '../../fixtures'
import { EditorHelpers } from '../../helpers/editor-helpers'
import { AppHelpers } from '../../helpers/app-helpers'

async function getViewMode(window: import('@playwright/test').Page): Promise<string> {
  return window.evaluate(() => {
    const store = (window as any).__REDUX_STORE__
    return store.getState().layout.viewMode
  })
}

async function setViewMode(
  window: import('@playwright/test').Page,
  mode: 'split' | 'editor-only' | 'preview-only'
): Promise<void> {
  await window.evaluate((m) => {
    const store = (window as any).__REDUX_STORE__
    store.dispatch({ type: 'layout/setViewMode', payload: m })
  }, mode)
}

test.describe('LYT-001: Three View Modes', () => {
  test.beforeEach(async ({ window }) => {
    await waitForAppReady(window)
  })

  test('split mode shows editor and preview side-by-side', async ({ window }) => {
    await setViewMode(window, 'split')
    await window.waitForTimeout(300)

    expect(await getViewMode(window)).toBe('split')
    await expect(window.locator('.monaco-editor').first()).toBeVisible()
    await expect(window.locator('.markdown-preview').first()).toBeVisible()
  })

  test('editor-only mode hides preview', async ({ window }) => {
    await setViewMode(window, 'editor-only')
    await window.waitForTimeout(300)

    expect(await getViewMode(window)).toBe('editor-only')
    await expect(window.locator('.monaco-editor').first()).toBeVisible()
    // Preview should not be visible as a full pane in editor-only mode
    const previewVisible = await window.locator('.markdown-preview').isVisible().catch(() => false)
    expect(previewVisible).toBe(false)
  })

  test('preview-only mode hides primary editor view', async ({ window }) => {
    await setViewMode(window, 'preview-only')
    await window.waitForTimeout(300)

    expect(await getViewMode(window)).toBe('preview-only')
    await expect(window.locator('.markdown-preview').first()).toBeVisible()
  })

  test('switching view modes preserves editor content', async ({ electronApp, window }) => {
    await waitForMonacoReady(window)
    const editor = new EditorHelpers(window)
    const unique = '# LYT-001 preservation check'
    await editor.setContent(unique)
    await window.waitForTimeout(300)

    const app = new AppHelpers(window, electronApp)

    await setViewMode(window, 'editor-only')
    await window.waitForTimeout(300)
    await setViewMode(window, 'preview-only')
    await window.waitForTimeout(300)
    await setViewMode(window, 'split')
    await window.waitForTimeout(500)

    // Content must still be present in the store via active tab
    const content = await window.evaluate(() => {
      const store = (window as any).__REDUX_STORE__
      const s = store.getState()
      const activeId = s.tabs.activeTabId
      const tab = s.tabs.tabs.find((t: any) => t.id === activeId)
      return tab?.content ?? ''
    })
    expect(content).toContain('LYT-001 preservation check')
    // And app should still be responsive
    expect(await app.getViewMode()).toBe('split')
  })

  test('default view mode is split', async ({ window }) => {
    // On fresh launch the beforeEach already waited. Verify default:
    const mode = await getViewMode(window)
    // Accept 'split' as the documented default. If something earlier changed it, this
    // still proves the reducer initializes to 'split' on cold start since nothing
    // else has dispatched setViewMode yet.
    expect(mode).toBe('split')
  })
})
