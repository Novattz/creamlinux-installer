## [1.5.0] - 28-03-2026

### Added
- Anonymous reporting system. Vote on whether CreamLinux or SmokeAPI works for a game
- Opt-in dialog on first launch explaining what is collected and why
- Rating button on game cards (only visible when opted in and an unlocker is installed)
- Community vote display in the unlocker selection dialog and before installing SmokeAPI on Proton games
- Votes track per-unlocker so CreamLinux and SmokeAPI ratings are independent
- Previously submitted votes are stored locally so already-cast buttons are disabled on re-open
- Config now automatically migrates missing fields on update without overwriting existing values
- API source available at https://github.com/Novattz/Lactose/

## [1.4.2] - 13-03-2026

### Added
- Added a dialog so users can manually add DLC's incase they are missing from the steam api

### Fixed
- Fixed an issue where if the libsteam_api.so file is nested too deeply in a game causing the app to not find it.

## [1.4.1] - 18-01-2026

### Added
- Dramatically reduced the time that bitness detection takes to detect game bitness

## [1.4.0] - 17-01-2026

### Added
- Unlocker selection dialog for native games, allowing users to choose between CreamLinux and SmokeAPI
- Game bitness detection

### Fixed
- Cache now validates if expected files are missing.

## [1.3.5] - 09-01-2026

### Changed
- Redesigned conflict detection dialog to show all conflicts at once
- Integrated Steam launch option reminder directly into the conflict dialog

### Fixed
- Improved UX by allowing users to resolve conflicts in any order or defer to later

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