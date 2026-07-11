import { useState, useEffect } from 'react'
import { getVersion } from '@tauri-apps/api/app'
import { Icon, layers, linux, proton, settings, diamond } from '@/components/icons'
import { epic } from '@/components/icons'

interface SidebarProps {
  setFilter: (filter: string) => void
  currentFilter: string
}

type FilterItem = {
  id: string
  label: string
  icon: string
  variant?: string
}

const Sidebar = ({ setFilter, currentFilter }: SidebarProps) => {
  const [version, setVersion] = useState('')

  useEffect(() => {
    getVersion()
      .then(setVersion)
      .catch(() => setVersion(''))
  }, [])

  const generalFilters: FilterItem[] = [
    { id: 'overview', label: 'Overview', icon: diamond, variant: 'solid' },
    { id: 'settings', label: 'Settings', icon: settings, variant: 'solid' },
  ]

  const steamFilters: FilterItem[] = [
    { id: 'all', label: 'All Games', icon: layers, variant: 'solid' },
    { id: 'native', label: 'Native', icon: linux, variant: 'brand' },
    { id: 'proton', label: 'Proton', icon: proton, variant: 'brand' },
  ]

  const epicFilters: FilterItem[] = [
    { id: 'epic', label: 'All Games', icon: epic, variant: 'brand' },
  ]

  const renderFilter = (filter: FilterItem) => (
    <li
      key={filter.id}
      className={currentFilter === filter.id ? 'active' : ''}
      onClick={() => setFilter(filter.id)}
    >
      <div className="filter-item">
        <Icon name={filter.icon} variant={filter.variant} size="md" className="filter-icon" />
        <span>{filter.label}</span>
      </div>
    </li>
  )

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <h2>Library</h2>
      </div>

      <div className="sidebar-section">
        <ul className="filter-list">
          {generalFilters.map(renderFilter)}
        </ul>
      </div>

      <div className="sidebar-section">
        <span className="sidebar-section-label">Steam</span>
        <ul className="filter-list">
          {steamFilters.map(renderFilter)}
        </ul>
      </div>

      <div className="sidebar-section">
        <span className="sidebar-section-label">Epic Games</span>
        <ul className="filter-list">
          {epicFilters.map(renderFilter)}
        </ul>
      </div>

      <div className="sidebar-footer">
        <div className="sidebar-footer-info">
          {version && <span className="sidebar-footer-version">v{version}</span>}
          <span className="sidebar-footer-build">Stable</span>
        </div>
        <a
          href="https://github.com/Novattz/creamlinux-installer"
          target="_blank"
          rel="noopener noreferrer"
          className="sidebar-footer-link"
        >
          GitHub
        </a>
      </div>
    </div>
  )
}

export default Sidebar
