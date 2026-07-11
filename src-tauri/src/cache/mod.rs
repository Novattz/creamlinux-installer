mod storage;
mod version;

pub use storage::{
    get_creamlinux_version_dir, get_smokeapi_version_dir,
    list_creamlinux_files, list_smokeapi_files, read_versions,
    update_creamlinux_version, update_smokeapi_version, validate_smokeapi_cache,
    validate_creamlinux_cache, get_cache_dir, get_koaloader_version_dir, get_screamapi_version_dir,
    clear_unlocker_cache,
};

pub use version::{
    read_manifest, remove_creamlinux_version, remove_smokeapi_version,
    update_creamlinux_version as update_game_creamlinux_version,
    update_smokeapi_version as update_game_smokeapi_version,
};

use crate::{cache::storage::{update_koaloader_version, update_screamapi_version, validate_koaloader_cache, validate_screamapi_cache}, unlockers::{CreamLinux, Koaloader, ScreamAPI, SmokeAPI, Unlocker}};
use log::{error, info, warn};
use std::collections::HashMap;

// Initialize the cache on app startup
// Downloads both unlockers if they don't exist
pub async fn initialize_cache() -> Result<(), String> {
    info!("Initializing cache...");

    let versions = read_versions()?;
    let mut needs_smokeapi = false;
    let mut needs_creamlinux = false;
    let mut needs_screamapi = false;
    let mut needs_koaloader = false;

    // Check if SmokeAPI is properly cached
    if versions.smokeapi.latest.is_empty() {
        info!("No SmokeAPI version in manifest");
        needs_smokeapi = true
    } else {
        // Validate that all files exist
        match validate_smokeapi_cache(&versions.smokeapi.latest) {
            Ok(true) => {
                info!("SmokeAPI cache validated successfully");
            }
            Ok(false) => {
                info!("SmokeAPI cache incomplete, re-downloading");
                needs_smokeapi = true;
            }
            Err(e) => {
                warn!("Failed to validate SmokeAPI cache: {}, re-downloading", e);
                needs_smokeapi = true;
            }
        }
    }

    // Check if CreamLinux is properly cached
    if versions.creamlinux.latest.is_empty() {
        info!("No CreamLinux version in manifest");
        needs_creamlinux = true;
    } else {
        match validate_creamlinux_cache(&versions.creamlinux.latest) {
            Ok(true) => {
                info!("CreamLinux cache validated successfully");
            }
            Ok(false) => {
                info!("CreamLinux cache incomplete, re-downloading");
                needs_creamlinux = true;
            }
            Err(e) => {
                warn!("Failed to validate CreamLinux cache: {}, re-downloading", e);
                needs_creamlinux = true;
            }
        }
    }

    // Check if ScreamAPI is properly cached
    if versions.screamapi.latest.is_empty() {
        info!("No ScreamAPI version in manifest");
        needs_screamapi = true
    } else {
        match validate_screamapi_cache(&versions.screamapi.latest) {
            Ok(true) => {
                info!("ScreamAPI cache validated successfully");
            }
            Ok(false) => {
                info!("ScreamAPI cache incomplete, re-downloading");
                needs_screamapi = true;
            }
            Err(e) => {
                warn!("Failed to validate ScreamAPI cache: {}, re-downloading", e);
                needs_screamapi = true;
            }
        }
    }

    // Check if Koaloader is properly cached
    if versions.koaloader.latest.is_empty() {
        info!("No Koaloader version in manifest");
        needs_koaloader = true
    } else {
        match validate_koaloader_cache(&versions.koaloader.latest) {
            Ok(true) => {
                info!("Koaloader cache validated successfully");
            }
            Ok(false) => {
                info!("Koaloader cache incomplete, re-downloading");
                needs_koaloader = true;
            }
            Err(e) => {
                warn!("Failed to validate Koaloader cache: {}, re-downloading", e);
                needs_koaloader = true;
            }
        }
    }

    // Download SmokeAPI
    if needs_smokeapi {
        info!("Downloading SmokeAPI...");
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
    }

    // Download CreamLinux
    if needs_creamlinux {
        info!("Downloading CreamLinux...");
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
    }

    // Download ScreamAPI
    if needs_screamapi {
        info!("Downloading ScreamAPI...");
        match ScreamAPI::download_to_cache().await {
            Ok(version) => {
                info!("Downloaded ScreamAPI version: {}", version);
                update_screamapi_version(&version)?;
            }
            Err(e) => {
                error!("Failed to download SmokeAPI: {}", e);
                return Err(format!("Failed to download ScreamAPI: {}", e));
            }
        }
    }

    // Download Koaloader
    if needs_koaloader {
        info!("Downloading Koaloader...");
        match Koaloader::download_to_cache().await {
            Ok(version) => {
                info!("Downloaded Koaloader version: {}", version);
                update_koaloader_version(&version)?;
            }
            Err(e) => {
                error!("Failed to download Koaloader: {}", e);
                return Err(format!("Failed to download Koaloader: {}", e));
            }
        }
    }

    if !needs_smokeapi && !needs_creamlinux && !needs_screamapi && !needs_koaloader {
        info!("Cache already initialized and validated");
    } else {
        info!("Cache initialization complete");
    }

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

    // Check ScreamAPI
    let current_screamapi = read_versions()?.screamapi.latest;
    match ScreamAPI::get_latest_version().await {
        Ok(latest_version) => {
            if current_screamapi != latest_version {
                info!(
                    "ScreamAPI update available: {} -> {}",
                    current_screamapi, latest_version
                );

                match ScreamAPI::download_to_cache().await {
                    Ok(version) => {
                        update_screamapi_version(&version)?;
                        result.screamapi_updated = true;
                        result.new_screamapi_version = Some(version);
                        info!("ScreamAPI updated successfully");
                    }
                    Err(e) => {
                        error!("Failed to download ScreamAPI update: {}", e);
                        return Err(format!("Failed to download ScreamAPI update: {}", e));
                    }
                }
            } else {
                info!("ScreamAPI is up to date: {}", current_screamapi);
            }
        }
        Err(e) => {
            warn!("Failed to check ScreamAPI version: {}", e);
        }
    }

    // Check Koaloader
    let current_koaloader = read_versions()?.koaloader.latest;
    match Koaloader::get_latest_version().await {
        Ok(latest_version) => {
            if current_koaloader != latest_version {
                info!(
                    "Koaloader update available: {} -> {}",
                    current_koaloader, latest_version
                );

                match Koaloader::download_to_cache().await {
                    Ok(version) => {
                        update_koaloader_version(&version)?;
                        result.koaloader_updated = true;
                        result.new_koaloader_version = Some(version);
                        info!("Koaloader updated successfully");
                    }
                    Err(e) => {
                        error!("Failed to download Koaloader update: {}", e);
                        return Err(format!("Failed to download Koaloader update: {}", e));
                    }
                }
            } else {
                info!("Koaloader is up to date: {}", current_koaloader);
            }
        }
        Err(e) => {
            warn!("Failed to check Koaloader version: {}", e);
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
    pub screamapi_updated: bool,
    pub koaloader_updated: bool,
    pub new_smokeapi_version: Option<String>,
    pub new_creamlinux_version: Option<String>,
    pub new_screamapi_version: Option<String>,
    pub new_koaloader_version: Option<String>,
}

impl UpdateResult {
    pub fn any_updated(&self) -> bool {
        self.smokeapi_updated
            || self.creamlinux_updated
            || self.screamapi_updated
            || self.koaloader_updated
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