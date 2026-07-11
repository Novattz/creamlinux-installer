import { useState, KeyboardEvent } from 'react'
import { Button } from '@/components/buttons'
import { Icon, IconName } from '@/components/icons'

export interface EntryListProps {
  /** The entries to display (e.g. file paths) */
  items: string[]
  /** Called with a manually-typed entry when the user presses Enter */
  onAddManual: (value: string) => void
  /** Called when the browse button (next to the input) is clicked */
  onBrowse: () => void
  /** Called with the entry to remove when its remove button is clicked */
  onRemove: (item: string) => void
  /** Placeholder text for the manual-entry input */
  placeholder: string
  /** Message shown when there are no entries yet */
  emptyLabel: string
  /** Disables all interaction, e.g. while a request is in flight */
  disabled?: boolean
  /** Icon shown next to each entry */
  icon?: IconName | string
}

/**
 * Generic list of string entries (paths, URLs, anything long and one-line)
 * with add/remove controls. The add row (manual entry + browse button) is
 * always pinned at the bottom it never scrolls out of view, even once
 * the entries above it start scrolling. Long entries are truncated from the
 * start so the end, usually the most identifying part stays visible.
 */
const EntryList = ({
  items,
  onAddManual,
  onBrowse,
  onRemove,
  placeholder,
  emptyLabel,
  disabled = false,
  icon = 'Folder',
}: EntryListProps) => {
  const [manualValue, setManualValue] = useState('')

  const submitManualValue = () => {
    const trimmed = manualValue.trim()
    if (!trimmed) return
    onAddManual(trimmed)
    setManualValue('')
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') submitManualValue()
  }

  return (
    <div className="entry-list">
      <div className="entry-list-scroll-area">
        {items.length === 0 ? (
          <div className="entry-list-empty">
            <Icon name={icon} className="icon-secondary" variant="solid" size="lg" />
            <p>{emptyLabel}</p>
          </div>
        ) : (
          <ul className="entry-list-items">
            {items.map((item) => (
              <li key={item} className="entry-list-item">
                <Icon name={icon} variant="solid" size="md" className="entry-list-item-icon" />
                <span className="entry-list-item-text" title={item}>
                  {item}
                </span>
                <Button
                  variant="secondary"
                  size="small"
                  onClick={() => onRemove(item)}
                  disabled={disabled}
                  title="Remove"
                  className="entry-list-remove-button"
                  leftIcon={<Icon name="Trash" variant="solid" size="sm" />}
                  iconOnly
                />
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="entry-list-input-row">
        <input
          type="text"
          className="entry-list-input"
          placeholder={placeholder}
          value={manualValue}
          onChange={(e) => setManualValue(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
        />
        <Button
          variant="primary"
          size="medium"
          onClick={onBrowse}
          disabled={disabled}
          title="Browse for a folder"
          className="entry-list-browse-button"
          leftIcon={<Icon name="Folder" variant="solid" size="md" />}
          iconOnly
        />
      </div>
    </div>
  )
}

export default EntryList
