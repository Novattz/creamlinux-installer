import { useState, useEffect } from 'react'
import Dialog from './Dialog'
import DialogHeader from './DialogHeader'
import DialogBody from './DialogBody'
import DialogFooter from './DialogFooter'
import DialogActions from './DialogActions'
import { Button } from '@/components/buttons'
import { DlcInfo } from '@/types'

export interface AddDlcDialogProps {
  visible: boolean
  onClose: () => void
  onAdd: (dlc: DlcInfo) => void
  existingIds: Set<string>
}

/**
 * Add DLC Manually dialog
 * Allows users to manually enter a DLC ID and name when it is
 * missing from the Steam API and cannot be fetched automatically
 */
const AddDlcDialog = ({ visible, onClose, onAdd, existingIds }: AddDlcDialogProps) => {
  const [id, setId] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState('')

  // Reset form state when dialog closes
  useEffect(() => {
    if (!visible) {
      setId('')
      setName('')
      setError('')
    }
  }, [visible])

  // Validate inputs and add the DLC to the list
  const handleSubmit = () => {
    const trimmedId = id.trim()
    const trimmedName = name.trim()

    if (!trimmedId) return setError('DLC ID is required.')
    if (!/^\d+$/.test(trimmedId)) return setError('DLC ID must be a number.')
    if (existingIds.has(trimmedId)) return setError('A DLC with this ID already exists.')
    if (!trimmedName) return setError('DLC name is required.')

    onAdd({ appid: trimmedId, name: trimmedName, enabled: true })
    onClose()
  }

  return (
    <Dialog visible={visible} onClose={onClose} size="small">
      <DialogHeader onClose={onClose}>
        <h3>Add DLC Manually</h3>
      </DialogHeader>
      <DialogBody>
        <div className="add-dlc-form">
          <div className="add-dlc-field">
            <label className="add-dlc-label">DLC ID</label>
            <input
              type="text"
              className="add-dlc-input"
              placeholder="e.g. 1234560"
              value={id}
              onChange={(e) => { setId(e.target.value); setError('') }}
              onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
              autoFocus
            />
          </div>
          <div className="add-dlc-field">
            <label className="add-dlc-label">DLC Name</label>
            <input
              type="text"
              className="add-dlc-input"
              placeholder="e.g. Expansion - My DLC"
              value={name}
              onChange={(e) => { setName(e.target.value); setError('') }}
              onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
            />
          </div>
          {error && <p className="add-dlc-error">{error}</p>}
        </div>
      </DialogBody>
      <DialogFooter>
        <DialogActions>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={handleSubmit}>Add DLC</Button>
        </DialogActions>
      </DialogFooter>
    </Dialog>
  )
}

export default AddDlcDialog
