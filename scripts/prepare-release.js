import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { execSync } from 'node:child_process'
import readline from 'node:readline'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Utility
function log(msg) {
  console.log(`\x1b[36m[release]\x1b[0m ${msg}`)
}

function bumpPatchVersion(version) {
  const [major, minor, patch] = version.split('.').map(Number)
  return `${major}.${minor}.${patch + 1}`
}

// STEP 1: Read + bump version
const pkgPath = path.join(__dirname, '..', 'package.json')
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'))
const oldVersion = pkg.version
const newVersion = bumpPatchVersion(oldVersion)
pkg.version = newVersion
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2))
log(`Version bumped: ${oldVersion} → ${newVersion}`)

// STEP 2: Update Cargo.toml
const cargoPath = path.join(__dirname, '..', 'src-tauri', 'Cargo.toml')
let cargoToml = fs.readFileSync(cargoPath, 'utf8')
cargoToml = cargoToml.replace(/version\s*=\s*"[^"]+"/, `version = "${newVersion}"`)
fs.writeFileSync(cargoPath, cargoToml)
log(`Updated Cargo.toml`)

// STEP 3: Update tauri.conf.json
const tauriPath = path.join(__dirname, '..', 'src-tauri', 'tauri.conf.json')
const tauriConfig = JSON.parse(fs.readFileSync(tauriPath, 'utf8'))
tauriConfig.version = newVersion
fs.writeFileSync(tauriPath, JSON.stringify(tauriConfig, null, 2))
log(`Updated tauri.conf.json`)

// STEP 4: Build
log('Building project with Tauri...')
execSync('NO_STRIP=true npm run tauri build', { stdio: 'inherit' })

// STEP 5: Generate latest.json
const pubDate = new Date().toISOString()
const baseUrl = `https://github.com/novattz/rust-gui-dev/releases/download/v${newVersion}`
const latest = {
  version: newVersion,
  notes: `Release version ${newVersion}`,
  pub_date: pubDate,
  platforms: {},
}

function findSig(dir, base) {
  const files = fs.readdirSync(dir)
  const sig = files.find((f) => f.startsWith(base) && f.endsWith('.sig'))
  return sig ? fs.readFileSync(path.join(dir, sig), 'utf8').trim() : null
}

function addPlatform(key, folder, baseName, ext) {
  const dir = path.join(__dirname, '..', 'src-tauri', 'target', 'release', 'bundle', folder)
  const file = `${baseName}${ext}`
  const full = path.join(dir, file)
  if (!fs.existsSync(full)) return
  const sig = findSig(dir, baseName)
  if (!sig) return
  latest.platforms[key] = {
    url: `${baseUrl}/${file}`,
    signature: sig,
  }
}

addPlatform('linux-x86_64', 'appimage', `Creamlinux_${newVersion}_amd64`, '.AppImage')
addPlatform('linux-deb', 'deb', `Creamlinux_${newVersion}_amd64`, '.deb')
addPlatform('linux-rpm', 'rpm', `Creamlinux-${newVersion}-1.x86_64`, '.rpm')
fs.writeFileSync(path.join(__dirname, '..', 'latest.json'), JSON.stringify(latest, null, 2))
log(`Generated latest.json`)

// STEP 6: Update changelog
let changelogPath = path.join(__dirname, '..', 'CHANGELOG.md')
let changelog = fs.existsSync(changelogPath)
  ? fs.readFileSync(changelogPath, 'utf8')
  : '# Changelog\n\n'
const date = new Date().toISOString().split('T')[0]
let newEntry = `## [${newVersion}] - ${date}\n\n`
try {
  const lastTag = execSync('git describe --tags --abbrev=0').toString().trim()
  const commits = execSync(`git log ${lastTag}..HEAD --pretty=format:"- %s (%an)"`)
    .toString()
    .trim()
  newEntry += commits ? `${commits}\n\n` : 'No notable changes.\n\n'
} catch {
  newEntry += 'Initial release.\n\n'
}
changelog = changelog.replace('# Changelog\n\n', `# Changelog\n\n${newEntry}`)
fs.writeFileSync(changelogPath, changelog)
log(`Updated CHANGELOG.md`)

// STEP 7: Confirm + push
const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
rl.question('Review the changelog and press [Enter] to commit, tag, and push release... ', () => {
  execSync(
    'git add package.json CHANGELOG.md src-tauri/Cargo.toml src-tauri/tauri.conf.json latest.json',
    { stdio: 'inherit' }
  )
  execSync(`git commit -m "chore(release): v${newVersion}"`, { stdio: 'inherit' })
  execSync(`git tag v${newVersion}`, { stdio: 'inherit' })
  execSync('git push && git push --tags', { stdio: 'inherit' })
  log('🚀 Release pushed!')
  rl.close()
})
