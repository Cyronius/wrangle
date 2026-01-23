import { registerFileHandlers } from './file-handler'
import { registerWindowHandlers } from './window-handler'
import { registerSettingsHandlers } from './settings-handler'
import { registerWorkspaceHandlers } from './workspace-handler'

export function registerAllHandlers(): void {
  registerFileHandlers()
  registerWindowHandlers()
  registerSettingsHandlers()
  registerWorkspaceHandlers()
}
