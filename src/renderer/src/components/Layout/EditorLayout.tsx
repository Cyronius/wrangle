import { Allotment } from 'allotment'
import { MonacoEditor } from '../Editor/MonacoEditor'
import { MarkdownPreview } from '../Preview/MarkdownPreview'
import { SourceRange } from '../../utils/source-map'
import { useSelector, useDispatch } from 'react-redux'
import { RootState } from '../../store/store'
import { setSplitRatio } from '../../store/layoutSlice'
import * as monaco from 'monaco-editor'
import 'allotment/dist/style.css'

interface EditorLayoutProps {
  content: string
  onChange: (value: string | undefined) => void
  baseDir?: string | null
  theme?: 'vs-dark' | 'vs'
  editorRef?: React.MutableRefObject<monaco.editor.IStandaloneCodeEditor | null>
}

// Calculate font size based on zoom level (base 14px, 10% per level)
function getZoomedFontSize(zoomLevel: number): number {
  return Math.round(14 * Math.pow(1.1, zoomLevel))
}

export function EditorLayout({
  content,
  onChange,
  baseDir = null,
  theme = 'vs-dark',
  editorRef
}: EditorLayoutProps) {
  const dispatch = useDispatch()
  const { viewMode, splitRatio, previewSync, zoomLevel } = useSelector((state: RootState) => state.layout)

  // Calculate zoomed font size for editor
  const fontSize = getZoomedFontSize(zoomLevel)

  const handleSplitChange = (sizes: number[]) => {
    if (sizes.length === 2) {
      // Convert pixel sizes to ratio (0-1)
      const total = sizes[0] + sizes[1]
      const ratio = sizes[0] / total
      // Clamp ratio between 0.2 and 0.8
      const clampedRatio = Math.max(0.2, Math.min(0.8, ratio))
      dispatch(setSplitRatio(clampedRatio))
    }
  }

  // Handle preview selection - select corresponding text in editor
  const handlePreviewSourceSelect = (range: SourceRange) => {
    if (!editorRef?.current) return

    const editor = editorRef.current
    const model = editor.getModel()
    if (!model) return

    // Convert character offsets to Monaco positions
    const startPos = model.getPositionAt(range.start)
    const endPos = model.getPositionAt(range.end)

    // Set selection in editor
    editor.setSelection(new monaco.Selection(
      startPos.lineNumber,
      startPos.column,
      endPos.lineNumber,
      endPos.column
    ))

    // Focus the editor
    editor.focus()
  }

  // Render based on view mode
  if (viewMode === 'editor-only') {
    return (
      <div style={{ height: '100%', width: '100%' }}>
        <MonacoEditor ref={editorRef} value={content} onChange={onChange} theme={theme} fontSize={fontSize} />
      </div>
    )
  }

  if (viewMode === 'preview-only') {
    return (
      <div style={{ height: '100%', width: '100%' }}>
        <MarkdownPreview
          content={content}
          baseDir={baseDir}
          syncScroll={false}
          onSourceSelect={handlePreviewSourceSelect}
          zoomLevel={zoomLevel}
        />
      </div>
    )
  }

  // Split view
  const editorSize = splitRatio * 100
  const previewSize = (1 - splitRatio) * 100

  return (
    <Allotment
      onChange={handleSplitChange}
      defaultSizes={[editorSize, previewSize]}
    >
      <Allotment.Pane minSize={200}>
        <MonacoEditor ref={editorRef} value={content} onChange={onChange} theme={theme} fontSize={fontSize} />
      </Allotment.Pane>
      <Allotment.Pane minSize={200}>
        <MarkdownPreview
          content={content}
          baseDir={baseDir}
          syncScroll={previewSync}
          onSourceSelect={handlePreviewSourceSelect}
          zoomLevel={zoomLevel}
        />
      </Allotment.Pane>
    </Allotment>
  )
}
