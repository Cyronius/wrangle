import * as monaco from 'monaco-editor'

// Map of key names to Monaco key codes
const keyCodeMap: Record<string, monaco.KeyCode> = {
  // Letters
  A: monaco.KeyCode.KeyA,
  B: monaco.KeyCode.KeyB,
  C: monaco.KeyCode.KeyC,
  D: monaco.KeyCode.KeyD,
  E: monaco.KeyCode.KeyE,
  F: monaco.KeyCode.KeyF,
  G: monaco.KeyCode.KeyG,
  H: monaco.KeyCode.KeyH,
  I: monaco.KeyCode.KeyI,
  J: monaco.KeyCode.KeyJ,
  K: monaco.KeyCode.KeyK,
  L: monaco.KeyCode.KeyL,
  M: monaco.KeyCode.KeyM,
  N: monaco.KeyCode.KeyN,
  O: monaco.KeyCode.KeyO,
  P: monaco.KeyCode.KeyP,
  Q: monaco.KeyCode.KeyQ,
  R: monaco.KeyCode.KeyR,
  S: monaco.KeyCode.KeyS,
  T: monaco.KeyCode.KeyT,
  U: monaco.KeyCode.KeyU,
  V: monaco.KeyCode.KeyV,
  W: monaco.KeyCode.KeyW,
  X: monaco.KeyCode.KeyX,
  Y: monaco.KeyCode.KeyY,
  Z: monaco.KeyCode.KeyZ,

  // Numbers
  '0': monaco.KeyCode.Digit0,
  '1': monaco.KeyCode.Digit1,
  '2': monaco.KeyCode.Digit2,
  '3': monaco.KeyCode.Digit3,
  '4': monaco.KeyCode.Digit4,
  '5': monaco.KeyCode.Digit5,
  '6': monaco.KeyCode.Digit6,
  '7': monaco.KeyCode.Digit7,
  '8': monaco.KeyCode.Digit8,
  '9': monaco.KeyCode.Digit9,

  // Function keys
  F1: monaco.KeyCode.F1,
  F2: monaco.KeyCode.F2,
  F3: monaco.KeyCode.F3,
  F4: monaco.KeyCode.F4,
  F5: monaco.KeyCode.F5,
  F6: monaco.KeyCode.F6,
  F7: monaco.KeyCode.F7,
  F8: monaco.KeyCode.F8,
  F9: monaco.KeyCode.F9,
  F10: monaco.KeyCode.F10,
  F11: monaco.KeyCode.F11,
  F12: monaco.KeyCode.F12,

  // Special keys
  Enter: monaco.KeyCode.Enter,
  Tab: monaco.KeyCode.Tab,
  Space: monaco.KeyCode.Space,
  Backspace: monaco.KeyCode.Backspace,
  Delete: monaco.KeyCode.Delete,
  Escape: monaco.KeyCode.Escape,
  Esc: monaco.KeyCode.Escape,

  // Arrow keys
  Up: monaco.KeyCode.UpArrow,
  Down: monaco.KeyCode.DownArrow,
  Left: monaco.KeyCode.LeftArrow,
  Right: monaco.KeyCode.RightArrow,
  ArrowUp: monaco.KeyCode.UpArrow,
  ArrowDown: monaco.KeyCode.DownArrow,
  ArrowLeft: monaco.KeyCode.LeftArrow,
  ArrowRight: monaco.KeyCode.RightArrow,

  // Navigation keys
  Home: monaco.KeyCode.Home,
  End: monaco.KeyCode.End,
  PageUp: monaco.KeyCode.PageUp,
  PageDown: monaco.KeyCode.PageDown,
  Insert: monaco.KeyCode.Insert,

  // Punctuation
  ',': monaco.KeyCode.Comma,
  '.': monaco.KeyCode.Period,
  '/': monaco.KeyCode.Slash,
  ';': monaco.KeyCode.Semicolon,
  "'": monaco.KeyCode.Quote,
  '[': monaco.KeyCode.BracketLeft,
  ']': monaco.KeyCode.BracketRight,
  '\\': monaco.KeyCode.Backslash,
  '`': monaco.KeyCode.Backquote,
  '-': monaco.KeyCode.Minus,
  '=': monaco.KeyCode.Equal,

  // Named punctuation
  Comma: monaco.KeyCode.Comma,
  Period: monaco.KeyCode.Period,
  Slash: monaco.KeyCode.Slash,
  Semicolon: monaco.KeyCode.Semicolon,
  Quote: monaco.KeyCode.Quote,
  BracketLeft: monaco.KeyCode.BracketLeft,
  BracketRight: monaco.KeyCode.BracketRight,
  Backslash: monaco.KeyCode.Backslash,
  Backquote: monaco.KeyCode.Backquote,
  Minus: monaco.KeyCode.Minus,
  Equal: monaco.KeyCode.Equal,
  Plus: monaco.KeyCode.Equal // '+' is typically Shift+=
}

// Reverse map for display
const keyCodeToString: Record<number, string> = {}
for (const [key, code] of Object.entries(keyCodeMap)) {
  // Prefer shorter/simpler names
  if (!keyCodeToString[code] || key.length < keyCodeToString[code].length) {
    keyCodeToString[code] = key
  }
}

/**
 * Parse a shortcut string like "Ctrl+Shift+B" into a Monaco keybinding number
 */
export function parseShortcutToMonaco(shortcut: string): number | null {
  if (!shortcut) return null

  const parts = shortcut.split('+')
  let keyCode: monaco.KeyCode | null = null
  let modifiers = 0

  for (const part of parts) {
    const normalizedPart = part.trim()
    const upperPart = normalizedPart.toUpperCase()

    // Check for modifiers
    if (upperPart === 'CTRL' || upperPart === 'CONTROL') {
      modifiers |= monaco.KeyMod.CtrlCmd
    } else if (upperPart === 'SHIFT') {
      modifiers |= monaco.KeyMod.Shift
    } else if (upperPart === 'ALT') {
      modifiers |= monaco.KeyMod.Alt
    } else if (upperPart === 'META' || upperPart === 'CMD' || upperPart === 'WIN') {
      modifiers |= monaco.KeyMod.WinCtrl
    } else {
      // Try to find the key code
      // First try exact match
      keyCode = keyCodeMap[normalizedPart] ?? null
      // Then try uppercase
      if (!keyCode) {
        keyCode = keyCodeMap[upperPart] ?? null
      }
      // Then try single letter uppercase
      if (!keyCode && normalizedPart.length === 1) {
        keyCode = keyCodeMap[normalizedPart.toUpperCase()] ?? null
      }
    }
  }

  if (!keyCode) {
    return null
  }

  return modifiers | keyCode
}

/**
 * Format a keyboard event into a shortcut string like "Ctrl+Shift+B"
 */
export function formatKeyboardEvent(event: KeyboardEvent): string {
  const parts: string[] = []

  if (event.ctrlKey || event.metaKey) {
    parts.push('Ctrl')
  }
  if (event.shiftKey) {
    parts.push('Shift')
  }
  if (event.altKey) {
    parts.push('Alt')
  }

  // Get the key
  let key = event.key

  // Normalize some key names
  if (key === ' ') key = 'Space'
  if (key === 'Control' || key === 'Shift' || key === 'Alt' || key === 'Meta') {
    // Don't include standalone modifier keys
    return parts.join('+')
  }

  // Handle special keys
  if (key.length === 1) {
    key = key.toUpperCase()
  }

  parts.push(key)

  return parts.join('+')
}

/**
 * Format a Monaco keybinding number into a display string
 */
export function formatMonacoKeybinding(keybinding: number): string {
  const parts: string[] = []

  if (keybinding & monaco.KeyMod.CtrlCmd) {
    parts.push('Ctrl')
  }
  if (keybinding & monaco.KeyMod.Shift) {
    parts.push('Shift')
  }
  if (keybinding & monaco.KeyMod.Alt) {
    parts.push('Alt')
  }
  if (keybinding & monaco.KeyMod.WinCtrl) {
    parts.push('Win')
  }

  // Extract key code (lower 8 bits)
  const keyCode = keybinding & 0xff
  const keyName = keyCodeToString[keyCode]

  if (keyName) {
    parts.push(keyName)
  }

  return parts.join('+')
}

/**
 * Check if a keyboard event matches a shortcut string
 */
export function matchesShortcut(event: KeyboardEvent, shortcut: string): boolean {
  if (!shortcut) return false

  const eventShortcut = formatKeyboardEvent(event)
  return eventShortcut.toLowerCase() === shortcut.toLowerCase()
}

/**
 * Find conflicts between a shortcut and existing bindings
 * Returns the command IDs that conflict
 */
export function findConflicts(
  shortcut: string,
  bindings: Record<string, string | null>,
  excludeCommandId?: string
): string[] {
  if (!shortcut) return []

  const normalizedShortcut = shortcut.toLowerCase()
  const conflicts: string[] = []

  for (const [commandId, binding] of Object.entries(bindings)) {
    if (commandId === excludeCommandId) continue
    if (binding && binding.toLowerCase() === normalizedShortcut) {
      conflicts.push(commandId)
    }
  }

  return conflicts
}

/**
 * Check if a shortcut is valid (has at least a modifier for non-function keys)
 */
export function isValidShortcut(shortcut: string): boolean {
  if (!shortcut) return false

  const parts = shortcut.split('+')
  const hasModifier = parts.some(
    (p) =>
      p.toUpperCase() === 'CTRL' ||
      p.toUpperCase() === 'SHIFT' ||
      p.toUpperCase() === 'ALT' ||
      p.toUpperCase() === 'META'
  )

  // Check if it's a function key
  const isFunctionKey = parts.some((p) => /^F\d{1,2}$/i.test(p))

  // Function keys don't need modifiers
  if (isFunctionKey) return true

  // All other keys need at least one modifier
  return hasModifier
}

/**
 * Normalize a shortcut string for consistent display and comparison
 */
export function normalizeShortcut(shortcut: string): string {
  if (!shortcut) return ''

  const parts = shortcut.split('+').map((p) => p.trim())
  const modifiers: string[] = []
  let key = ''

  for (const part of parts) {
    const upper = part.toUpperCase()
    if (upper === 'CTRL' || upper === 'CONTROL') {
      modifiers.push('Ctrl')
    } else if (upper === 'SHIFT') {
      modifiers.push('Shift')
    } else if (upper === 'ALT') {
      modifiers.push('Alt')
    } else if (upper === 'META' || upper === 'CMD' || upper === 'WIN') {
      modifiers.push('Meta')
    } else {
      // Normalize key name
      if (part.length === 1) {
        key = part.toUpperCase()
      } else {
        key = part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()
      }
    }
  }

  // Sort modifiers in standard order: Ctrl, Shift, Alt, Meta
  const order = ['Ctrl', 'Shift', 'Alt', 'Meta']
  modifiers.sort((a, b) => order.indexOf(a) - order.indexOf(b))

  if (key) {
    modifiers.push(key)
  }

  return modifiers.join('+')
}
