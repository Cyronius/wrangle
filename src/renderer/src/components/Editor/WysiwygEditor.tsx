import { forwardRef, useEffect, useRef, useCallback } from 'react'
import {
  MDXEditor,
  MDXEditorMethods,
  headingsPlugin,
  listsPlugin,
  quotePlugin,
  thematicBreakPlugin,
  linkPlugin,
  imagePlugin,
  tablePlugin,
  codeBlockPlugin,
  codeMirrorPlugin,
  CodeMirrorEditor,
  markdownShortcutPlugin,
  linkDialogPlugin,
  frontmatterPlugin,
  diffSourcePlugin
} from '@mdxeditor/editor'
import '@mdxeditor/editor/style.css'
import './wysiwyg-editor.css'

interface WysiwygEditorProps {
  value: string
  onChange: (value: string) => void
  theme?: 'light' | 'dark'
}

export const WysiwygEditor = forwardRef<MDXEditorMethods, WysiwygEditorProps>(
  ({ value, onChange, theme = 'dark' }, ref) => {
    const internalRef = useRef<MDXEditorMethods>(null)
    const editorRef = (ref as React.RefObject<MDXEditorMethods>) || internalRef
    // Track whether the last change was internal (from user typing in WYSIWYG)
    const isInternalChangeRef = useRef(false)

    // Wrap onChange to track internal changes
    const handleChange = useCallback((newValue: string) => {
      isInternalChangeRef.current = true
      onChange(newValue)
    }, [onChange])

    // Update editor content only when value prop changes externally
    useEffect(() => {
      // Skip if this was an internal change (user typing in WYSIWYG)
      if (isInternalChangeRef.current) {
        isInternalChangeRef.current = false
        return
      }
      if (editorRef.current) {
        const currentMarkdown = editorRef.current.getMarkdown()
        if (currentMarkdown !== value) {
          editorRef.current.setMarkdown(value)
        }
      }
    }, [value])

    return (
      <div className={`wysiwyg-editor-container ${theme === 'dark' ? 'dark-theme' : ''}`}>
        <MDXEditor
          ref={editorRef}
          markdown={value}
          onChange={handleChange}
          className={theme === 'dark' ? 'dark-theme dark-editor' : ''}
          contentEditableClassName="wysiwyg-content"
          plugins={[
            headingsPlugin(),
            listsPlugin(),
            quotePlugin(),
            thematicBreakPlugin(),
            linkPlugin(),
            linkDialogPlugin(),
            imagePlugin(),
            tablePlugin(),
            frontmatterPlugin(),
            codeBlockPlugin({
              defaultCodeBlockLanguage: 'text',
              codeBlockEditorDescriptors: [
                // Fallback descriptor for any unrecognized language
                {
                  priority: -10,
                  match: () => true,
                  Editor: CodeMirrorEditor
                }
              ]
            }),
            codeMirrorPlugin({
              codeBlockLanguages: {
                // Fallback for empty/unspecified language
                '': 'Plain Text',
                text: 'Plain Text',
                plaintext: 'Plain Text',
                // Special blocks that MDXEditor can't render but shouldn't error on
                mermaid: 'Mermaid',
                katex: 'KaTeX',
                math: 'Math',
                latex: 'LaTeX',
                // Standard languages
                js: 'JavaScript',
                javascript: 'JavaScript',
                ts: 'TypeScript',
                typescript: 'TypeScript',
                jsx: 'JSX',
                tsx: 'TSX',
                css: 'CSS',
                html: 'HTML',
                json: 'JSON',
                markdown: 'Markdown',
                md: 'Markdown',
                python: 'Python',
                py: 'Python',
                rust: 'Rust',
                go: 'Go',
                java: 'Java',
                c: 'C',
                cpp: 'C++',
                csharp: 'C#',
                shell: 'Shell',
                bash: 'Bash',
                sh: 'Shell',
                zsh: 'Shell',
                sql: 'SQL',
                yaml: 'YAML',
                yml: 'YAML',
                xml: 'XML',
                // Additional common languages
                php: 'PHP',
                ruby: 'Ruby',
                rb: 'Ruby',
                swift: 'Swift',
                kotlin: 'Kotlin',
                scala: 'Scala',
                r: 'R',
                diff: 'Diff',
                dockerfile: 'Dockerfile',
                docker: 'Dockerfile',
                graphql: 'GraphQL',
                toml: 'TOML',
                ini: 'INI',
                conf: 'Config'
              }
            }),
            markdownShortcutPlugin(),
            diffSourcePlugin({ viewMode: 'rich-text' })
          ]}
        />
      </div>
    )
  }
)

WysiwygEditor.displayName = 'WysiwygEditor'
