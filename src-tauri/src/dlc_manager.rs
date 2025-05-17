use log::{error, info};
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use std::fs;
use std::path::Path;
use tauri::Manager;

// More detailed DLC information with enabled state
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct DlcInfoWithState {
    pub appid: String,
    pub name: String,
    pub enabled: bool,
}

// Parse the cream_api.ini file to extract both enabled and disabled DLCs
pub fn get_enabled_dlcs(game_path: &str) -> Result<Vec<String>, String> {
    info!("Reading enabled DLCs from {}", game_path);

    let cream_api_path = Path::new(game_path).join("cream_api.ini");
    if !cream_api_path.exists() {
        return Err(format!(
            "cream_api.ini not found at {}",
            cream_api_path.display()
        ));
    }

    let contents = match fs::read_to_string(&cream_api_path) {
        Ok(c) => c,
        Err(e) => return Err(format!("Failed to read cream_api.ini: {}", e)),
    };

    // Extract DLCs
    let mut in_dlc_section = false;
    let mut enabled_dlcs = Vec::new();

    for line in contents.lines() {
        let trimmed = line.trim();

        // Check if we're in the DLC section
        if trimmed == "[dlc]" {
            in_dlc_section = true;
            continue;
        }

        // Check if we're leaving the DLC section
        if in_dlc_section && trimmed.starts_with('[') && trimmed.ends_with(']') {
            in_dlc_section = false;
            continue;
        }

        // Skip empty lines and non-DLC comments
        if in_dlc_section && !trimmed.is_empty() && !trimmed.starts_with(';') {
            // Extract the DLC app ID
            if let Some(appid) = trimmed.split('=').next() {
                let appid_clean = appid.trim();
                // Check if the line is commented out (indicating a disabled DLC)
                if !appid_clean.starts_with("#") {
                    enabled_dlcs.push(appid_clean.to_string());
                }
            }
        }
    }

    info!("Found {} enabled DLCs", enabled_dlcs.len());
    Ok(enabled_dlcs)
}

// Get all DLCs (both enabled and disabled) from cream_api.ini
pub fn get_all_dlcs(game_path: &str) -> Result<Vec<DlcInfoWithState>, String> {
    info!("Reading all DLCs from {}", game_path);

    let cream_api_path = Path::new(game_path).join("cream_api.ini");
    if !cream_api_path.exists() {
        return Err(format!(
            "cream_api.ini not found at {}",
            cream_api_path.display()
        ));
    }

    let contents = match fs::read_to_string(&cream_api_path) {
        Ok(c) => c,
        Err(e) => return Err(format!("Failed to read cream_api.ini: {}", e)),
    };

    // Extract DLCs
    let mut in_dlc_section = false;
    let mut all_dlcs = Vec::new();

    for line in contents.lines() {
        let trimmed = line.trim();

        // Check if we're in the DLC section
        if trimmed == "[dlc]" {
            in_dlc_section = true;
            continue;
        }

        // Check if we're leaving the DLC section
        if in_dlc_section && trimmed.starts_with('[') && trimmed.ends_with(']') {
            in_dlc_section = false;
            continue;
        }

        // Process DLC entries (both enabled and commented/disabled)
        if in_dlc_section && !trimmed.is_empty() && !trimmed.starts_with(';') {
            let is_commented = trimmed.starts_with("#");
            let actual_line = if is_commented {
                trimmed.trim_start_matches('#').trim()
            } else {
                trimmed
            };

            let parts: Vec<&str> = actual_line.splitn(2, '=').collect();
            if parts.len() == 2 {
                let appid = parts[0].trim();
                let name = parts[1].trim();

                all_dlcs.push(DlcInfoWithState {
                    appid: appid.to_string(),
                    name: name.to_string().trim_matches('"').to_string(),
                    enabled: !is_commented,
                });
            }
        }
    }

    info!(
        "Found {} total DLCs ({} enabled, {} disabled)",
        all_dlcs.len(),
        all_dlcs.iter().filter(|d| d.enabled).count(),
        all_dlcs.iter().filter(|d| !d.enabled).count()
    );

    Ok(all_dlcs)
}

// Update the cream_api.ini file with the user's DLC selections
pub fn update_dlc_configuration(
    game_path: &str,
    dlcs: Vec<DlcInfoWithState>,
) -> Result<(), String> {
    info!("Updating DLC configuration for {}", game_path);

    let cream_api_path = Path::new(game_path).join("cream_api.ini");
    if !cream_api_path.exists() {
        return Err(format!(
            "cream_api.ini not found at {}",
            cream_api_path.display()
        ));
    }

    // Read the current file contents
    let current_contents = match fs::read_to_string(&cream_api_path) {
        Ok(c) => c,
        Err(e) => return Err(format!("Failed to read cream_api.ini: {}", e)),
    };

    // Create a mapping of DLC appid to its state for easy lookup
    let dlc_states: HashMap<String, (bool, String)> = dlcs
        .iter()
        .map(|dlc| (dlc.appid.clone(), (dlc.enabled, dlc.name.clone())))
        .collect();

    // Keep track of processed DLCs to avoid duplicates
    let mut processed_dlcs = HashSet::new();

    // Process the file line by line to retain most of the original structure
    let mut new_contents = Vec::new();
    let mut in_dlc_section = false;

    for line in current_contents.lines() {
        let trimmed = line.trim();

        // Add section markers directly
        if trimmed == "[dlc]" {
            in_dlc_section = true;
            new_contents.push(line.to_string());
            continue;
        }

        // Check if we're leaving the DLC section
        if in_dlc_section && trimmed.starts_with('[') && trimmed.ends_with(']') {
            in_dlc_section = false;

            // Before leaving the DLC section, add any DLCs that weren't processed yet
            for (appid, (enabled, name)) in &dlc_states {
                if !processed_dlcs.contains(appid) {
                    if *enabled {
                        new_contents.push(format!("{} = {}", appid, name));
                    } else {
                        new_contents.push(format!("# {} = {}", appid, name));
                    }
                }
            }

            // Now add the section marker
            new_contents.push(line.to_string());
            continue;
        }

        if in_dlc_section && !trimmed.is_empty() {
            let is_comment_line = trimmed.starts_with(';');

            // If it's a regular comment line (not a DLC), keep it as is
            if is_comment_line {
                new_contents.push(line.to_string());
                continue;
            }

            // Check if it's a commented-out DLC line or a regular DLC line
            let is_commented = trimmed.starts_with("#");
            let actual_line = if is_commented {
                trimmed.trim_start_matches('#').trim()
            } else {
                trimmed
            };

            // Extract appid and name
            let parts: Vec<&str> = actual_line.splitn(2, '=').collect();
            if parts.len() == 2 {
                let appid = parts[0].trim();
                let name = parts[1].trim();

                // Check if this DLC exists in our updated list
                if let Some((enabled, _)) = dlc_states.get(appid) {
                    // Add the DLC with its updated state
                    if *enabled {
                        new_contents.push(format!("{} = {}", appid, name));
                    } else {
                        new_contents.push(format!("# {} = {}", appid, name));
                    }
                    processed_dlcs.insert(appid.to_string());
                } else {
                    // Not in our list keep the original line
                    new_contents.push(line.to_string());
                }
            } else {
                // Invalid format or not a DLC line keep as is
                new_contents.push(line.to_string());
            }
        } else if !in_dlc_section || trimmed.is_empty() {
            // Not a DLC line or empty line keep as is
            new_contents.push(line.to_string());
        }
    }

    // If we never left the DLC section, make sure we add any unprocessed DLCs
    if in_dlc_section {
        for (appid, (enabled, name)) in &dlc_states {
            if !processed_dlcs.contains(appid) {
                if *enabled {
                    new_contents.push(format!("{} = {}", appid, name));
                } else {
                    new_contents.push(format!("# {} = {}", appid, name));
                }
            }
        }
    }

    // Write the updated file
    match fs::write(&cream_api_path, new_contents.join("\n")) {
        Ok(_) => {
            info!(
                "Successfully updated DLC configuration at {}",
                cream_api_path.display()
            );
            Ok(())
        }
        Err(e) => {
            error!("Failed to write updated cream_api.ini: {}", e);
            Err(format!("Failed to write updated cream_api.ini: {}", e))
        }
    }
}

// Get app ID from game path by reading cream_api.ini
#[allow(dead_code)]
fn extract_app_id_from_config(game_path: &str) -> Option<String> {
    if let Ok(contents) = fs::read_to_string(Path::new(game_path).join("cream_api.ini")) {
        let re = regex::Regex::new(r"APPID\s*=\s*(\d+)").unwrap();
        if let Some(cap) = re.captures(&contents) {
            return Some(cap[1].to_string());
        }
    }
    None
}

// Create a custom installation with selected DLCs
pub async fn install_cream_with_dlcs(
    game_id: String,
    app_handle: tauri::AppHandle,
    selected_dlcs: Vec<DlcInfoWithState>,
) -> Result<(), String> {
    use crate::AppState;

    // Count enabled DLCs for logging
    let enabled_dlc_count = selected_dlcs.iter().filter(|dlc| dlc.enabled).count();
    info!(
        "Starting installation of CreamLinux with {} selected DLCs",
        enabled_dlc_count
    );

    // Get the game from state
    let game = {
        let state = app_handle.state::<AppState>();
        let games = state.games.lock();
        match games.get(&game_id) {
            Some(g) => g.clone(),
            None => return Err(format!("Game with ID {} not found", game_id)),
        }
    };

    info!(
        "Installing CreamLinux for game: {} ({})",
        game.title, game_id
    );

    // Install CreamLinux first - but provide the DLCs directly instead of fetching them again
    use crate::installer::install_creamlinux_with_dlcs;

    // Convert DlcInfoWithState to installer::DlcInfo for those that are enabled
    let enabled_dlcs = selected_dlcs
        .iter()
        .filter(|dlc| dlc.enabled)
        .map(|dlc| crate::installer::DlcInfo {
            appid: dlc.appid.clone(),
            name: dlc.name.clone(),
        })
        .collect::<Vec<_>>();

    let app_handle_clone = app_handle.clone();
    let game_title = game.title.clone();

    // Use direct installation with provided DLCs instead of re-fetching
    match install_creamlinux_with_dlcs(
        &game.path,
        &game_id,
        enabled_dlcs,
        move |progress, message| {
            // Emit progress updates during installation
            use crate::installer::emit_progress;
            emit_progress(
                &app_handle_clone,
                &format!("Installing CreamLinux for {}", game_title),
                message,
                progress * 100.0, // Scale progress from 0 to 100%
                false,
                false,
                None,
            );
        },
    )
    .await
    {
        Ok(_) => {
            info!(
                "CreamLinux installation completed successfully for game: {}",
                game.title
            );
            Ok(())
        }
        Err(e) => {
            error!("Failed to install CreamLinux: {}", e);
            Err(format!("Failed to install CreamLinux: {}", e))
        }
    }
}
