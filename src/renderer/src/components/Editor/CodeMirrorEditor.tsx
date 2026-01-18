import { useEffect, useRef, useImperativeHandle, forwardRef } from 'react'
import { EditorState } from '@codemirror/state'
import { EditorView, ViewPlugin, ViewUpdate } from '@codemirror/view'
import { markdown } from '@codemirror/lang-markdown'
import { basicSetup } from 'codemirror'

// Simple dark theme
const darkTheme = EditorView.theme({
  '&': {
    backgroundColor: '#1e1e1e',
    color: '#d4d4d4'
  },
  '.cm-content': {
    caretColor: '#aeafad'
  },
  '.cm-cursor, .cm-dropCursor': {
    borderLeftColor: '#aeafad'
  },
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection': {
    backgroundColor: '#264f78'
  },
  '.cm-gutters': {
    backgroundColor: '#1e1e1e',
    color: '#858585',
    border: 'none'
  },
  '.cm-activeLineGutter': {
    backgroundColor: '#2c2c2c'
  },
  '.cm-activeLine': {
    backgroundColor: '#2c2c2c'
  }
}, { dark: true })

interface CodeMirrorEditorProps {
  value: string
  onChange?: (value: string) => void
  onCursorChange?: (offset: number) => void
  onScroll?: (offset: number) => void
}

export interface CodeMirrorEditorHandle {
  revealOffset: (offset: number) => void
  setCursor: (offset: number) => void
  getView: () => EditorView | null
}

export const CodeMirrorEditor = forwardRef<CodeMirrorEditorHandle, CodeMirrorEditorProps>(
  ({ value, onChange, onCursorChange, onScroll }, ref) => {
    const containerRef = useRef<HTMLDivElement>(null)
    const viewRef = useRef<EditorView | null>(null)
    const callbacksRef = useRef({ onChange, onCursorChange, onScroll })

    // Keep callbacks ref updated to avoid stale closures
    callbacksRef.current = { onChange, onCursorChange, onScroll }

    useEffect(() => {
      if (!containerRef.current) return

      // Scroll sync plugin - reports first visible character offset
      const scrollPlugin = ViewPlugin.fromClass(
        class {
          update(update: ViewUpdate) {
            if (update.viewportChanged) {
              const offset = update.view.viewport.from
              callbacksRef.current.onScroll?.(offset)
            }
          }
        }
      )

      // Create editor state
      const state = EditorState.create({
        doc: value,
        extensions: [
          basicSetup,
          markdown(),
          darkTheme,
          scrollPlugin,
          EditorView.updateListener.of((update) => {
            // Content changes
            if (update.docChanged) {
              callbacksRef.current.onChange?.(update.state.doc.toString())
            }
            // Cursor changes
            if (update.selectionSet) {
              const offset = update.state.selection.main.head
              callbacksRef.current.onCursorChange?.(offset)
            }
          }),
          // Make editor fill container
          EditorView.theme({
            '&': { height: '100%' },
            '.cm-scroller': { overflow: 'auto' }
          })
        ]
      })

      const view = new EditorView({
        state,
        parent: containerRef.current
      })

      viewRef.current = view

      // Expose for E2E testing
      if (typeof window !== 'undefined') {
        ;(window as any).__codeMirrorView = view
      }

      return () => {
        view.destroy()
        // Clean up E2E testing exposure
        if (typeof window !== 'undefined') {
          delete (window as any).__codeMirrorView
        }
      }
    }, [])

    // Sync external value changes (e.g., when switching tabs)
    useEffect(() => {
      const view = viewRef.current
      if (!view) return

      const currentValue = view.state.doc.toString()
      if (value !== currentValue) {
        view.dispatch({
          changes: { from: 0, to: currentValue.length, insert: value }
        })
      }
    }, [value])

    useImperativeHandle(ref, () => ({
      revealOffset: (offset: number) => {
        const view = viewRef.current
        if (!view) return
        // Clamp offset to valid range
        const clampedOffset = Math.max(0, Math.min(offset, view.state.doc.length))
        view.dispatch({
          effects: EditorView.scrollIntoView(clampedOffset, { y: 'center' })
        })
      },
      setCursor: (offset: number) => {
        const view = viewRef.current
        if (!view) return
        // Clamp offset to valid range
        const clampedOffset = Math.max(0, Math.min(offset, view.state.doc.length))
        // Focus the editor so keyboard input works
        view.focus()
        view.dispatch({
          selection: { anchor: clampedOffset, head: clampedOffset }
        })
      },
      getView: () => viewRef.current
    }))

    return <div ref={containerRef} style={{ height: '100%', overflow: 'hidden' }} />
  }
)
