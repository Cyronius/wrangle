import { app, shell, BrowserWindow, globalShortcut, ipcMain } from 'electron'
import { join } from 'path'
import { existsSync } from 'fs'
import { readFile } from 'fs/promises'
import { registerAllHandlers } from './ipc'
import { initTempRoot } from './utils/temp-dir-manager'
import { didCrashLastSession, createRunningMarker, clearRunningMarker, findOrphanedDrafts, readRunningMarkerPid } from './utils/crash-recovery'
import { setCrashRecoveryInfo } from './ipc/crash-recovery-handler'
import { isTextFile } from '../shared/file-extensions'
import { logStartup } from './utils/startup-log'
import { createApplicationMenu } from './menu/menu-template'

logStartup('main module loaded', { isPackaged: app.isPackaged, platform: process.platform, version: app.getVersion() })

process.on('uncaughtException', (err) => {
  logStartup('uncaughtException', err)
})
process.on('unhandledRejection', (reason) => {
  logStartup('unhandledRejection', reason)
})

// Module-level reference so second-instance handler can access it
let mainWindow: BrowserWindow | null = null

function getFilePathFromArgs(argv?: string[]): string | null {
  // process.argv structure in Electron:
  // [0]: electron executable
  // [1]: app path (main.js)
  // [2+]: custom arguments
  const args = (argv || process.argv).slice(2)

  for (const arg of args) {
    // Skip flags and look for supported text file paths
    if (!arg.startsWith('-') && isTextFile(arg) && existsSync(arg)) {
      return arg
    }
  }
  return null
}

function createWindow(): BrowserWindow {
  logStartup('createWindow: start')
  // Create the browser window
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 400,
    minHeight: 300,
    show: false,
    titleBarStyle: 'hidden',
    ...(process.platform === 'win32'
      ? {
          titleBarOverlay: {
            color: '#252526',
            symbolColor: '#d4d4d4',
            height: 36
          }
        }
      : {}),
    icon: join(__dirname, '../assets/w.png'),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  // Guarantee the window becomes visible even if `ready-to-show` is late/never
  // (seen in packaged builds where the renderer stalls before first paint).
  // Race three triggers: ready-to-show, did-finish-load, and a 3s safety timer.
  let shown = false
  const showNow = (reason: string): void => {
    if (shown || win.isDestroyed()) return
    shown = true
    logStartup('window.show', { reason })
    if (process.env.NODE_ENV !== 'test') {
      win.show()
    }
  }
  const safetyTimer = setTimeout(() => showNow('safety-timeout-3s'), 3000)
  win.once('closed', () => clearTimeout(safetyTimer))

  win.on('ready-to-show', async () => {
    showNow('ready-to-show')

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

  win.webContents.on('did-finish-load', () => {
    logStartup('webContents did-finish-load')
    showNow('did-finish-load')
  })
  win.webContents.on('did-fail-load', (_e, code, desc, url) => {
    logStartup('webContents did-fail-load', { code, desc, url })
  })
  win.webContents.on('render-process-gone', (_e, details) => {
    logStartup('renderer gone', details)
  })
  win.webContents.on('preload-error', (_e, preloadPath, err) => {
    logStartup('preload-error', { preloadPath, error: err })
  })

  // Forward window state changes to renderer (needed to force drag region recalculation on Linux)
  win.on('maximize', () => win.webContents.send('window:stateChanged', true))
  win.on('unmaximize', () => win.webContents.send('window:stateChanged', false))

  win.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // Build native menu from registry schema. The custom title bar shows its
  // own dropdown menu; the native menu serves to register accelerators with
  // the OS and reflect the user's active preset (KBD-007).
  createApplicationMenu(win, {})

  // HMR for renderer based on electron-vite cli
  // Load the remote URL for development or the local html file for production
  if (!app.isPackaged && process.env['ELECTRON_RENDERER_URL']) {
    const url = process.env['ELECTRON_RENDERER_URL']
    logStartup('loadURL', { url })
    win.loadURL(url).catch((err) => logStartup('loadURL failed', err))
  } else {
    const htmlPath = join(__dirname, '../renderer/index.html')
    logStartup('loadFile', { htmlPath, exists: existsSync(htmlPath) })
    win.loadFile(htmlPath).catch((err) => logStartup('loadFile failed', err))
  }

  logStartup('createWindow: end')
  return win
}

// Single-instance lock: if another instance is already running,
// send the file path to the existing instance and quit
const gotLock = app.requestSingleInstanceLock()
logStartup('single-instance lock', { gotLock, priorMarkerPid: readRunningMarkerPid() })
if (!gotLock) {
  logStartup('second instance detected, quitting')
  app.quit()
} else {
  app.on('second-instance', async (_event, argv) => {
    // If the tracked window was closed/destroyed, create a fresh one
    if (!mainWindow || mainWindow.isDestroyed()) {
      mainWindow = createWindow()
    }

    // Always bring the existing window back to the user
    if (mainWindow.isMinimized()) mainWindow.restore()
    if (!mainWindow.isVisible()) mainWindow.show()
    mainWindow.focus()

    // If a file path was passed on the second invocation, open it
    const filePath = getFilePathFromArgs(argv)
    if (filePath) {
      try {
        const content = await readFile(filePath, 'utf-8')
        mainWindow.webContents.send('file:openFromPath', { path: filePath, content })
      } catch (error) {
        console.error('Error reading file from second instance:', error)
      }
    }
  })
}

// This method will be called when Electron has finished initialization
app.whenReady().then(async () => {
  logStartup('app.whenReady fired')
  // Set app user model id for windows
  if (process.platform === 'win32') {
    app.setAppUserModelId('com.electron.wrangle')
  }

  // Check for crash from previous session
  const crashed = didCrashLastSession()
  logStartup('crash detection', { crashed, priorMarkerPid: readRunningMarkerPid() })
  let hasOrphanedDrafts = false

  if (crashed) {
    const orphanedDrafts = await findOrphanedDrafts()
    hasOrphanedDrafts = orphanedDrafts.length > 0
    logStartup('orphaned drafts', { count: orphanedDrafts.length })
    setCrashRecoveryInfo({ didCrash: true, orphanedDrafts })
  }

  // Create running marker for this session
  await createRunningMarker()
  logStartup('running marker created')

  // Initialize temp directory system (skip cleanup if we have orphaned drafts to recover)
  try {
    await initTempRoot(hasOrphanedDrafts)
    logStartup('temp root initialized', { skipCleanup: hasOrphanedDrafts })
  } catch (error) {
    logStartup('initTempRoot failed', error)
    console.error('Failed to initialize temp directory:', error)
  }

  // Register IPC handlers
  registerAllHandlers()
  logStartup('IPC handlers registered')

  // KBD-007: rebuild the native application menu whenever the renderer
  // publishes the active preset bindings. `Menu.setApplicationMenu` replaces
  // the existing menu wholesale, so this is safe to call repeatedly.
  ipcMain.on('shortcuts:bindings-updated', (event, bindings: Record<string, string | null>) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (win) createApplicationMenu(win, bindings)
  })

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
}).catch((err) => {
  logStartup('whenReady rejected', err)
})

// Unregister global shortcuts and clear crash marker when quitting
app.on('will-quit', () => {
  logStartup('will-quit')
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
