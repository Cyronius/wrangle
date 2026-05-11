import { Menu, BrowserWindow, MenuItemConstructorOptions } from 'electron'
import { menuSchema, MenuNode } from '../../shared/menu-schema'

/**
 * Convert a registry shortcut string (e.g. "Ctrl+S", "Ctrl+K Ctrl+O") into an
 * Electron accelerator string. Electron uses `CmdOrCtrl` for cross-platform
 * Ctrl/Cmd; we substitute it for the renderer's `Ctrl` token. Returns
 * undefined for null/empty bindings.
 */
function toElectronAccelerator(binding: string | null | undefined): string | undefined {
  if (!binding) return undefined
  return binding.replace(/\bCtrl\b/g, 'CmdOrCtrl')
}

function buildItem(
  node: MenuNode,
  bindings: Record<string, string | null>,
  mainWindow: BrowserWindow
): MenuItemConstructorOptions {
  if (node.type === 'separator') {
    return { type: 'separator' }
  }

  if (node.role) {
    const item: MenuItemConstructorOptions = { role: node.role }
    if (node.label) item.label = node.label
    return item
  }

  const item: MenuItemConstructorOptions = {}
  if (node.label) item.label = node.label

  if (node.submenu) {
    item.submenu = node.submenu.map((child) => buildItem(child, bindings, mainWindow))
  }

  if (node.commandId) {
    const accelerator = toElectronAccelerator(bindings[node.commandId])
    if (accelerator) item.accelerator = accelerator
    item.click = () => {
      // Emit the registry command ID directly (KBD-013).
      mainWindow.webContents.send('menu:command', node.commandId)
    }
  }

  return item
}

export function createApplicationMenu(
  mainWindow: BrowserWindow,
  bindings: Record<string, string | null> = {}
): void {
  const template = menuSchema.map((node) => buildItem(node, bindings, mainWindow))
  const menu = Menu.buildFromTemplate(template)
  Menu.setApplicationMenu(menu)
  // The custom title bar renders its own menu UI; the native menu exists only
  // so the OS knows about the accelerators. On Windows a visible native menu
  // bar would steal the titleBarOverlay drag region, leaving no way to move
  // the window — keep it hidden.
  mainWindow.setMenuBarVisibility(false)
  mainWindow.autoHideMenuBar = true
}
