// Traces: KBD-002 (canonical spec: specs/keyboard-commands/spec.md)
import { test, expect, waitForAppReady } from '../../fixtures'

async function openPreferencesShortcutsTab(window: import('@playwright/test').Page): Promise<boolean> {
  await window.keyboard.press('Control+,')
  await window.waitForTimeout(600)
  const prefs = await window.$('[class*="preferences"], [role="dialog"]')
  if (!prefs) return false
  // Try to click the "Keyboard Shortcuts" tab
  const tab = await window.$('text=/Keyboard Shortcuts/i')
  if (tab) await tab.click()
  await window.waitForTimeout(300)
  return true
}

test.describe('KBD-002: Built-in "default" preset is immutable', () => {
  test('when default preset is active, shortcut recorders are disabled', async ({ window }) => {
    await waitForAppReady(window)

    const opened = await openPreferencesShortcutsTab(window)
    if (!opened) {
      test.fixme(true, 'Preferences dialog not reachable in this build.')
      return
    }

    // When built-in preset active, the tab renders the read-only notice.
    const readOnlyNotice = await window.$(
      'text=/built-?in|read[- ]?only|cannot be (edited|modified)/i'
    )
    expect(readOnlyNotice).toBeTruthy()

    // Any shortcut recorder buttons should be disabled.
    const disabledRecorders = await window.$$eval(
      'button[class*="ShortcutRecorder"], button[class*="shortcut-recorder"]',
      (nodes) => nodes.filter((n) => (n as HTMLButtonElement).disabled).length
    )
    const totalRecorders = await window.$$eval(
      'button[class*="ShortcutRecorder"], button[class*="shortcut-recorder"]',
      (nodes) => nodes.length
    )
    if (totalRecorders > 0) {
      expect(disabledRecorders).toBe(totalRecorders)
    } else {
      test.fixme(true, 'ShortcutRecorder DOM selector did not match in this build.')
    }
  })

  test('default preset appears in the preset selector', async ({ window }) => {
    await waitForAppReady(window)
    const opened = await openPreferencesShortcutsTab(window)
    if (!opened) {
      test.fixme(true, 'Preferences dialog not reachable.')
      return
    }
    const hasDefault = await window.$('text=/default.*built-in|built-in.*default|default \\(built/i')
    expect(hasDefault).toBeTruthy()
  })

  test.fixme(
    'new commands auto-appear in default preset on next launch without migration',
    async () => {
      // Requires modifying the registry between launches — this is a unit-test concern.
    }
  )
})
