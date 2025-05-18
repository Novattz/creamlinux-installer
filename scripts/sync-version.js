import fs from 'node:fs'
import path from 'node:path'
import { execSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

// Recreate __dirname
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Read current version from package.json
const packageJsonPath = path.join(__dirname, '..', 'package.json')
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'))
const version = packageJson.version

console.log(`Current version: ${version}`)

// Update Cargo.toml
const cargoTomlPath = path.join(__dirname, '..', 'src-tauri', 'Cargo.toml')
let cargoToml = fs.readFileSync(cargoTomlPath, 'utf8')

// Replace the version in Cargo.toml
cargoToml = cargoToml.replace(/version\s*=\s*"[^"]+"/m, `version = "${version}"`)
fs.writeFileSync(cargoTomlPath, cargoToml)
console.log(`Updated Cargo.toml version to ${version}`)

// Update tauri.conf.json
const tauriConfigPath = path.join(__dirname, '..', 'src-tauri', 'tauri.conf.json')
const tauriConfig = JSON.parse(fs.readFileSync(tauriConfigPath, 'utf8'))

// Set the version in tauri.conf.json
tauriConfig.version = version
fs.writeFileSync(tauriConfigPath, JSON.stringify(tauriConfig, null, 2))
console.log(`Updated tauri.conf.json version to ${version}`)

console.log('Version synchronization completed!')
