mod storage;
mod version;

pub use storage::{
    get_creamlinux_version_dir, get_smokeapi_version_dir, is_cache_initialized,
    list_creamlinux_files, list_smokeapi_dlls, read_versions, update_creamlinux_version,
    update_smokeapi_version,
};

pub use version::{
    read_manifest, remove_creamlinux_version, remove_smokeapi_version,
    update_creamlinux_version as update_game_creamlinux_version,
    update_smokeapi_version as update_game_smokeapi_version,
};

use crate::unlockers::{CreamLinux, SmokeAPI, Unlocker};
use log::{error, info, warn};
use std::collections::HashMap;

// Initialize the cache on app startup
// Downloads both unlockers if they don't exist
pub async fn initialize_cache() -> Result<(), String> {
    info!("Initializing cache...");

    // Check if cache is already initialized
    if is_cache_initialized()? {
        info!("Cache already initialized");
        return Ok(());
    }

    info!("Cache not initialized, downloading unlockers...");

    // Download SmokeAPI
    match SmokeAPI::download_to_cache().await {
        Ok(version) => {
            info!("Downloaded SmokeAPI version: {}", version);
            update_smokeapi_version(&version)?;
        }
        Err(e) => {
            error!("Failed to download SmokeAPI: {}", e);
            return Err(format!("Failed to download SmokeAPI: {}", e));
        }
    }

    // Download CreamLinux
    match CreamLinux::download_to_cache().await {
        Ok(version) => {
            info!("Downloaded CreamLinux version: {}", version);
            update_creamlinux_version(&version)?;
        }
        Err(e) => {
            error!("Failed to download CreamLinux: {}", e);
            return Err(format!("Failed to download CreamLinux: {}", e));
        }
    }

    info!("Cache initialization complete");
    Ok(())
}

// Check for updates and download new versions if available
pub async fn check_and_update_cache() -> Result<UpdateResult, String> {
    info!("Checking for unlocker updates...");

    let mut result = UpdateResult::default();

    // Check SmokeAPI
    let current_smokeapi = read_versions()?.smokeapi.latest;
    match SmokeAPI::get_latest_version().await {
        Ok(latest_version) => {
            if current_smokeapi != latest_version {
                info!(
                    "SmokeAPI update available: {} -> {}",
                    current_smokeapi, latest_version
                );

                match SmokeAPI::download_to_cache().await {
                    Ok(version) => {
                        update_smokeapi_version(&version)?;
                        result.smokeapi_updated = true;
                        result.new_smokeapi_version = Some(version);
                        info!("SmokeAPI updated successfully");
                    }
                    Err(e) => {
                        error!("Failed to download SmokeAPI update: {}", e);
                        return Err(format!("Failed to download SmokeAPI update: {}", e));
                    }
                }
            } else {
                info!("SmokeAPI is up to date: {}", current_smokeapi);
            }
        }
        Err(e) => {
            warn!("Failed to check SmokeAPI version: {}", e);
        }
    }

    // Check CreamLinux
    let current_creamlinux = read_versions()?.creamlinux.latest;
    match CreamLinux::get_latest_version().await {
        Ok(latest_version) => {
            if current_creamlinux != latest_version {
                info!(
                    "CreamLinux update available: {} -> {}",
                    current_creamlinux, latest_version
                );

                match CreamLinux::download_to_cache().await {
                    Ok(version) => {
                        update_creamlinux_version(&version)?;
                        result.creamlinux_updated = true;
                        result.new_creamlinux_version = Some(version);
                        info!("CreamLinux updated successfully");
                    }
                    Err(e) => {
                        error!("Failed to download CreamLinux update: {}", e);
                        return Err(format!("Failed to download CreamLinux update: {}", e));
                    }
                }
            } else {
                info!("CreamLinux is up to date: {}", current_creamlinux);
            }
        }
        Err(e) => {
            warn!("Failed to check CreamLinux version: {}", e);
        }
    }

    Ok(result)
}

// Update all games that have outdated unlocker versions
pub async fn update_outdated_games(
    games: &HashMap<String, crate::installer::Game>,
) -> Result<GameUpdateStats, String> {
    info!("Checking for outdated game installations...");

    let cached_versions = read_versions()?;
    let mut stats = GameUpdateStats::default();

    for (game_id, game) in games {
        // Read the game's manifest
        let manifest = match read_manifest(&game.path) {
            Ok(m) => m,
            Err(e) => {
                warn!("Failed to read manifest for {}: {}", game.title, e);
                continue;
            }
        };

        // Check if SmokeAPI needs updating
        if manifest.has_smokeapi()
            && manifest.is_smokeapi_outdated(&cached_versions.smokeapi.latest)
        {
            info!(
                "Game '{}' has outdated SmokeAPI, updating...",
                game.title
            );

            // Convert api_files Vec to comma-separated string
            let api_files_str = game.api_files.join(",");
            match SmokeAPI::install_to_game(&game.path, &api_files_str).await {
                Ok(_) => {
                    update_game_smokeapi_version(&game.path, cached_versions.smokeapi.latest.clone())?;
                    stats.smokeapi_updated += 1;
                    info!("Updated SmokeAPI for '{}'", game.title);
                }
                Err(e) => {
                    error!("Failed to update SmokeAPI for '{}': {}", game.title, e);
                    stats.smokeapi_failed += 1;
                }
            }
        }

        // Check if CreamLinux needs updating
        if manifest.has_creamlinux()
            && manifest.is_creamlinux_outdated(&cached_versions.creamlinux.latest)
        {
            info!(
                "Game '{}' has outdated CreamLinux, updating...",
                game.title
            );

            // For CreamLinux, we need to preserve the DLC configuration
            match CreamLinux::install_to_game(&game.path, game_id).await {
                Ok(_) => {
                    update_game_creamlinux_version(&game.path, cached_versions.creamlinux.latest.clone())?;
                    stats.creamlinux_updated += 1;
                    info!("Updated CreamLinux for '{}'", game.title);
                }
                Err(e) => {
                    error!("Failed to update CreamLinux for '{}': {}", game.title, e);
                    stats.creamlinux_failed += 1;
                }
            }
        }
    }

    info!(
        "Game update complete - SmokeAPI: {} updated, {} failed | CreamLinux: {} updated, {} failed",
        stats.smokeapi_updated,
        stats.smokeapi_failed,
        stats.creamlinux_updated,
        stats.creamlinux_failed
    );

    Ok(stats)
}

// Result of checking for cache updates
#[derive(Debug, Default, Clone)]
pub struct UpdateResult {
    pub smokeapi_updated: bool,
    pub creamlinux_updated: bool,
    pub new_smokeapi_version: Option<String>,
    pub new_creamlinux_version: Option<String>,
}

impl UpdateResult {
    pub fn any_updated(&self) -> bool {
        self.smokeapi_updated || self.creamlinux_updated
    }
}

// Statistics about game updates
#[derive(Debug, Default, Clone)]
pub struct GameUpdateStats {
    pub smokeapi_updated: u32,
    pub smokeapi_failed: u32,
    pub creamlinux_updated: u32,
    pub creamlinux_failed: u32,
}

impl GameUpdateStats {
    pub fn total_updated(&self) -> u32 {
        self.smokeapi_updated + self.creamlinux_updated
    }

    pub fn total_failed(&self) -> u32 {
        self.smokeapi_failed + self.creamlinux_failed
    }

    pub fn has_failures(&self) -> bool {
        self.total_failed() > 0
    }
}