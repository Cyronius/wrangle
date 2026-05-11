import { useState, useCallback, useMemo } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { AppDispatch, RootState } from '../../store/store'
import {
  selectCurrentBindings,
  selectAllPresetNames,
  selectVimMode,
  builtInPresets,
  setCurrentPreset,
  setVimMode,
  addCustomPreset,
  editShortcutBinding,
  deleteCustomPreset,
  saveShortcutSettings,
  saveEditorSettings
} from '../../store/settingsSlice'
import { commands, categories, categoryLabels, commandMap, CommandDefinition } from '../../commands/registry'
import { ShortcutRecorder, ShortcutRecorderMode } from './ShortcutRecorder'
import { findConflicts } from '../../utils/shortcut-parser'
import { useDebounce } from '../../hooks/useKeyboardShortcuts'

function recorderModeFor(cmd: CommandDefinition): ShortcutRecorderMode {
  if (cmd.bindingShape?.suffix === 'Tap') return 'tap'
  if (cmd.bindingShape?.suffix) return 'modifier-only'
  return 'chord'
}

function suffixLabel(cmd: CommandDefinition): string | null {
  if (!cmd.bindingShape?.suffix) return null
  if (cmd.bindingShape.suffix === 'Tap') return '(tap)'
  return `+ ${cmd.bindingShape.suffix}`
}

export function KeyboardShortcutsTab() {
  const dispatch = useDispatch<AppDispatch>()
  const bindings = useSelector(selectCurrentBindings)
  const presetNames = useSelector(selectAllPresetNames)
  const vimEnabled = useSelector(selectVimMode)
  const currentPreset = useSelector(
    (state: RootState) => state.settings.shortcuts.currentPreset
  )

  const [searchQuery, setSearchQuery] = useState('')
  const [showNewPresetModal, setShowNewPresetModal] = useState(false)
  const [newPresetName, setNewPresetName] = useState('')

  const isCurrentBuiltIn = !!builtInPresets[currentPreset]

  const debouncedSave = useDebounce(
    useCallback(() => {
      dispatch(saveShortcutSettings())
    }, [dispatch]),
    1000
  )

  const filteredCommands = useMemo(() => {
    if (!searchQuery.trim()) return commands

    const query = searchQuery.toLowerCase()
    return commands.filter(
      (cmd) =>
        cmd.label.toLowerCase().includes(query) ||
        cmd.id.toLowerCase().includes(query) ||
        (bindings[cmd.id]?.toLowerCase().includes(query) ?? false) ||
        (cmd.bindingShape?.suffix?.toLowerCase().includes(query) ?? false)
    )
  }, [searchQuery, bindings])

  // Group filtered commands by category, separating mouse-gesture commands
  // (`bindingShape.suffix` Scroll/Drag) into a sub-section under "View".
  const groupedCommands = useMemo(() => {
    const groups: Record<string, { standard: CommandDefinition[]; gestures: CommandDefinition[] }> = {}
    for (const category of categories) {
      const categoryCommands = filteredCommands.filter((cmd) => cmd.category === category)
      if (categoryCommands.length === 0) continue
      const standard: CommandDefinition[] = []
      const gestures: CommandDefinition[] = []
      for (const cmd of categoryCommands) {
        if (cmd.bindingShape?.suffix === 'Scroll' || cmd.bindingShape?.suffix === 'Drag') {
          gestures.push(cmd)
        } else {
          standard.push(cmd)
        }
      }
      groups[category] = { standard, gestures }
    }
    return groups
  }, [filteredCommands])

  const handlePresetChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    dispatch(setCurrentPreset(e.target.value))
    debouncedSave()
  }

  const handleCopyToCustom = () => {
    setNewPresetName(`${currentPreset}-copy`)
    setShowNewPresetModal(true)
  }

  const handleCreatePreset = () => {
    const name = newPresetName.trim()
    if (!name) return

    if (presetNames.includes(name)) {
      alert('A preset with this name already exists')
      return
    }

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

  const handleDeletePreset = () => {
    if (isCurrentBuiltIn) return
    if (confirm(`Delete preset "${currentPreset}"?`)) {
      dispatch(deleteCustomPreset(currentPreset))
      debouncedSave()
    }
  }

  // KBD-012: editing a binding while a built-in preset is active auto-creates
  // a custom preset and switches to it before applying the change.
  const handleShortcutChange = (commandId: string, shortcut: string | null) => {
    dispatch(editShortcutBinding({ commandId, shortcut }))
    debouncedSave()
  }

  const handleClearShortcut = (commandId: string) => {
    handleShortcutChange(commandId, null)
  }

  // KBD-014: partition conflict detection by `bindingShape.suffix` so e.g.
  // `Ctrl+Scroll` and `Ctrl+B` don't surface as conflicts.
  const getConflictsForCommand = (commandId: string): string[] => {
    const binding = bindings[commandId]
    if (!binding) return []
    return findConflicts(
      binding,
      bindings,
      commandId,
      (id) => commandMap.get(id)?.bindingShape?.suffix
    )
  }

  const handleVimModeToggle = () => {
    dispatch(setVimMode(!vimEnabled))
    dispatch(saveEditorSettings())
  }

  const renderShortcutRow = (cmd: CommandDefinition) => {
    const conflicts = getConflictsForCommand(cmd.id)
    const hasConflict = conflicts.length > 0
    const suffix = suffixLabel(cmd)
    const mode = recorderModeFor(cmd)

    return (
      <div key={cmd.id} className="shortcut-item">
        <span className="shortcut-label">{cmd.label}</span>
        <div className="shortcut-binding">
          <ShortcutRecorder
            value={bindings[cmd.id] || null}
            onChange={(shortcut) => handleShortcutChange(cmd.id, shortcut)}
            onCancel={() => {}}
            hasConflict={hasConflict}
            mode={mode}
          />
          {suffix && <span className="shortcut-suffix">{suffix}</span>}
          {bindings[cmd.id] && (
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
          {!isCurrentBuiltIn && (
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

      {/* Vim mode toggle */}
      <div className="vim-mode-toggle">
        <label className="vim-mode-label">
          <input
            type="checkbox"
            checked={vimEnabled}
            onChange={handleVimModeToggle}
          />
          <span>Vim Mode</span>
        </label>
      </div>

      {/* Commands list */}
      <div className="shortcuts-list">
        {Object.entries(groupedCommands).map(([category, { standard, gestures }]) => (
          <div key={category} className="shortcuts-category">
            <div className="shortcuts-category-header">
              {categoryLabels[category as keyof typeof categoryLabels]}
            </div>
            {standard.map(renderShortcutRow)}
            {gestures.length > 0 && (
              <>
                <div className="shortcuts-subcategory-header">Mouse Gestures</div>
                {gestures.map(renderShortcutRow)}
              </>
            )}
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
