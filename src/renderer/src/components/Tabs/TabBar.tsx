import { useSelector, useDispatch } from 'react-redux'
import { RootState } from '../../store/store'
import { setActiveTab, closeTab } from '../../store/tabsSlice'
import { Tab } from './Tab'
import './tabs.css'

interface TabBarProps {
  onCloseTab?: (tabId: string) => void
}

export function TabBar({ onCloseTab }: TabBarProps) {
  const dispatch = useDispatch()
  const { tabs, activeTabId } = useSelector((state: RootState) => state.tabs)

  const handleTabClick = (tabId: string) => {
    dispatch(setActiveTab(tabId))
  }

  const handleTabClose = (e: React.MouseEvent, tabId: string) => {
    e.stopPropagation()

    // Check if tab has unsaved changes
    const tab = tabs.find(t => t.id === tabId)
    if (tab?.isDirty) {
      const shouldClose = window.confirm(
        `"${tab.filename}" has unsaved changes. Close anyway?`
      )
      if (!shouldClose) return
    }

    // Notify parent if callback provided
    if (onCloseTab) {
      onCloseTab(tabId)
    }

    dispatch(closeTab(tabId))
  }

  if (tabs.length === 0) {
    return null
  }

  return (
    <div className="tab-bar">
      {tabs.map(tab => (
        <Tab
          key={tab.id}
          id={tab.id}
          filename={tab.filename}
          isDirty={tab.isDirty}
          isActive={tab.id === activeTabId}
          onClick={() => handleTabClick(tab.id)}
          onClose={(e) => handleTabClose(e, tab.id)}
        />
      ))}
    </div>
  )
}
