#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

mod cache;
mod dlc_manager;
mod installer;
mod searcher; // Keep the module for now

use dlc_manager::DlcInfoWithState;
use installer::{Game, InstallerAction, InstallerType};
use log::{debug, error, info, warn};
use parking_lot::Mutex;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::atomic::AtomicBool;
use std::sync::atomic::Ordering;
use std::sync::Arc;
use tauri::State;
use tauri::{Emitter, Manager};
use tokio::time::Duration;
use tokio::time::Instant;

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct GameAction {
    game_id: String,
    action: String,
}

#[derive(Debug, Clone)]
struct DlcCache {
    data: Vec<DlcInfoWithState>,
    timestamp: Instant,
}

// Structure to hold the state of installed games
struct AppState {
    games: Mutex<HashMap<String, Game>>,
    dlc_cache: Mutex<HashMap<String, DlcCache>>,
    fetch_cancellation: Arc<AtomicBool>,
}

#[tauri::command]
fn get_all_dlcs_command(game_path: String) -> Result<Vec<DlcInfoWithState>, String> {
    info!("Getting all DLCs (enabled and disabled) for: {}", game_path);
    dlc_manager::get_all_dlcs(&game_path)
}

// Scan and get the list of Steam games
#[tauri::command]
async fn scan_steam_games(
    state: State<'_, AppState>,
    app_handle: tauri::AppHandle,
) -> Result<Vec<Game>, String> {
    info!("Starting Steam games scan");
    emit_scan_progress(&app_handle, "Locating Steam libraries...", 10);

    // Get default Steam paths
    let paths = searcher::get_default_steam_paths();

    // Find Steam libraries
    emit_scan_progress(&app_handle, "Finding Steam libraries...", 15);
    let libraries = searcher::find_steam_libraries(&paths);

    // Group libraries by path to avoid duplicates in logs
    let mut unique_libraries = std::collections::HashSet::new();
    for lib in &libraries {
        unique_libraries.insert(lib.to_string_lossy().to_string());
    }

    info!(
        "Found {} Steam library directories:",
        unique_libraries.len()
    );
    for (i, lib) in unique_libraries.iter().enumerate() {
        info!("  Library {}: {}", i + 1, lib);
    }

    emit_scan_progress(
        &app_handle,
        &format!(
            "Found {} Steam libraries. Starting game scan...",
            unique_libraries.len()
        ),
        20,
    );

    // Find installed games
    let games_info = searcher::find_installed_games(&libraries).await;

    emit_scan_progress(
        &app_handle,
        &format!("Found {} games. Processing...", games_info.len()),
        90,
    );

    // Log summary of games found
    info!("Games scan complete - Found {} games", games_info.len());
    info!(
        "Native games: {}",
        games_info.iter().filter(|g| g.native).count()
    );
    info!(
        "Proton games: {}",
        games_info.iter().filter(|g| !g.native).count()
    );
    info!(
        "Games with CreamLinux: {}",
        games_info.iter().filter(|g| g.cream_installed).count()
    );
    info!(
        "Games with SmokeAPI: {}",
        games_info.iter().filter(|g| g.smoke_installed).count()
    );

    // Convert to our Game struct
    let mut result = Vec::new();

    info!("Processing games into application state...");
    for game_info in games_info {
        // Only log detailed game info at Debug level to keep Info logs cleaner
        debug!(
            "Processing game: {}, Native: {}, CreamLinux: {}, SmokeAPI: {}",
            game_info.title, game_info.native, game_info.cream_installed, game_info.smoke_installed
        );

        let game = Game {
            id: game_info.id,
            title: game_info.title,
            path: game_info.path.to_string_lossy().to_string(),
            native: game_info.native,
            api_files: game_info.api_files,
            cream_installed: game_info.cream_installed,
            smoke_installed: game_info.smoke_installed,
            installing: false,
        };

        result.push(game.clone());

        // Store in state for later use
        state.games.lock().insert(game.id.clone(), game);
    }

    emit_scan_progress(
        &app_handle,
        &format!("Scan complete. Found {} games.", result.len()),
        100,
    );

    info!("Game scan completed successfully");
    Ok(result)
}

// Helper function to emit scan progress events
fn emit_scan_progress(app_handle: &tauri::AppHandle, message: &str, progress: u32) {
    // Log first, then emit the event
    info!("Scan progress: {}% - {}", progress, message);

    let payload = serde_json::json!({
        "message": message,
        "progress": progress
    });

    if let Err(e) = app_handle.emit("scan-progress", payload) {
        warn!("Failed to emit scan-progress event: {}", e);
    }
}

// Fetch game info by ID - useful for single game updates
#[tauri::command]
fn get_game_info(game_id: String, state: State<AppState>) -> Result<Game, String> {
    let games = state.games.lock();
    games
        .get(&game_id)
        .cloned()
        .ok_or_else(|| format!("Game with ID {} not found", game_id))
}

// Unified action handler for installation and uninstallation
#[tauri::command]
async fn process_game_action(
    game_action: GameAction,
    state: State<'_, AppState>,
    app_handle: tauri::AppHandle,
) -> Result<Game, String> {
    // Clone the information we need from state to avoid lifetime issues
    let game = {
        let games = state.games.lock();
        games
            .get(&game_action.game_id)
            .cloned()
            .ok_or_else(|| format!("Game with ID {} not found", game_action.game_id))?
    };

    // Parse the action string to determine type and operation
    let (installer_type, action) = match game_action.action.as_str() {
        "install_cream" => (InstallerType::Cream, InstallerAction::Install),
        "uninstall_cream" => (InstallerType::Cream, InstallerAction::Uninstall),
        "install_smoke" => (InstallerType::Smoke, InstallerAction::Install),
        "uninstall_smoke" => (InstallerType::Smoke, InstallerAction::Uninstall),
        _ => return Err(format!("Invalid action: {}", game_action.action)),
    };

    // Execute the action
    installer::process_action(
        game_action.game_id.clone(),
        installer_type,
        action,
        game.clone(),
        app_handle.clone(),
    )
    .await?;

    // Update game status in state based on the action
    let updated_game = {
        let mut games_map = state.games.lock();
        let game = games_map.get_mut(&game_action.game_id).ok_or_else(|| {
            format!(
                "Game with ID {} not found after action",
                game_action.game_id
            )
        })?;

        // Update installation status
        match (installer_type, action) {
            (InstallerType::Cream, InstallerAction::Install) => {
                game.cream_installed = true;
            }
            (InstallerType::Cream, InstallerAction::Uninstall) => {
                game.cream_installed = false;
            }
            (InstallerType::Smoke, InstallerAction::Install) => {
                game.smoke_installed = true;
            }
            (InstallerType::Smoke, InstallerAction::Uninstall) => {
                game.smoke_installed = false;
            }
        }

        // Reset installing flag
        game.installing = false;

        // Return updated game info
        game.clone()
    };

    // Emit an event to update the UI for this specific game
    if let Err(e) = app_handle.emit("game-updated", &updated_game) {
        warn!("Failed to emit game-updated event: {}", e);
    }

    Ok(updated_game)
}

// Fetch DLC list for a game
#[tauri::command]
async fn fetch_game_dlcs(
    game_id: String,
    app_handle: tauri::AppHandle,
) -> Result<Vec<DlcInfoWithState>, String> {
    info!("Fetching DLCs for game ID: {}", game_id);

    // Fetch DLC data
    match installer::fetch_dlc_details(&game_id).await {
        Ok(dlcs) => {
            // Convert to DlcInfoWithState
            let dlcs_with_state = dlcs
                .into_iter()
                .map(|dlc| DlcInfoWithState {
                    appid: dlc.appid,
                    name: dlc.name,
                    enabled: true,
                })
                .collect::<Vec<_>>();

            // Cache in memory for this session (but not on disk)
            let state = app_handle.state::<AppState>();
            let mut cache = state.dlc_cache.lock();
            cache.insert(
                game_id.clone(),
                DlcCache {
                    data: dlcs_with_state.clone(),
                    timestamp: Instant::now(),
                },
            );

            Ok(dlcs_with_state)
        }
        Err(e) => Err(format!("Failed to fetch DLC details: {}", e)),
    }
}

#[tauri::command]
fn abort_dlc_fetch(game_id: String, app_handle: tauri::AppHandle) -> Result<(), String> {
    info!("Request to abort DLC fetch for game ID: {}", game_id);

    let state = app_handle.state::<AppState>();
    state.fetch_cancellation.store(true, Ordering::SeqCst);

    // Reset after a short delay
    std::thread::spawn(move || {
        std::thread::sleep(std::time::Duration::from_millis(500));
        let state = app_handle.state::<AppState>();
        state.fetch_cancellation.store(false, Ordering::SeqCst);
    });

    Ok(())
}

// Fetch DLC list with progress updates (streaming)
#[tauri::command]
async fn stream_game_dlcs(game_id: String, app_handle: tauri::AppHandle) -> Result<(), String> {
    info!("Streaming DLCs for game ID: {}", game_id);

    // Fetch DLC data from API
    match installer::fetch_dlc_details_with_progress(&game_id, &app_handle).await {
        Ok(dlcs) => {
            info!(
                "Successfully streamed {} DLCs for game {}",
                dlcs.len(),
                game_id
            );

            // Convert to DLCInfoWithState for in-memory caching only
            let dlcs_with_state = dlcs
                .into_iter()
                .map(|dlc| DlcInfoWithState {
                    appid: dlc.appid,
                    name: dlc.name,
                    enabled: true,
                })
                .collect::<Vec<_>>();

            // Update in-memory cache without storing to disk
            let state = app_handle.state::<AppState>();
            let mut dlc_cache = state.dlc_cache.lock();
            dlc_cache.insert(
                game_id.clone(),
                DlcCache {
                    data: dlcs_with_state,
                    timestamp: tokio::time::Instant::now(),
                },
            );

            Ok(())
        }
        Err(e) => {
            error!("Failed to stream DLC details: {}", e);
            // Emit error event
            let error_payload = serde_json::json!({
                "error": format!("Failed to fetch DLC details: {}", e)
            });

            if let Err(emit_err) = app_handle.emit("dlc-error", error_payload) {
                warn!("Failed to emit dlc-error event: {}", emit_err);
            }

            Err(format!("Failed to fetch DLC details: {}", e))
        }
    }
}

// Clear caches command renamed to flush_data for clarity
#[tauri::command]
fn clear_caches() -> Result<(), String> {
    info!("Data flush requested - cleaning in-memory state only");
    Ok(())
}

// Get the list of enabled DLCs for a game
#[tauri::command]
fn get_enabled_dlcs_command(game_path: String) -> Result<Vec<String>, String> {
    info!("Getting enabled DLCs for: {}", game_path);
    dlc_manager::get_enabled_dlcs(&game_path)
}

// Update the DLC configuration for a game
#[tauri::command]
fn update_dlc_configuration_command(
    game_path: String,
    dlcs: Vec<DlcInfoWithState>,
) -> Result<(), String> {
    info!("Updating DLC configuration for: {}", game_path);
    dlc_manager::update_dlc_configuration(&game_path, dlcs)
}

// Install CreamLinux with selected DLCs
#[tauri::command]
async fn install_cream_with_dlcs_command(
    game_id: String,
    selected_dlcs: Vec<DlcInfoWithState>,
    app_handle: tauri::AppHandle,
) -> Result<Game, String> {
    info!(
        "Installing CreamLinux with selected DLCs for game: {}",
        game_id
    );

    // Clone selected_dlcs for later use
    let selected_dlcs_clone = selected_dlcs.clone();

    // Install CreamLinux with the selected DLCs
    match dlc_manager::install_cream_with_dlcs(game_id.clone(), app_handle.clone(), selected_dlcs)
        .await
    {
        Ok(_) => {
            // Return updated game info
            let state = app_handle.state::<AppState>();

            // Get a mutable reference and update the game
            let game = {
                let mut games_map = state.games.lock();
                let game = games_map.get_mut(&game_id).ok_or_else(|| {
                    format!("Game with ID {} not found after installation", game_id)
                })?;

                // Update installation status
                game.cream_installed = true;
                game.installing = false;

                // Clone the game for returning later
                game.clone()
            };

            // Emit an event to update the UI
            if let Err(e) = app_handle.emit("game-updated", &game) {
                warn!("Failed to emit game-updated event: {}", e);
            }

            // Show installation complete dialog with instructions
            let instructions = installer::InstallationInstructions {
                type_: "cream_install".to_string(),
                command: "sh ./cream.sh %command%".to_string(),
                game_title: game.title.clone(),
                dlc_count: Some(selected_dlcs_clone.iter().filter(|dlc| dlc.enabled).count()),
            };

            installer::emit_progress(
                &app_handle,
                &format!("Installation Completed: {}", game.title),
                "CreamLinux has been installed successfully!",
                100.0,
                true,
                true,
                Some(instructions),
            );

            Ok(game)
        }
        Err(e) => {
            error!("Failed to install CreamLinux with selected DLCs: {}", e);
            Err(format!(
                "Failed to install CreamLinux with selected DLCs: {}",
                e
            ))
        }
    }
}

// Setup logging
fn setup_logging() -> Result<(), Box<dyn std::error::Error>> {
    use log::LevelFilter;
    use log4rs::append::file::FileAppender;
    use log4rs::config::{Appender, Config, Root};
    use log4rs::encode::pattern::PatternEncoder;
    use std::fs;

    // Get XDG cache directory
    let xdg_dirs = xdg::BaseDirectories::with_prefix("creamlinux")?;
    let log_path = xdg_dirs.place_cache_file("creamlinux.log")?;

    // Clear the log file on startup
    if log_path.exists() {
        if let Err(e) = fs::write(&log_path, "") {
            eprintln!("Warning: Failed to clear log file: {}", e);
        }
    }

    // Create a file appender
    let file = FileAppender::builder()
        .encoder(Box::new(PatternEncoder::new(
            "[{d(%Y-%m-%d %H:%M:%S)}] {l}: {m}\n",
        )))
        .build(log_path)?;

    // Build the config
    let config = Config::builder()
        .appender(Appender::builder().build("file", Box::new(file)))
        .build(Root::builder().appender("file").build(LevelFilter::Info))?;

    // Initialize log4rs with this config
    log4rs::init_config(config)?;

    info!("CreamLinux started with a clean log file");
    Ok(())
}

fn main() {
    // Set up logging first
    if let Err(e) = setup_logging() {
        eprintln!("Warning: Failed to initialize logging: {}", e);
    }

    info!("Initializing CreamLinux application");

    let app_state = AppState {
        games: Mutex::new(HashMap::new()),
        dlc_cache: Mutex::new(HashMap::new()),
        fetch_cancellation: Arc::new(AtomicBool::new(false)),
    };

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .manage(app_state)
        .invoke_handler(tauri::generate_handler![
            scan_steam_games,
            get_game_info,
            process_game_action,
            fetch_game_dlcs,
            stream_game_dlcs,
            get_enabled_dlcs_command,
            update_dlc_configuration_command,
            install_cream_with_dlcs_command,
            get_all_dlcs_command,
            clear_caches,
            abort_dlc_fetch,
        ])
        .setup(|app| {
            // Add a setup handler to do any initialization work
            info!("Tauri application setup");

            #[cfg(debug_assertions)]
            {
                if std::env::var("OPEN_DEVTOOLS").ok().as_deref() == Some("1") {
                    if let Some(window) = app.get_webview_window("main") {
                        window.open_devtools();
                    }
                }
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
