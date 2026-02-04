declare module 'monaco-vim' {
  import * as monaco from 'monaco-editor'

  export interface VimModeInstance {
    dispose: () => void
  }

  export function initVimMode(
    editor: monaco.editor.IStandaloneCodeEditor,
    statusBarNode?: HTMLElement | null
  ): VimModeInstance

  export namespace VimMode {
    namespace Vim {
      function defineEx(
        name: string,
        shorthand: string,
        callback: (cm: unknown, params: { args?: string[]; argString?: string }) => void
      ): void

      function map(lhs: string, rhs: string, context?: string): void

      function unmap(lhs: string, context?: string): void

      function noremap(lhs: string, rhs: string, context?: string): void
    }
  }
}
