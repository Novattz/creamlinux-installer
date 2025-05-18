import { Icon, layers, linux, proton } from '@/components/icons'

interface SidebarProps {
  setFilter: (filter: string) => void
  currentFilter: string
}

// Define a type for filter items that makes variant optional
type FilterItem = {
  id: string
  label: string
  icon: string
  variant?: string
}

/**
 * Application sidebar component
 * Contains filters for game types
 */
const Sidebar = ({ setFilter, currentFilter }: SidebarProps) => {
  // Available filter options with icons
  const filters: FilterItem[] = [
    { id: 'all', label: 'All Games', icon: layers, variant: 'bold' },
    { id: 'native', label: 'Native', icon: linux, variant: 'brand' },
    { id: 'proton', label: 'Proton Required', icon: proton, variant: 'brand' }
  ]
  
  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <h2>Library</h2>
      </div>
      
      <ul className="filter-list">
        {filters.map(filter => (
          <li 
            key={filter.id}
            className={currentFilter === filter.id ? 'active' : ''}
            onClick={() => setFilter(filter.id)}
          >
            <div className="filter-item">
              <Icon 
                name={filter.icon}
                variant={filter.variant}
                size="md" 
                className="filter-icon"
              />
              <span>{filter.label}</span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

export default Sidebar