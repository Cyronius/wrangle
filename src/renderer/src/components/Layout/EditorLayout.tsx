import { useState, useCallback, useRef } from 'react'
import { Allotment } from 'allotment'
import { MonacoEditor } from '../Editor/MonacoEditor'
import { MarkdownPreview, MarkdownPreviewHandle } from '../Preview/MarkdownPreview'
import { SyncLockIcon } from './SyncLockIcon'
import { SourceMap } from '../../utils/source-map'
import { useSelector, useDispatch } from 'react-redux'
import { RootState } from '../../store/store'
import { setSplitRatio } from '../../store/layoutSlice'
import type * as monaco from 'monaco-editor'
import 'allotment/dist/style.css'

interface EditorLayoutProps {
  content: string
  onChange: (value: string | undefined) => void
  baseDir?: string | null
  theme?: string
  editorRef?: React.MutableRefObject<monaco.editor.IStandaloneCodeEditor | null>
  onCursorPositionChange?: (position: { lineNumber: number; column: number }) => void
  onScrollTopChange?: (scrollTop: number) => void
  // Optional overrides for multi-pane mode
  viewModeOverride?: 'split' | 'editor-only' | 'preview-only'
  splitRatioOverride?: number
  onSplitRatioChange?: (ratio: number) => void
}

// Calculate font size based on zoom level (base 14px, 10% per level)
function getZoomedFontSize(zoomLevel: number): number {
  return Math.round(14 * Math.pow(1.1, zoomLevel))
}

/**
 * Convert an offset from CRLF content to LF-normalized content.
 * Since CRLF (\r\n) becomes LF (\n), we need to subtract the number of \r characters
 * that appear before the given offset.
 */
function normalizeOffset(content: string, offset: number): number {
  // Count \r characters before the offset
  let crCount = 0
  for (let i = 0; i < offset && i < content.length; i++) {
    if (content[i] === '\r') {
      crCount++
    }
  }
  return offset - crCount
}

/**
 * Convert an LF-normalized offset back to CRLF offset.
 * Used when we have an offset from the source map (LF) and need to position
 * the cursor in Monaco (which may use CRLF).
 */
function denormalizeOffset(content: string, lfOffset: number): number {
  // Walk through content, counting characters without \r
  let lfCount = 0
  for (let i = 0; i < content.length; i++) {
    if (content[i] !== '\r') {
      if (lfCount === lfOffset) {
        return i
      }
      lfCount++
    }
  }
  // If we reach the end, return content length
  return content.length
}

export function EditorLayout({
  content,
  onChange,
  baseDir = null,
  theme = 'vs-dark',
  editorRef,
  onCursorPositionChange,
  onScrollTopChange,
  viewModeOverride,
  splitRatioOverride,
  onSplitRatioChange
}: EditorLayoutProps) {
  const dispatch = useDispatch()
  const layoutState = useSelector((state: RootState) => state.layout)

  // Use overrides if provided (multi-pane mode), otherwise use global state
  const viewMode = viewModeOverride ?? layoutState.viewMode
  const splitRatio = splitRatioOverride ?? layoutState.splitRatio
  const { previewSync, zoomLevel } = layoutState

  // State for scroll sync
  const [sourceMap, setSourceMap] = useState<SourceMap | null>(null)

  // Refs for scroll synchronization
  const previewRef = useRef<MarkdownPreviewHandle>(null)
  const isEditorScrollingRef = useRef(false)
  const isPreviewScrollingRef = useRef(false)
  const sourceMapRef = useRef<SourceMap | null>(null)
  const previewSyncRef = useRef(previewSync)
  const contentRef = useRef(content)

  // Keep refs in sync with state (avoids stale closures in callbacks captured by Monaco)
  sourceMapRef.current = sourceMap
  previewSyncRef.current = previewSync
  contentRef.current = content

  // Calculate zoomed font size for editor
  const fontSize = getZoomedFontSize(zoomLevel)

  // Store sourceMap when preview renders
  const handleSourceMapReady = useCallback((map: SourceMap) => {
    setSourceMap(map)
  }, [])

  // Handle editor scroll - sync to preview using source map
  // Use refs to avoid stale closure issues - this callback is captured by Monaco on mount
  const handleEditorScroll = useCallback((offset: number) => {
    // Normalize offset from editor (which may have CRLF) to match source map (which uses LF)
    const normalizedOffset = normalizeOffset(contentRef.current, offset)
    if (!previewSyncRef.current || isPreviewScrollingRef.current || !sourceMapRef.current) return

    // Find the element corresponding to this source offset
    const elementId = sourceMapRef.current.findElementByOffset(normalizedOffset)
    if (!elementId) return

    // Get the entry to find its start offset (used as the scroll target)
    const entry = sourceMapRef.current.getEntry(elementId)
    if (!entry) return

    isEditorScrollingRef.current = true
    // Pass the start offset as string - this matches the data-source-start attribute
    previewRef.current?.scrollToSourceId(String(entry.sourceRange.start))

    setTimeout(() => {
      isEditorScrollingRef.current = false
    }, 100)
  }, [])

  // Handle preview scroll - sync to editor using source map
  // Note: sourceId is now a start offset string (e.g., "0", "45") from data-source-start attribute
  const handlePreviewScroll = useCallback((sourceId: string | null) => {
    if (!previewSync || isEditorScrollingRef.current) return
    if (!editorRef?.current || !sourceId) return

    // sourceId is now the start offset directly
    const startOffset = parseInt(sourceId, 10)
    if (isNaN(startOffset)) return

    isPreviewScrollingRef.current = true
    const editor = editorRef.current
    const model = editor.getModel()
    if (model) {
      // Denormalize offset from LF to CRLF if needed
      const crlfOffset = denormalizeOffset(content, startOffset)
      // Convert character offset to line number
      const position = model.getPositionAt(crlfOffset)
      editor.revealLineInCenter(position.lineNumber)
    }

    setTimeout(() => {
      isPreviewScrollingRef.current = false
    }, 100)
  }, [previewSync, content, editorRef])

  const handleSplitChange = (sizes: number[]) => {
    if (sizes.length === 2) {
      const total = sizes[0] + sizes[1]
      const ratio = sizes[0] / total
      const clampedRatio = Math.max(0.2, Math.min(0.8, ratio))
      if (onSplitRatioChange) {
        onSplitRatioChange(clampedRatio)
      } else {
        dispatch(setSplitRatio(clampedRatio))
      }
    }
  }

  // Render based on view mode
  if (viewMode === 'editor-only') {
    return (
      <div style={{ height: '100%', width: '100%' }}>
        <MonacoEditor ref={editorRef} value={content} onChange={onChange} theme={theme} fontSize={fontSize} onCursorPositionChange={onCursorPositionChange} onScrollTopChange={onScrollTopChange} />
      </div>
    )
  }

  if (viewMode === 'preview-only') {
    return (
      <div style={{ height: '100%', width: '100%', position: 'relative' }}>
        {/* Hidden editor - keeps editorRef valid for WYSIWYG toolbar commands */}
        <div style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', opacity: 0, pointerEvents: 'none' }}>
          <MonacoEditor ref={editorRef} value={content} onChange={onChange} theme={theme} fontSize={fontSize} onCursorPositionChange={onCursorPositionChange} />
        </div>
        <MarkdownPreview
          content={content}
          baseDir={baseDir}
          syncScroll={false}
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
            onScroll={handleEditorScroll}
            onCursorPositionChange={onCursorPositionChange}
            onScrollTopChange={onScrollTopChange}
          />
        </Allotment.Pane>
        <Allotment.Pane minSize={200}>
          <MarkdownPreview
            ref={previewRef}
            content={content}
            baseDir={baseDir}
            syncScroll={previewSync}
            onScroll={handlePreviewScroll}
            onSourceMapReady={handleSourceMapReady}
            zoomLevel={zoomLevel}
          />
        </Allotment.Pane>
      </Allotment>
      <SyncLockIcon />
    </div>
  )
}
