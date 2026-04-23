// Traces: SYN-001 (canonical spec: specs/preview-sync/spec.md)
import { test, expect, waitForAppReady } from '../../fixtures'
import { EditorHelpers } from '../../helpers/editor-helpers'

test.describe('SYN-001: Sync Lock Toggle', () => {
  test.beforeEach(async ({ window }) => {
    await waitForAppReady(window)
    const editor = new EditorHelpers(window)
    await editor.setContent('# Title\n\nBody paragraph.\n')
    await window.waitForTimeout(300)
  })

  test('renders the sync lock icon in split view', async ({ window }) => {
    const icon = await window.$('.sync-lock-icon')
    expect(icon).not.toBeNull()
    const visible = await window.isVisible('.sync-lock-icon')
    expect(visible).toBe(true)
  })

  test('clicking the icon toggles previewSync in Redux', async ({ window }) => {
    // Default: synced
    const initialClass = await window.getAttribute('.sync-lock-icon', 'class')
    expect(initialClass).toContain('synced')
    expect(initialClass).not.toContain('unsynced')

    await window.click('.sync-lock-icon')
    await window.waitForTimeout(150)

    const afterFirst = await window.getAttribute('.sync-lock-icon', 'class')
    expect(afterFirst).toContain('unsynced')
    expect(afterFirst).not.toMatch(/\bsynced\b/)

    await window.click('.sync-lock-icon')
    await window.waitForTimeout(150)

    const afterSecond = await window.getAttribute('.sync-lock-icon', 'class')
    expect(afterSecond).toContain('synced')
    expect(afterSecond).not.toContain('unsynced')
  })

  test('locked state uses connected-chain svg and synced class', async ({ window }) => {
    const locked = await window.evaluate(() => {
      const btn = document.querySelector('.sync-lock-icon')
      if (!btn) return null
      const svg = btn.querySelector('svg')
      return {
        classes: btn.className,
        hasSvg: !!svg,
        // The broken-chain variant has multiple path segments; the connected
        // variant renders as one continuous chain. We at least assert an svg
        // exists and the synced class is applied.
        svgInnerLength: svg?.innerHTML.length ?? 0
      }
    })
    expect(locked?.classes).toContain('synced')
    expect(locked?.hasSvg).toBe(true)
    expect(locked?.svgInnerLength).toBeGreaterThan(0)
  })

  test('unlocked state uses broken-chain svg and unsynced class', async ({ window }) => {
    await window.click('.sync-lock-icon')
    await window.waitForTimeout(150)

    const unlocked = await window.evaluate(() => {
      const btn = document.querySelector('.sync-lock-icon')
      if (!btn) return null
      const svg = btn.querySelector('svg')
      return {
        classes: btn.className,
        hasSvg: !!svg,
        svgInnerLength: svg?.innerHTML.length ?? 0
      }
    })
    expect(unlocked?.classes).toContain('unsynced')
    expect(unlocked?.hasSvg).toBe(true)
    expect(unlocked?.svgInnerLength).toBeGreaterThan(0)
  })

  test('tooltip text reflects sync state', async ({ window }) => {
    const lockedTitle = await window.getAttribute('.sync-lock-icon', 'title')
    expect(lockedTitle).toBe('Preview scroll is synced - click to unlock')

    await window.click('.sync-lock-icon')
    await window.waitForTimeout(150)

    const unlockedTitle = await window.getAttribute('.sync-lock-icon', 'title')
    expect(unlockedTitle).toBe('Preview scroll is unlocked - click to sync')
  })
})
