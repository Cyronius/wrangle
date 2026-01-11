import { registerFileHandlers } from './file-handler'
import { registerWindowHandlers } from './window-handler'

export function registerAllHandlers(): void {
  registerFileHandlers()
  registerWindowHandlers()
}
