import { test, expect, waitForAppReady } from '../fixtures'

test.describe('Tab Context Menu', () => {
  test('right-click on tab shows context menu with all items', async ({ window }) => {
    await waitForAppReady(window)

    const tab = window.locator('.tab').first()
    await expect(tab).toBeVisible()

    // Right-click the tab
    await tab.click({ button: 'right' })

    // Context menu should appear
    const contextMenu = window.locator('.tab-context-menu')
    await expect(contextMenu).toBeVisible()

    // Verify all expected items
    const items = await contextMenu.locator('.tab-context-menu-item').allTextContents()
    expect(items).toEqual([
      'Reveal in File Explorer',
      'Copy Path',
      'Copy Relative Path',
      'Close Tabs to Left',
      'Close Tabs to Right',
      'Close All Tabs'
    ])

    // Verify separator between path actions and close actions
    const separator = contextMenu.locator('.tab-context-menu-separator')
    await expect(separator).toBeVisible()
  })

  test('context menu dismisses on click-outside', async ({ window }) => {
    await waitForAppReady(window)

    const tab = window.locator('.tab').first()
    await tab.click({ button: 'right' })

    const contextMenu = window.locator('.tab-context-menu')
    await expect(contextMenu).toBeVisible()

    // Click outside the menu
    await window.mouse.click(5, 5)
    await expect(contextMenu).not.toBeVisible()
  })

  test('context menu dismisses on Escape key', async ({ window }) => {
    await waitForAppReady(window)

    const tab = window.locator('.tab').first()
    await tab.click({ button: 'right' })

    const contextMenu = window.locator('.tab-context-menu')
    await expect(contextMenu).toBeVisible()

    // Press Escape — use dispatchEvent to avoid global handlers intercepting
    await window.evaluate(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    })
    await expect(contextMenu).not.toBeVisible()
  })

  test('first tab has Close Tabs to Left disabled', async ({ window }) => {
    await waitForAppReady(window)

    // Right-click the first tab in its workspace
    const firstTab = window.locator('.tab').first()
    await firstTab.click({ button: 'right' })

    const contextMenu = window.locator('.tab-context-menu')
    await expect(contextMenu).toBeVisible()

    // "Close Tabs to Left" (4th item, index 3) should be disabled for first tab
    const closeLeftBtn = contextMenu.locator('button:has-text("Close Tabs to Left")')
    await expect(closeLeftBtn).toBeDisabled()
  })

  test('Copy Path copies file path to clipboard', async ({ window }) => {
    await waitForAppReady(window)

    // Right-click a saved tab (first tab from restored session should have a path)
    const tab = window.locator('.tab').first()
    await tab.click({ button: 'right' })

    const contextMenu = window.locator('.tab-context-menu')
    await expect(contextMenu).toBeVisible()

    // Click "Copy Path"
    const copyPathBtn = contextMenu.locator('button:has-text("Copy Path")')
    await expect(copyPathBtn).toBeEnabled()
    await copyPathBtn.click()

    // Menu should close after action
    await expect(contextMenu).not.toBeVisible()

    // Verify clipboard has a file path
    const clipboardContent = await window.evaluate(() => navigator.clipboard.readText())
    console.log('Clipboard after Copy Path:', clipboardContent)
    expect(clipboardContent).toContain('/')
  })
})
