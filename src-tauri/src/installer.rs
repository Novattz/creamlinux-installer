use crate::AppState;
use log::{error, info, warn};
use reqwest;
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::fs;
use std::io;
use std::path::Path;
use std::sync::atomic::Ordering;
use std::time::Duration;
use tauri::Manager;
use tauri::{AppHandle, Emitter};
use tempfile::tempdir;
use zip::ZipArchive;

// Constants for API endpoints and downloads
const CREAMLINUX_RELEASE_URL: &str =
    "https://github.com/anticitizn/creamlinux/releases/latest/download/creamlinux.zip";
const SMOKEAPI_REPO: &str = "acidicoala/SmokeAPI";

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

// Error type combining all possible errors
#[derive(Debug)]
pub enum InstallerError {
    IoError(io::Error),
    ReqwestError(reqwest::Error),
    ZipError(zip::result::ZipError),
    InstallationError(String),
}

impl From<io::Error> for InstallerError {
    fn from(err: io::Error) -> Self {
        InstallerError::IoError(err)
    }
}

impl From<reqwest::Error> for InstallerError {
    fn from(err: reqwest::Error) -> Self {
        InstallerError::ReqwestError(err)
    }
}

impl From<zip::result::ZipError> for InstallerError {
    fn from(err: zip::result::ZipError) -> Self {
        InstallerError::ZipError(err)
    }
}

impl std::fmt::Display for InstallerError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            InstallerError::IoError(e) => write!(f, "IO error: {}", e),
            InstallerError::ReqwestError(e) => write!(f, "Network error: {}", e),
            InstallerError::ZipError(e) => write!(f, "Zip extraction error: {}", e),
            InstallerError::InstallationError(e) => write!(f, "Installation error: {}", e),
        }
    }
}

impl std::error::Error for InstallerError {}

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

// Game information structure from searcher module
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
    _game_id: String,
    installer_type: InstallerType,
    action: InstallerAction,
    game: Game,
    app_handle: AppHandle,
) -> Result<(), String> {
    match (installer_type, action) {
        (InstallerType::Cream, InstallerAction::Install) => {
            // We only allow CreamLinux for native games
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
            let dlcs = match fetch_dlc_details(&game.id).await {
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
                "Downloading CreamLinux...",
                30.0,
                false,
                false,
                None,
            );

            // Install CreamLinux
            let app_handle_clone = app_handle.clone();
            let game_title_clone = game_title.clone();

            match install_creamlinux(&game.path, &game.id, dlcs, move |progress, message| {
                // Emit progress updates during installation
                emit_progress(
                    &app_handle_clone,
                    &format!("Installing CreamLinux for {}", game_title_clone),
                    message,
                    30.0 + (progress * 60.0), // Scale progress from 30% to 90%
                    false,
                    false,
                    None,
                );
            })
            .await
            {
                Ok(_) => {
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
                Err(e) => {
                    error!("Failed to install CreamLinux: {}", e);
                    Err(format!("Failed to install CreamLinux: {}", e))
                }
            }
        }
        (InstallerType::Cream, InstallerAction::Uninstall) => {
            // Ensure this is a native game
            if !game.native {
                return Err(
                    "CreamLinux can only be uninstalled from native Linux games".to_string()
                );
            }

            let game_title = game.title.clone();
            info!("Uninstalling CreamLinux from game: {}", game_title);

            emit_progress(
                &app_handle,
                &format!("Uninstalling CreamLinux from {}", game_title),
                "Removing CreamLinux files...",
                30.0,
                false,
                false,
                None,
            );

            // Uninstall CreamLinux
            match uninstall_creamlinux(&game.path) {
                Ok(_) => {
                    // Emit completion with instructions
                    let instructions = InstallationInstructions {
                        type_: "cream_uninstall".to_string(),
                        command: "sh ./cream.sh %command%".to_string(),
                        game_title: game_title.clone(),
                        dlc_count: None,
                    };

                    emit_progress(
                        &app_handle,
                        &format!("Uninstallation Completed: {}", game_title),
                        "CreamLinux has been uninstalled successfully!",
                        100.0,
                        true,
                        true,
                        Some(instructions),
                    );

                    info!("CreamLinux uninstallation completed for: {}", game_title);
                    Ok(())
                }
                Err(e) => {
                    error!("Failed to uninstall CreamLinux: {}", e);
                    Err(format!("Failed to uninstall CreamLinux: {}", e))
                }
            }
        }
        (InstallerType::Smoke, InstallerAction::Install) => {
            // We only allow SmokeAPI for Proton/Windows games
            if game.native {
                return Err("SmokeAPI can only be installed on Proton/Windows games".to_string());
            }

            // Check if we have any Steam API DLLs to patch
            if game.api_files.is_empty() {
                return Err(
                    "No Steam API DLLs found to patch. SmokeAPI cannot be installed.".to_string(),
                );
            }

            let game_title = game.title.clone();
            info!("Installing SmokeAPI for game: {}", game_title);

            emit_progress(
                &app_handle,
                &format!("Installing SmokeAPI for {}", game_title),
                "Fetching SmokeAPI release information...",
                10.0,
                false,
                false,
                None,
            );

            // Create clones for the closure
            let app_handle_clone = app_handle.clone();
            let game_title_clone = game_title.clone();
            let api_files = game.api_files.clone();

            // Call the SmokeAPI installation with progress updates
            match install_smokeapi(&game.path, &api_files, move |progress, message| {
                // Emit progress updates during installation
                emit_progress(
                    &app_handle_clone,
                    &format!("Installing SmokeAPI for {}", game_title_clone),
                    message,
                    10.0 + (progress * 90.0), // Scale progress from 10% to 100%
                    false,
                    false,
                    None,
                );
            })
            .await
            {
                Ok(_) => {
                    // Emit completion with instructions
                    let instructions = InstallationInstructions {
                        type_: "smoke_install".to_string(),
                        command: "No additional steps needed. SmokeAPI will work automatically."
                            .to_string(),
                        game_title: game_title.clone(),
                        dlc_count: Some(game.api_files.len()),
                    };

                    emit_progress(
                        &app_handle,
                        &format!("Installation Completed: {}", game_title),
                        "SmokeAPI has been installed successfully!",
                        100.0,
                        true,
                        true,
                        Some(instructions),
                    );

                    info!("SmokeAPI installation completed for: {}", game_title);
                    Ok(())
                }
                Err(e) => {
                    error!("Failed to install SmokeAPI: {}", e);
                    Err(format!("Failed to install SmokeAPI: {}", e))
                }
            }
        }
        (InstallerType::Smoke, InstallerAction::Uninstall) => {
            // Ensure this is a non-native game
            if game.native {
                return Err(
                    "SmokeAPI can only be uninstalled from Proton/Windows games".to_string()
                );
            }

            let game_title = game.title.clone();
            info!("Uninstalling SmokeAPI from game: {}", game_title);

            emit_progress(
                &app_handle,
                &format!("Uninstalling SmokeAPI from {}", game_title),
                "Restoring original files...",
                30.0,
                false,
                false,
                None,
            );

            // Uninstall SmokeAPI
            match uninstall_smokeapi(&game.path, &game.api_files) {
                Ok(_) => {
                    // Emit completion with instructions
                    let instructions = InstallationInstructions {
                        type_: "smoke_uninstall".to_string(),
                        command: "Original Steam API files have been restored.".to_string(),
                        game_title: game_title.clone(),
                        dlc_count: None,
                    };

                    emit_progress(
                        &app_handle,
                        &format!("Uninstallation Completed: {}", game_title),
                        "SmokeAPI has been uninstalled successfully!",
                        100.0,
                        true,
                        true,
                        Some(instructions),
                    );

                    info!("SmokeAPI uninstallation completed for: {}", game_title);
                    Ok(())
                }
                Err(e) => {
                    error!("Failed to uninstall SmokeAPI: {}", e);
                    Err(format!("Failed to uninstall SmokeAPI: {}", e))
                }
            }
        }
    }
}

// Install CreamLinux for a game
async fn install_creamlinux<F>(
    game_path: &str,
    app_id: &str,
    dlcs: Vec<DlcInfo>,
    progress_callback: F,
) -> Result<(), InstallerError>
where
    F: Fn(f32, &str) + Send + 'static,
{
    // Progress update
    progress_callback(0.1, "Preparing to download CreamLinux...");

    // Download CreamLinux zip
    let client = reqwest::Client::new();
    progress_callback(0.2, "Downloading CreamLinux...");

    let response = client
        .get(CREAMLINUX_RELEASE_URL)
        .timeout(Duration::from_secs(30))
        .send()
        .await?;

    if !response.status().is_success() {
        return Err(InstallerError::InstallationError(format!(
            "Failed to download CreamLinux: HTTP {}",
            response.status()
        )));
    }

    // Save to temporary file
    progress_callback(0.4, "Saving downloaded files...");
    let temp_dir = tempdir()?;
    let zip_path = temp_dir.path().join("creamlinux.zip");
    let content = response.bytes().await?;
    fs::write(&zip_path, &content)?;

    // Extract the zip
    progress_callback(0.5, "Extracting CreamLinux files...");
    let file = fs::File::open(&zip_path)?;
    let mut archive = ZipArchive::new(file)?;

    for i in 0..archive.len() {
        let mut file = archive.by_index(i)?;
        let outpath = Path::new(game_path).join(file.name());

        if file.name().ends_with('/') {
            fs::create_dir_all(&outpath)?;
        } else {
            if let Some(p) = outpath.parent() {
                if !p.exists() {
                    fs::create_dir_all(p)?;
                }
            }
            let mut outfile = fs::File::create(&outpath)?;
            io::copy(&mut file, &mut outfile)?;
        }

        // Set executable permissions for cream.sh
        if file.name() == "cream.sh" {
            progress_callback(0.6, "Setting executable permissions...");
            #[cfg(unix)]
            {
                use std::os::unix::fs::PermissionsExt;
                let mut perms = fs::metadata(&outpath)?.permissions();
                perms.set_mode(0o755);
                fs::set_permissions(&outpath, perms)?;
            }
        }
    }

    // Create cream_api.ini with DLC info
    progress_callback(0.8, "Creating configuration file...");
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

    fs::write(cream_api_path, config)?;
    progress_callback(1.0, "Installation completed successfully!");

    Ok(())
}

// Install CreamLinux for a game with pre-fetched DLC list
pub async fn install_creamlinux_with_dlcs<F>(
    game_path: &str,
    app_id: &str,
    dlcs: Vec<DlcInfo>,
    progress_callback: F,
) -> Result<(), InstallerError>
where
    F: Fn(f32, &str) + Send + 'static,
{
    // Progress update
    progress_callback(0.1, "Preparing to download CreamLinux...");

    // Download CreamLinux zip
    let client = reqwest::Client::new();
    progress_callback(0.2, "Downloading CreamLinux...");

    let response = client
        .get(CREAMLINUX_RELEASE_URL)
        .timeout(Duration::from_secs(30))
        .send()
        .await?;

    if !response.status().is_success() {
        return Err(InstallerError::InstallationError(format!(
            "Failed to download CreamLinux: HTTP {}",
            response.status()
        )));
    }

    // Save to temporary file
    progress_callback(0.4, "Saving downloaded files...");
    let temp_dir = tempdir()?;
    let zip_path = temp_dir.path().join("creamlinux.zip");
    let content = response.bytes().await?;
    fs::write(&zip_path, &content)?;

    // Extract the zip
    progress_callback(0.5, "Extracting CreamLinux files...");
    let file = fs::File::open(&zip_path)?;
    let mut archive = ZipArchive::new(file)?;

    for i in 0..archive.len() {
        let mut file = archive.by_index(i)?;
        let outpath = Path::new(game_path).join(file.name());

        if file.name().ends_with('/') {
            fs::create_dir_all(&outpath)?;
        } else {
            if let Some(p) = outpath.parent() {
                if !p.exists() {
                    fs::create_dir_all(p)?;
                }
            }
            let mut outfile = fs::File::create(&outpath)?;
            io::copy(&mut file, &mut outfile)?;
        }

        // Set executable permissions for cream.sh
        if file.name() == "cream.sh" {
            progress_callback(0.6, "Setting executable permissions...");
            #[cfg(unix)]
            {
                use std::os::unix::fs::PermissionsExt;
                let mut perms = fs::metadata(&outpath)?.permissions();
                perms.set_mode(0o755);
                fs::set_permissions(&outpath, perms)?;
            }
        }
    }

    // Create cream_api.ini with DLC info - using the provided DLCs directly
    progress_callback(0.8, "Creating configuration file...");
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

    fs::write(cream_api_path, config)?;
    progress_callback(1.0, "Installation completed successfully!");

    Ok(())
}

// Uninstall CreamLinux from a game
fn uninstall_creamlinux(game_path: &str) -> Result<(), InstallerError> {
    info!("Uninstalling CreamLinux from: {}", game_path);

    // Files to remove during uninstallation
    let files_to_remove = [
        "cream.sh",
        "cream_api.ini",
        "cream_api.so",
        "lib32Creamlinux.so",
        "lib64Creamlinux.so",
    ];

    for file in &files_to_remove {
        let file_path = Path::new(game_path).join(file);
        if file_path.exists() {
            match fs::remove_file(&file_path) {
                Ok(_) => info!("Removed file: {}", file_path.display()),
                Err(e) => {
                    error!("Failed to remove {}: {}", file_path.display(), e);
                    // Continue with other files even if one fails
                }
            }
        }
    }

    info!("CreamLinux uninstallation completed for: {}", game_path);
    Ok(())
}

// Fetch DLC details from Steam API
pub async fn fetch_dlc_details(app_id: &str) -> Result<Vec<DlcInfo>, InstallerError> {
    let client = reqwest::Client::new();
    let base_url = format!(
        "https://store.steampowered.com/api/appdetails?appids={}",
        app_id
    );

    let response = client
        .get(&base_url)
        .timeout(Duration::from_secs(10))
        .send()
        .await?;

    if !response.status().is_success() {
        return Err(InstallerError::InstallationError(format!(
            "Failed to fetch game details: HTTP {}",
            response.status()
        )));
    }

    let data: serde_json::Value = response.json().await?;
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
            .await?;

        if dlc_response.status().is_success() {
            let dlc_data: serde_json::Value = dlc_response.json().await?;

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
) -> Result<Vec<DlcInfo>, InstallerError> {
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
        .await?;

    if !response.status().is_success() {
        let error_msg = format!("Failed to fetch game details: HTTP {}", response.status());
        error!("{}", error_msg);
        return Err(InstallerError::InstallationError(error_msg));
    }

    let data: serde_json::Value = response.json().await?;
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
            return Err(InstallerError::InstallationError(
                "Operation cancelled by user".to_string(),
            ));
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
            .await?;

        if dlc_response.status().is_success() {
            let dlc_data: serde_json::Value = dlc_response.json().await?;

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

// Install SmokeAPI for a game
async fn install_smokeapi<F>(
    game_path: &str,
    api_files: &[String],
    progress_callback: F,
) -> Result<(), InstallerError>
where
    F: Fn(f32, &str) + Send + 'static,
{
    // Get the latest SmokeAPI release
    progress_callback(0.1, "Fetching latest SmokeAPI release...");
    let client = reqwest::Client::new();
    let releases_url = format!(
        "https://api.github.com/repos/{}/releases/latest",
        SMOKEAPI_REPO
    );

    let response = client
        .get(&releases_url)
        .header("User-Agent", "CreamLinux")
        .timeout(Duration::from_secs(10))
        .send()
        .await?;

    if !response.status().is_success() {
        return Err(InstallerError::InstallationError(format!(
            "Failed to fetch SmokeAPI releases: HTTP {}",
            response.status()
        )));
    }

    let release_info: serde_json::Value = response.json().await?;
    let latest_version = match release_info.get("tag_name") {
        Some(tag) => tag.as_str().unwrap_or("latest"),
        _ => "latest",
    };

    info!("Latest SmokeAPI version: {}", latest_version);

    // Construct download URL
    let zip_url = format!(
        "https://github.com/{}/releases/download/{}/SmokeAPI-{}.zip",
        SMOKEAPI_REPO, latest_version, latest_version
    );

    // Download the zip
    progress_callback(0.3, "Downloading SmokeAPI...");
    let response = client
        .get(&zip_url)
        .timeout(Duration::from_secs(30))
        .send()
        .await?;

    if !response.status().is_success() {
        return Err(InstallerError::InstallationError(format!(
            "Failed to download SmokeAPI: HTTP {}",
            response.status()
        )));
    }

    // Save to temporary file
    progress_callback(0.5, "Saving downloaded files...");
    let temp_dir = tempdir()?;
    let zip_path = temp_dir.path().join("smokeapi.zip");
    let content = response.bytes().await?;
    fs::write(&zip_path, &content)?;

    // Extract and install for each API file
    progress_callback(0.6, "Extracting SmokeAPI files...");
    let file = fs::File::open(&zip_path)?;
    let mut archive = ZipArchive::new(file)?;

    for (i, api_file) in api_files.iter().enumerate() {
        let progress = 0.6 + (i as f32 / api_files.len() as f32) * 0.3;
        progress_callback(progress, &format!("Installing SmokeAPI for {}", api_file));

        let api_dir = Path::new(game_path).join(
            Path::new(api_file)
                .parent()
                .unwrap_or_else(|| Path::new("")),
        );
        let api_name = Path::new(api_file).file_name().unwrap_or_default();

        // Backup original file
        let original_path = api_dir.join(api_name);
        let backup_path = api_dir.join(api_name.to_string_lossy().replace(".dll", "_o.dll"));

        info!("Processing: {}", original_path.display());
        info!("Backup path: {}", backup_path.display());

        // Only backup if not already backed up
        if !backup_path.exists() && original_path.exists() {
            fs::copy(&original_path, &backup_path)?;
            info!("Created backup: {}", backup_path.display());
        }

        // Map the Steam API DLL name to the corresponding SmokeAPI DLL name
        let smoke_dll_name = match api_name.to_string_lossy().as_ref() {
            "steam_api.dll" => "SmokeAPI32.dll",
            "steam_api64.dll" => "SmokeAPI64.dll",
            _ => {
                return Err(InstallerError::InstallationError(format!(
                    "Unknown Steam API DLL: {}",
                    api_name.to_string_lossy()
                )));
            }
        };

        // Extract the appropriate SmokeAPI DLL and rename it to the original Steam API DLL name
        if let Ok(mut file) = archive.by_name(smoke_dll_name) {
            let mut outfile = fs::File::create(&original_path)?;
            io::copy(&mut file, &mut outfile)?;
            info!("Installed {} as: {}", smoke_dll_name, original_path.display());
        } else {
            return Err(InstallerError::InstallationError(format!(
                "Could not find {} in the SmokeAPI zip file",
                smoke_dll_name
            )));
        }
    }

    progress_callback(1.0, "SmokeAPI installation completed!");
    info!("SmokeAPI installation completed for: {}", game_path);
    Ok(())
}

// Uninstall SmokeAPI from a game
fn uninstall_smokeapi(game_path: &str, api_files: &[String]) -> Result<(), InstallerError> {
    info!("Uninstalling SmokeAPI from: {}", game_path);

    for api_file in api_files {
        let api_path = Path::new(game_path).join(api_file);
        let api_dir = api_path.parent().unwrap_or_else(|| Path::new(game_path));
        let api_name = api_path.file_name().unwrap_or_default();

        let original_path = api_dir.join(api_name);
        let backup_path = api_dir.join(api_name.to_string_lossy().replace(".dll", "_o.dll"));

        info!("Processing: {}", original_path.display());
        info!("Backup path: {}", backup_path.display());

        if backup_path.exists() {
            // Remove the SmokeAPI version
            if original_path.exists() {
                match fs::remove_file(&original_path) {
                    Ok(_) => info!("Removed SmokeAPI file: {}", original_path.display()),
                    Err(e) => error!(
                        "Failed to remove SmokeAPI file: {}, error: {}",
                        original_path.display(),
                        e
                    ),
                }
            }

            // Restore the original file
            match fs::rename(&backup_path, &original_path) {
                Ok(_) => info!("Restored original file: {}", original_path.display()),
                Err(e) => {
                    error!(
                        "Failed to restore original file: {}, error: {}",
                        original_path.display(),
                        e
                    );
                    // Try to copy instead if rename fails
                    if let Err(copy_err) = fs::copy(&backup_path, &original_path)
                        .and_then(|_| fs::remove_file(&backup_path))
                    {
                        error!("Failed to copy backup file: {}", copy_err);
                    }
                }
            }
        } else {
            info!("No backup found for: {}", api_file);
        }
    }

    info!("SmokeAPI uninstallation completed for: {}", game_path);
    Ok(())
}
