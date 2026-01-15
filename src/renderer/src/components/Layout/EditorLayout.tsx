import { useEffect, useRef } from 'react'
import { Allotment } from 'allotment'
import { MonacoEditor } from '../Editor/MonacoEditor'
import { WysiwygEditor } from '../Editor/WysiwygEditor'
import { useSelector, useDispatch } from 'react-redux'
import { RootState } from '../../store/store'
import { setSplitRatio } from '../../store/layoutSlice'
import * as monaco from 'monaco-editor'
import 'allotment/dist/style.css'

interface EditorLayoutProps {
  content: string
  onChange: (value: string | undefined) => void
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
  theme = 'vs-dark',
  editorRef
}: EditorLayoutProps) {
  const dispatch = useDispatch()
  const { viewMode, splitRatio, zoomLevel } = useSelector((state: RootState) => state.layout)

  // Calculate zoomed font size for editor
  const fontSize = getZoomedFontSize(zoomLevel)

  // Track if we're programmatically scrolling to prevent feedback loops
  const isScrollingSyncRef = useRef(false)

  // Scroll sync: Monaco editor -> WYSIWYG editor
  useEffect(() => {
    if (viewMode !== 'split' || !editorRef?.current) return

    const editor = editorRef.current
    const disposable = editor.onDidScrollChange(() => {
      if (isScrollingSyncRef.current) return

      const scrollTop = editor.getScrollTop()
      const scrollHeight = editor.getScrollHeight()
      const clientHeight = editor.getLayoutInfo().height
      const maxScroll = scrollHeight - clientHeight
      const ratio = maxScroll > 0 ? scrollTop / maxScroll : 0

      // Apply to WYSIWYG container
      const wysiwygContainer = document.querySelector('.mdxeditor-root-contenteditable')
      if (wysiwygContainer) {
        isScrollingSyncRef.current = true
        const wysiwygMaxScroll = wysiwygContainer.scrollHeight - wysiwygContainer.clientHeight
        wysiwygContainer.scrollTop = wysiwygMaxScroll * ratio
        setTimeout(() => {
          isScrollingSyncRef.current = false
        }, 50)
      }
    })

    return () => disposable.dispose()
  }, [viewMode, editorRef])

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
        <MonacoEditor ref={editorRef} value={content} onChange={onChange} theme={theme} fontSize={fontSize} />
      </div>
    )
  }

  if (viewMode === 'preview-only') {
    return (
      <div style={{ height: '100%', width: '100%' }}>
        <WysiwygEditor
          value={content}
          onChange={(val) => onChange(val)}
          theme={theme === 'vs-dark' ? 'dark' : 'light'}
        />
      </div>
    )
  }

  // Split view: Monaco (raw markdown) on left, WysiwygEditor (rich text) on right
  const editorSize = splitRatio * 100
  const wysiwygSize = (1 - splitRatio) * 100

  return (
    <div style={{ height: '100%', width: '100%', position: 'relative' }}>
      <Allotment
        onChange={handleSplitChange}
        defaultSizes={[editorSize, wysiwygSize]}
      >
        <Allotment.Pane minSize={200}>
          <MonacoEditor ref={editorRef} value={content} onChange={onChange} theme={theme} fontSize={fontSize} />
        </Allotment.Pane>
        <Allotment.Pane minSize={200}>
          <WysiwygEditor
            value={content}
            onChange={(val) => onChange(val)}
            theme={theme === 'vs-dark' ? 'dark' : 'light'}
          />
        </Allotment.Pane>
      </Allotment>
    </div>
  )
}
