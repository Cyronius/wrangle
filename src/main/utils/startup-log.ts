import { homedir } from 'os'
import { join } from 'path'
import { appendFileSync, mkdirSync, statSync, renameSync, existsSync } from 'fs'

const LOG_DIR = join(homedir(), '.wrangle')
const LOG_PATH = join(LOG_DIR, 'startup.log')
const LOG_PATH_PREV = join(LOG_DIR, 'startup.log.old')
const MAX_LOG_BYTES = 256 * 1024

function rotateIfNeeded(): void {
  try {
    if (!existsSync(LOG_PATH)) return
    if (statSync(LOG_PATH).size > MAX_LOG_BYTES) {
      renameSync(LOG_PATH, LOG_PATH_PREV)
    }
  } catch {
    // ignore
  }
}

export function logStartup(message: string, data?: unknown): void {
  try {
    mkdirSync(LOG_DIR, { recursive: true })
    rotateIfNeeded()
    const ts = new Date().toISOString()
    const suffix = data === undefined ? '' : ' ' + safeStringify(data)
    appendFileSync(LOG_PATH, `[${ts}] pid=${process.pid} ${message}${suffix}\n`, 'utf-8')
  } catch {
    // logging must never crash startup
  }
}

function safeStringify(value: unknown): string {
  try {
    if (value instanceof Error) {
      return JSON.stringify({ name: value.name, message: value.message, stack: value.stack })
    }
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}
