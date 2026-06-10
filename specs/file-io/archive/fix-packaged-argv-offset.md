# Plan: Fix Packaged-Build argv Offset So Explorer-Opened Files Load

## Context

Double-clicking a `.md` file in Windows Explorer **launches Wrangle but opens no file**. The `.md` association is already registered and the app starts correctly — the failure is that the file path passed by the OS is never read.

Root cause is in `getFilePathFromArgs` ([src/main/index.ts:25-39](../../../src/main/index.ts)):

```ts
const args = (argv || process.argv).slice(2)
```

Electron's `process.argv` shape differs between builds:

| Build | `process.argv` | File path index |
|-------|----------------|-----------------|
| Unpackaged (dev / e2e tests) | `[electron.exe, main.js, <file>]` | 2 |
| **Packaged (installed app)** | `[Wrangle.exe, <file>]` | **1** |

In a packaged build there is no `main.js` entry, so `slice(2)` discards `argv[1]` — the actual file path. `getFilePathFromArgs` returns `null` and the app opens empty. This affects both first-launch (FIO-007) and second-instance forwarding (FIO-008), since both share this helper.

The bug is also encoded in the spec: FIO-007's Behavior says *"`process.argv.slice(2)` is scanned"*, which is only correct for unpackaged builds.

Note: scanning from index 1 unconditionally is **not** safe — in unpackaged builds `argv[1]` is the built main script (`out/main/index.js`), and `.js` is in `TEXT_EXTENSIONS` and exists on disk, so it would be wrongly opened in dev/tests. The offset must be conditioned on `app.isPackaged`.

## Proposed Changes

### Modified Requirements

- **FIO-007: CLI File Argument Opens On First Launch** — Update the Behavior text: the argv scan offset depends on packaging. Packaged → scan `process.argv.slice(1)`; unpackaged → `slice(2)`. (The existing extension/existence filters are unchanged.)
- **FIO-008** — No wording change needed (it already defers to FIO-007's rules via `getFilePathFromArgs`), but it inherits the fix.

### New Requirements

- None — this is a bug in already-specified behavior.

## Implementation

Rewrite `getFilePathFromArgs` to take the packaging state into account, and make it injectable so the offset logic is unit-testable without a real packaged build:

```ts
export function getFilePathFromArgs(
  argv?: string[],
  isPackaged: boolean = app.isPackaged
): string | null {
  // Packaged:   [exe, <file>, ...]
  // Unpackaged: [electron, mainScript, <file>, ...]
  const args = (argv || process.argv).slice(isPackaged ? 1 : 2)
  for (const arg of args) {
    if (!arg.startsWith('-') && isTextFile(arg) && existsSync(arg)) {
      return arg
    }
  }
  return null
}
```

Update the explanatory comment at [src/main/index.ts:26-29](../../../src/main/index.ts) to document both argv shapes.

The two call sites (`ready-to-show` and `second-instance`) need no change — `app.isPackaged` is read by default.

## Tests

Per doctrine, FIO-007/FIO-008 are Electron-launch behaviors classified **e2e**. But the argv-offset decision is now a pure, injectable function — extract a real **unit** test for it (category split is justified: the parsing logic is genuinely unit-testable, the launch wiring is not):

- **unit** (`specs/file-io/tests/fio-007-argv-offset.test.ts`, Vitest):
  - `getFilePathFromArgs([exe, realFile.md], /*isPackaged*/ true)` → returns `realFile.md`  ← reproduces the bug (currently returns `null`)
  - `getFilePathFromArgs([electron, main.js, realFile.md], false)` → returns `realFile.md`
  - packaged argv with a leading `-flag` then the file → returns the file
  - packaged argv with a non-text path (`image.png`) → returns `null`
  - argv with a nonexistent `.md` path → returns `null`
  - Uses real temp files on disk to satisfy the `existsSync` check.

  Requires extracting `getFilePathFromArgs` as an export. If importing `src/main/index.ts` triggers Electron-only side effects under Vitest, move the helper to a small importable module (e.g. `src/main/utils/cli-args.ts`) that takes `isPackaged` as a parameter and has no `app` import — `index.ts` then passes `app.isPackaged`.

- **e2e**: existing FIO-007/FIO-008 specs continue to pass unchanged (they run unpackaged → `slice(2)` path). They do not exercise the packaged shape, which is why the bug escaped — the new unit test closes that gap.

## Spec Impact

- [ ] FIO-007 Behavior text updated to describe packaging-dependent offset
- [ ] `getFilePathFromArgs` fixed (and possibly extracted to `cli-args.ts`)
- [ ] New unit test added under `specs/file-io/tests/`, referencing FIO-007
- [ ] Plan moved to `specs/file-io/archive/`

## Out of Scope

- File-association *registration* (`fileAssociations` in electron-builder) — already working; the OS launches Wrangle correctly.
- File icon for `.md` — confirmed working.
