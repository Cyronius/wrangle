import type { MenuItemConstructorOptions } from 'electron'

/**
 * Declarative menu schema. Walked by the main process to build the native
 * application menu, with `commandId` references resolved to current
 * accelerators by looking up the active preset bindings (KBD-007, KBD-013).
 */
export interface MenuNode {
  label?: string
  type?: 'separator'
  role?: MenuItemConstructorOptions['role']
  /** Registry command ID — main resolves to accelerator + click handler */
  commandId?: string
  submenu?: MenuNode[]
  enabled?: boolean
}

export const menuSchema: MenuNode[] = [
  {
    label: 'File',
    submenu: [
      { commandId: 'file.new', label: 'New' },
      { commandId: 'file.open', label: 'Open' },
      { commandId: 'workspace.openFolder', label: 'Open Folder as Workspace...' },
      { commandId: 'file.save', label: 'Save' },
      { commandId: 'file.saveAs', label: 'Save As' },
      { type: 'separator' },
      { commandId: 'app.exit', label: 'Exit' }
    ]
  },
  {
    label: 'Edit',
    submenu: [
      { role: 'undo' },
      { role: 'redo' },
      { type: 'separator' },
      { role: 'cut' },
      { role: 'copy' },
      { role: 'paste' },
      { role: 'selectAll' }
    ]
  },
  {
    label: 'View',
    submenu: [
      { commandId: 'view.editorOnly', label: 'Editor Only' },
      { commandId: 'view.split', label: 'Split View' },
      { commandId: 'view.previewOnly', label: 'Preview Only' },
      { type: 'separator' },
      {
        label: 'Theme',
        submenu: [
          { commandId: 'view.themeLight', label: 'Light' },
          { commandId: 'view.themeDark', label: 'Dark' }
        ]
      },
      { type: 'separator' },
      { commandId: 'view.reload', label: 'Reload' },
      { commandId: 'view.forceReload', label: 'Force Reload' },
      { commandId: 'view.devTools', label: 'Toggle Developer Tools' },
      { type: 'separator' },
      { commandId: 'view.resetZoom', label: 'Reset Zoom' },
      { commandId: 'view.zoomIn', label: 'Zoom In' },
      { commandId: 'view.zoomOut', label: 'Zoom Out' },
      { type: 'separator' },
      { commandId: 'view.toggleFullscreen', label: 'Toggle Fullscreen' }
    ]
  }
]
