import { app, shell, BrowserWindow, Menu, globalShortcut } from 'electron'
import { join } from 'path'
import { existsSync } from 'fs'
import { readFile } from 'fs/promises'
import { registerAllHandlers } from './ipc'
import { initTempRoot } from './utils/temp-dir-manager'
import { didCrashLastSession, createRunningMarker, clearRunningMarker, findOrphanedDrafts } from './utils/crash-recovery'
import { setCrashRecoveryInfo } from './ipc/crash-recovery-handler'

// Module-level reference so second-instance handler can access it
let mainWindow: BrowserWindow | null = null

function getFilePathFromArgs(argv?: string[]): string | null {
  // process.argv structure in Electron:
  // [0]: electron executable
  // [1]: app path (main.js)
  // [2+]: custom arguments
  const args = (argv || process.argv).slice(2)

  for (const arg of args) {
    // Skip flags and look for markdown file paths
    if (!arg.startsWith('-') && /\.(md|markdown|mdown|mkd|mdwn)$/i.test(arg) && existsSync(arg)) {
      return arg
    }
  }
  return null
}

function createWindow(): BrowserWindow {
  // Create the browser window
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    show: false,
    frame: false,
    titleBarStyle: 'hidden',
    icon: join(__dirname, '../assets/w.png'),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  win.on('ready-to-show', async () => {
    if (process.env.NODE_ENV !== 'test') {
      win.show()
    }

    // Check for file path in command-line arguments
    const filePath = getFilePathFromArgs()
    if (filePath) {
      try {
        const content = await readFile(filePath, 'utf-8')
        win.webContents.send('file:openFromPath', { path: filePath, content })
      } catch (error) {
        console.error('Error reading file from command line:', error)
      }
    }
  })

  win.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // Hide native menu - using custom title bar menu instead
  Menu.setApplicationMenu(null)

  // HMR for renderer based on electron-vite cli
  // Load the remote URL for development or the local html file for production
  if (!app.isPackaged && process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return win
}

// Single-instance lock: if another instance is already running,
// send the file path to the existing instance and quit
const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
} else {
  app.on('second-instance', async (_event, argv) => {
    // Another instance was launched - extract file path from its args
    const filePath = getFilePathFromArgs(argv)
    if (filePath && mainWindow && !mainWindow.isDestroyed()) {
      try {
        const content = await readFile(filePath, 'utf-8')
        mainWindow.webContents.send('file:openFromPath', { path: filePath, content })
      } catch (error) {
        console.error('Error reading file from second instance:', error)
      }
      // Focus the existing window
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
    }
  })
}

// This method will be called when Electron has finished initialization
app.whenReady().then(async () => {
  // Set app user model id for windows
  if (process.platform === 'win32') {
    app.setAppUserModelId('com.electron.wrangle')
  }

  // Check for crash from previous session
  const crashed = didCrashLastSession()
  let hasOrphanedDrafts = false

  if (crashed) {
    const orphanedDrafts = await findOrphanedDrafts()
    hasOrphanedDrafts = orphanedDrafts.length > 0
    setCrashRecoveryInfo({ didCrash: true, orphanedDrafts })
  }

  // Create running marker for this session
  await createRunningMarker()

  // Initialize temp directory system (skip cleanup if we have orphaned drafts to recover)
  try {
    await initTempRoot(hasOrphanedDrafts)
  } catch (error) {
    console.error('Failed to initialize temp directory:', error)
  }

  // Register IPC handlers
  registerAllHandlers()

  mainWindow = createWindow()

  // Register global shortcuts to toggle DevTools (works even when DevTools has focus)
  // Try F12 first, fall back to Ctrl+Shift+I if F12 is reserved
  const toggleDevTools = () => {
    console.log('DevTools shortcut triggered')
    const windows = BrowserWindow.getAllWindows()
    if (windows.length > 0) {
      const win = windows.find(w => !w.isDestroyed())
      if (win) {
        win.webContents.toggleDevTools()
      }
    }
  }

  const f12Success = globalShortcut.register('F12', toggleDevTools)
  console.log('F12 global shortcut registered:', f12Success)

  // Also register Ctrl+Shift+I as a reliable alternative
  const ctrlShiftISuccess = globalShortcut.register('CommandOrControl+Shift+I', toggleDevTools)
  console.log('Ctrl+Shift+I global shortcut registered:', ctrlShiftISuccess)

  if (!f12Success && !ctrlShiftISuccess) {
    console.error('Failed to register any DevTools shortcuts')
  }

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createWindow()
    }
  })
})

// Unregister global shortcuts and clear crash marker when quitting
app.on('will-quit', () => {
  globalShortcut.unregisterAll()
  clearRunningMarker().catch(() => {})
})

// Handle SIGINT/SIGTERM for graceful shutdown
process.on('SIGINT', () => {
  clearRunningMarker().catch(() => {})
  app.quit()
})

process.on('SIGTERM', () => {
  clearRunningMarker().catch(() => {})
  app.quit()
})

// Quit when all windows are closed, except on macOS
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
