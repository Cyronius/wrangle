import { ElectronApplication, Page } from '@playwright/test'

/**
 * Shared helpers for window-drag e2e tests (WD-001, WD-002, WD-003).
 */

export async function getWindowPosition(
  electronApp: ElectronApplication
): Promise<{ x: number; y: number }> {
  return electronApp.evaluate(({ BrowserWindow }) => {
    const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
    const [x, y] = win.getPosition()
    return { x, y }
  })
}

export async function getWindowBounds(
  electronApp: ElectronApplication
): Promise<{ x: number; y: number; width: number; height: number }> {
  return electronApp.evaluate(({ BrowserWindow }) => {
    const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
    return win.getBounds()
  })
}

export async function isWindowMaximized(electronApp: ElectronApplication): Promise<boolean> {
  return electronApp.evaluate(({ BrowserWindow }) => {
    const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
    return win.isMaximized()
  })
}

export async function maximizeWindow(electronApp: ElectronApplication): Promise<void> {
  await electronApp.evaluate(({ BrowserWindow }) => {
    const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
    if (!win.isMaximized()) win.maximize()
  })
}

export async function unmaximizeWindow(electronApp: ElectronApplication): Promise<void> {
  await electronApp.evaluate(({ BrowserWindow }) => {
    const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
    if (win.isMaximized()) win.unmaximize()
  })
}

export async function setWindowPosition(
  electronApp: ElectronApplication,
  x: number,
  y: number
): Promise<void> {
  await electronApp.evaluate(
    ({ BrowserWindow }, pos) => {
      const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
      win.setPosition(pos.x, pos.y)
    },
    { x, y }
  )
}

export async function setWindowSize(
  electronApp: ElectronApplication,
  width: number,
  height: number
): Promise<void> {
  await electronApp.evaluate(
    ({ BrowserWindow }, size) => {
      const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
      win.setSize(size.w, size.h)
    },
    { w: width, h: height }
  )
}

/**
 * Perform an Alt+drag gesture on the page.
 * Coordinates are page-relative (viewport).
 */
export async function altDrag(
  window: Page,
  startX: number,
  startY: number,
  deltaX: number,
  deltaY: number,
  options?: { steps?: number; releaseAlt?: boolean; stepDelayMs?: number }
): Promise<void> {
  const steps = options?.steps ?? 10
  const releaseAlt = options?.releaseAlt ?? true
  const stepDelayMs = options?.stepDelayMs ?? 30

  await window.keyboard.down('Alt')
  await window.waitForTimeout(150)

  await window.mouse.move(startX, startY)
  await window.mouse.down()
  await window.waitForTimeout(100)

  for (let i = 1; i <= steps; i++) {
    await window.mouse.move(startX + (deltaX * i) / steps, startY + (deltaY * i) / steps)
    if (i % 3 === 0) await window.waitForTimeout(stepDelayMs)
  }
  await window.waitForTimeout(150)

  await window.mouse.up()
  await window.waitForTimeout(150)

  if (releaseAlt) {
    await window.keyboard.up('Alt')
    await window.waitForTimeout(150)
  }
}
