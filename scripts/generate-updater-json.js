const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')

// Read the current version from package.json
const packageJson = require('../package.json')
const version = packageJson.version
console.log(`Current version: ${version}`)

// Get the current date in RFC 3339 format for pub_date
const pubDate = new Date().toISOString()

// Base URL where the assets will be available
const baseUrl = 'https://github.com/tickbase/creamlinux/releases/download'
const releaseTag = `v${version}`
const releaseUrl = `${baseUrl}/${releaseTag}`

// Create the updater JSON structure
const updaterJson = {
  version,
  notes: `Release version ${version}`,
  pub_date: pubDate,
  platforms: {
    // Windows x64
    'windows-x86_64': {
      url: `${releaseUrl}/creamlinux-setup.exe`,
      signature: readSignature('windows', 'creamlinux-setup.exe'),
    },
    // Linux x64
    'linux-x86_64': {
      url: `${releaseUrl}/creamlinux.AppImage`,
      signature: readSignature('linux', 'creamlinux.AppImage'),
    },
    // macOS x64 and arm64 (universal)
    'darwin-universal': {
      url: `${releaseUrl}/creamlinux.app.tar.gz`,
      signature: readSignature('macos', 'creamlinux.app.tar.gz'),
    },
  },
}

// Write the updater JSON file
fs.writeFileSync('latest.json', JSON.stringify(updaterJson, null, 2))
console.log('Created latest.json updater file')

// Helper function to read signature files
function readSignature(platform, filename) {
  try {
    // Determine path based on platform
    let sigPath

    switch (platform) {
      case 'windows':
        // Check both NSIS and MSI
        try {
          sigPath = path.join('src-tauri', 'target', 'release', 'bundle', 'nsis', `${filename}.sig`)
          return fs.readFileSync(sigPath, 'utf8').trim()
        } catch (e) {
          sigPath = path.join('src-tauri', 'target', 'release', 'bundle', 'msi', `${filename}.sig`)
          return fs.readFileSync(sigPath, 'utf8').trim()
        }
      case 'linux':
        sigPath = path.join(
          'src-tauri',
          'target',
          'release',
          'bundle',
          'appimage',
          `${filename}.sig`
        )
        return fs.readFileSync(sigPath, 'utf8').trim()
      case 'macos':
        sigPath = path.join('src-tauri', 'target', 'release', 'bundle', 'macos', `${filename}.sig`)
        return fs.readFileSync(sigPath, 'utf8').trim()
      default:
        throw new Error(`Unknown platform: ${platform}`)
    }
  } catch (error) {
    console.error(`Error reading signature for ${platform}/${filename}:`, error.message)
    return ''
  }
}
