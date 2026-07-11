import { Icon, diamond, search } from '@/components/icons'

interface HeaderProps {
  onSearch: (query: string) => void
  searchQuery: string
}

/**
 * Application header component
 * Contains the app title and search input
 */
const Header = ({ onSearch, searchQuery }: HeaderProps) => {
  return (
    <header className="app-header">
      <div className="app-title">
        <Icon name={diamond} variant="solid" size="lg" className="app-logo-icon" />
        <h1>CreamLinux</h1>
      </div>

      <div className="header-controls">
        <div className="search-container">
          <input
            type="text"
            placeholder="Search games..."
            className="search-input"
            value={searchQuery}
            onChange={(e) => onSearch(e.target.value)}
          />
          <Icon name={search} variant="solid" size="md" className="search-icon" />
        </div>
      </div>
    </header>
  )
}

export default Header
