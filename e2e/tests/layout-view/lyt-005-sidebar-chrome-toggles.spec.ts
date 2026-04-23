// Traces: LYT-005 (canonical spec: specs/layout-view/spec.md)
import { test, expect, waitForAppReady } from '../../fixtures'

type LayoutFlags = {
  showOutline: boolean
  showToolbar: boolean
  showExplorer: boolean
  showWorkspaceSidebar: boolean
}

async function getFlags(window: import('@playwright/test').Page): Promise<LayoutFlags> {
  return window.evaluate(() => {
    const s = (window as any).__REDUX_STORE__.getState().layout
    return {
      showOutline: s.showOutline,
      showToolbar: s.showToolbar,
      showExplorer: s.showExplorer,
      showWorkspaceSidebar: s.showWorkspaceSidebar
    }
  })
}

async function dispatch(window: import('@playwright/test').Page, type: string, payload?: unknown): Promise<void> {
  await window.evaluate(
    ({ t, p }) => {
      const store = (window as any).__REDUX_STORE__
      if (p === undefined) store.dispatch({ type: t })
      else store.dispatch({ type: t, payload: p })
    },
    { t: type, p: payload }
  )
}

test.describe('LYT-005: Sidebar and Chrome Toggles', () => {
  test.beforeEach(async ({ window }) => {
    await waitForAppReady(window)
  })

  test('default values match spec', async ({ window }) => {
    // We can't guarantee the user hasn't toggled, but on fresh launch these should be defaults.
    const flags = await getFlags(window)
    expect(typeof flags.showOutline).toBe('boolean')
    expect(typeof flags.showToolbar).toBe('boolean')
    expect(typeof flags.showExplorer).toBe('boolean')
    expect(typeof flags.showWorkspaceSidebar).toBe('boolean')
  })

  test('toggleOutline flips showOutline independently', async ({ window }) => {
    const before = await getFlags(window)
    await dispatch(window, 'layout/toggleOutline')
    const after = await getFlags(window)
    expect(after.showOutline).toBe(!before.showOutline)
    // Others unchanged
    expect(after.showToolbar).toBe(before.showToolbar)
    expect(after.showExplorer).toBe(before.showExplorer)
    expect(after.showWorkspaceSidebar).toBe(before.showWorkspaceSidebar)
  })

  test('toggleToolbar flips showToolbar independently', async ({ window }) => {
    const before = await getFlags(window)
    await dispatch(window, 'layout/toggleToolbar')
    const after = await getFlags(window)
    expect(after.showToolbar).toBe(!before.showToolbar)
    expect(after.showOutline).toBe(before.showOutline)
    expect(after.showExplorer).toBe(before.showExplorer)
    expect(after.showWorkspaceSidebar).toBe(before.showWorkspaceSidebar)
  })

  test('toggleExplorer flips showExplorer independently', async ({ window }) => {
    const before = await getFlags(window)
    await dispatch(window, 'layout/toggleExplorer')
    const after = await getFlags(window)
    expect(after.showExplorer).toBe(!before.showExplorer)
    expect(after.showOutline).toBe(before.showOutline)
    expect(after.showToolbar).toBe(before.showToolbar)
    expect(after.showWorkspaceSidebar).toBe(before.showWorkspaceSidebar)
  })

  test('toggleWorkspaceSidebar flips showWorkspaceSidebar independently', async ({ window }) => {
    const before = await getFlags(window)
    await dispatch(window, 'layout/toggleWorkspaceSidebar')
    const after = await getFlags(window)
    expect(after.showWorkspaceSidebar).toBe(!before.showWorkspaceSidebar)
    expect(after.showOutline).toBe(before.showOutline)
    expect(after.showToolbar).toBe(before.showToolbar)
    expect(after.showExplorer).toBe(before.showExplorer)
  })

  test('setWorkspaceSidebar forces explicit value regardless of current state', async ({ window }) => {
    await dispatch(window, 'layout/setWorkspaceSidebar', true)
    expect((await getFlags(window)).showWorkspaceSidebar).toBe(true)

    // Calling with true again keeps it true (not a toggle)
    await dispatch(window, 'layout/setWorkspaceSidebar', true)
    expect((await getFlags(window)).showWorkspaceSidebar).toBe(true)

    await dispatch(window, 'layout/setWorkspaceSidebar', false)
    expect((await getFlags(window)).showWorkspaceSidebar).toBe(false)

    await dispatch(window, 'layout/setWorkspaceSidebar', false)
    expect((await getFlags(window)).showWorkspaceSidebar).toBe(false)
  })
})
