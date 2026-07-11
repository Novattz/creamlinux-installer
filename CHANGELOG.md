## [1.7.0] - 11-07-2026

> A quick word before the changelog: sorry this update took as long as it did. Life, work, and a few other projects got in the way, but it's finally here. This one was mostly about polish, giving the app some life, cleaning up a lot of rough edges, and generally trying to make it feel nicer to use day to day. Between everything in this release, I'm confident enough in where things stand to move this over to the stable channel.
>
> This isn't the end of it, either there's still plenty I want to overhaul, and performance is next on the list since I know the AppImage build has been running laggy for some people.
>
> Thanks for sticking with this project, for the kind words, and for actually using it. I honestly didn't expect to hit 100 stars given how much I still had (and have) left to learn and fix along the way and somehow we're past 300 now. That means a lot.

### Added
- Custom Steam library paths. Add extra folders to scan for Steam games from Settings, for libraries that aren't auto-detected
- Redesigned the whole UI toward a flatter, more minimal look, reworked sidebar, top bar, dialogs, buttons, and game cards to remove gradients, glow shadows, and heavy drop shadows in favor of flat colors and subtle borders
- New Windows/Fluent-style ring spinner
- Overview page: hero totals for Steam/Epic library size, a Native vs Proton composition bar, compact stat chips, a session Recent Activity feed, and a System card showing host OS/CPU/GPU
- Settings page: a Compatibility Reporting toggle (previously only choosable once via the first-launch prompt) and a Danger Zone (reset all settings, clear cached unlocker downloads, open the config folder)
- Refresh buttons on both the Steam and Epic game list headers, next to each list's heading, instead of one global refresh button in the top bar that only ever refreshed the Steam list
- App version/build/repo link moved into a sidebar footer instead of a top bar pill and an Overview section

### Fixed
- Heroic games installed via Flatpak (e.g. on Steam Deck through Discover) were not being detected, since the Epic scanner only checked the native `~/.config/heroic` path and not Flatpak's sandboxed config location
- ScreamAPI's cache would never repair itself when incomplete due to a copy-paste bug that re-downloaded SmokeAPI instead
- ScreamAPI and Koaloader were never checked for updates after the initial download
- The Steam library was scanned twice on every app launch, doubling startup scan time
- The auto-update screen's progress bar jumped straight to 100% instead of showing real download progress
- Two event listeners (game scan startup, Epic game updates) were torn down and re-subscribed far more often than needed, adding unnecessary overhead and a small window where events could be missed
- Installing SmokeAPI on a Proton game via the community-votes confirmation dialog silently skipped the success toast and activity log entry, since that path called the raw installer directly instead of the wrapper that reports the result
- `clear_caches` was a no-op stub that didn't actually clear anything. It now deletes the cached CreamLinux/SmokeAPI/ScreamAPI/Koaloader downloads (report history and the anonymous vote identity are left alone, since those aren't a "cache")
- The Epic Games page was missing the heading separator/spacing the Steam page had
- Epic game cards weren't getting the hover glow effect Steam game cards got
- A dead ternary in the game card's image-fallback logic where both branches were identical

### Changed
- Removed dead code (including an unused utils module), an unused dependency, duplicated Koaloader install logic, and updated Rust packages.
- Merged the SmokeAPI and ScreamAPI settings dialogs into one generic, config-driven settings dialog
- Merged the Steam and Epic unlocker-choice dialogs into one generic dialog
- Removed the unused ReminderDialog component and other dead CSS left over from the old glow/gradient styling

## [1.5.6] - 06-05-2026

### Added
- DLC fetching now uses steamcmd instead of the Steam store API, which was missing DLCs from many games

## [1.5.5] - 30-04-2026

### Added
- Epic Games library scanning via Heroic/Legendary
- ScreamAPI support (Tested and working with SnowRunner)
- Koaloader support (currently not working, fix coming in a future update)

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