import { Button } from '@/components/buttons'
import { Icon, diamond, refresh, search } from '@/components/icons'

interface HeaderProps {
  onRefresh: () => void
  refreshDisabled?: boolean
  onSearch: (query: string) => void
  searchQuery: string
}

/**
 * Application header component
 * Contains the app title, search input, and refresh button
 */
const Header = ({ onRefresh, refreshDisabled = false, onSearch, searchQuery }: HeaderProps) => {
  return (
    <header className="app-header">
      <div className="app-title">
        <Icon name={diamond} variant="bold" size="lg" className="app-logo-icon" />
        <h1>CreamLinux</h1>
      </div>
      <div className="header-controls">
        <Button
          variant="primary"
          onClick={onRefresh}
          disabled={refreshDisabled}
          className="refresh-button"
          leftIcon={<Icon name={refresh} variant="bold" size="md" />}
        >
          Refresh
        </Button>
        <div className="search-container">
          <input
            type="text"
            placeholder="Search games..."
            className="search-input"
            value={searchQuery}
            onChange={(e) => onSearch(e.target.value)}
          />
          <Icon name={search} variant="bold" size="md" className="search-icon" />
        </div>
      </div>
    </header>
  )
}

export default Header
