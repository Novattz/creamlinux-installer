#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

mod cache;
mod dlc_manager;
mod installer;
mod searcher;
mod unlockers;
mod smokeapi_config;

use crate::unlockers::{CreamLinux, SmokeAPI, Unlocker};
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
use tauri_plugin_updater::Builder as UpdaterBuilder;
use tokio::time::Instant;

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct GameAction {
    game_id: String,
    action: String,
}

#[derive(Debug, Clone)]
struct DlcCache {
    #[allow(dead_code)]
    data: Vec<DlcInfoWithState>,
    #[allow(dead_code)]
    timestamp: Instant,
}

// Structure to hold the state of installed games
pub struct AppState {
    games: Mutex<HashMap<String, Game>>,
    dlc_cache: Mutex<HashMap<String, DlcCache>>,
    fetch_cancellation: Arc<AtomicBool>,
}

#[tauri::command]
fn get_all_dlcs_command(game_path: String) -> Result<Vec<DlcInfoWithState>, String> {
    info!("Getting all DLCs (enabled and disabled) for: {}", game_path);
    dlc_manager::get_all_dlcs(&game_path)
}

#[tauri::command]
async fn scan_steam_games(
    state: State<'_, AppState>,
    app_handle: tauri::AppHandle,
) -> Result<Vec<Game>, String> {
    info!("Starting Steam games scan");
    emit_scan_progress(&app_handle, "Locating Steam libraries...", 10);

    let paths = searcher::get_default_steam_paths();

    emit_scan_progress(&app_handle, "Finding Steam libraries...", 15);
    let libraries = searcher::find_steam_libraries(&paths);

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

    let games_info = searcher::find_installed_games(&libraries).await;

    emit_scan_progress(
        &app_handle,
        &format!("Found {} games. Processing...", games_info.len()),
        90,
    );

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

    let mut result = Vec::new();

    info!("Processing games into application state...");
    for game_info in games_info {
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

fn emit_scan_progress(app_handle: &tauri::AppHandle, message: &str, progress: u32) {
    info!("Scan progress: {}% - {}", progress, message);

    let payload = serde_json::json!({
        "message": message,
        "progress": progress
    });

    if let Err(e) = app_handle.emit("scan-progress", payload) {
        warn!("Failed to emit scan-progress event: {}", e);
    }
}

#[tauri::command]
fn get_game_info(game_id: String, state: State<AppState>) -> Result<Game, String> {
    let games = state.games.lock();
    games
        .get(&game_id)
        .cloned()
        .ok_or_else(|| format!("Game with ID {} not found", game_id))
}

#[tauri::command]
async fn process_game_action(
    game_action: GameAction,
    state: State<'_, AppState>,
    app_handle: tauri::AppHandle,
) -> Result<Game, String> {
    let game = {
        let games = state.games.lock();
        games
            .get(&game_action.game_id)
            .cloned()
            .ok_or_else(|| format!("Game with ID {} not found", game_action.game_id))?
    };

    let (installer_type, action) = match game_action.action.as_str() {
        "install_cream" => (InstallerType::Cream, InstallerAction::Install),
        "uninstall_cream" => (InstallerType::Cream, InstallerAction::Uninstall),
        "install_smoke" => (InstallerType::Smoke, InstallerAction::Install),
        "uninstall_smoke" => (InstallerType::Smoke, InstallerAction::Uninstall),
        _ => return Err(format!("Invalid action: {}", game_action.action)),
    };

    installer::process_action(
        game_action.game_id.clone(),
        installer_type,
        action,
        game.clone(),
        app_handle.clone(),
    )
    .await?;

    let updated_game = {
        let mut games_map = state.games.lock();
        let game = games_map.get_mut(&game_action.game_id).ok_or_else(|| {
            format!(
                "Game with ID {} not found after action",
                game_action.game_id
            )
        })?;

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

        game.installing = false;
        game.clone()
    };

    if let Err(e) = app_handle.emit("game-updated", &updated_game) {
        warn!("Failed to emit game-updated event: {}", e);
    }

    Ok(updated_game)
}

#[tauri::command]
async fn fetch_game_dlcs(
    game_id: String,
    state: State<'_, AppState>,
) -> Result<Vec<DlcInfoWithState>, String> {
    info!("Fetching DLC list for game ID: {}", game_id);

    // Fetch DLC data from API
    match installer::fetch_dlc_details(&game_id).await {
        Ok(dlcs) => {
            info!("Successfully fetched {} DLCs for game {}", dlcs.len(), game_id);

            // Convert to DLCInfoWithState for in-memory caching
            let dlcs_with_state = dlcs
                .into_iter()
                .map(|dlc| DlcInfoWithState {
                    appid: dlc.appid,
                    name: dlc.name,
                    enabled: true,
                })
                .collect::<Vec<_>>();

            // Update in-memory cache
            let mut dlc_cache = state.dlc_cache.lock();
            dlc_cache.insert(
                game_id.clone(),
                DlcCache {
                    data: dlcs_with_state.clone(),
                    timestamp: tokio::time::Instant::now(),
                },
            );

            Ok(dlcs_with_state)
        }
        Err(e) => {
            error!("Failed to fetch DLC details: {}", e);
            Err(format!("Failed to fetch DLC details: {}", e))
        }
    }
}

#[tauri::command]
fn abort_dlc_fetch(state: State<'_, AppState>, app_handle: tauri::AppHandle) -> Result<(), String> {
    info!("Aborting DLC fetch request received");
    state.fetch_cancellation.store(true, Ordering::SeqCst);

    // Reset cancellation flag after a short delay
    std::thread::spawn(move || {
        std::thread::sleep(std::time::Duration::from_millis(500));
        let state = app_handle.state::<AppState>();
        state.fetch_cancellation.store(false, Ordering::SeqCst);
    });

    Ok(())
}

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

            // Convert to DLCInfoWithState for in-memory caching
            let dlcs_with_state = dlcs
                .into_iter()
                .map(|dlc| DlcInfoWithState {
                    appid: dlc.appid,
                    name: dlc.name,
                    enabled: true,
                })
                .collect::<Vec<_>>();

            // Update in-memory cache
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

#[tauri::command]
fn clear_caches() -> Result<(), String> {
    info!("Data flush requested - cleaning in-memory state only");
    Ok(())
}

#[tauri::command]
fn get_enabled_dlcs_command(game_path: String) -> Result<Vec<String>, String> {
    info!("Getting enabled DLCs for: {}", game_path);
    dlc_manager::get_enabled_dlcs(&game_path)
}

#[tauri::command]
fn update_dlc_configuration_command(
    game_path: String,
    dlcs: Vec<DlcInfoWithState>,
) -> Result<(), String> {
    info!("Updating DLC configuration for: {}", game_path);
    dlc_manager::update_dlc_configuration(&game_path, dlcs)
}

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

#[tauri::command]
fn read_smokeapi_config(game_path: String) -> Result<Option<smokeapi_config::SmokeAPIConfig>, String> {
    info!("Reading SmokeAPI config for: {}", game_path);
    smokeapi_config::read_config(&game_path)
}

#[tauri::command]
fn write_smokeapi_config(
    game_path: String,
    config: smokeapi_config::SmokeAPIConfig,
) -> Result<(), String> {
    info!("Writing SmokeAPI config for: {}", game_path);
    smokeapi_config::write_config(&game_path, &config)
}

#[tauri::command]
fn delete_smokeapi_config(game_path: String) -> Result<(), String> {
    info!("Deleting SmokeAPI config for: {}", game_path);
    smokeapi_config::delete_config(&game_path)
}

#[tauri::command]
async fn resolve_platform_conflict(
    game_id: String,
    conflict_type: String, // "cream-to-proton" or "smoke-to-native"
    state: State<'_, AppState>,
    app_handle: tauri::AppHandle,
) -> Result<Game, String> {
    info!(
        "Resolving platform conflict for game {}: {}",
        game_id, conflict_type
    );

    let game = {
        let games = state.games.lock();
        games
            .get(&game_id)
            .cloned()
            .ok_or_else(|| format!("Game with ID {} not found", game_id))?
    };

    let game_title = game.title.clone();

    // Emit progress
    installer::emit_progress(
        &app_handle,
        &format!("Resolving Conflict: {}", game_title),
        "Removing conflicting files...",
        50.0,
        false,
        false,
        None,
    );

    // Perform the appropriate removal based on conflict type
    match conflict_type.as_str() {
        "cream-to-proton" => {
            // Remove CreamLinux files (bypassing native check)
            info!("Removing CreamLinux files from Proton game: {}", game_title);
            
            CreamLinux::uninstall_from_game(&game.path, &game.id)
                .await
                .map_err(|e| format!("Failed to remove CreamLinux files: {}", e))?;

            // Remove version from manifest
            crate::cache::remove_creamlinux_version(&game.path)?;
        }
        "smoke-to-native" => {
            // Remove SmokeAPI files (bypassing proton check)
            info!("Removing SmokeAPI files from native game: {}", game_title);
            
            // For native games, we need to manually remove backup files since
            // the main DLL might already be gone
            // Look for and remove *_o.dll backup files
            use walkdir::WalkDir;
            let mut removed_files = false;
            
            for entry in WalkDir::new(&game.path)
                .max_depth(5)
                .into_iter()
                .filter_map(Result::ok)
            {
                let path = entry.path();
                if !path.is_file() {
                    continue;
                }
                
                let filename = path.file_name().unwrap_or_default().to_string_lossy();
                
                // Remove steam_api*_o.dll backup files
                if filename.starts_with("steam_api") && filename.ends_with("_o.dll") {
                    match std::fs::remove_file(path) {
                        Ok(_) => {
                            info!("Removed SmokeAPI backup file: {}", path.display());
                            removed_files = true;
                        }
                        Err(e) => {
                            warn!("Failed to remove backup file {}: {}", path.display(), e);
                        }
                    }
                }
            }
            
            // Also try the normal uninstall if api_files are present
            if !game.api_files.is_empty() {
                let api_files_str = game.api_files.join(",");
                if let Err(e) = SmokeAPI::uninstall_from_game(&game.path, &api_files_str).await {
                    // Don't fail if this errors - we might have already cleaned up manually above
                    warn!("SmokeAPI uninstall warning: {}", e);
                }
            }
            
            if !removed_files {
                warn!("No SmokeAPI files found to remove for: {}", game_title);
            }

            // Remove version from manifest
            crate::cache::remove_smokeapi_version(&game.path)?;
        }
        _ => return Err(format!("Invalid conflict type: {}", conflict_type)),
    }

    installer::emit_progress(
        &app_handle,
        &format!("Conflict Resolved: {}", game_title),
        "Conflicting files have been removed successfully!",
        100.0,
        true,
        false,
        None,
    );

    // Update game state
    let updated_game = {
        let mut games_map = state.games.lock();
        let game = games_map
            .get_mut(&game_id)
            .ok_or_else(|| format!("Game with ID {} not found after conflict resolution", game_id))?;

        match conflict_type.as_str() {
            "cream-to-proton" => {
                game.cream_installed = false;
            }
            "smoke-to-native" => {
                game.smoke_installed = false;
            }
            _ => {}
        }

        game.installing = false;
        game.clone()
    };

    if let Err(e) = app_handle.emit("game-updated", &updated_game) {
        warn!("Failed to emit game-updated event: {}", e);
    }

    info!("Platform conflict resolved successfully for: {}", game_title);
    Ok(updated_game)
}

fn setup_logging() -> Result<(), Box<dyn std::error::Error>> {
    use log::LevelFilter;
    use log4rs::append::file::FileAppender;
    use log4rs::config::{Appender, Config, Root};
    use log4rs::encode::pattern::PatternEncoder;
    use std::fs;

    let xdg_dirs = xdg::BaseDirectories::with_prefix("creamlinux")?;
    let log_path = xdg_dirs.place_cache_file("creamlinux.log")?;

    if log_path.exists() {
        if let Err(e) = fs::write(&log_path, "") {
            eprintln!("Warning: Failed to clear log file: {}", e);
        }
    }

    let file = FileAppender::builder()
        .encoder(Box::new(PatternEncoder::new(
            "[{d(%Y-%m-%d %H:%M:%S)}] {l}: {m}\n",
        )))
        .build(log_path)?;

    let config = Config::builder()
        .appender(Appender::builder().build("file", Box::new(file)))
        .build(Root::builder().appender("file").build(LevelFilter::Info))?;

    log4rs::init_config(config)?;

    info!("CreamLinux started with a clean log file");
    Ok(())
}

fn main() {
    if let Err(e) = setup_logging() {
        eprintln!("Warning: Failed to initialize logging: {}", e);
    }

    info!("Initializing CreamLinux application");

    tauri::Builder::default()
        .plugin(UpdaterBuilder::new().build())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
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
            read_smokeapi_config,
            write_smokeapi_config,
            delete_smokeapi_config,
            resolve_platform_conflict,
        ])
        .setup(|app| {
            info!("Tauri application setup");

            #[cfg(debug_assertions)]
            {
                if std::env::var("OPEN_DEVTOOLS").ok().as_deref() == Some("1") {
                    if let Some(window) = app.get_webview_window("main") {
                        window.open_devtools();
                    }
                }
            }

            let app_handle = app.handle().clone();
            let state = AppState {
                games: Mutex::new(HashMap::new()),
                dlc_cache: Mutex::new(HashMap::new()),
                fetch_cancellation: Arc::new(AtomicBool::new(false)),
            };
            app.manage(state);

            // Initialize cache on startup in a background task
            tauri::async_runtime::spawn(async move {
                info!("Starting cache initialization...");

                // Step 1: Initialize cache if needed (downloads unlockers)
                if let Err(e) = cache::initialize_cache().await {
                    error!("Failed to initialize cache: {}", e);
                    return;
                }

                info!("Cache initialized successfully");

                // Step 2: Check for updates
                match cache::check_and_update_cache().await {
                    Ok(result) => {
                        if result.any_updated() {
                            info!(
                                "Updates found - SmokeAPI: {:?}, CreamLinux: {:?}",
                                result.new_smokeapi_version, result.new_creamlinux_version
                            );

                            // Step 3: Update outdated games
                            let state_for_update = app_handle.state::<AppState>();
                            let games = state_for_update.games.lock().clone();

                            match cache::update_outdated_games(&games).await {
                                Ok(stats) => {
                                    info!(
                                        "Game updates complete - {} games updated, {} failed",
                                        stats.total_updated(),
                                        stats.total_failed()
                                    );

                                    if stats.has_failures() {
                                        warn!(
                                            "Some game updates failed: SmokeAPI failed: {}, CreamLinux failed: {}",
                                            stats.smokeapi_failed, stats.creamlinux_failed
                                        );
                                    }
                                }
                                Err(e) => {
                                    error!("Failed to update games: {}", e);
                                }
                            }
                        } else {
                            info!("All unlockers are up to date");
                        }
                    }
                    Err(e) => {
                        error!("Failed to check for updates: {}", e);
                    }
                }
            });

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}