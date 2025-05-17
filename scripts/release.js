#!/usr/bin/env node

/**
 * CreamLinux Release Script
 * This script helps automate the release process by triggering the GitHub Actions workflow
 *
 * Usage:
 *   node scripts/release.js [patch|minor|major] [release notes]
 *
 * Examples:
 *   node scripts/release.js patch
 *   node scripts/release.js minor "Added new feature X"
 *   node scripts/release.js major "Major redesign with new UI"
 */

import { execSync } from 'child_process'
import { existsSync } from 'fs'
import path from 'path'

// Configuration
const GITHUB_WORKFLOW_NAME = 'release.yml'

// Validate environment
function validateEnvironment() {
  try {
    // Check if git is installed
    execSync('git --version', { stdio: 'ignore' })

    // Check if GitHub CLI is installed
    execSync('gh --version', { stdio: 'ignore' })

    // Check if the user is authenticated with GitHub CLI
    execSync('gh auth status', { stdio: 'ignore' })

    // Check if we're in a git repository
    execSync('git rev-parse --is-inside-work-tree', { stdio: 'ignore' })

    // Check if the workflow file exists
    const workflowPath = path.join('.github', 'workflows', GITHUB_WORKFLOW_NAME)
    if (!existsSync(workflowPath)) {
      console.error(`Error: Workflow file not found at ${workflowPath}`)
      process.exit(1)
    }

    // Check if there are uncommitted changes
    const status = execSync('git status --porcelain').toString().trim()
    if (status) {
      console.error('Error: There are uncommitted changes in the repository.')
      console.error('Please commit or stash your changes before running this script.')
      process.exit(1)
    }
  } catch (error) {
    console.error(`Environment validation failed: ${error.message}`)
    process.exit(1)
  }
}

// Parse arguments
function parseArguments() {
  const args = process.argv.slice(2)

  if (args.length === 0) {
    console.error('Error: Missing version type argument')
    showUsage()
    process.exit(1)
  }

  const versionType = args[0].toLowerCase()
  if (!['patch', 'minor', 'major'].includes(versionType)) {
    console.error(`Error: Invalid version type "${versionType}"`)
    showUsage()
    process.exit(1)
  }

  // Join remaining arguments as release notes
  const releaseNotes = args.slice(1).join(' ')

  return { versionType, releaseNotes }
}

// Show usage information
function showUsage() {
  console.log('Usage: node scripts/release.js [patch|minor|major] [release notes]')
  console.log('')
  console.log('Examples:')
  console.log('  node scripts/release.js patch')
  console.log('  node scripts/release.js minor "Added new feature X"')
  console.log('  node scripts/release.js major "Major redesign with new UI"')
}

// Trigger GitHub workflow
function triggerWorkflow(versionType, releaseNotes) {
  try {
    console.log(`Triggering release workflow with version type: ${versionType}`)

    const command = releaseNotes
      ? `gh workflow run ${GITHUB_WORKFLOW_NAME} -f version_type=${versionType} -f custom_release_notes="${releaseNotes}"`
      : `gh workflow run ${GITHUB_WORKFLOW_NAME} -f version_type=${versionType}`

    execSync(command, { stdio: 'inherit' })

    console.log('\nRelease workflow triggered successfully!')
    console.log('You can check the progress in the Actions tab of your GitHub repository.')
    console.log('https://github.com/Novattz/rust-gui-dev/actions')
  } catch (error) {
    console.error(`Failed to trigger workflow: ${error.message}`)
    process.exit(1)
  }
}

// Main function
function main() {
  console.log('=== CreamLinux Release Script ===\n')

  validateEnvironment()
  const { versionType, releaseNotes } = parseArguments()

  console.log(`Version type: ${versionType}`)
  if (releaseNotes) {
    console.log(`Release notes: "${releaseNotes}"`)
  } else {
    console.log('Release notes: Auto-generated from commit messages')
  }

  // Confirm with user
  console.log('\nThis will trigger a GitHub Actions workflow to create a new release.')
  console.log('Press Ctrl+C to cancel or wait 5 seconds to continue...')

  setTimeout(() => {
    triggerWorkflow(versionType, releaseNotes)
  }, 5000)
}

main()
