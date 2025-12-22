## [1.3.0] - 22-12-2025

### Added
- New icons
- Unlockers are now cached in `~/.cache/creamlinux/` with automatic version management
- Check for new SmokeAPI/CreamLinux versions on every app startup
- Each game gets a `creamlinux.json` manifest tracking installed versions
- Outdated installations automatically sync with latest cached versions

### Changed
- Polished toast notifications alot
- Complete modular rewrite with clear separation of concerns

### Fixed
- Fixed toast message where uninstall actions incorrectly showed success notifications