import { useState, useEffect, useCallback, useRef } from 'react'
import { check } from '@tauri-apps/plugin-updater'
import { relaunch } from '@tauri-apps/plugin-process'
import { ProgressBar, Spinner } from '@/components/common'

interface UpdateScreenProps {
  onComplete: () => void
}

/**
 * Update screen displayed before the initial loading screen
 * Checks for updates and installs them automatically
 */
const UpdateScreen = ({ onComplete }: UpdateScreenProps) => {
  const [checking, setChecking] = useState(true)
  const [downloading, setDownloading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [version, setVersion] = useState('')
  const totalBytesRef = useRef(0)
  const downloadedBytesRef = useRef(0)

  const checkForUpdates = useCallback(async () => {
    try {
      setChecking(true)
      const update = await check()

      // Check if update exists (null means no update available)
      if (update) {
        setChecking(false)
        setDownloading(true)
        setVersion(update.version)

        // Download and install the update
        totalBytesRef.current = 0
        downloadedBytesRef.current = 0

        await update.downloadAndInstall((event) => {
          switch (event.event) {
            case 'Started': {
              totalBytesRef.current = event.data.contentLength ?? 0
              console.log(`Started downloading ${totalBytesRef.current} bytes`)
              break
            }
            case 'Progress': {
              downloadedBytesRef.current += event.data.chunkLength
              // Percentage of total bytes downloaded so far (0 if the server
              // didn't report a content length)
              const total = totalBytesRef.current
              setProgress(total > 0 ? Math.min((downloadedBytesRef.current / total) * 100, 100) : 0)
              break
            }
            case 'Finished':
              console.log('Download finished, installing...')
              setProgress(100)
              break
          }
        })

        // Relaunch the app
        await relaunch()
      } else {
        // No update available (update is null), proceed to normal loading
        setChecking(false)
        onComplete()
      }
    } catch (error) {
      console.error('Update check failed:', error)
      // On error, just continue to the app
      setChecking(false)
      onComplete()
    }
  }, [onComplete])

  useEffect(() => {
    checkForUpdates()
  }, [checkForUpdates])

  return (
    <div className="initial-loading-screen">
      <div className="loading-content">
        <h1>CreamLinux</h1>

        <div className="loading-animation">
          {checking && <Spinner />}
        </div>

        <p className="loading-message">
          {checking && 'Checking for updates...'}
          {downloading && `Downloading update v${version}...`}
        </p>

        {downloading && <ProgressBar progress={progress} />}
      </div>
    </div>
  )
}

export default UpdateScreen