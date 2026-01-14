import { registerFileHandlers } from './file-handler'
import { registerWindowHandlers } from './window-handler'
import { registerSettingsHandlers } from './settings-handler'

export function registerAllHandlers(): void {
  registerFileHandlers()
  registerWindowHandlers()
  registerSettingsHandlers()
}
