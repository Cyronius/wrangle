import { useState, useCallback, useRef } from 'react'
import { Allotment } from 'allotment'
import { CodeMirrorEditor, CodeMirrorEditorHandle } from '../Editor/CodeMirrorEditor'
import { MarkdownPreview, MarkdownPreviewHandle } from '../Preview/MarkdownPreview'
import { SyncLockIcon } from './SyncLockIcon'
import { SourceRange, SourceMap } from '../../utils/source-map'
import { useSelector, useDispatch } from 'react-redux'
import { RootState } from '../../store/store'
import { setSplitRatio } from '../../store/layoutSlice'
import 'allotment/dist/style.css'

interface EditorLayoutProps {
  content: string
  onChange: (value: string | undefined) => void
  baseDir?: string | null
  theme?: 'vs-dark' | 'vs'
  // POC: editorRef is now CodeMirror handle, but we keep prop for compatibility
  editorRef?: React.MutableRefObject<CodeMirrorEditorHandle | null>
}

// Calculate font size based on zoom level (base 14px, 10% per level)
function getZoomedFontSize(zoomLevel: number): number {
  return Math.round(14 * Math.pow(1.1, zoomLevel))
}

/**
 * Convert an offset from CRLF content to LF-normalized content.
 * NOTE: CodeMirror may handle this internally - testing needed.
 */
function normalizeOffset(content: string, offset: number): number {
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
 */
function denormalizeOffset(content: string, lfOffset: number): number {
  let lfCount = 0
  for (let i = 0; i < content.length; i++) {
    if (content[i] !== '\r') {
      if (lfCount === lfOffset) {
        return i
      }
      lfCount++
    }
  }
  return content.length
}

export function EditorLayout({
  content,
  onChange,
  baseDir = null,
  theme = 'vs-dark',
  editorRef: externalEditorRef
}: EditorLayoutProps) {
  const dispatch = useDispatch()
  const { viewMode, splitRatio, previewSync, zoomLevel } = useSelector((state: RootState) => state.layout)

  // Internal ref for CodeMirror editor
  const internalEditorRef = useRef<CodeMirrorEditorHandle>(null)
  const editorRef = externalEditorRef || internalEditorRef

  // State for bidirectional sync
  const [sourceMap, setSourceMap] = useState<SourceMap | null>(null)
  const [highlightSourceId, setHighlightSourceId] = useState<string | null>(null)
  const [cursorOffset, setCursorOffset] = useState<number | null>(null)
  const [editorSelection, setEditorSelection] = useState<{ start: number; end: number } | null>(null)

  // Refs for scroll synchronization
  const previewRef = useRef<MarkdownPreviewHandle>(null)
  const isEditorScrollingRef = useRef(false)
  const isPreviewScrollingRef = useRef(false)
  const sourceMapRef = useRef<SourceMap | null>(null)
  const previewSyncRef = useRef(previewSync)
  const contentRef = useRef(content)

  // Keep refs in sync with state
  sourceMapRef.current = sourceMap
  previewSyncRef.current = previewSync
  contentRef.current = content

  // Calculate zoomed font size for editor (POC: not yet applied to CodeMirror)
  const fontSize = getZoomedFontSize(zoomLevel)

  // Handle cursor position changes in editor - highlight corresponding preview element
  const handleCursorChange = useCallback((offset: number) => {
    // CodeMirror gives us character offsets directly
    // Check if we need CRLF normalization
    const normalizedOffset = normalizeOffset(content, offset)
    setCursorOffset(normalizedOffset)
    if (!sourceMap) {
      setHighlightSourceId(null)
      return
    }
    const elementId = sourceMap.findElementByOffset(normalizedOffset)
    setHighlightSourceId(elementId)
  }, [sourceMap, content])

  // Store sourceMap when preview renders
  const handleSourceMapReady = useCallback((map: SourceMap) => {
    setSourceMap(map)
  }, [])

  // Handle editor scroll - sync to preview using source map
  const handleEditorScroll = useCallback((offset: number) => {
    // Normalize offset if needed
    const normalizedOffset = normalizeOffset(contentRef.current, offset)
    if (!previewSyncRef.current || isPreviewScrollingRef.current || !sourceMapRef.current) return

    // Find the element corresponding to this source offset
    const elementId = sourceMapRef.current.findElementByOffset(normalizedOffset)
    if (!elementId) return

    // Get the entry to find its start offset
    const entry = sourceMapRef.current.getEntry(elementId)
    if (!entry) return

    isEditorScrollingRef.current = true
    previewRef.current?.scrollToSourceId(String(entry.sourceRange.start))

    setTimeout(() => {
      isEditorScrollingRef.current = false
    }, 100)
  }, [])

  // Handle preview scroll - sync to editor using source map
  const handlePreviewScroll = useCallback((sourceId: string | null) => {
    if (!previewSync || isEditorScrollingRef.current) return
    if (!editorRef?.current || !sourceId) return

    const startOffset = parseInt(sourceId, 10)
    if (isNaN(startOffset)) return

    isPreviewScrollingRef.current = true

    // Denormalize if content has CRLF
    const crlfOffset = denormalizeOffset(content, startOffset)

    // Use CodeMirror's revealOffset
    editorRef.current.revealOffset(crlfOffset)

    setTimeout(() => {
      isPreviewScrollingRef.current = false
    }, 100)
  }, [previewSync, content, editorRef])

  const handleSplitChange = (sizes: number[]) => {
    if (sizes.length === 2) {
      const total = sizes[0] + sizes[1]
      const ratio = sizes[0] / total
      const clampedRatio = Math.max(0.2, Math.min(0.8, ratio))
      dispatch(setSplitRatio(clampedRatio))
    }
  }

  // Handle preview selection - select corresponding text in editor
  const handlePreviewSourceSelect = (range: SourceRange) => {
    if (!editorRef?.current) return

    // Denormalize offsets from LF to CRLF if needed
    const crlfStart = denormalizeOffset(content, range.start)
    const crlfEnd = denormalizeOffset(content, range.end)

    // POC: For now, just position cursor at start
    // Full selection would require extending CodeMirrorEditorHandle
    editorRef.current.setCursor(crlfStart)
  }

  // Handle preview click - position cursor at clicked location
  const handlePreviewSourceClick = (offset: number) => {
    if (!editorRef?.current) return

    // Denormalize offset from LF to CRLF if needed
    const crlfOffset = denormalizeOffset(content, offset)
    editorRef.current.setCursor(crlfOffset)
  }

  // Render based on view mode
  if (viewMode === 'editor-only') {
    return (
      <div style={{ height: '100%', width: '100%' }}>
        <CodeMirrorEditor
          ref={editorRef}
          value={content}
          onChange={onChange}
        />
      </div>
    )
  }

  if (viewMode === 'preview-only') {
    return (
      <div style={{ height: '100%', width: '100%', position: 'relative' }}>
        {/* Hidden editor - keeps editorRef valid */}
        <div style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', opacity: 0, pointerEvents: 'none' }}>
          <CodeMirrorEditor
            ref={editorRef}
            value={content}
            onChange={onChange}
          />
        </div>
        <MarkdownPreview
          content={content}
          baseDir={baseDir}
          syncScroll={false}
          onSourceSelect={handlePreviewSourceSelect}
          onSourceClick={handlePreviewSourceClick}
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
          <CodeMirrorEditor
            ref={editorRef}
            value={content}
            onChange={onChange}
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
            onSourceClick={handlePreviewSourceClick}
            onSourceMapReady={handleSourceMapReady}
            highlightSourceId={highlightSourceId}
            zoomLevel={zoomLevel}
            cursorOffset={previewSync ? cursorOffset : null}
            selectionRange={previewSync ? editorSelection : null}
            showPseudoCursor={previewSync}
          />
        </Allotment.Pane>
      </Allotment>
      <SyncLockIcon />
    </div>
  )
}
