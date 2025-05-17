import React from 'react'

interface SidebarProps {
  setFilter: (filter: string) => void
  currentFilter: string
}

const Sidebar: React.FC<SidebarProps> = ({ setFilter, currentFilter }) => {
  return (
    <div className="sidebar">
      <h2>Library</h2>
      <ul className="filter-list">
        <li className={currentFilter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}>
          All Games
        </li>
        <li
          className={currentFilter === 'native' ? 'active' : ''}
          onClick={() => setFilter('native')}
        >
          Native
        </li>
        <li
          className={currentFilter === 'proton' ? 'active' : ''}
          onClick={() => setFilter('proton')}
        >
          Proton Required
        </li>
      </ul>
    </div>
  )
}

export default Sidebar
