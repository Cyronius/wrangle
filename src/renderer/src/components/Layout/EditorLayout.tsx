import { useState, useCallback, useRef } from 'react'
import { Allotment } from 'allotment'
import { MonacoEditor } from '../Editor/MonacoEditor'
import { MarkdownPreview, MarkdownPreviewHandle } from '../Preview/MarkdownPreview'
import { SyncLockIcon } from './SyncLockIcon'
import { SourceRange, SourceMap } from '../../utils/source-map'
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

  // State for bidirectional sync
  const [sourceMap, setSourceMap] = useState<SourceMap | null>(null)
  const [highlightSourceId, setHighlightSourceId] = useState<string | null>(null)

  // Refs for scroll synchronization
  const previewRef = useRef<MarkdownPreviewHandle>(null)
  const isEditorScrollingRef = useRef(false)
  const isPreviewScrollingRef = useRef(false)
  const sourceMapRef = useRef<SourceMap | null>(null)
  const previewSyncRef = useRef(previewSync)

  // Keep refs in sync with state (avoids stale closures in callbacks captured by Monaco)
  sourceMapRef.current = sourceMap
  previewSyncRef.current = previewSync

  // Calculate zoomed font size for editor
  const fontSize = getZoomedFontSize(zoomLevel)

  // Handle cursor position changes in editor - highlight corresponding preview element
  const handleCursorChange = useCallback((offset: number) => {
    if (!sourceMap) {
      setHighlightSourceId(null)
      return
    }
    const elementId = sourceMap.findElementByOffset(offset)
    setHighlightSourceId(elementId)
  }, [sourceMap])

  // Store sourceMap when preview renders
  const handleSourceMapReady = useCallback((map: SourceMap) => {
    console.log('[EditorLayout] sourceMap ready, size:', map.size)
    setSourceMap(map)
  }, [])

  // Handle editor scroll - sync to preview using source map
  // Use refs to avoid stale closure issues - this callback is captured by Monaco on mount
  const handleEditorScroll = useCallback((offset: number) => {
    console.log('[EditorLayout] handleEditorScroll called with offset:', offset)
    console.log('[EditorLayout] previewSyncRef:', previewSyncRef.current, 'isPreviewScrolling:', isPreviewScrollingRef.current, 'sourceMap:', !!sourceMapRef.current, 'sourceMapSize:', sourceMapRef.current?.size)
    if (!previewSyncRef.current || isPreviewScrollingRef.current || !sourceMapRef.current) return

    // Find the element corresponding to this source offset
    const elementId = sourceMapRef.current.findElementByOffset(offset)
    console.log('[EditorLayout] found elementId:', elementId, 'for offset:', offset)

    // Debug: show all entries to see what offsets exist
    if (!elementId && sourceMapRef.current.size > 0) {
      console.log('[EditorLayout] DEBUG: sourceMap entries:')
      sourceMapRef.current.getAllEntries().forEach((entry, id) => {
        console.log(`  ${id}: ${entry.type} [${entry.sourceRange.start}-${entry.sourceRange.end}]`)
      })
    }
    if (!elementId) return

    isEditorScrollingRef.current = true
    console.log('[EditorLayout] calling scrollToSourceId with:', elementId)
    previewRef.current?.scrollToSourceId(elementId)

    setTimeout(() => {
      isEditorScrollingRef.current = false
    }, 100)
  }, [])

  // Handle preview scroll - sync to editor using source map
  const handlePreviewScroll = useCallback((sourceId: string | null) => {
    if (!previewSync || isEditorScrollingRef.current) return
    if (!editorRef?.current || !sourceMap || !sourceId) return

    // Get the source range for this element
    const range = sourceMap.getRange(sourceId)
    if (!range) return

    isPreviewScrollingRef.current = true
    const editor = editorRef.current
    const model = editor.getModel()
    if (model) {
      // Convert character offset to line number
      const position = model.getPositionAt(range.start)
      editor.revealLineInCenter(position.lineNumber)
    }

    setTimeout(() => {
      isPreviewScrollingRef.current = false
    }, 100)
  }, [previewSync, sourceMap, editorRef])

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

    // Only focus editor in split/editor-only mode, not preview-only
    // This allows WYSIWYG editing: select in preview, use toolbar, stay in preview
    if (viewMode !== 'preview-only') {
      editor.focus()
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
      <div style={{ height: '100%', width: '100%', position: 'relative' }}>
        {/* Hidden editor - keeps editorRef valid for WYSIWYG toolbar commands */}
        <div style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', opacity: 0, pointerEvents: 'none' }}>
          <MonacoEditor ref={editorRef} value={content} onChange={onChange} theme={theme} fontSize={fontSize} />
        </div>
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
    <div style={{ height: '100%', width: '100%', position: 'relative' }}>
      <Allotment
        onChange={handleSplitChange}
        defaultSizes={[editorSize, previewSize]}
      >
        <Allotment.Pane minSize={200}>
          <MonacoEditor
            ref={editorRef}
            value={content}
            onChange={onChange}
            theme={theme}
            fontSize={fontSize}
            onCursorChange={handleCursorChange}
            onScroll={handleEditorScroll}
          />
        </Allotment.Pane>
        <Allotment.Pane minSize={200}>
          <MarkdownPreview
            ref={previewRef}
            content={content}
            baseDir={baseDir}
            syncScroll={previewSync}
            onScroll={handlePreviewScroll}
            onSourceSelect={handlePreviewSourceSelect}
            onSourceMapReady={handleSourceMapReady}
            highlightSourceId={highlightSourceId}
            zoomLevel={zoomLevel}
          />
        </Allotment.Pane>
      </Allotment>
      <SyncLockIcon />
    </div>
  )
}
