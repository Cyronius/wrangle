import './empty-state.css'

interface EmptyStateProps {
  onNewFile: () => void
  onOpenFile: () => void
}

export function EmptyState({ onNewFile, onOpenFile }: EmptyStateProps) {
  return (
    <div className="empty-state">
      <div className="empty-state-content">
        <h1>Wrangle</h1>
        <p>Create a new document or open an existing one</p>
        <div className="empty-state-actions">
          <button onClick={onNewFile}>
            New File
            <span className="shortcut">Ctrl+N</span>
          </button>
          <button onClick={onOpenFile}>
            Open File
            <span className="shortcut">Ctrl+O</span>
          </button>
        </div>
      </div>
    </div>
  )
}
