import { app, shell, BrowserWindow } from 'electron'
import { join } from 'path'
import { registerAllHandlers } from './ipc'
import { createApplicationMenu } from './menu/menu-template'
import { initTempRoot } from './utils/temp-dir-manager'

function createWindow(): void {
  // Create the browser window
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    show: false,
    autoHideMenuBar: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // Create application menu
  createApplicationMenu(mainWindow)

  // HMR for renderer based on electron-vite cli
  // Load the remote URL for development or the local html file for production
  if (!app.isPackaged && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// This method will be called when Electron has finished initialization
app.whenReady().then(async () => {
  // Set app user model id for windows
  if (process.platform === 'win32') {
    app.setAppUserModelId('com.electron.tangle')
  }

  // Initialize temp directory system
  try {
    await initTempRoot()
  } catch (error) {
    console.error('Failed to initialize temp directory:', error)
  }

  // Register IPC handlers
  registerAllHandlers()

  createWindow()

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Quit when all windows are closed, except on macOS
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
