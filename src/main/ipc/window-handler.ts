import { ipcMain, BrowserWindow } from 'electron'

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
}
