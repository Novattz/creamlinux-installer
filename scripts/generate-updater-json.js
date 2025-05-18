import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'))
const version = packageJson.version
const pubDate = new Date().toISOString()

const baseUrl = 'https://github.com/novattz/rust-gui-dev/releases/download'
const releaseTag = `v${version}`
const releaseUrl = `${baseUrl}/${releaseTag}`

function findSigFile(dir, baseName) {
  const files = fs.readdirSync(dir)
  const sigFile = files.find((f) => f.startsWith(baseName) && f.endsWith('.sig'))
  return sigFile ? fs.readFileSync(path.join(dir, sigFile), 'utf8').trim() : null
}

function addPlatform(platformKey, folder, baseName, ext) {
  const dir = path.join('src-tauri', 'target', 'release', 'bundle', folder)
  const fileName = `${baseName}${ext}`
  const filePath = path.join(dir, fileName)

  if (fs.existsSync(filePath)) {
    const signature = findSigFile(dir, baseName)
    if (!signature) {
      console.warn(`⚠️  Signature not found for ${fileName}`)
      return
    }

    updaterJson.platforms[platformKey] = {
      url: `${releaseUrl}/${fileName}`,
      signature,
    }
  } else {
    console.warn(`⚠️  File not found: ${filePath}`)
  }
}

const updaterJson = {
  version,
  notes: `Release version ${version}`,
  pub_date: pubDate,
  platforms: {},
}

addPlatform('linux-x86_64', 'appimage', `Creamlinux_${version}_amd64`, '.AppImage')
addPlatform('linux-deb', 'deb', `Creamlinux_${version}_amd64`, '.deb')
addPlatform('linux-rpm', 'rpm', `Creamlinux-${version}-1.x86_64`, '.rpm')

// Optional: Windows/macOS can still be supported later

fs.writeFileSync('latest.json', JSON.stringify(updaterJson, null, 2))
console.log('✅ Created latest.json updater file')
