import { useState, useEffect } from 'react'
import { check, type Update, type DownloadEvent } from '@tauri-apps/plugin-updater'
import { relaunch } from '@tauri-apps/plugin-process'
import { Button } from '@/components/buttons'

/**
 * React component that checks for updates and provides
 * UI for downloading and installing them
 */
const UpdateChecker = () => {
  const [updateAvailable, setUpdateAvailable] = useState(false)
  const [updateInfo, setUpdateInfo] = useState<Update | null>(null)
  const [isChecking, setIsChecking] = useState(false)
  const [isDownloading, setIsDownloading] = useState(false)
  const [downloadProgress, setDownloadProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)

  // Check for updates on component mount
  useEffect(() => {
    checkForUpdates()
  }, [])

  const checkForUpdates = async () => {
    try {
      setIsChecking(true)
      setError(null)
      
      // Check for updates
      const update = await check()
      
      if (update) {
        console.log(`Update available: ${update.version}`)
        setUpdateAvailable(true)
        setUpdateInfo(update)
      } else {
        console.log('No updates available')
        setUpdateAvailable(false)
      }
    } catch (err) {
      console.error('Failed to check for updates:', err)
      setError(`Failed to check for updates: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setIsChecking(false)
    }
  }

  const downloadAndInstallUpdate = async () => {
    if (!updateInfo) return
    
    try {
      setIsDownloading(true)
      setError(null)
      
      let downloaded = 0
      let contentLength = 0
      
      // Download and install update
      await updateInfo.downloadAndInstall((event: DownloadEvent) => {
        switch (event.event) {
          case 'Started':
            // Started event includes contentLength
            if ('contentLength' in event.data && typeof event.data.contentLength === 'number') {
              contentLength = event.data.contentLength
              console.log(`Started downloading ${contentLength} bytes`)
            }
            break
          case 'Progress':
            // Progress event includes chunkLength
            if ('chunkLength' in event.data && typeof event.data.chunkLength === 'number' && contentLength > 0) {
              downloaded += event.data.chunkLength
              const progress = (downloaded / contentLength) * 100
              setDownloadProgress(progress)
              console.log(`Downloaded ${downloaded} from ${contentLength}`)
            }
            break
          case 'Finished':
            console.log('Download finished')
            break
        }
      })
      
      console.log('Update installed, relaunching application')
      await relaunch()
    } catch (err) {
      console.error('Failed to download and install update:', err)
      setError(`Failed to download and install update: ${err instanceof Error ? err.message : String(err)}`)
      setIsDownloading(false)
    }
  }

  if (isChecking) {
    return <div className="update-checker">Checking for updates...</div>
  }

  if (error) {
    return (
      <div className="update-checker error">
        <p>{error}</p>
        <Button variant="primary" onClick={checkForUpdates}>Try Again</Button>
      </div>
    )
  }

  if (!updateAvailable || !updateInfo) {
    return null // Don't show anything if there's no update
  }

  return (
    <div className="update-checker">
      <div className="update-info">
        <h3>Update Available</h3>
        <p>Version {updateInfo.version} is available to download.</p>
        {updateInfo.body && <p className="update-notes">{updateInfo.body}</p>}
      </div>

      {isDownloading ? (
        <div className="update-progress">
          <div className="progress-bar-container">
            <div 
              className="progress-bar" 
              style={{ width: `${downloadProgress}%` }} 
            />
          </div>
          <p>Downloading: {Math.round(downloadProgress)}%</p>
        </div>
      ) : (
        <div className="update-actions">
          <Button 
            variant="primary" 
            onClick={downloadAndInstallUpdate}
            disabled={isDownloading}
          >
            Download & Install
          </Button>
          <Button 
            variant="secondary"
            onClick={() => setUpdateAvailable(false)}
          >
            Later
          </Button>
        </div>
      )}
    </div>
  )
}

export default UpdateChecker