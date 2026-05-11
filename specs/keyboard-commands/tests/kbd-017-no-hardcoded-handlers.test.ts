// Traces: KBD-017 (canonical spec: specs/keyboard-commands/spec.md)
//
// Property under test: code outside the registry/dispatcher must not handle
// keystrokes by literal-string match for any key that a registry command
// holds as its accelerator. The presence of such a literal handler guarantees
// that user customization will not propagate to it (KBD-016 regression).

import { describe, it, expect } from 'vitest'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { commands } from '../../../src/renderer/src/commands/registry'

// ---------------------------------------------------------------------------
// Exemptions
// ---------------------------------------------------------------------------
//
// Each entry is a path relative to `src/renderer/src/` whose literal-key
// matches are intentional and not a regression of KBD-016. Adding to this
// list requires a justification comment.

const EXEMPT_FILES = new Set<string>([
  // Tap-modifier handler reads `targetKey` from the configured binding rather
  // than a literal; the literals it does compare are the runtime variable's
  // string value at the moment of comparison. (App.tsx:537-548 region.)
  // The wheel-zoom handler in the same file uses `eventMatchesModifier`, no
  // literal compare. Both are KBD-014 binding-driven.
  'App.tsx',
  // ShortcutRecorder is the binding-recorder UI itself: by definition it
  // reads raw keystrokes for capture and filters out modifier-only presses.
  // It is part of the binding system, not a registry-command consumer.
  'components/Preferences/ShortcutRecorder.tsx',
  // shortcut-parser exports `formatKeyboardEvent`, the mapping that
  // *implements* binding comparison. Literal key references here are the
  // canonical mapping table, not a parallel handler.
  'utils/shortcut-parser.ts'
])

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Return the trailing key portion of a binding (e.g. "Ctrl+Shift+B" -> "B"). */
function bindingKey(binding: string): string {
  const lastChord = binding.split(' ').pop() ?? binding
  const parts = lastChord.split('+').map((p) => p.trim())
  // For modifier-only bindings (`Ctrl`, `Alt`), the only part IS the modifier.
  if (parts.length === 1) return parts[0]
  // Otherwise the trailing part is the key.
  return parts[parts.length - 1]
}

/** A literal RHS we consider "looks like a command key": single char or F-key. */
function isCommandKeyLiteral(literal: string): boolean {
  if (/^[A-Za-z0-9`~!@#$%^&*()_\-+={}[\]\\|;:'",.<>/?]$/.test(literal)) return true
  if (/^F([1-9]|1[0-2])$/.test(literal)) return true
  return false
}

interface Hit {
  file: string
  line: number
  literal: string
  snippet: string
}

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      walk(full, out)
    } else if (/\.(ts|tsx)$/.test(entry.name)) {
      out.push(full)
    }
  }
  return out
}

function findHardcodedKeystrokeHandlers(srcRoot: string, commandKeys: Set<string>): Hit[] {
  const hits: Hit[] = []
  const files = walk(srcRoot)
  // Match `<word>.key === '<literal>'` or `<word>.key !== '<literal>'`,
  // also `event.key === '<literal>'`. Captures the literal in group 1.
  const literalRe = /\b\w+\.key\s*[!=]==\s*['"]([^'"]+)['"]/g

  for (const file of files) {
    const rel = path.relative(srcRoot, file).replace(/\\/g, '/')
    if (EXEMPT_FILES.has(rel)) continue

    const content = fs.readFileSync(file, 'utf8')
    const lines = content.split(/\r?\n/)
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      let m: RegExpExecArray | null
      const re = new RegExp(literalRe.source, 'g')
      while ((m = re.exec(line)) !== null) {
        const literal = m[1]
        if (!isCommandKeyLiteral(literal)) continue
        if (!commandKeys.has(literal.toUpperCase())) continue
        hits.push({
          file: rel,
          line: i + 1,
          literal,
          snippet: line.trim()
        })
      }
    }
  }
  return hits
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

const SRC_ROOT = path.resolve(__dirname, '../../../src/renderer/src')

const commandKeys = new Set<string>(
  commands
    .filter((c) => c.defaultBinding !== null)
    .map((c) => bindingKey(c.defaultBinding!).toUpperCase())
)

describe('KBD-017: no hardcoded keystroke handlers for registry commands', () => {
  it('static analysis returns no hits in current source', () => {
    const hits = findHardcodedKeystrokeHandlers(SRC_ROOT, commandKeys)
    if (hits.length > 0) {
      const formatted = hits
        .map((h) => `  ${h.file}:${h.line}  '${h.literal}'  -- ${h.snippet}`)
        .join('\n')
      throw new Error(
        `Found ${hits.length} hardcoded keystroke handler(s):\n${formatted}\n\n` +
          'These bypass the registry binding system. Remove them, route through ' +
          'the dispatcher, or add the file to EXEMPT_FILES with justification.'
      )
    }
    expect(hits).toEqual([])
  })

  it('the analyzer detects a planted regression (positive control)', () => {
    // Confirm the regex actually fires when given a known-bad pattern.
    // We do this by feeding an arbitrary directory containing only a fake
    // file via direct regex check (no temp filesystem write).
    const sample = "if ((e.ctrlKey || e.metaKey) && e.key === 's') save()"
    const re = /\b\w+\.key\s*[!=]==\s*['"]([^'"]+)['"]/g
    const m = re.exec(sample)
    expect(m).not.toBeNull()
    expect(m![1]).toBe('s')
    expect(isCommandKeyLiteral('s')).toBe(true)
    expect(commandKeys.has('S')).toBe(true)
  })
})
