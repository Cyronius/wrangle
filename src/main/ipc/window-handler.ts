import { ipcMain, BrowserWindow, dialog } from 'electron'
import { writeFile } from 'fs/promises'

export function registerWindowHandlers(): void {
  ipcMain.on('window:minimize', (event) => {
    const window = BrowserWindow.fromWebContents(event.sender)
    window?.minimize()
  })

  ipcMain.on('window:maximize', (event) => {
    const window = BrowserWindow.fromWebContents(event.sender)
    if (window?.isMaximized()) {
      window.unmaximize()
    } else {
      window?.maximize()
    }
  })

  ipcMain.on('window:close', (event) => {
    const window = BrowserWindow.fromWebContents(event.sender)
    window?.close()
  })

  // Zoom handlers
  ipcMain.on('window:zoom', (event, delta: number) => {
    const window = BrowserWindow.fromWebContents(event.sender)
    if (window) {
      const currentZoom = window.webContents.getZoomLevel()
      // Clamp zoom level between -3 and 3 (roughly 50% to 200%)
      const newZoom = Math.max(-3, Math.min(3, currentZoom + delta * 0.5))
      window.webContents.setZoomLevel(newZoom)
    }
  })

  ipcMain.handle('window:getZoom', (event) => {
    const window = BrowserWindow.fromWebContents(event.sender)
    return window?.webContents.getZoomLevel() ?? 0
  })

  ipcMain.handle('window:isMaximized', (event) => {
    const window = BrowserWindow.fromWebContents(event.sender)
    return window?.isMaximized() ?? false
  })

  ipcMain.on('window:print', (event) => {
    const window = BrowserWindow.fromWebContents(event.sender)
    window?.webContents.print({ silent: false, printBackground: true })
  })

  ipcMain.on('window:resetZoom', (event) => {
    const window = BrowserWindow.fromWebContents(event.sender)
    if (window) {
      window.webContents.setZoomLevel(0)
    }
  })

  ipcMain.on('window:toggleDevTools', (event) => {
    const window = BrowserWindow.fromWebContents(event.sender)
    window?.webContents.toggleDevTools()
  })

  ipcMain.handle(
    'window:exportPdf',
    async (event, html: string, title: string) => {
      const parentWindow = BrowserWindow.fromWebContents(event.sender)
      if (!parentWindow) return null

      const result = await dialog.showSaveDialog(parentWindow, {
        title: 'Export as PDF',
        defaultPath: `${title}.pdf`,
        filters: [{ name: 'PDF Files', extensions: ['pdf'] }]
      })

      if (result.canceled || !result.filePath) return null

      // Create a hidden window to render the HTML for PDF export
      const hiddenWindow = new BrowserWindow({
        show: false,
        width: 816, // US Letter width at 96 DPI
        height: 1056, // US Letter height at 96 DPI
        webPreferences: {
          offscreen: true
        }
      })

      try {
        // Load the HTML content
        await hiddenWindow.loadURL(
          `data:text/html;charset=utf-8,${encodeURIComponent(html)}`
        )

        // Wait for content to render
        await new Promise((resolve) => setTimeout(resolve, 500))

        const pdfBuffer = await hiddenWindow.webContents.printToPDF({
          printBackground: true,
          margins: {
            top: 0.5,
            bottom: 0.5,
            left: 0.5,
            right: 0.5
          }
        })

        await writeFile(result.filePath, pdfBuffer)
        return result.filePath
      } catch (error) {
        console.error('Failed to export PDF:', error)
        return null
      } finally {
        hiddenWindow.destroy()
      }
    }
  )

  ipcMain.handle(
    'window:exportHtml',
    async (event, html: string, title: string) => {
      const parentWindow = BrowserWindow.fromWebContents(event.sender)
      if (!parentWindow) return null

      const result = await dialog.showSaveDialog(parentWindow, {
        title: 'Export as HTML',
        defaultPath: `${title}.html`,
        filters: [{ name: 'HTML Files', extensions: ['html'] }]
      })

      if (result.canceled || !result.filePath) return null

      try {
        await writeFile(result.filePath, html, 'utf-8')
        return result.filePath
      } catch (error) {
        console.error('Failed to export HTML:', error)
        return null
      }
    }
  )
}
