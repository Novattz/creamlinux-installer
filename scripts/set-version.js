#!/usr/bin/env node

import fs from 'fs'
import path from 'path'

// Get version from command line argument
const newVersion = process.argv[2]

if (!newVersion) {
  console.error('Error: No version specified')
  console.log('Usage: npm run set-version <version>')
  console.log('Example: npm run set-version 1.2.3')
  process.exit(1)
}

// Validate version format (basic semver check)
if (!/^\d+\.\d+\.\d+$/.test(newVersion)) {
  console.error('Error: Invalid version format. Use semver format: X.Y.Z')
  console.log('Example: 1.2.3')
  process.exit(1)
}

console.log(`Setting version to ${newVersion}...\n`)

let errors = 0

// 1. Update package.json
try {
  const packageJsonPath = path.join(process.cwd(), 'package.json')
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'))
  packageJson.version = newVersion
  fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n')
  console.log('Updated package.json')
} catch (err) {
  console.error('Failed to update package.json:', err.message)
  errors++
}

// 2. Update package-lock.json
try {
  const packageLockPath = path.join(process.cwd(), 'package-lock.json')
  if (fs.existsSync(packageLockPath)) {
    const packageLock = JSON.parse(fs.readFileSync(packageLockPath, 'utf8'))
    packageLock.version = newVersion
    if (packageLock.packages && packageLock.packages['']) {
      packageLock.packages[''].version = newVersion
    }
    fs.writeFileSync(packageLockPath, JSON.stringify(packageLock, null, 2) + '\n')
    console.log('Updated package-lock.json')
  } else {
    console.log('package-lock.json not found (skipping)')
  }
} catch (err) {
  console.error('Failed to update package-lock.json:', err.message)
  errors++
}

// 3. Update Cargo.toml
try {
  const cargoTomlPath = path.join(process.cwd(), 'src-tauri', 'Cargo.toml')
  let cargoToml = fs.readFileSync(cargoTomlPath, 'utf8')

  // Replace version in [package] section
  cargoToml = cargoToml.replace(/^version\s*=\s*"[^"]*"/m, `version = "${newVersion}"`)

  fs.writeFileSync(cargoTomlPath, cargoToml)
  console.log('Updated Cargo.toml')
} catch (err) {
  console.error('Failed to update Cargo.toml:', err.message)
  errors++
}

// 4. Update tauri.conf.json
try {
  const tauriConfPath = path.join(process.cwd(), 'src-tauri', 'tauri.conf.json')
  const tauriConf = JSON.parse(fs.readFileSync(tauriConfPath, 'utf8'))
  tauriConf.version = newVersion
  fs.writeFileSync(tauriConfPath, JSON.stringify(tauriConf, null, 2) + '\n')
  console.log('Updated tauri.conf.json')
} catch (err) {
  console.error('Failed to update tauri.conf.json:', err.message)
  errors++
}

// Summary
console.log('\n' + '='.repeat(50))
if (errors === 0) {
  console.log(`Successfully set version to ${newVersion} in all files!`)
} else {
  console.log(`Completed with ${errors} error(s)`)
  process.exit(1)
}
