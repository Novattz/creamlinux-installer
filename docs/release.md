# Release Process for CreamLinux

This document describes the automated release process for CreamLinux, including version management, changelog generation, and asset publishing.

## Overview

CreamLinux uses GitHub Actions to automate the release process. The workflow handles:

1. Version incrementing (patch, minor, major)
2. Changelog generation from commit messages
3. Building release artifacts (AppImage, Debian package)
4. Publishing these artifacts to GitHub Releases

## Prerequisites

To use the release automation, you need:

- Git installed locally
- GitHub CLI installed and authenticated
- Proper GitHub permissions on the repository

## Starting a Release

### Method 1: Using the `npm run release` command (Recommended)

The easiest way to trigger a release is using the npm script:

```bash
# For a patch release (0.1.0 -> 0.1.1)
npm run release patch

# For a minor release (0.1.0 -> 0.2.0)
npm run release minor

# For a major release (0.1.0 -> 2.0.0)
npm run release major
```

You can also provide custom release notes:

```bash
npm run release minor "Added DLC management feature and improved UI"
```

If you don't provide custom notes, they will be automatically generated from commit messages since the last release.

### Method 2: Manually triggering the workflow in GitHub

You can also manually trigger the workflow from the GitHub Actions tab:

1. Go to your repository on GitHub
2. Click on the "Actions" tab
3. Select the "Release CreamLinux" workflow
4. Click "Run workflow"
5. Choose the version increment type (patch, minor, major)
6. Optionally enter custom release notes
7. Click "Run workflow"

## Release Process Details

The release process follows these steps:

1. **Version Calculation**: Determines the new version based on the current version and increment type
2. **File Updates**: Updates version numbers in:
   - `package.json`
   - `src-tauri/Cargo.toml`
   - `src-tauri/tauri.conf.json`
3. **Changelog Generation**: If no custom notes are provided, generates a changelog from commits
4. **Git Operations**:
   - Commits the version changes
   - Creates a version tag
   - Pushes the changes and tag to the repository
5. **Release Creation**: Creates a GitHub Release with the changelog
6. **Build Process**: Builds the application for Linux
7. **Asset Upload**: Uploads the AppImage and Debian package to the release

## Release Artifacts

The following artifacts are published to the GitHub release:

- AppImage (`.AppImage`): Portable Linux executable
- Debian Package (`.deb`): For Debian/Ubuntu-based distributions

## Versioning Convention

CreamLinux follows [Semantic Versioning](https://semver.org/):

- **Major version**: Incompatible API changes
- **Minor version**: Backwards-compatible functionality
- **Patch version**: Backwards-compatible bug fixes

## Troubleshooting

If you encounter issues with the release process:

1. **Check GitHub Actions logs**: Review the workflow logs for detailed error information
2. **Verify permissions**: Ensure you have write permissions to the repository
3. **GitHub CLI authentication**: Run `gh auth status` to verify authentication

For technical issues with the release workflow, contact the CreamLinux maintainers.
