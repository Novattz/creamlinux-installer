mod file_ops;

use crate::cache::{
    remove_creamlinux_version, remove_smokeapi_version,
    update_game_creamlinux_version, update_game_smokeapi_version,
};
use crate::unlockers::{CreamLinux, SmokeAPI, Unlocker};
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

// Install SmokeAPI to a game
async fn install_smokeapi(game: Game, app_handle: AppHandle) -> Result<(), String> {
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

// Uninstall SmokeAPI from a game
async fn uninstall_smokeapi(game: Game, app_handle: AppHandle) -> Result<(), String> {
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

// Fetch DLC details from Steam API (simple version without progress)
pub async fn fetch_dlc_details(app_id: &str) -> Result<Vec<DlcInfo>, String> {
    let client = reqwest::Client::new();
    let base_url = format!(
        "https://store.steampowered.com/api/appdetails?appids={}",
        app_id
    );

    let response = client
        .get(&base_url)
        .timeout(Duration::from_secs(10))
        .send()
        .await
        .map_err(|e| format!("Failed to fetch game details: {}", e))?;

    if !response.status().is_success() {
        return Err(format!(
            "Failed to fetch game details: HTTP {}",
            response.status()
        ));
    }

    let data: serde_json::Value = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse response: {}", e))?;

    let dlc_ids = match data
        .get(app_id)
        .and_then(|app| app.get("data"))
        .and_then(|data| data.get("dlc"))
    {
        Some(dlc_array) => match dlc_array.as_array() {
            Some(array) => array
                .iter()
                .filter_map(|id| id.as_u64().map(|n| n.to_string()))
                .collect::<Vec<String>>(),
            _ => Vec::new(),
        },
        _ => Vec::new(),
    };

    info!("Found {} DLCs for game ID {}", dlc_ids.len(), app_id);

    let mut dlc_details = Vec::new();

    for dlc_id in dlc_ids {
        let dlc_url = format!(
            "https://store.steampowered.com/api/appdetails?appids={}",
            dlc_id
        );

        // Add a small delay to avoid rate limiting
        tokio::time::sleep(Duration::from_millis(300)).await;

        let dlc_response = client
            .get(&dlc_url)
            .timeout(Duration::from_secs(10))
            .send()
            .await
            .map_err(|e| format!("Failed to fetch DLC details: {}", e))?;

        if dlc_response.status().is_success() {
            let dlc_data: serde_json::Value = dlc_response
                .json()
                .await
                .map_err(|e| format!("Failed to parse DLC response: {}", e))?;

            let dlc_name = match dlc_data
                .get(&dlc_id)
                .and_then(|app| app.get("data"))
                .and_then(|data| data.get("name"))
            {
                Some(name) => match name.as_str() {
                    Some(s) => s.to_string(),
                    _ => "Unknown DLC".to_string(),
                },
                _ => "Unknown DLC".to_string(),
            };

            info!("Found DLC: {} ({})", dlc_name, dlc_id);
            dlc_details.push(DlcInfo {
                appid: dlc_id,
                name: dlc_name,
            });
        } else if dlc_response.status() == reqwest::StatusCode::TOO_MANY_REQUESTS {
            // If rate limited, wait longer
            error!("Rate limited by Steam API, waiting 10 seconds");
            tokio::time::sleep(Duration::from_secs(10)).await;
        }
    }

    info!(
        "Successfully retrieved details for {} DLCs",
        dlc_details.len()
    );
    Ok(dlc_details)
}

// Fetch DLC details from Steam API with progress updates
pub async fn fetch_dlc_details_with_progress(
    app_id: &str,
    app_handle: &tauri::AppHandle,
) -> Result<Vec<DlcInfo>, String> {
    info!(
        "Starting DLC details fetch with progress for game ID: {}",
        app_id
    );

    // Get a reference to a cancellation flag from app state
    let state = app_handle.state::<AppState>();
    let should_cancel = state.fetch_cancellation.clone();

    let client = reqwest::Client::new();
    let base_url = format!(
        "https://store.steampowered.com/api/appdetails?appids={}",
        app_id
    );

    // Emit initial progress
    emit_dlc_progress(app_handle, "Looking up game details...", 5, None);
    info!("Emitted initial DLC progress: 5%");

    let response = client
        .get(&base_url)
        .timeout(Duration::from_secs(10))
        .send()
        .await
        .map_err(|e| format!("Failed to fetch game details: {}", e))?;

    if !response.status().is_success() {
        let error_msg = format!("Failed to fetch game details: HTTP {}", response.status());
        error!("{}", error_msg);
        return Err(error_msg);
    }

    let data: serde_json::Value = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse response: {}", e))?;

    let dlc_ids = match data
        .get(app_id)
        .and_then(|app| app.get("data"))
        .and_then(|data| data.get("dlc"))
    {
        Some(dlc_array) => match dlc_array.as_array() {
            Some(array) => array
                .iter()
                .filter_map(|id| id.as_u64().map(|n| n.to_string()))
                .collect::<Vec<String>>(),
            _ => Vec::new(),
        },
        _ => Vec::new(),
    };

    info!("Found {} DLCs for game ID {}", dlc_ids.len(), app_id);
    emit_dlc_progress(
        app_handle,
        &format!("Found {} DLCs. Fetching details...", dlc_ids.len()),
        10,
        None,
    );
    info!("Emitted DLC progress: 10%, found {} DLCs", dlc_ids.len());

    let mut dlc_details = Vec::new();
    let total_dlcs = dlc_ids.len();

    for (index, dlc_id) in dlc_ids.iter().enumerate() {
        // Check if cancellation was requested
        if should_cancel.load(Ordering::SeqCst) {
            info!("DLC fetch cancelled for game {}", app_id);
            return Err("Operation cancelled by user".to_string());
        }

        let progress_percent = 10.0 + (index as f32 / total_dlcs as f32) * 90.0;
        let progress_rounded = progress_percent as u32;
        let remaining_dlcs = total_dlcs - index;

        // Estimate time remaining (rough calculation - 300ms per DLC)
        let est_time_left = if remaining_dlcs > 0 {
            let seconds = (remaining_dlcs as f32 * 0.3).ceil() as u32;
            if seconds < 60 {
                format!("~{} seconds", seconds)
            } else {
                format!("~{} minute(s)", (seconds as f32 / 60.0).ceil() as u32)
            }
        } else {
            "almost done".to_string()
        };

        info!(
            "Processing DLC {}/{} - Progress: {}%",
            index + 1,
            total_dlcs,
            progress_rounded
        );
        emit_dlc_progress(
            app_handle,
            &format!("Processing DLC {}/{}", index + 1, total_dlcs),
            progress_rounded,
            Some(&est_time_left),
        );

        let dlc_url = format!(
            "https://store.steampowered.com/api/appdetails?appids={}",
            dlc_id
        );

        // Add a small delay to avoid rate limiting
        tokio::time::sleep(Duration::from_millis(300)).await;

        let dlc_response = client
            .get(&dlc_url)
            .timeout(Duration::from_secs(10))
            .send()
            .await
            .map_err(|e| format!("Failed to fetch DLC details: {}", e))?;

        if dlc_response.status().is_success() {
            let dlc_data: serde_json::Value = dlc_response
                .json()
                .await
                .map_err(|e| format!("Failed to parse DLC response: {}", e))?;

            let dlc_name = match dlc_data
                .get(&dlc_id)
                .and_then(|app| app.get("data"))
                .and_then(|data| data.get("name"))
            {
                Some(name) => match name.as_str() {
                    Some(s) => s.to_string(),
                    _ => "Unknown DLC".to_string(),
                },
                _ => "Unknown DLC".to_string(),
            };

            info!("Found DLC: {} ({})", dlc_name, dlc_id);
            let dlc_info = DlcInfo {
                appid: dlc_id.clone(),
                name: dlc_name,
            };

            // Emit each DLC as we find it
            if let Ok(json) = serde_json::to_string(&dlc_info) {
                if let Err(e) = app_handle.emit("dlc-found", json) {
                    warn!("Failed to emit dlc-found event: {}", e);
                } else {
                    info!("Emitted dlc-found event for DLC: {}", dlc_id);
                }
            }

            dlc_details.push(dlc_info);
        } else if dlc_response.status() == reqwest::StatusCode::TOO_MANY_REQUESTS {
            // If rate limited, wait longer
            error!("Rate limited by Steam API, waiting 10 seconds");
            emit_dlc_progress(
                app_handle,
                "Rate limited by Steam. Waiting...",
                progress_rounded,
                None,
            );
            tokio::time::sleep(Duration::from_secs(10)).await;
        }
    }

    // Final progress update
    info!(
        "Completed DLC fetch. Found {} DLCs in total",
        dlc_details.len()
    );
    emit_dlc_progress(
        app_handle,
        &format!("Completed! Found {} DLCs", dlc_details.len()),
        100,
        None,
    );
    info!("Emitted final DLC progress: 100%");

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