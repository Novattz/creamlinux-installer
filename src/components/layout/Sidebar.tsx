interface SidebarProps {
  setFilter: (filter: string) => void
  currentFilter: string
}

/**
 * Application sidebar component
 * Contains filters for game types
 */
const Sidebar = ({ setFilter, currentFilter }: SidebarProps) => {
  // Available filter options
  const filters = [
    { id: 'all', label: 'All Games' },
    { id: 'native', label: 'Native' },
    { id: 'proton', label: 'Proton Required' }
  ]
  
  return (
    <div className="sidebar">
      <h2>Library</h2>
      <ul className="filter-list">
        {filters.map(filter => (
          <li 
            key={filter.id}
            className={currentFilter === filter.id ? 'active' : ''}
            onClick={() => setFilter(filter.id)}
          >
            {filter.label}
          </li>
        ))}
      </ul>
    </div>
  )
}

export default Sidebar