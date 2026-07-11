import { useState, useEffect, ReactNode } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { useAppContext } from '@/contexts/useAppContext'
import { Icon, IconName } from '@/components/icons'

interface LocalReport {
  game_id: string
  unlocker: string
  worked: boolean
}

interface SystemInfo {
  os_name: string
  cpu_model: string
  cpu_cores: number
  gpu_name: string
}

interface StatChipProps {
  label: string
  value: ReactNode
  icon: IconName | string
  variant?: string
}

const StatChip = ({ label, value, icon, variant }: StatChipProps) => (
  <div className="stat-chip">
    <Icon name={icon} variant={variant} size="md" className="stat-chip-icon" />
    <span className="stat-chip-value">{value}</span>
    <span className="stat-chip-label">{label}</span>
  </div>
)

/**
 * Overview page - the default landing view. Leads with the two library
 * totals as hero numbers, then a Native/Proton composition bar for the
 * Steam library, then secondary stats as compact chips, plus app info.
 */
const OverviewPage = () => {
  const { games, epicGames, epicLoading, loadEpicGames, activityFeed } = useAppContext()
  const [localReports, setLocalReports] = useState<LocalReport[]>([])
  const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null)

  useEffect(() => {
    invoke<LocalReport[]>('get_local_reports')
      .then(setLocalReports)
      .catch(() => setLocalReports([]))
  }, [])

  useEffect(() => {
    invoke<SystemInfo>('get_system_info')
      .then(setSystemInfo)
      .catch(() => setSystemInfo(null))
  }, [])

  // Overview is the default landing page, so kick off the Epic scan here too
  // otherwise the Epic count would show 0 until the user visits that tab.
  useEffect(() => {
    if (epicGames.length === 0 && !epicLoading) {
      loadEpicGames()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const nativeCount = games.filter((g) => g.native).length
  const protonCount = games.length - nativeCount
  const creamCount = games.filter((g) => g.cream_installed).length
  const smokeCount = games.filter((g) => g.smoke_installed).length
  const nativePct = games.length ? (nativeCount / games.length) * 100 : 0
  const protonPct = games.length ? (protonCount / games.length) * 100 : 0

  return (
    <div className="overview-page">
      <h2>Overview</h2>

      <div className="stat-hero">
        <div className="stat-hero-item">
          <span className="stat-hero-value">{games.length}</span>
          <span className="stat-hero-label">Steam Games</span>
        </div>
        <div className="stat-hero-divider" />
        <div className="stat-hero-item">
          <span className="stat-hero-value">{epicLoading ? '—' : epicGames.length}</span>
          <span className="stat-hero-label">Epic Games</span>
        </div>
      </div>

      {games.length > 0 && (
        <div className="library-composition">
          <span className="overview-section-label">Steam Library Composition</span>
          <div className="composition-bar">
            <div className="composition-segment native" style={{ width: `${nativePct}%` }} />
            <div className="composition-segment proton" style={{ width: `${protonPct}%` }} />
          </div>
          <div className="composition-legend">
            <div className="legend-item">
              <span className="legend-dot native" />
              <span className="legend-label">Native</span>
              <span className="legend-value">{nativeCount}</span>
            </div>
            <div className="legend-item">
              <span className="legend-dot proton" />
              <span className="legend-label">Proton</span>
              <span className="legend-value">{protonCount}</span>
            </div>
          </div>
        </div>
      )}

      <div className="stat-chips">
        <StatChip label="CreamLinux Installed" value={creamCount} icon="Linux" />
        <StatChip label="SmokeAPI Installed" value={smokeCount} icon="Windows" />
        <StatChip label="Compatibility Reports" value={localReports.length} icon="Star" />
      </div>

      <div className="overview-columns">
        <div className="page-section">
          <h4>Recent Activity</h4>

          {activityFeed.length === 0 ? (
            <p className="page-section-description">
              Nothing yet this session - install or uninstall something and it'll show up here.
            </p>
          ) : (
            <ul className="activity-feed">
              {activityFeed.map((item) => (
                <li key={item.id} className="activity-item">
                  <span className={`activity-item-dot activity-item-dot--${item.type}`} />
                  <span className="activity-item-message">{item.message}</span>
                  <span className="activity-item-time">
                    {new Date(item.timestamp).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="page-section">
          <h4>System</h4>

          {systemInfo ? (
            <div className="system-specs">
              <div className="system-spec system-spec--os">
                <span className="system-spec-label">Operating System</span>
                <span className="system-spec-value" title={systemInfo.os_name}>
                  {systemInfo.os_name}
                </span>
              </div>
              <div className="system-spec system-spec--cpu">
                <span className="system-spec-label">Processor</span>
                <span className="system-spec-value" title={systemInfo.cpu_model}>
                  {systemInfo.cpu_model}
                </span>
                <span className="system-spec-sub">{systemInfo.cpu_cores} threads</span>
              </div>
              <div className="system-spec system-spec--gpu">
                <span className="system-spec-label">Graphics</span>
                <span className="system-spec-value" title={systemInfo.gpu_name}>
                  {systemInfo.gpu_name}
                </span>
              </div>
            </div>
          ) : (
            <p className="page-section-description">Reading system info...</p>
          )}
        </div>
      </div>
    </div>
  )
}

export default OverviewPage
