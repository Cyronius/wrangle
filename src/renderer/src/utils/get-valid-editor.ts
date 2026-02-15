import * as monaco from 'monaco-editor'

/** Get a valid (has model) editor instance, preferring the ref but falling back to monaco.editor.getEditors() */
export function getValidEditor(
  editorRef: React.RefObject<monaco.editor.IStandaloneCodeEditor | null>
): monaco.editor.IStandaloneCodeEditor | null {
  const refEditor = editorRef.current
  if (refEditor && refEditor.getModel()) return refEditor

  // Fallback: find the focused or first valid editor from Monaco's registry
  const allEditors = monaco.editor.getEditors()
  const focused = allEditors.find(e => e.hasTextFocus() && e.getModel())
  if (focused) return focused
  const withModel = allEditors.find(e => !!e.getModel())
  return withModel || null
}
