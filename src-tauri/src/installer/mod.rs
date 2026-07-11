use crate::cache::{
    remove_creamlinux_version, remove_smokeapi_version,
    update_game_creamlinux_version, update_game_smokeapi_version,
};
use crate::unlockers::{CreamLinux, SmokeAPI, ScreamAPI, Unlocker};
use crate::epic_scanner::EpicGame;
use crate::AppState;
use log::{error, info, warn};
use reqwest;
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::fs;
use std::path::Path;
use std::sync::atomic::Ordering;
use std::time::Duration;
use tauri::Manager;
use tauri::{AppHandle, Emitter};

// Type of installer
#[derive(Debug, Clone, Copy)]
pub enum InstallerType {
    Cream,
    Smoke,
}

// Action to perform
#[derive(Debug, Clone, Copy)]
pub enum InstallerAction {
    Install,
    Uninstall,
}

// DLC Information structure
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct DlcInfo {
    pub appid: String,
    pub name: String,
}

// Struct to hold installation instructions for the frontend
#[derive(Serialize, Debug, Clone)]
pub struct InstallationInstructions {
    #[serde(rename = "type")]
    pub type_: String,
    pub command: String,
    pub game_title: String,
    pub dlc_count: Option<usize>,
}

// Game information structure
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Game {
    pub id: String,
    pub title: String,
    pub path: String,
    pub native: bool,
    pub api_files: Vec<String>,
    pub cream_installed: bool,
    pub smoke_installed: bool,
    pub installing: bool,
}

// Emit a progress update to the frontend
pub fn emit_progress(
    app_handle: &AppHandle,
    title: &str,
    message: &str,
    progress: f32,
    complete: bool,
    show_instructions: bool,
    instructions: Option<InstallationInstructions>,
) {
    let mut payload = json!({
        "title": title,
        "message": message,
        "progress": progress,
        "complete": complete,
        "show_instructions": show_instructions
    });

    if let Some(inst) = instructions {
        payload["instructions"] = serde_json::to_value(inst).unwrap_or_default();
    }

    if let Err(e) = app_handle.emit("installation-progress", payload) {
        warn!("Failed to emit progress event: {}", e);
    }
}

// Process a single game action (install/uninstall Cream/Smoke)
pub async fn process_action(
    game_id: String,
    installer_type: InstallerType,
    action: InstallerAction,
    game: Game,
    app_handle: AppHandle,
) -> Result<(), String> {
    match (installer_type, action) {
        (InstallerType::Cream, InstallerAction::Install) => {
            install_creamlinux(game_id, game, app_handle).await
        }
        (InstallerType::Cream, InstallerAction::Uninstall) => {
            uninstall_creamlinux(game, app_handle).await
        }
        (InstallerType::Smoke, InstallerAction::Install) => {
            install_smokeapi(game, app_handle).await
        }
        (InstallerType::Smoke, InstallerAction::Uninstall) => {
            uninstall_smokeapi(game, app_handle).await
        }
    }
}

// Install CreamLinux to a game
async fn install_creamlinux(
    game_id: String,
    game: Game,
    app_handle: AppHandle,
) -> Result<(), String> {
    if !game.native {
        return Err("CreamLinux can only be installed on native Linux games".to_string());
    }

    info!("Installing CreamLinux for game: {}", game.title);
    let game_title = game.title.clone();

    emit_progress(
        &app_handle,
        &format!("Installing CreamLinux for {}", game_title),
        "Fetching DLC list...",
        10.0,
        false,
        false,
        None,
    );

    // Fetch DLC list
    let dlcs = match fetch_dlc_details(&game_id).await {
        Ok(dlcs) => dlcs,
        Err(e) => {
            error!("Failed to fetch DLC details: {}", e);
            return Err(format!("Failed to fetch DLC details: {}", e));
        }
    };

    let dlc_count = dlcs.len();
    info!("Found {} DLCs for {}", dlc_count, game_title);

    emit_progress(
        &app_handle,
        &format!("Installing CreamLinux for {}", game_title),
        "Installing from cache...",
        50.0,
        false,
        false,
        None,
    );

    // Install CreamLinux binaries from cache
    CreamLinux::install_to_game(&game.path, &game_id)
        .await
        .map_err(|e| format!("Failed to install CreamLinux: {}", e))?;

    emit_progress(
        &app_handle,
        &format!("Installing CreamLinux for {}", game_title),
        "Writing DLC configuration...",
        80.0,
        false,
        false,
        None,
    );

    // Write cream_api.ini with DLCs
    write_cream_api_ini(&game.path, &game_id, &dlcs)?;

    // Update version manifest
    let cached_versions = crate::cache::read_versions()?;
    update_game_creamlinux_version(&game.path, cached_versions.creamlinux.latest)?;

    // Emit completion with instructions
    let instructions = InstallationInstructions {
        type_: "cream_install".to_string(),
        command: "sh ./cream.sh %command%".to_string(),
        game_title: game_title.clone(),
        dlc_count: Some(dlc_count),
    };

    emit_progress(
        &app_handle,
        &format!("Installation Completed: {}", game_title),
        "CreamLinux has been installed successfully!",
        100.0,
        true,
        true,
        Some(instructions),
    );

    info!("CreamLinux installation completed for: {}", game_title);
    Ok(())
}

// Uninstall CreamLinux from a game
async fn uninstall_creamlinux(game: Game, app_handle: AppHandle) -> Result<(), String> {
    if !game.native {
        return Err("CreamLinux can only be uninstalled from native Linux games".to_string());
    }

    let game_title = game.title.clone();
    info!("Uninstalling CreamLinux from game: {}", game_title);

    emit_progress(
        &app_handle,
        &format!("Uninstalling CreamLinux from {}", game_title),
        "Removing CreamLinux files...",
        50.0,
        false,
        false,
        None,
    );

    CreamLinux::uninstall_from_game(&game.path, &game.id)
        .await
        .map_err(|e| format!("Failed to uninstall CreamLinux: {}", e))?;

    // Remove version from manifest
    remove_creamlinux_version(&game.path)?;

    emit_progress(
        &app_handle,
        &format!("Uninstallation Completed: {}", game_title),
        "CreamLinux has been removed successfully!",
        100.0,
        true,
        false,
        None,
    );

    info!("CreamLinux uninstallation completed for: {}", game_title);
    Ok(())
}

async fn install_smokeapi(game: Game, app_handle: AppHandle) -> Result<(), String> {
    // Check if native or proton and route accordingly
    if game.native {
        install_smokeapi_native(game, app_handle).await
    } else {
        install_smokeapi_proton(game, app_handle).await
    }
}

async fn uninstall_smokeapi(game: Game, app_handle: AppHandle) -> Result<(), String> {
    // Check if native or proton and route accordingly
    if game.native {
        uninstall_smokeapi_native(game, app_handle).await
    } else {
        uninstall_smokeapi_proton(game, app_handle).await
    }
}

// Install SmokeAPI to a proton game
async fn install_smokeapi_proton(game: Game, app_handle: AppHandle) -> Result<(), String> {
    if game.native {
        return Err("SmokeAPI can only be installed on Proton/Windows games".to_string());
    }

    info!("Installing SmokeAPI for game: {}", game.title);
    let game_title = game.title.clone();

    emit_progress(
        &app_handle,
        &format!("Installing SmokeAPI for {}", game_title),
        "Installing from cache...",
        50.0,
        false,
        false,
        None,
    );

    // Join api_files into a comma-separated string for the context
    let api_files_str = game.api_files.join(",");

    // Install SmokeAPI from cache
    SmokeAPI::install_to_game(&game.path, &api_files_str)
        .await
        .map_err(|e| format!("Failed to install SmokeAPI: {}", e))?;

    // Update version manifest
    let cached_versions = crate::cache::read_versions()?;
    update_game_smokeapi_version(&game.path, cached_versions.smokeapi.latest)?;

    emit_progress(
        &app_handle,
        &format!("Installation Completed: {}", game_title),
        "SmokeAPI has been installed successfully!",
        100.0,
        true,
        false,
        None,
    );

    info!("SmokeAPI installation completed for: {}", game_title);
    Ok(())
}

// Uninstall SmokeAPI from a proton game
async fn uninstall_smokeapi_proton(game: Game, app_handle: AppHandle) -> Result<(), String> {
    if game.native {
        return Err("SmokeAPI can only be uninstalled from Proton/Windows games".to_string());
    }

    let game_title = game.title.clone();
    info!("Uninstalling SmokeAPI from game: {}", game_title);

    emit_progress(
        &app_handle,
        &format!("Uninstalling SmokeAPI from {}", game_title),
        "Removing SmokeAPI files...",
        50.0,
        false,
        false,
        None,
    );

    // Join api_files into a comma-separated string for the context
    let api_files_str = game.api_files.join(",");

    SmokeAPI::uninstall_from_game(&game.path, &api_files_str)
        .await
        .map_err(|e| format!("Failed to uninstall SmokeAPI: {}", e))?;

    // Remove version from manifest
    remove_smokeapi_version(&game.path)?;

    emit_progress(
        &app_handle,
        &format!("Uninstallation Completed: {}", game_title),
        "SmokeAPI has been removed successfully!",
        100.0,
        true,
        false,
        None,
    );

    info!("SmokeAPI uninstallation completed for: {}", game_title);
    Ok(())
}

// Install SmokeAPI to a native Linux game
async fn install_smokeapi_native(
    game: Game,
    app_handle: AppHandle,
) -> Result<(), String> {

    info!("Installing SmokeAPI (native) for game: {}", game.title);
    let game_title = game.title.clone();

    emit_progress(
        &app_handle,
        &format!("Installing SmokeAPI for {}", game_title),
        "Detecting game architecture...",
        20.0,
        false,
        false,
        None,
    );

    emit_progress(
        &app_handle,
        &format!("Installing SmokeAPI for {}", game_title),
        "Installing from cache...",
        50.0,
        false,
        false,
        None,
    );

    // Install SmokeAPI for native Linux (empty string for api_files_str)
    SmokeAPI::install_to_game(&game.path, "")
        .await
        .map_err(|e| format!("Failed to install SmokeAPI: {}", e))?;

    // Update version manifest
    let cached_versions = crate::cache::read_versions()?;
    update_game_smokeapi_version(&game.path, cached_versions.smokeapi.latest)?;

    emit_progress(
        &app_handle,
        &format!("Installation Completed: {}", game_title),
        "SmokeAPI has been installed successfully!",
        100.0,
        true,
        false,
        None,
    );

    info!("SmokeAPI (native) installation completed for: {}", game_title);
    Ok(())
}

// Uninstall SmokeAPI from a native Linux game
async fn uninstall_smokeapi_native(game: Game, app_handle: AppHandle) -> Result<(), String> {
    if !game.native {
        return Err("This function is only for native Linux games".to_string());
    }

    let game_title = game.title.clone();
    info!("Uninstalling SmokeAPI (native) from game: {}", game_title);

    emit_progress(
        &app_handle,
        &format!("Uninstalling SmokeAPI from {}", game_title),
        "Removing SmokeAPI files...",
        50.0,
        false,
        false,
        None,
    );

    // Uninstall SmokeAPI (empty string for api_files_str)
    SmokeAPI::uninstall_from_game(&game.path, "")
        .await
        .map_err(|e| format!("Failed to uninstall SmokeAPI: {}", e))?;

    // Remove version from manifest
    remove_smokeapi_version(&game.path)?;

    emit_progress(
        &app_handle,
        &format!("Uninstallation Completed: {}", game_title),
        "SmokeAPI has been removed successfully!",
        100.0,
        true,
        false,
        None,
    );

    info!("SmokeAPI (native) uninstallation completed for: {}", game_title);
    Ok(())
}

pub async fn install_screamapi(game: EpicGame, app_handle: AppHandle) -> Result<(), String> {
    let title = game.title.clone();
    info!("Installing ScreamAPI for: {}", title);
 
    emit_progress(
        &app_handle,
        &format!("Installing ScreamAPI for {}", title),
        "Scanning for EOS SDK DLLs...",
        15.0, false, false, None,
    );
 
    let eos_dlls = crate::unlockers::ScreamAPI::find_eossdk_dlls(
        std::path::Path::new(&game.install_path)
    );
    if eos_dlls.is_empty() {
        return Err(format!("No EOSSDK-Win*-Shipping.dll found in {}", game.install_path));
    }
 
    emit_progress(
        &app_handle,
        &format!("Installing ScreamAPI for {}", title),
        &format!("Replacing {} EOS SDK DLL(s)...", eos_dlls.len()),
        50.0, false, false, None,
    );
 
    ScreamAPI::install_to_game(&game.install_path, "")
        .await
        .map_err(|e| format!("Failed to install ScreamAPI: {}", e))?;
 
    emit_progress(
        &app_handle,
        &format!("Installation Complete: {}", title),
        "ScreamAPI installed successfully!",
        100.0, true, false, None,
    );
 
    info!("ScreamAPI installation complete for: {}", title);
    Ok(())
}

pub async fn uninstall_screamapi(game: EpicGame, app_handle: AppHandle) -> Result<(), String> {
    let title = game.title.clone();
    info!("Uninstalling ScreamAPI from: {}", title);
 
    emit_progress(
        &app_handle,
        &format!("Uninstalling ScreamAPI from {}", title),
        "Restoring original EOS SDK DLLs...",
        30.0, false, false, None,
    );
 
    ScreamAPI::uninstall_from_game(&game.install_path, "")
        .await
        .map_err(|e| format!("Failed to uninstall ScreamAPI: {}", e))?;
 
    emit_progress(
        &app_handle,
        &format!("Uninstallation Complete: {}", title),
        "ScreamAPI removed successfully!",
        100.0, true, false, None,
    );
 
    info!("ScreamAPI uninstallation complete for: {}", title);
    Ok(())
}

/// Returns is_fallback so process_epic_action can set proxy_fallback_used.
pub async fn install_koaloader(
    game: EpicGame,
    app_handle: AppHandle,
) -> Result<bool, String> {
    let title = game.title.clone();
    info!("Installing Koaloader for: {}", title);
 
    emit_progress(
        &app_handle,
        &format!("Installing Koaloader for {}", title),
        "Locating game executable...",
        10.0, false, false, None,
    );
 
    let exe_path = crate::unlockers::Koaloader::resolve_exe_pub(&game.install_path, &game.executable)?;
    let exe_dir = exe_path.parent().ok_or("Failed to get executable directory")?;

    emit_progress(
        &app_handle,
        &format!("Installing Koaloader for {}", title),
        "Scanning PE imports for best proxy DLL...",
        30.0, false, false, None,
    );

    // Detects bitness, scans PE imports, and copies the matching proxy DLL
    let scan = crate::unlockers::Koaloader::install_proxy(&exe_path)?;
    let is_fallback = scan.is_fallback;

    emit_progress(
        &app_handle,
        &format!("Installing Koaloader for {}", title),
        &format!("Installed proxy DLL ({})", scan.proxy_name),
        50.0, false, false, None,
    );

    emit_progress(
        &app_handle,
        &format!("Installing Koaloader for {}", title),
        "Installing ScreamAPI payload...",
        70.0, false, false, None,
    );

    let exe_dir_str = exe_dir.to_string_lossy().to_string();
    ScreamAPI::install_to_game(&exe_dir_str, "koaloader")
        .await
        .map_err(|e| format!("Failed to install ScreamAPI payload: {}", e))?;

    emit_progress(
        &app_handle,
        &format!("Installing Koaloader for {}", title),
        "Writing configuration files...",
        88.0, false, false, None,
    );

    crate::unlockers::Koaloader::write_koaloader_config(&exe_path)?;

    emit_progress(
        &app_handle,
        &format!("Installation Complete: {}", title),
        "Koaloader + ScreamAPI installed successfully!",
        100.0, true, false, None,
    );
 
    info!("Koaloader installation complete for: {}", title);
    Ok(is_fallback)
}

pub async fn uninstall_koaloader(game: EpicGame, app_handle: AppHandle) -> Result<(), String> {
    let title = game.title.clone();
    info!("Uninstalling Koaloader from: {}", title);
 
    emit_progress(
        &app_handle,
        &format!("Uninstalling Koaloader from {}", title),
        "Removing proxy DLL...",
        25.0, false, false, None,
    );
 
    let exe_path = crate::unlockers::Koaloader::resolve_exe_pub(&game.install_path, &game.executable)?;
    let exe_dir = exe_path.parent().ok_or("Failed to get executable directory")?;
    let exe_dir_str = exe_dir.to_string_lossy().to_string();

    // Removes Koaloader.config.json and any proxy DLL variant
    crate::unlockers::Koaloader::remove_proxy_and_config(exe_dir)?;

    emit_progress(
        &app_handle,
        &format!("Uninstalling Koaloader from {}", title),
        "Removing ScreamAPI files...",
        65.0, false, false, None,
    );
 
    ScreamAPI::uninstall_from_game(&exe_dir_str, "koaloader")
        .await
        .map_err(|e| format!("Failed to remove ScreamAPI payload: {}", e))?;
 
    emit_progress(
        &app_handle,
        &format!("Uninstallation Complete: {}", title),
        "Koaloader + ScreamAPI removed successfully!",
        100.0, true, false, None,
    );
 
    info!("Koaloader uninstallation complete for: {}", title);
    Ok(())
}

// steamcmd helpers

/// Calls `https://api.steamcmd.net/v1/info/{app_id}` and returns the per-app
/// JSON object (`data[app_id]`), or `None` on any failure.
async fn fetch_steamcmd_info(
    client: &reqwest::Client,
    app_id: &str,
) -> Option<serde_json::Value> {
    let url = format!("https://api.steamcmd.net/v1/info/{}", app_id);

    let resp = client
        .get(&url)
        .header("User-Agent", "CreamLinux-Installer")
        .timeout(Duration::from_secs(15))
        .send()
        .await
        .ok()?;

    let json: serde_json::Value = resp.json().await.ok()?;

    if json.get("status").and_then(|s| s.as_str()) != Some("success") {
        return None;
    }

    json.get("data").and_then(|d| d.get(app_id)).cloned()
}

/// Extracts DLC app-IDs from a game's steamcmd info object.
/// Merges two sources and deduplicates:
///   1. `extended.listofdlc` - comma-separated string
///   2. `depots[*].dlcappid` - per-depot numeric field
fn extract_dlc_ids(info: &serde_json::Value) -> Vec<String> {
    let mut ids: std::collections::HashSet<String> = std::collections::HashSet::new();
 
    // Source 1 - extended.listofdlc
    if let Some(list) = info
        .get("extended")
        .and_then(|e| e.get("listofdlc"))
        .and_then(|v| v.as_str())
    {
        for raw in list.split(',') {
            let id = raw.trim();
            if !id.is_empty() {
                ids.insert(id.to_string());
            }
        }
    }
 
    // Source 2 - depots[*].dlcappid
    if let Some(depots) = info.get("depots").and_then(|d| d.as_object()) {
        for (_key, depot) in depots {
            if let Some(dlc_id) = depot.get("dlcappid").and_then(|v| {
                v.as_u64()
                    .map(|n| n.to_string())
                    .or_else(|| v.as_str().map(|s| s.to_string()))
            }) {
                if !dlc_id.is_empty() {
                    ids.insert(dlc_id);
                }
            }
        }
    }
 
    let mut sorted: Vec<String> = ids.into_iter().collect();
    sorted.sort();
    sorted
}

/// Fetches the display name for a single DLC from steamcmd.net.
/// Returns `None` if the call fails or the name is empty / "Unknown".
async fn fetch_dlc_name(
    client: &reqwest::Client,
    dlc_id: &str,
) -> Option<String> {
    let info = fetch_steamcmd_info(client, dlc_id).await?;
    let name = info
        .get("common")
        .and_then(|c| c.get("name"))
        .and_then(|n| n.as_str())?;
 
    if name.is_empty() || name.eq_ignore_ascii_case("unknown") {
        return None;
    }
 
    Some(name.to_string())
}

// Fetch DLC details from steamcmd.net (simple version without progress)
pub async fn fetch_dlc_details(app_id: &str) -> Result<Vec<DlcInfo>, String> {
    info!("Fetching DLC list via steamcmd.net for game ID: {}", app_id);
 
    let client = reqwest::Client::new();
 
    // Step 1: get game info → extract DLC IDs
    let game_info = fetch_steamcmd_info(&client, app_id)
        .await
        .ok_or_else(|| format!("steamcmd.net returned no data for app {}", app_id))?;
 
    let dlc_ids = extract_dlc_ids(&game_info);
    info!("Found {} DLC IDs for game {}", dlc_ids.len(), app_id);
 
    // Step 2: fetch name for each ID; skip any that resolve to Unknown
    let mut dlc_details = Vec::new();
 
    for dlc_id in &dlc_ids {
        tokio::time::sleep(Duration::from_millis(100)).await;
 
        match fetch_dlc_name(&client, dlc_id).await {
            Some(name) => {
                info!("Found DLC: {} ({})", name, dlc_id);
                dlc_details.push(DlcInfo {
                    appid: dlc_id.clone(),
                    name,
                });
            }
            None => {
                info!("Skipping DLC {} - no name / unknown", dlc_id);
            }
        }
    }
 
    info!("Successfully retrieved {} named DLCs", dlc_details.len());
    Ok(dlc_details)
}

// Fetch DLC details from steamcmd.net with progress updates
pub async fn fetch_dlc_details_with_progress(
    app_id: &str,
    app_handle: &tauri::AppHandle,
) -> Result<Vec<DlcInfo>, String> {
    info!(
        "Starting DLC details fetch with progress for game ID: {}",
        app_id
    );
 
    let state = app_handle.state::<AppState>();
    let should_cancel = state.fetch_cancellation.clone();
 
    let client = reqwest::Client::new();
 
    // Step 1: fetch game info to get DLC ID list
    emit_dlc_progress(app_handle, "Looking up game details...", 5, None);
 
    let game_info = fetch_steamcmd_info(&client, app_id)
        .await
        .ok_or_else(|| format!("steamcmd.net returned no data for app {}", app_id))?;
 
    let dlc_ids = extract_dlc_ids(&game_info);
    let total_dlcs = dlc_ids.len();
 
    info!("Found {} DLC IDs for game {}", total_dlcs, app_id);
    emit_dlc_progress(
        app_handle,
        &format!("Found {} DLCs. Fetching details...", total_dlcs),
        10,
        None,
    );
 
    // Step 2: fetch each DLC name, emit as we go, skip unknowns
    let mut dlc_details = Vec::new();
 
    for (index, dlc_id) in dlc_ids.iter().enumerate() {
        // Check for cancellation
        if should_cancel.load(Ordering::SeqCst) {
            info!("DLC fetch cancelled for game {}", app_id);
            return Err("Operation cancelled by user".to_string());
        }
 
        let progress_rounded = (10.0 + (index as f32 / total_dlcs as f32) * 90.0) as u32;
        let remaining = total_dlcs - index;
 
        let est_time_left = if remaining > 0 {
            // steamcmd is ~100 ms/request, much faster than the old 300 ms Steam API
            let seconds = (remaining as f32 * 0.15).ceil() as u32;
            if seconds < 60 {
                format!("~{} seconds", seconds)
            } else {
                format!("~{} minute(s)", (seconds as f32 / 60.0).ceil() as u32)
            }
        } else {
            "almost done".to_string()
        };
 
        info!(
            "Processing DLC {}/{} ({})",
            index + 1,
            total_dlcs,
            dlc_id
        );
        emit_dlc_progress(
            app_handle,
            &format!("Processing DLC {}/{}", index + 1, total_dlcs),
            progress_rounded,
            Some(&est_time_left),
        );
 
        // Small delay to be polite to the API
        tokio::time::sleep(Duration::from_millis(100)).await;
 
        match fetch_dlc_name(&client, dlc_id).await {
            Some(name) => {
                info!("Found DLC: {} ({})", name, dlc_id);
                let dlc_info = DlcInfo {
                    appid: dlc_id.clone(),
                    name,
                };
 
                // Emit immediately so the UI updates as DLCs arrive
                if let Ok(json) = serde_json::to_string(&dlc_info) {
                    if let Err(e) = app_handle.emit("dlc-found", json) {
                        warn!("Failed to emit dlc-found event: {}", e);
                    }
                }
 
                dlc_details.push(dlc_info);
            }
            None => {
                info!("Skipping DLC {} - no name / unknown", dlc_id);
            }
        }
    }
 
    info!(
        "Completed DLC fetch. Found {} named DLCs out of {} IDs",
        dlc_details.len(),
        total_dlcs
    );
    emit_dlc_progress(
        app_handle,
        &format!("Completed! Found {} DLCs", dlc_details.len()),
        100,
        None,
    );
 
    Ok(dlc_details)
}

// Emit DLC progress updates to the frontend
fn emit_dlc_progress(
    app_handle: &tauri::AppHandle,
    message: &str,
    progress: u32,
    time_left: Option<&str>,
) {
    let mut payload = json!({
        "message": message,
        "progress": progress
    });

    if let Some(time) = time_left {
        payload["timeLeft"] = json!(time);
    }

    if let Err(e) = app_handle.emit("dlc-progress", payload) {
        warn!("Failed to emit dlc-progress event: {}", e);
    }
}

// Write cream_api.ini configuration file
fn write_cream_api_ini(game_path: &str, app_id: &str, dlcs: &[DlcInfo]) -> Result<(), String> {
    let cream_api_path = Path::new(game_path).join("cream_api.ini");
    let mut config = String::new();

    config.push_str(&format!("APPID = {}\n[config]\n", app_id));
    config.push_str("issubscribedapp_on_false_use_real = true\n");
    config.push_str("[methods]\n");
    config.push_str("disable_steamapps_issubscribedapp = false\n");
    config.push_str("[dlc]\n");

    for dlc in dlcs {
        config.push_str(&format!("{} = {}\n", dlc.appid, dlc.name));
    }

    fs::write(&cream_api_path, config)
        .map_err(|e| format!("Failed to write cream_api.ini: {}", e))?;

    info!("Wrote cream_api.ini to {}", cream_api_path.display());
    Ok(())
}