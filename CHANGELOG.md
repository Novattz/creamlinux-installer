## [1.3.4] - 03-01-2026

### Added
- Disclaimer dialog explaining that CreamLinux Installer manages DLC IDs, not actual DLC files
- User config stored in `~/.config/creamlinux/config.json`
- **"Don't show again" option**: Users can permanently dismiss the disclaimer via checkbox

## [1.3.3] - 26-12-2025

### Added
- Platform conflict detection
- Automatic removal of incompatible unlocker files when switching between Native/Proton
- Reminder dialog for steam launch options after creamlinux removal
- Conflict dialog to show which game had the conflict

## [1.3.2] - 23-12-2025

### Added
- New dropdown component
- Settings dialog for SmokeAPI configuration
- Update creamlinux config functionality

### Changed
- Adjusted styling for CreamLinux settings dialog

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