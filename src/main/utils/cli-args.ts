import { existsSync } from 'fs'
import { isTextFile } from '../../shared/file-extensions'

/**
 * Find the first openable file path in a process argv array.
 *
 * Electron's argv shape depends on whether the app is packaged:
 *   - Packaged (installed app):   [exe, <file>, ...customArgs]
 *   - Unpackaged (dev / e2e):     [electron, mainScript, <file>, ...customArgs]
 *
 * The leading entries (the executable, and in unpackaged builds the main
 * script) are not user-supplied file arguments, so they are sliced off. Getting
 * this offset wrong drops the file path the OS passes when a file is opened from
 * the file manager (FIO-007 / FIO-008).
 *
 * A candidate is accepted when it (a) is not a flag, (b) has a known text
 * extension, and (c) exists on disk.
 */
export function getFilePathFromArgs(argv: string[], isPackaged: boolean): string | null {
  const args = argv.slice(isPackaged ? 1 : 2)

  for (const arg of args) {
    if (!arg.startsWith('-') && isTextFile(arg) && existsSync(arg)) {
      return arg
    }
  }
  return null
}
