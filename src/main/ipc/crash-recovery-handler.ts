import { ipcMain } from 'electron'
import { OrphanedDraft } from '../utils/crash-recovery'

export interface CrashRecoveryInfo {
  didCrash: boolean
  orphanedDrafts: OrphanedDraft[]
}

let cachedRecoveryInfo: CrashRecoveryInfo = { didCrash: false, orphanedDrafts: [] }

export function setCrashRecoveryInfo(info: CrashRecoveryInfo): void {
  cachedRecoveryInfo = info
}

export function registerCrashRecoveryHandlers(): void {
  ipcMain.handle('crashRecovery:check', async (): Promise<CrashRecoveryInfo> => {
    return cachedRecoveryInfo
  })
}
