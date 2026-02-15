import { ipcMain, shell } from 'electron'

export function registerShellHandlers(): void {
  ipcMain.on('shell:showItemInFolder', (_event, fullPath: string) => {
    shell.showItemInFolder(fullPath)
  })
}
