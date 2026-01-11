import { Allotment } from 'allotment'
import { MonacoEditor } from '../Editor/MonacoEditor'
import { MarkdownPreview } from '../Preview/MarkdownPreview'
import { useSelector, useDispatch } from 'react-redux'
import { RootState } from '../../store/store'
import { setSplitRatio } from '../../store/layoutSlice'
import 'allotment/dist/style.css'

interface EditorLayoutProps {
  content: string
  onChange: (value: string | undefined) => void
  baseDir?: string | null
  theme?: 'vs-dark' | 'vs'
  editorRef?: React.MutableRefObject<any>
}

export function EditorLayout({
  content,
  onChange,
  baseDir = null,
  theme = 'vs-dark',
  editorRef
}: EditorLayoutProps) {
  const dispatch = useDispatch()
  const { viewMode, splitRatio, previewSync } = useSelector((state: RootState) => state.layout)

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

  // Render based on view mode
  if (viewMode === 'editor-only') {
    return (
      <div style={{ height: '100%', width: '100%' }}>
        <MonacoEditor ref={editorRef} value={content} onChange={onChange} theme={theme} />
      </div>
    )
  }

  if (viewMode === 'preview-only') {
    return (
      <div style={{ height: '100%', width: '100%' }}>
        <MarkdownPreview content={content} baseDir={baseDir} syncScroll={false} />
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
        <MonacoEditor ref={editorRef} value={content} onChange={onChange} theme={theme} />
      </Allotment.Pane>
      <Allotment.Pane minSize={200}>
        <MarkdownPreview content={content} baseDir={baseDir} syncScroll={previewSync} />
      </Allotment.Pane>
    </Allotment>
  )
}
