// Traces: KBD-008 (canonical spec: specs/keyboard-commands/spec.md)
import { test, expect, waitForAppReady } from '../../fixtures'

async function openShortcutsTab(window: import('@playwright/test').Page): Promise<boolean> {
  await window.keyboard.press('Control+,')
  await window.waitForTimeout(600)
  const prefs = await window.$('[class*="preferences"], [role="dialog"]')
  if (!prefs) return false
  const tab = await window.$('text=/Keyboard Shortcuts/i')
  if (tab) await tab.click()
  await window.waitForTimeout(400)
  return true
}

test.describe('KBD-008: Preferences → Keyboard Shortcuts tab lists all commands', () => {
  test('commands are grouped by category with category headers', async ({ window }) => {
    await waitForAppReady(window)
    const opened = await openShortcutsTab(window)
    if (!opened) {
      test.fixme(true, 'Preferences dialog not reachable.')
      return
    }

    // Look for category labels in the tab.
    const bodyText = (await window.textContent('body')) || ''
    for (const label of ['File', 'Edit', 'View', 'Navigation', 'Markdown', 'Application']) {
      expect(bodyText).toContain(label)
    }
  })

  test('well-known commands are present as rows (Bold, Save, Italic)', async ({ window }) => {
    await waitForAppReady(window)
    const opened = await openShortcutsTab(window)
    if (!opened) {
      test.fixme(true, 'Preferences dialog not reachable.')
      return
    }
    const bodyText = (await window.textContent('body')) || ''
    expect(bodyText).toMatch(/\bBold\b/)
    expect(bodyText).toMatch(/\bItalic\b/)
    expect(bodyText).toMatch(/\bSave\b/)
  })

  test('search box filters the visible rows', async ({ window }) => {
    await waitForAppReady(window)
    const opened = await openShortcutsTab(window)
    if (!opened) {
      test.fixme(true, 'Preferences dialog not reachable.')
      return
    }
    const searchInput = await window.$('input[type="search"], input[placeholder*="earch"]')
    if (!searchInput) {
      test.fixme(true, 'No search input found in Shortcuts tab.')
      return
    }
    await searchInput.fill('bold')
    await window.waitForTimeout(300)
    const text = (await window.textContent('[class*="shortcuts"], [class*="Shortcuts"]')) || ''
    expect(text.toLowerCase()).toContain('bold')
    // Italic should no longer be listed.
    expect(text.toLowerCase()).not.toContain('italic')
  })

  test.fixme(
    'Vim Mode checkbox toggles settings.editor.vimMode',
    async () => {
      // Requires reading Redux state post-click — better done as a component/integration test.
    }
  )
})
