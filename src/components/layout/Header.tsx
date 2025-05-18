import { Button } from '@/components/buttons'

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
const Header = ({
  onRefresh,
  refreshDisabled = false,
  onSearch,
  searchQuery,
}: HeaderProps) => {
  return (
    <header className="app-header">
      <h1>CreamLinux</h1>
      <div className="header-controls">
        <Button 
          variant="primary"
          onClick={onRefresh} 
          disabled={refreshDisabled}
          className="refresh-button"
        >
          Refresh
        </Button>
        <input
          type="text"
          placeholder="Search games..."
          className="search-input"
          value={searchQuery}
          onChange={(e) => onSearch(e.target.value)}
        />
      </div>
    </header>
  )
}

export default Header