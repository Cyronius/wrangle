import React from 'react'
import ReactDOM from 'react-dom/client'
import * as monaco from 'monaco-editor'
import { loader } from '@monaco-editor/react'
import App from './App'
import './styles/global.css'
import 'allotment/dist/style.css'
import 'highlight.js/styles/github-dark.css'

// Tell @monaco-editor/react to use our bundled Monaco instance
// instead of loading from CDN. This ensures ThemeProvider and
// the Editor component share the same Monaco instance.
loader.config({ monaco })

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
