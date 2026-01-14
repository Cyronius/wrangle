import { useState, useCallback, useMemo, useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { AppDispatch, RootState } from '../../store/store'
import {
  selectCurrentBindings,
  selectIsBuiltInPreset,
  selectAllPresetNames,
  builtInPresets,
  setCurrentPreset,
  addCustomPreset,
  updateShortcutBinding,
  deleteCustomPreset,
  saveShortcutSettings,
  ShortcutBindings
} from '../../store/settingsSlice'
import { commands, categories, categoryLabels, CommandDefinition } from '../../commands/registry'
import { ShortcutRecorder } from './ShortcutRecorder'
import { findConflicts } from '../../utils/shortcut-parser'
import { useDebounce } from '../../hooks/useKeyboardShortcuts'

export function KeyboardShortcutsTab() {
  const dispatch = useDispatch<AppDispatch>()
  const bindings = useSelector(selectCurrentBindings)
  const isBuiltIn = useSelector(selectIsBuiltInPreset)
  const presetNames = useSelector(selectAllPresetNames)
  const { currentPreset, customPresets } = useSelector(
    (state: RootState) => state.settings.shortcuts
  )

  const [searchQuery, setSearchQuery] = useState('')
  const [showNewPresetModal, setShowNewPresetModal] = useState(false)
  const [newPresetName, setNewPresetName] = useState('')

  // Debounced save
  const debouncedSave = useDebounce(
    useCallback(() => {
      dispatch(
        saveShortcutSettings({
          currentPreset,
          customPresets
        })
      )
    }, [dispatch, currentPreset, customPresets]),
    1000
  )

  // Filter commands by search query
  const filteredCommands = useMemo(() => {
    if (!searchQuery.trim()) return commands

    const query = searchQuery.toLowerCase()
    return commands.filter(
      (cmd) =>
        cmd.label.toLowerCase().includes(query) ||
        cmd.id.toLowerCase().includes(query) ||
        (bindings[cmd.id]?.toLowerCase().includes(query) ?? false)
    )
  }, [searchQuery, bindings])

  // Group filtered commands by category
  const groupedCommands = useMemo(() => {
    const groups: Record<string, CommandDefinition[]> = {}
    for (const category of categories) {
      const categoryCommands = filteredCommands.filter((cmd) => cmd.category === category)
      if (categoryCommands.length > 0) {
        groups[category] = categoryCommands
      }
    }
    return groups
  }, [filteredCommands])

  // Handle preset change
  const handlePresetChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    dispatch(setCurrentPreset(e.target.value))
    debouncedSave()
  }

  // Handle copy to custom
  const handleCopyToCustom = () => {
    setNewPresetName(`${currentPreset}-copy`)
    setShowNewPresetModal(true)
  }

  // Create new custom preset
  const handleCreatePreset = () => {
    const name = newPresetName.trim()
    if (!name) return

    // Check if name already exists
    if (presetNames.includes(name)) {
      alert('A preset with this name already exists')
      return
    }

    // Copy current bindings to new preset
    dispatch(
      addCustomPreset({
        name,
        bindings: { ...bindings }
      })
    )
    dispatch(setCurrentPreset(name))
    setShowNewPresetModal(false)
    setNewPresetName('')
    debouncedSave()
  }

  // Handle delete preset
  const handleDeletePreset = () => {
    if (isBuiltIn) return
    if (confirm(`Delete preset "${currentPreset}"?`)) {
      dispatch(deleteCustomPreset(currentPreset))
      debouncedSave()
    }
  }

  // Handle shortcut change
  const handleShortcutChange = (commandId: string, shortcut: string | null) => {
    if (isBuiltIn) return

    dispatch(
      updateShortcutBinding({
        presetName: currentPreset,
        commandId,
        shortcut
      })
    )
    debouncedSave()
  }

  // Clear shortcut
  const handleClearShortcut = (commandId: string) => {
    handleShortcutChange(commandId, null)
  }

  // Check for conflicts for a specific command
  const getConflictsForCommand = (commandId: string): string[] => {
    const binding = bindings[commandId]
    if (!binding) return []
    return findConflicts(binding, bindings, commandId)
  }

  return (
    <div className="shortcuts-tab">
      {/* Controls */}
      <div className="shortcuts-controls">
        <div className="shortcuts-preset-select">
          <select value={currentPreset} onChange={handlePresetChange}>
            {presetNames.map((name) => (
              <option key={name} value={name}>
                {name}
                {builtInPresets[name] ? ' (built-in)' : ''}
              </option>
            ))}
          </select>
        </div>

        <div className="shortcuts-search">
          <input
            type="text"
            placeholder="Search commands..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="shortcuts-actions">
          <button
            className="shortcuts-btn"
            onClick={handleCopyToCustom}
            title="Create a custom preset based on current"
          >
            Copy to Custom
          </button>
          {!isBuiltIn && (
            <button
              className="shortcuts-btn danger"
              onClick={handleDeletePreset}
              title="Delete this custom preset"
            >
              Delete
            </button>
          )}
        </div>
      </div>

      {/* Read-only notice for built-in presets */}
      {isBuiltIn && (
        <div className="shortcut-readonly-notice">
          <svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor">
            <path d="M8 16A8 8 0 1 1 8 0a8 8 0 0 1 0 16zm.93-9.412-1 4.705c-.07.34.029.533.304.533.194 0 .487-.07.686-.246l-.088.416c-.287.346-.92.598-1.465.598-.703 0-1.002-.422-.808-1.319l.738-3.468c.064-.293.006-.399-.287-.47l-.451-.081.082-.381 2.29-.287zM8 5.5a1 1 0 1 0 0-2 1 1 0 0 0 0 2z" />
          </svg>
          Built-in presets are read-only. Click "Copy to Custom" to create an editable copy.
        </div>
      )}

      {/* Commands list */}
      <div className="shortcuts-list">
        {Object.entries(groupedCommands).map(([category, cmds]) => (
          <div key={category} className="shortcuts-category">
            <div className="shortcuts-category-header">
              {categoryLabels[category as keyof typeof categoryLabels]}
            </div>
            {cmds.map((cmd) => {
              const conflicts = getConflictsForCommand(cmd.id)
              const hasConflict = conflicts.length > 0

              return (
                <div key={cmd.id} className="shortcut-item">
                  <span className="shortcut-label">{cmd.label}</span>
                  <div className="shortcut-binding">
                    <ShortcutRecorder
                      value={bindings[cmd.id] || null}
                      onChange={(shortcut) => handleShortcutChange(cmd.id, shortcut)}
                      onCancel={() => {}}
                      hasConflict={hasConflict}
                      disabled={isBuiltIn}
                    />
                    {!isBuiltIn && bindings[cmd.id] && (
                      <button
                        className="shortcut-clear"
                        onClick={() => handleClearShortcut(cmd.id)}
                        title="Clear shortcut"
                      >
                        <svg viewBox="0 0 10 10" width="10" height="10">
                          <path
                            d="M1 0L0 1l4 4-4 4 1 1 4-4 4 4 1-1-4-4 4-4-1-1-4 4-4-4z"
                            fill="currentColor"
                          />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        ))}
      </div>

      {/* New preset modal */}
      {showNewPresetModal && (
        <div
          className="name-modal-overlay"
          onClick={(e) => e.target === e.currentTarget && setShowNewPresetModal(false)}
        >
          <div className="name-modal">
            <h3>New Custom Preset</h3>
            <input
              type="text"
              placeholder="Preset name"
              value={newPresetName}
              onChange={(e) => setNewPresetName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreatePreset()}
              autoFocus
            />
            <div className="name-modal-actions">
              <button
                className="shortcuts-btn"
                onClick={() => setShowNewPresetModal(false)}
              >
                Cancel
              </button>
              <button
                className="shortcuts-btn primary"
                onClick={handleCreatePreset}
                disabled={!newPresetName.trim()}
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
