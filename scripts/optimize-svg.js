#!/usr/bin/env node

/**
 * SVG Optimizer for Creamlinux
 *
 * This script optimizes SVG files for use in the icon system.
 * Run it with `node optimize-svg.js path/to/svg`
 */

import fs from 'fs'
import path from 'path'
import optimize from 'svgo'

// Check if a file path is provided
if (process.argv.length < 3) {
  console.error('Please provide a path to an SVG file or directory')
  process.exit(1)
}

const inputPath = process.argv[2]

// SVGO configuration
const svgoConfig = {
  plugins: [
    {
      name: 'preset-default',
      params: {
        overrides: {
          // Keep viewBox attribute
          removeViewBox: false,
          // Don't remove IDs
          cleanupIDs: false,
          // Don't minify colors
          convertColors: false,
        },
      },
    },
    // Add currentColor for path fill if not specified
    {
      name: 'addAttributesToSVGElement',
      params: {
        attributes: [
          {
            fill: 'currentColor',
          },
        ],
      },
    },
    // Remove width and height
    {
      name: 'removeAttrs',
      params: {
        attrs: ['width', 'height'],
      },
    },
    // Make sure viewBox is 0 0 24 24 for consistent sizing
    {
      name: 'addAttributesToSVGElement',
      params: {
        attributes: [
          {
            viewBox: '0 0 24 24',
          },
        ],
      },
    },
  ],
}

// Function to optimize a single SVG file
function optimizeSVG(filePath) {
  try {
    const svg = fs.readFileSync(filePath, 'utf8')
    const result = optimize(svg, svgoConfig)

    // Write the optimized SVG back to the file
    fs.writeFileSync(filePath, result.data)
    console.log(`✅ Optimized: ${filePath}`)

    return true
  } catch (error) {
    console.error(`❌ Error optimizing ${filePath}:`, error)
    return false
  }
}

// Function to process a directory of SVG files
function processDirectory(dirPath) {
  try {
    const files = fs.readdirSync(dirPath)
    let optimizedCount = 0

    for (const file of files) {
      const filePath = path.join(dirPath, file)
      const stat = fs.statSync(filePath)

      if (stat.isDirectory()) {
        // Recursively process subdirectories
        optimizedCount += processDirectory(filePath)
      } else if (path.extname(file).toLowerCase() === '.svg') {
        // Process SVG files
        if (optimizeSVG(filePath)) {
          optimizedCount++
        }
      }
    }

    return optimizedCount
  } catch (error) {
    console.error(`Error processing directory ${dirPath}:`, error)
    return 0
  }
}

// Main execution
try {
  const stat = fs.statSync(inputPath)

  if (stat.isDirectory()) {
    const count = processDirectory(inputPath)
    console.log(`\nOptimized ${count} SVG files in ${inputPath}`)
  } else if (path.extname(inputPath).toLowerCase() === '.svg') {
    optimizeSVG(inputPath)
  } else {
    console.error('The provided path is not an SVG file or directory')
    process.exit(1)
  }
} catch (error) {
  console.error('Error:', error)
  process.exit(1)
}
