// Traces: WIN-004 (canonical spec: specs/window-lifecycle/spec.md)
import { test, expect } from '../../fixtures'
import * as os from 'os'
import * as path from 'path'
import * as fs from 'fs'

test.describe('WIN-004: Export as PDF', () => {
  test('returns null when user cancels the save dialog', async ({ electronApp, window }) => {
    await window.waitForLoadState('domcontentloaded')
    // Stub dialog.showSaveDialog to simulate user cancel.
    const result = await electronApp.evaluate(async ({ dialog, ipcMain, BrowserWindow }) => {
      const original = dialog.showSaveDialog
      ;(dialog as any).showSaveDialog = async () => ({ canceled: true, filePath: undefined })
      try {
        const win = BrowserWindow.getAllWindows()[0]
        // ipcMain.handle is internal; invoke via webContents.ipc or via the private map.
        // Use the internal _invokeHandler to call the registered handler.
        const r = await (ipcMain as any)._invokeHandler('window:exportPdf', { sender: win.webContents }, '<p>hi</p>', 'doc')
        return r
      } finally {
        dialog.showSaveDialog = original
      }
    })
    expect(result).toBeNull()
  })

  test('writes PDF to chosen path and returns the path on success', async ({ electronApp, window }) => {
    await window.waitForLoadState('domcontentloaded')
    const tmpFile = path.join(os.tmpdir(), `wrangle-e2e-${Date.now()}.pdf`)
    const result = await electronApp.evaluate(async ({ dialog, ipcMain, BrowserWindow }, target) => {
      const original = dialog.showSaveDialog
      ;(dialog as any).showSaveDialog = async () => ({ canceled: false, filePath: target })
      try {
        const win = BrowserWindow.getAllWindows()[0]
        const html = '<!doctype html><html><body><h1>Hello PDF</h1></body></html>'
        const r = await (ipcMain as any)._invokeHandler('window:exportPdf', { sender: win.webContents }, html, 'Hello')
        return r
      } finally {
        dialog.showSaveDialog = original
      }
    }, tmpFile)

    expect(result).toBe(tmpFile)
    expect(fs.existsSync(tmpFile)).toBe(true)
    const stat = fs.statSync(tmpFile)
    expect(stat.size).toBeGreaterThan(0)
    const head = fs.readFileSync(tmpFile).subarray(0, 4).toString('utf-8')
    expect(head).toBe('%PDF')

    fs.unlinkSync(tmpFile)
  })

  test('returns null when writeFile throws (error path)', async ({ electronApp, window }) => {
    await window.waitForLoadState('domcontentloaded')
    // Point the save path at an illegal location so writeFile fails.
    const badPath = process.platform === 'win32' ? 'Z:/does/not/exist/wrangle.pdf' : '/proc/does/not/exist/wrangle.pdf'

    const result = await electronApp.evaluate(async ({ dialog, ipcMain, BrowserWindow }, target) => {
      const original = dialog.showSaveDialog
      ;(dialog as any).showSaveDialog = async () => ({ canceled: false, filePath: target })
      try {
        const win = BrowserWindow.getAllWindows()[0]
        const r = await (ipcMain as any)._invokeHandler('window:exportPdf', { sender: win.webContents }, '<p>x</p>', 't')
        return r
      } finally {
        dialog.showSaveDialog = original
      }
    }, badPath)

    expect(result).toBeNull()
  })

  test('hidden offscreen BrowserWindow is destroyed after export (no window leak)', async ({ electronApp, window }) => {
    await window.waitForLoadState('domcontentloaded')
    const tmpFile = path.join(os.tmpdir(), `wrangle-e2e-${Date.now()}-leak.pdf`)

    const counts = await electronApp.evaluate(async ({ dialog, ipcMain, BrowserWindow }, target) => {
      const before = BrowserWindow.getAllWindows().length
      const original = dialog.showSaveDialog
      ;(dialog as any).showSaveDialog = async () => ({ canceled: false, filePath: target })
      try {
        const win = BrowserWindow.getAllWindows()[0]
        await (ipcMain as any)._invokeHandler('window:exportPdf', { sender: win.webContents }, '<p>leak-check</p>', 'Leak')
      } finally {
        dialog.showSaveDialog = original
      }
      const after = BrowserWindow.getAllWindows().length
      return { before, after }
    }, tmpFile)

    expect(counts.after).toBe(counts.before)
    if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile)
  })
})
