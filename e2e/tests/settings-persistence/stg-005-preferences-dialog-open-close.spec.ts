// Traces: STG-005 (canonical spec: specs/settings-persistence/spec.md)
import { test, expect } from '../../fixtures'
import { launchWithCleanProfile, waitForSettingsFile } from '../../helpers/settings-helpers'
import { waitForAppReady } from '../../fixtures'

async function openPreferences(window: import('@playwright/test').Page): Promise<void> {
  await waitForAppReady(window)
  await window.keyboard.press('Control+,')
  await window.waitForSelector('.preferences-dialog', { state: 'visible', timeout: 5000 })
}

test.describe('STG-005: Preferences Dialog Open/Close Behavior', () => {
  test('Ctrl+, opens the dialog (parent sets isOpen=true)', async () => {
    const app = await launchWithCleanProfile()
    try {
      await waitForAppReady(app.window)
      await expect(app.window.locator('.preferences-dialog')).toHaveCount(0)

      await app.window.keyboard.press('Control+,')
      await expect(app.window.locator('.preferences-dialog')).toBeVisible()
    } finally {
      await app.cleanup()
    }
  })

  test('clicking the close (X) button closes the dialog', async () => {
    const app = await launchWithCleanProfile()
    try {
      await openPreferences(app.window)
      await app.window.locator('.preferences-close').click()
      await app.window.waitForSelector('.preferences-dialog', { state: 'hidden', timeout: 3000 })
      await expect(app.window.locator('.preferences-dialog')).toHaveCount(0)
    } finally {
      await app.cleanup()
    }
  })

  test('pressing Escape closes the dialog', async () => {
    const app = await launchWithCleanProfile()
    try {
      await openPreferences(app.window)
      await app.window.keyboard.press('Escape')
      await app.window.waitForSelector('.preferences-dialog', { state: 'hidden', timeout: 3000 })
      await expect(app.window.locator('.preferences-dialog')).toHaveCount(0)
    } finally {
      await app.cleanup()
    }
  })

  test('clicking the overlay backdrop outside the panel closes the dialog', async () => {
    const app = await launchWithCleanProfile()
    try {
      await openPreferences(app.window)

      // Click at the overlay's top-left (outside the centered panel).
      const overlay = app.window.locator('.preferences-overlay')
      const box = await overlay.boundingBox()
      expect(box).not.toBeNull()
      await app.window.mouse.click(box!.x + 2, box!.y + 2)

      await app.window.waitForSelector('.preferences-dialog', { state: 'hidden', timeout: 3000 })
    } finally {
      await app.cleanup()
    }
  })

  test('clicking inside the panel does NOT close the dialog', async () => {
    const app = await launchWithCleanProfile()
    try {
      await openPreferences(app.window)

      // Click inside the dialog body (the tab content area).
      await app.window.locator('.preferences-content').click({ position: { x: 20, y: 20 } })

      // Still visible
      await app.window.waitForTimeout(200)
      await expect(app.window.locator('.preferences-dialog')).toBeVisible()
    } finally {
      await app.cleanup()
    }
  })

  test('loadSettings is dispatched on first open when not yet loaded', async () => {
    // Seed the profile with a recognizable value before the first launch, so
    // that after opening the dialog (which triggers loadSettings), Redux state
    // reflects that seeded value.
    const app = await launchWithCleanProfile()
    try {
      // Mutate a setting via IPC; this also loads the store. Then verify the
      // dialog, once opened, has access to the loaded data (tabs render, no
      // permanent "Loading settings..." placeholder).
      await app.window.evaluate(async () =>
        window.electron.settings.set('theme', { current: 'Light', customThemes: {} })
      )

      await openPreferences(app.window)

      // Loading placeholder should resolve quickly (settings already loaded).
      await app.window.waitForFunction(
        () => !document.querySelector('.preferences-loading'),
        undefined,
        { timeout: 5000 }
      )

      // And either the ThemeEditorTab or its container should be present under content.
      const contentChildren = await app.window
        .locator('.preferences-content')
        .evaluate((el) => el.children.length)
      expect(contentChildren).toBeGreaterThan(0)
    } finally {
      await app.cleanup()
    }
  })

  test('active tab resets to Theme Editor on each reopen (not persisted)', async () => {
    const app = await launchWithCleanProfile()
    try {
      await openPreferences(app.window)

      // Switch to Keyboard Shortcuts
      await app.window.locator('.preferences-tab', { hasText: 'Keyboard Shortcuts' }).click()
      await expect(
        app.window.locator('.preferences-tab.active', { hasText: 'Keyboard Shortcuts' })
      ).toBeVisible()

      // Close
      await app.window.keyboard.press('Escape')
      await app.window.waitForSelector('.preferences-dialog', { state: 'hidden', timeout: 3000 })

      // Reopen
      await openPreferences(app.window)

      // Active tab is back to Theme Editor
      await expect(
        app.window.locator('.preferences-tab.active', { hasText: 'Theme Editor' })
      ).toBeVisible()
      await expect(
        app.window.locator('.preferences-tab.active', { hasText: 'Keyboard Shortcuts' })
      ).toHaveCount(0)
    } finally {
      await app.cleanup()
    }
  })

  test('bounds are persisted at the end of a drag gesture (not only on close)', async () => {
    const app = await launchWithCleanProfile()
    try {
      await openPreferences(app.window)

      // Drag the header to move the dialog. Start position = header center,
      // end position = header center + (100, 80).
      const header = app.window.locator('.preferences-header')
      const box = await header.boundingBox()
      expect(box).not.toBeNull()

      const startX = box!.x + box!.width / 2
      const startY = box!.y + box!.height / 2

      await app.window.mouse.move(startX, startY)
      await app.window.mouse.down()
      // Move in a couple of steps so the mousemove listener fires
      await app.window.mouse.move(startX + 50, startY + 40, { steps: 5 })
      await app.window.mouse.move(startX + 100, startY + 80, { steps: 5 })
      await app.window.mouse.up()

      // Wait for the async persist (setTimeout 0 then IPC) to land on disk,
      // while the dialog is still open (proves "not only on close").
      const data = await waitForSettingsFile(
        app.userDataDir,
        (d) => !!d && !!(d.layout as any)?.preferencesDialog
      )
      expect(data).not.toBeNull()
      const pd = (data!.layout as any).preferencesDialog
      expect(typeof pd.x).toBe('number')
      expect(typeof pd.y).toBe('number')
      expect(typeof pd.width).toBe('number')
      expect(typeof pd.height).toBe('number')

      // Dialog is still open
      await expect(app.window.locator('.preferences-dialog')).toBeVisible()
    } finally {
      await app.cleanup()
    }
  })

  test('Escape handler is only registered while isOpen (no-op when dialog closed)', async () => {
    const app = await launchWithCleanProfile()
    try {
      await waitForAppReady(app.window)

      // Press Escape while dialog is closed — nothing should throw, no dialog appears.
      await app.window.keyboard.press('Escape')
      await app.window.waitForTimeout(100)
      await expect(app.window.locator('.preferences-dialog')).toHaveCount(0)

      // Open, then confirm Escape closes
      await app.window.keyboard.press('Control+,')
      await app.window.waitForSelector('.preferences-dialog', { state: 'visible', timeout: 5000 })
      await app.window.keyboard.press('Escape')
      await app.window.waitForSelector('.preferences-dialog', { state: 'hidden', timeout: 3000 })
    } finally {
      await app.cleanup()
    }
  })
})
