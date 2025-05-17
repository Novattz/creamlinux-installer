#!/usr/bin/env node

/**
 * CreamLinux Release Script
 * This script helps automate the release process by triggering the GitHub Actions workflow
 *
 * Usage:
 *   node scripts/release.js [patch|minor|major] [options] [release notes]
 *
 * Options:
 *   --dry-run    Perform a dry run (no actual release)
 *   --local      Test the workflow locally with act before running on GitHub
 *   --help       Show help message
 *
 * Examples:
 *   node scripts/release.js patch
 *   node scripts/release.js minor "Added new feature X"
 *   node scripts/release.js major "Major redesign with new UI"
 *   node scripts/release.js patch --dry-run
 *   node scripts/release.js minor --local
 */

import { execSync } from 'child_process'
import { existsSync } from 'fs'
import path from 'path'

// Configuration
const GITHUB_WORKFLOW_NAME = 'release.yml'

// Check if act is installed for local testing
function isActInstalled() {
  try {
    execSync('act --version', { stdio: 'ignore' })
    return true
  } catch (error) {
    return false
  }
}

// Validate environment
function validateEnvironment(isLocal) {
  try {
    // Check if git is installed
    execSync('git --version', { stdio: 'ignore' })

    if (!isLocal) {
      // Check if GitHub CLI is installed
      execSync('gh --version', { stdio: 'ignore' })

      // Check if the user is authenticated with GitHub CLI
      execSync('gh auth status', { stdio: 'ignore' })
    } else {
      // Check if act is installed for local testing
      if (!isActInstalled()) {
        console.error('Error: "act" is required for local testing but is not installed.')
        console.error('You can install it from: https://github.com/nektos/act')
        process.exit(1)
      }
    }

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

  if (args.length === 0 || args[0] === '--help') {
    showUsage()
    process.exit(args[0] === '--help' ? 0 : 1)
  }

  const versionType = args[0].toLowerCase()
  if (!['patch', 'minor', 'major'].includes(versionType)) {
    console.error(`Error: Invalid version type "${versionType}"`)
    showUsage()
    process.exit(1)
  }

  // Extract options
  const options = {
    dryRun: args.includes('--dry-run'),
    localTest: args.includes('--local'),
  }

  // Join remaining arguments as release notes (excluding options)
  const releaseNotes = args
    .slice(1)
    .filter((arg) => !arg.startsWith('--'))
    .join(' ')

  return { versionType, releaseNotes, options }
}

// Show usage information
function showUsage() {
  console.log('Usage: node scripts/release.js [patch|minor|major] [options] [release notes]')
  console.log('')
  console.log('Options:')
  console.log('  --dry-run    Perform a dry run (no actual release)')
  console.log('  --local      Test the workflow locally with act before running on GitHub')
  console.log('  --help       Show this help message')
  console.log('')
  console.log('Examples:')
  console.log('  node scripts/release.js patch')
  console.log('  node scripts/release.js minor "Added new feature X"')
  console.log('  node scripts/release.js major "Major redesign with new UI"')
  console.log('  node scripts/release.js patch --dry-run')
  console.log('  node scripts/release.js minor --local')
}

// Run local test with act
function runLocalTest(versionType, releaseNotes) {
  console.log('\n=== Running local workflow test with act ===')

  try {
    const actCommand = `act workflow_dispatch -j version-bump -e ./scripts/test-event.json`

    // First create the test event JSON
    const testEvent = {
      inputs: {
        version_type: versionType,
        custom_release_notes: releaseNotes || '',
        dry_run: true,
      },
    }

    // Write the test event to a file
    const fs = require('fs')
    fs.writeFileSync('./scripts/test-event.json', JSON.stringify(testEvent, null, 2))

    console.log('Running local test with act (this might take a while)...')
    execSync(actCommand, { stdio: 'inherit' })

    // Clean up
    fs.unlinkSync('./scripts/test-event.json')

    console.log('\n✅ Local test completed successfully!')
    return true
  } catch (error) {
    console.error(`❌ Local test failed: ${error.message}`)
    return false
  }
}

// Trigger GitHub workflow
function triggerWorkflow(versionType, releaseNotes, isDryRun) {
  try {
    console.log(
      `Triggering release workflow with version type: ${versionType}${isDryRun ? ' (dry run)' : ''}`
    )

    let command = `gh workflow run ${GITHUB_WORKFLOW_NAME} -f version_type=${versionType} -f dry_run=${isDryRun}`

    if (releaseNotes) {
      command += ` -f custom_release_notes="${releaseNotes}"`
    }

    execSync(command, { stdio: 'inherit' })

    console.log('\n✅ Release workflow triggered successfully!')
    console.log('You can check the progress in the Actions tab of your GitHub repository.')
    console.log('https://github.com/yourusername/creamlinux/actions')
  } catch (error) {
    console.error(`❌ Failed to trigger workflow: ${error.message}`)
    process.exit(1)
  }
}

// Main function
async function main() {
  console.log('=== CreamLinux Release Script ===\n')

  const { versionType, releaseNotes, options } = parseArguments()

  // Validate environment based on mode
  validateEnvironment(options.localTest)

  console.log(`Version type: ${versionType} (${options.dryRun ? 'dry run' : 'actual release'})`)
  if (releaseNotes) {
    console.log(`Release notes: "${releaseNotes}"`)
  } else {
    console.log('Release notes: Auto-generated from commit messages')
  }

  if (options.localTest) {
    // Run local test first
    const success = runLocalTest(versionType, releaseNotes)

    if (options.localTest) {
      // Run local test first
      const success = runLocalTest(versionType, releaseNotes)

      if (!success) {
        console.error('\nLocal test failed. Fix the issues before running on GitHub.')
        process.exit(1)
      }

      // If it was just a local test, exit here
      if (options.dryRun) {
        console.log(
          '\nLocal test completed successfully. Exiting without triggering GitHub workflow.'
        )
        process.exit(0)
      }

      // Ask if user wants to continue with actual GitHub workflow
      console.log('\nLocal test passed! Do you want to trigger the actual GitHub workflow?')
      console.log('Press Ctrl+C to cancel or wait 5 seconds to continue...')

      return new Promise((resolve) => {
        setTimeout(() => {
          triggerWorkflow(versionType, releaseNotes, options.dryRun)
          resolve()
        }, 5000)
      })
    } else {
      // No local test, just confirm and trigger workflow
      console.log('\nThis will trigger a GitHub Actions workflow to create a new release.')
      console.log('Press Ctrl+C to cancel or wait 5 seconds to continue...')

      return new Promise((resolve) => {
        setTimeout(() => {
          triggerWorkflow(versionType, releaseNotes, options.dryRun)
          resolve()
        }, 5000)
      })
    }
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
