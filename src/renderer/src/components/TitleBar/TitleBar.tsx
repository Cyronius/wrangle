import { useState, useEffect, useRef } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { RootState } from '../../store/store'
import { setViewMode } from '../../store/layoutSlice'
import { setTheme } from '../../store/themeSlice'
import tangleIcon from '../../../../assets/tangle.png'
import './TitleBar.css'

interface MenuItem {
  label: string
  shortcut?: string
  action?: () => void
  separator?: boolean
  submenu?: MenuItem[]
}

interface TitleBarProps {
  onFileNew: () => void
  onFileOpen: () => void
  onFileSave: () => void
  onFileSaveAs: () => void
  onCloseTab?: () => void
  onEditUndo?: () => void
  onEditRedo?: () => void
  onCopyRichText?: () => void
  onExportHtml?: () => void
  onExportPdf?: () => void
  onOpenPreferences?: () => void
  children?: React.ReactNode
}

export function TitleBar({ onFileNew, onFileOpen, onFileSave, onFileSaveAs, onCloseTab, onEditUndo, onEditRedo, onCopyRichText, onExportHtml, onExportPdf, onOpenPreferences, children }: TitleBarProps) {
  const dispatch = useDispatch()
  const viewMode = useSelector((state: RootState) => state.layout.mode)
  const theme = useSelector((state: RootState) => state.theme.currentTheme)

  const [isMaximized, setIsMaximized] = useState(false)
  const [openMenu, setOpenMenu] = useState<string | null>(null)
  const [openSubmenu, setOpenSubmenu] = useState<string | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  // Check maximized state
  useEffect(() => {
    const checkMaximized = async () => {
      const maximized = await window.electron.window.isMaximized()
      setIsMaximized(maximized)
    }
    checkMaximized()

    // Check periodically (window state can change via OS controls)
    const interval = setInterval(checkMaximized, 500)
    return () => clearInterval(interval)
  }, [])

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenMenu(null)
        setOpenSubmenu(null)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleMenuClick = (menuName: string) => {
    setOpenMenu(openMenu === menuName ? null : menuName)
    setOpenSubmenu(null)
  }

  const handleMenuItemClick = (action?: () => void) => {
    if (action) {
      action()
    }
    setOpenMenu(null)
    setOpenSubmenu(null)
  }

  const menus: Record<string, MenuItem[]> = {
    Tangle: [
      { label: 'New', shortcut: 'Ctrl+N', action: onFileNew },
      { label: 'Open', shortcut: 'Ctrl+O', action: onFileOpen },
      { label: 'Save', shortcut: 'Ctrl+S', action: onFileSave },
      { label: 'Save As', shortcut: 'Ctrl+Shift+S', action: onFileSaveAs },
      { label: 'Close Tab', shortcut: 'Ctrl+W', action: onCloseTab },
      { separator: true, label: '' },
      { label: 'Export as HTML', action: onExportHtml },
      { label: 'Export as PDF', action: onExportPdf },
      { separator: true, label: '' },
      { label: 'Print', shortcut: 'Ctrl+P', action: () => window.electron.window.print() },
      { separator: true, label: '' },
      { label: 'Preferences', shortcut: 'Ctrl+,', action: onOpenPreferences },
      { separator: true, label: '' },
      { label: 'Exit', shortcut: 'Ctrl+Q', action: () => window.electron.window.close() }
    ],
    Edit: [
      { label: 'Undo', shortcut: 'Ctrl+Z', action: onEditUndo },
      { label: 'Redo', shortcut: 'Ctrl+Y', action: onEditRedo },
      { separator: true, label: '' },
      { label: 'Cut', shortcut: 'Ctrl+X', action: () => document.execCommand('cut') },
      { label: 'Copy', shortcut: 'Ctrl+C', action: () => document.execCommand('copy') },
      { label: 'Copy as Rich Text', action: onCopyRichText },
      { label: 'Paste', shortcut: 'Ctrl+V', action: () => document.execCommand('paste') },
      { separator: true, label: '' },
      { label: 'Select All', shortcut: 'Ctrl+A', action: () => document.execCommand('selectAll') },
      { separator: true, label: '' },
      { label: 'Toggle Case', shortcut: 'Ctrl+Shift+U' }
    ],
    View: [
      { label: 'Editor Only', shortcut: 'Ctrl+1', action: () => dispatch(setViewMode('editor-only')) },
      { label: 'Split View', shortcut: 'Ctrl+2', action: () => dispatch(setViewMode('split')) },
      { label: 'Preview Only', shortcut: 'Ctrl+3', action: () => dispatch(setViewMode('preview-only')) },
      { separator: true, label: '' },
      {
        label: 'Theme',
        submenu: [
          { label: 'Light', action: () => dispatch(setTheme('light')) },
          { label: 'Dark', action: () => dispatch(setTheme('dark')) }
        ]
      },
      { separator: true, label: '' },
      { label: 'Reset Zoom', shortcut: 'Ctrl+0', action: () => window.electron.window.resetZoom() },
      { label: 'Zoom In', shortcut: 'Ctrl++', action: () => window.electron.window.zoom(1) },
      { label: 'Zoom Out', shortcut: 'Ctrl+-', action: () => window.electron.window.zoom(-1) },
      { separator: true, label: '' },
      { label: 'Toggle Developer Tools', shortcut: 'F12', action: () => window.electron.window.toggleDevTools() }
    ]
  }

  const handleMinimize = () => window.electron.window.minimize()
  const handleMaximize = async () => {
    window.electron.window.maximize()
    // Update state after a small delay
    setTimeout(async () => {
      const maximized = await window.electron.window.isMaximized()
      setIsMaximized(maximized)
    }, 100)
  }
  const handleClose = () => window.electron.window.close()

  return (
    <div className="title-bar">
      <div className="title-bar-menus" ref={menuRef}>
        <div className="menu-bar">
          {Object.entries(menus).map(([menuName, items], index) => (
            <div key={menuName} className={`menu-item ${openMenu === menuName ? 'open' : ''}`}>
              <button
                className={`menu-button ${index === 0 ? 'menu-button-icon' : ''}`}
                onClick={() => handleMenuClick(menuName)}
                onMouseEnter={() => openMenu && setOpenMenu(menuName)}
              >
                {index === 0 ? (
                  <img src={tangleIcon} alt="Menu" className="menu-icon" />
                ) : (
                  menuName
                )}
              </button>

              {openMenu === menuName && (
                <div className="menu-dropdown">
                  {items.map((item, index) => (
                    item.separator ? (
                      <div key={index} className="menu-dropdown-separator" />
                    ) : item.submenu ? (
                      <div
                        key={index}
                        className="menu-dropdown-item menu-submenu"
                        onMouseEnter={() => setOpenSubmenu(item.label)}
                        onMouseLeave={() => setOpenSubmenu(null)}
                      >
                        <span>{item.label}</span>
                        <span className="menu-submenu-indicator">▶</span>

                        {openSubmenu === item.label && (
                          <div className="menu-submenu-dropdown">
                            {item.submenu.map((subItem, subIndex) => (
                              <button
                                key={subIndex}
                                className="menu-dropdown-item"
                                onClick={() => handleMenuItemClick(subItem.action)}
                              >
                                <span>{subItem.label}</span>
                                {subItem.shortcut && (
                                  <span className="shortcut">{subItem.shortcut}</span>
                                )}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    ) : (
                      <button
                        key={index}
                        className="menu-dropdown-item"
                        onClick={() => handleMenuItemClick(item.action)}
                      >
                        <span>{item.label}</span>
                        {item.shortcut && (
                          <span className="shortcut">{item.shortcut}</span>
                        )}
                      </button>
                    )
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="title-bar-tabs">
        {children}
      </div>

      <div className="title-bar-spacer"></div>

      <div className="window-controls">
        <button className="window-control-button" onClick={handleMinimize} title="Minimize">
          <svg viewBox="0 0 10 1">
            <rect width="10" height="1" fill="currentColor" />
          </svg>
        </button>
        <button className="window-control-button" onClick={handleMaximize} title={isMaximized ? 'Restore' : 'Maximize'}>
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
        <button className="window-control-button close" onClick={handleClose} title="Close">
          <svg viewBox="0 0 10 10">
            <path d="M1 0L0 1l4 4-4 4 1 1 4-4 4 4 1-1-4-4 4-4-1-1-4 4-4-4z" fill="currentColor" />
          </svg>
        </button>
      </div>
    </div>
  )
}
