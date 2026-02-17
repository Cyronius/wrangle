import { useState, useEffect, useCallback } from 'react'

export function WindowControls({ className }: { className?: string }) {
  const [isMaximized, setIsMaximized] = useState(false)

  useEffect(() => {
    window.electron.window.isMaximized().then(setIsMaximized)
    const unsub = window.electron.window.onStateChanged(setIsMaximized)
    return unsub
  }, [])

  const handleMinimize = useCallback(() => window.electron.window.minimize(), [])
  const handleMaximize = useCallback(() => window.electron.window.maximize(), [])
  const handleClose = useCallback(() => window.electron.window.close(), [])

  return (
    <div className={`window-controls${className ? ` ${className}` : ''}`}>
      <button className="window-control-btn" onClick={handleMinimize} title="Minimize">
        <svg viewBox="0 0 10 1">
          <rect width="10" height="1" fill="currentColor" />
        </svg>
      </button>
      <button className="window-control-btn" onClick={handleMaximize} title={isMaximized ? 'Restore' : 'Maximize'}>
        {isMaximized ? (
          <svg viewBox="0 0 10 10">
            <path d="M2 0v2H0v8h8V8h2V0H2zm6 8H1V3h7v5zm1-6H3V1h6v6H9V2z" fill="currentColor" />
          </svg>
        ) : (
          <svg viewBox="0 0 10 10">
            <rect width="10" height="10" fill="none" stroke="currentColor" strokeWidth="1" />
          </svg>
        )}
      </button>
      <button className="window-control-btn close" onClick={handleClose} title="Close">
        <svg viewBox="0 0 10 10">
          <path d="M1 0L0 1l4 4-4 4 1 1 4-4 4 4 1-1-4-4 4-4-1-1-4 4-4-4z" fill="currentColor" />
        </svg>
      </button>
    </div>
  )
}
