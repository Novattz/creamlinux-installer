const fs = require('fs')
const path = require('path')

// Path to your tauri.conf.json file
const tauriConfigPath = path.join(__dirname, '..', 'src-tauri', 'tauri.conf.json')

// Read the current config
const rawConfig = fs.readFileSync(tauriConfigPath, 'utf8')
const config = JSON.parse(rawConfig)

// Add or update the updater configuration
if (!config.plugins) {
  config.plugins = {}
}

// Get the public key from environment variable
const pubkey = process.env.TAURI_PUBLIC_KEY || ''

if (!pubkey) {
  console.warn(
    'Warning: TAURI_PUBLIC_KEY environment variable is not set. Updater will not work correctly!'
  )
}

// Configure the updater plugin
config.plugins.updater = {
  pubkey,
  endpoints: ['https://github.com/tickbase/creamlinux/releases/latest/download/latest.json'],
}

// Configure bundle settings for updater artifacts
if (!config.bundle) {
  config.bundle = {}
}

// Set createUpdaterArtifacts to true
config.bundle.createUpdaterArtifacts = true

// Write the updated config back to the file
fs.writeFileSync(tauriConfigPath, JSON.stringify(config, null, 2))

console.log('Tauri config updated with updater configuration')
