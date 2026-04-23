// Traces: WIN-005 (canonical spec: specs/window-lifecycle/spec.md)
import { test, expect } from '../../fixtures'
import * as os from 'os'
import * as path from 'path'
import * as fs from 'fs'

test.describe('WIN-005: Export as HTML', () => {
  test('returns null when user cancels the save dialog', async ({ electronApp, window }) => {
    await window.waitForLoadState('domcontentloaded')
    const result = await electronApp.evaluate(async ({ dialog, ipcMain, BrowserWindow }) => {
      const original = dialog.showSaveDialog
      ;(dialog as any).showSaveDialog = async () => ({ canceled: true, filePath: undefined })
      try {
        const win = BrowserWindow.getAllWindows()[0]
        return await (ipcMain as any)._invokeHandler('window:exportHtml', { sender: win.webContents }, '<p>hi</p>', 'doc')
      } finally {
        dialog.showSaveDialog = original
      }
    })
    expect(result).toBeNull()
  })

  test('writes HTML UTF-8 to chosen path and returns the path on success', async ({ electronApp, window }) => {
    await window.waitForLoadState('domcontentloaded')
    const tmpFile = path.join(os.tmpdir(), `wrangle-e2e-${Date.now()}.html`)
    const html = '<!doctype html><html><body><h1>Héllo ✓</h1></body></html>'

    const result = await electronApp.evaluate(async ({ dialog, ipcMain, BrowserWindow }, args) => {
      const original = dialog.showSaveDialog
      ;(dialog as any).showSaveDialog = async () => ({ canceled: false, filePath: args.target })
      try {
        const win = BrowserWindow.getAllWindows()[0]
        return await (ipcMain as any)._invokeHandler('window:exportHtml', { sender: win.webContents }, args.html, 'Doc')
      } finally {
        dialog.showSaveDialog = original
      }
    }, { target: tmpFile, html })

    expect(result).toBe(tmpFile)
    expect(fs.existsSync(tmpFile)).toBe(true)
    const written = fs.readFileSync(tmpFile, 'utf-8')
    expect(written).toBe(html)

    fs.unlinkSync(tmpFile)
  })

  test('returns null when writeFile throws (error path)', async ({ electronApp, window }) => {
    await window.waitForLoadState('domcontentloaded')
    const badPath = process.platform === 'win32' ? 'Z:/does/not/exist/wrangle.html' : '/proc/does/not/exist/wrangle.html'

    const result = await electronApp.evaluate(async ({ dialog, ipcMain, BrowserWindow }, target) => {
      const original = dialog.showSaveDialog
      ;(dialog as any).showSaveDialog = async () => ({ canceled: false, filePath: target })
      try {
        const win = BrowserWindow.getAllWindows()[0]
        return await (ipcMain as any)._invokeHandler('window:exportHtml', { sender: win.webContents }, '<p>x</p>', 't')
      } finally {
        dialog.showSaveDialog = original
      }
    }, badPath)

    expect(result).toBeNull()
  })
})
