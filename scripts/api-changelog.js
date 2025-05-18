import fs from 'node:fs'
import path from 'node:path'
import { execSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

// Recreate __dirname
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Define paths
const rustFilesPath = path.join(__dirname, '..', 'src-tauri')

function getApiDefinitions() {
  // Get a list of all Rust files
  const rustFiles = findRustFiles(rustFilesPath)

  // Extract API functions and structs from Rust files
  const apiDefinitions = {
    commands: [],
    structs: [],
  }

  rustFiles.forEach((filePath) => {
    const content = fs.readFileSync(filePath, 'utf8')

    // Find Tauri commands (API endpoints)
    const commandRegex = /#\[tauri::command\]\s+(?:pub\s+)?(?:async\s+)?fn\s+([a-zA-Z0-9_]+)/g
    let match
    while ((match = commandRegex.exec(content)) !== null) {
      apiDefinitions.commands.push({
        name: match[1],
        file: path.relative(rustFilesPath, filePath),
      })
    }

    // Find structs that are likely part of the API
    const structRegex = /#\[derive\(.*Serialize.*\)\]\s+(?:pub\s+)?struct\s+([a-zA-Z0-9_]+)/g
    while ((match = structRegex.exec(content)) !== null) {
      apiDefinitions.structs.push({
        name: match[1],
        file: path.relative(rustFilesPath, filePath),
      })
    }
  })

  return apiDefinitions
}

function findRustFiles(dir) {
  let results = []
  const list = fs.readdirSync(dir)

  list.forEach((file) => {
    const filePath = path.join(dir, file)
    const stat = fs.statSync(filePath)

    if (stat && stat.isDirectory() && file !== 'target') {
      // Recursively search subdirectories, but skip the 'target' directory
      results = results.concat(findRustFiles(filePath))
    } else if (path.extname(file) === '.rs') {
      // Add Rust files to the results
      results.push(filePath)
    }
  })

  return results
}

function compareApiDefinitions(oldApi, newApi) {
  const changes = {
    commands: {
      added: [],
      removed: [],
    },
    structs: {
      added: [],
      removed: [],
    },
  }

  // Find added and removed commands
  const oldCommandNames = oldApi.commands.map((cmd) => cmd.name)
  const newCommandNames = newApi.commands.map((cmd) => cmd.name)

  changes.commands.added = newApi.commands.filter((cmd) => !oldCommandNames.includes(cmd.name))
  changes.commands.removed = oldApi.commands.filter((cmd) => !newCommandNames.includes(cmd.name))

  // Find added and removed structs
  const oldStructNames = oldApi.structs.map((struct) => struct.name)
  const newStructNames = newApi.structs.map((struct) => struct.name)

  changes.structs.added = newApi.structs.filter((struct) => !oldStructNames.includes(struct.name))
  changes.structs.removed = oldApi.structs.filter((struct) => !newStructNames.includes(struct.name))

  return changes
}

function updateChangelog(changes) {
  const changelogPath = path.join(__dirname, '..', 'CHANGELOG.md')
  let changelog = ''

  // Create changelog if it doesn't exist
  if (fs.existsSync(changelogPath)) {
    changelog = fs.readFileSync(changelogPath, 'utf8')
  } else {
    changelog =
      '# Changelog\n\nAll notable changes to this project will be documented in this file.\n\n'
  }

  // Get the current version and date
  const packageJsonPath = path.join(__dirname, '..', 'package.json')
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'))
  const version = packageJson.version
  const date = new Date().toISOString().split('T')[0]

  // Create the new changelog entry
  let newEntry = `## [${version}] - ${date}\n\n`

  if (
    changes.commands.added.length > 0 ||
    changes.commands.removed.length > 0 ||
    changes.structs.added.length > 0 ||
    changes.structs.removed.length > 0
  ) {
    newEntry += '### API Changes\n\n'

    if (changes.commands.added.length > 0) {
      newEntry += '#### New Commands\n\n'
      changes.commands.added.forEach((cmd) => {
        newEntry += `- \`${cmd.name}\` in \`${cmd.file}\`\n`
      })
      newEntry += '\n'
    }

    if (changes.commands.removed.length > 0) {
      newEntry += '#### Removed Commands\n\n'
      changes.commands.removed.forEach((cmd) => {
        newEntry += `- \`${cmd.name}\` (was in \`${cmd.file}\`)\n`
      })
      newEntry += '\n'
    }

    if (changes.structs.added.length > 0) {
      newEntry += '#### New Structures\n\n'
      changes.structs.added.forEach((struct) => {
        newEntry += `- \`${struct.name}\` in \`${struct.file}\`\n`
      })
      newEntry += '\n'
    }

    if (changes.structs.removed.length > 0) {
      newEntry += '#### Removed Structures\n\n'
      changes.structs.removed.forEach((struct) => {
        newEntry += `- \`${struct.name}\` (was in \`${struct.file}\`)\n`
      })
      newEntry += '\n'
    }
  } else {
    newEntry += 'No API changes in this release.\n\n'
  }

  // Add git commit information since last release
  try {
    // Get the latest tag
    const latestTag = execSync('git describe --tags --abbrev=0', { encoding: 'utf8' }).trim()

    // Get commits since the latest tag
    const commits = execSync(`git log ${latestTag}..HEAD --pretty=format:"%h %s (%an)"`, {
      encoding: 'utf8',
    }).trim()

    if (commits) {
      newEntry += '### Other Changes\n\n'

      // Split commits by line and add them to the changelog
      commits.split('\n').forEach((commit) => {
        newEntry += `- ${commit}\n`
      })

      newEntry += '\n'
    }
  } catch (error) {
    // If there are no tags or other git issues, just continue without commit info
    console.warn('Could not get git commit information:', error.message)
  }

  // Add the new entry to the changelog
  if (changelog.includes('## [')) {
    // Insert new entry after the first heading
    changelog = changelog.replace('# Changelog\n\n', `# Changelog\n\n${newEntry}`)
  } else {
    // Append to the end if no existing versions
    changelog += newEntry
  }

  // Write the updated changelog
  fs.writeFileSync(changelogPath, changelog)
  console.log(`Updated CHANGELOG.md with API changes for version ${version}`)
}

// Main execution
try {
  // Check if we have a saved API definition
  const apiCachePath = path.join(__dirname, '.api-cache.json')
  let oldApi = { commands: [], structs: [] }
  let newApi = getApiDefinitions()

  if (fs.existsSync(apiCachePath)) {
    oldApi = JSON.parse(fs.readFileSync(apiCachePath, 'utf8'))
  }

  // Compare and update the changelog
  const changes = compareApiDefinitions(oldApi, newApi)
  updateChangelog(changes)

  // Save the new API definition for next time
  fs.writeFileSync(apiCachePath, JSON.stringify(newApi, null, 2))
} catch (error) {
  console.error('Error updating API changelog:', error)
  process.exit(1)
}
