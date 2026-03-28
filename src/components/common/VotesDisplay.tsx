import React from 'react'

export interface GameVotes {
  unlocker: string
  success: number
  fail: number
}

interface VotesDisplayProps {
  votes: GameVotes | null
}

/**
 * Compact vote bar shown inside the unlocker selection dialog.
 * Shows a green/red progress bar with a label, or "No votes yet" when empty.
 */
const VotesDisplay: React.FC<VotesDisplayProps> = ({ votes }) => {
  if (!votes || (votes.success === 0 && votes.fail === 0)) {
    return (
      <div className="unlocker-votes">
        <span className="votes-label votes-label--none">No votes yet</span>
      </div>
    )
  }

  const total = votes.success + votes.fail
  const pct = Math.round((votes.success / total) * 100)

  const labelClass =
    pct >= 70 ? 'votes-label--positive' : pct >= 40 ? '' : 'votes-label--negative'

  return (
    <div
      className="unlocker-votes"
      title={`${votes.success} worked · ${votes.fail} didn't work`}
    >
      <div className="votes-bar-wrap">
        <div className="votes-bar-fill" style={{ width: `${pct}%` }} />
      </div>
      <span className={`votes-label ${labelClass}`}>
        {pct}% working ({total})
      </span>
    </div>
  )
}

export default VotesDisplay