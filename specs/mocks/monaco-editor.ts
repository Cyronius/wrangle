// Minimal stub of `monaco-editor` for unit tests. Real monaco cannot be loaded
// in jsdom (it expects browser globals it doesn't get). The renderer code that
// imports monaco only needs:
//   - KeyCode / KeyMod numeric enums (used by shortcut-parser at module load)
//   - Position / Range / Selection classes (used inside command execute fns)
//   - editor.IStandaloneCodeEditor type (erased at runtime)
// Any test that drives a real Monaco editor needs a different harness.

const keyCodeNames = [
  'KeyA','KeyB','KeyC','KeyD','KeyE','KeyF','KeyG','KeyH','KeyI','KeyJ',
  'KeyK','KeyL','KeyM','KeyN','KeyO','KeyP','KeyQ','KeyR','KeyS','KeyT',
  'KeyU','KeyV','KeyW','KeyX','KeyY','KeyZ',
  'Digit0','Digit1','Digit2','Digit3','Digit4','Digit5','Digit6','Digit7','Digit8','Digit9',
  'F1','F2','F3','F4','F5','F6','F7','F8','F9','F10','F11','F12',
  'Enter','Tab','Space','Backspace','Delete','Escape',
  'UpArrow','DownArrow','LeftArrow','RightArrow',
  'Home','End','PageUp','PageDown','Insert',
  'Comma','Period','Slash','Semicolon','Quote',
  'BracketLeft','BracketRight','Backslash','Backquote','Minus','Equal'
] as const

const KeyCode: Record<string, number> = {}
keyCodeNames.forEach((name, i) => { KeyCode[name] = i + 1 })

const KeyMod = {
  CtrlCmd: 1 << 11,
  Shift: 1 << 10,
  Alt: 1 << 9,
  WinCtrl: 1 << 8
}

export class Position {
  constructor(public lineNumber: number, public column: number) {}
}

export class Range {
  constructor(
    public startLineNumber: number,
    public startColumn: number,
    public endLineNumber: number,
    public endColumn: number
  ) {}
}

export class Selection extends Range {}

export const editor = {}

export { KeyCode, KeyMod }

export default { KeyCode, KeyMod, Position, Range, Selection, editor }
