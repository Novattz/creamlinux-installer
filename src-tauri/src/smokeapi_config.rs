use log::{info, warn};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::Path;

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct SmokeAPIConfig {
    #[serde(rename = "$schema")]
    pub schema: String,
    #[serde(rename = "$version")]
    pub version: u32,
    pub logging: bool,
    pub log_steam_http: bool,
    pub default_app_status: String,
    pub override_app_status: HashMap<String, String>,
    pub override_dlc_status: HashMap<String, String>,
    pub auto_inject_inventory: bool,
    pub extra_inventory_items: Vec<u32>,
    pub extra_dlcs: HashMap<String, serde_json::Value>,
}

impl Default for SmokeAPIConfig {
    fn default() -> Self {
        Self {
            schema: "https://raw.githubusercontent.com/acidicoala/SmokeAPI/refs/tags/v4.0.0/res/SmokeAPI.schema.json".to_string(),
            version: 4,
            logging: false,
            log_steam_http: false,
            default_app_status: "unlocked".to_string(),
            override_app_status: HashMap::new(),
            override_dlc_status: HashMap::new(),
            auto_inject_inventory: true,
            extra_inventory_items: Vec::new(),
            extra_dlcs: HashMap::new(),
        }
    }
}

// Read SmokeAPI config from a game directory
// Returns None if the config doesn't exist
pub fn read_config(game_path: &str) -> Result<Option<SmokeAPIConfig>, String> {
    info!("Reading SmokeAPI config from: {}", game_path);

    // Find the SmokeAPI DLL location in the game directory
    let config_path = find_smokeapi_config_path(game_path)?;

    if !config_path.exists() {
        info!("No SmokeAPI config found at: {}", config_path.display());
        return Ok(None);
    }

    let content = fs::read_to_string(&config_path)
        .map_err(|e| format!("Failed to read SmokeAPI config: {}", e))?;

    let config: SmokeAPIConfig = serde_json::from_str(&content)
        .map_err(|e| format!("Failed to parse SmokeAPI config: {}", e))?;

    info!("Successfully read SmokeAPI config");
    Ok(Some(config))
}

// Write SmokeAPI config to a game directory
pub fn write_config(game_path: &str, config: &SmokeAPIConfig) -> Result<(), String> {
    info!("Writing SmokeAPI config to: {}", game_path);

    let config_path = find_smokeapi_config_path(game_path)?;

    let content = serde_json::to_string_pretty(config)
        .map_err(|e| format!("Failed to serialize SmokeAPI config: {}", e))?;

    fs::write(&config_path, content)
        .map_err(|e| format!("Failed to write SmokeAPI config: {}", e))?;

    info!("Successfully wrote SmokeAPI config to: {}", config_path.display());
    Ok(())
}

// Delete SmokeAPI config from a game directory
pub fn delete_config(game_path: &str) -> Result<(), String> {
    info!("Deleting SmokeAPI config from: {}", game_path);

    let config_path = find_smokeapi_config_path(game_path)?;

    if config_path.exists() {
        fs::remove_file(&config_path)
            .map_err(|e| format!("Failed to delete SmokeAPI config: {}", e))?;
        info!("Successfully deleted SmokeAPI config");
    } else {
        info!("No SmokeAPI config to delete");
    }

    Ok(())
}

// Find the path where SmokeAPI.config.json should be located
// This is in the same directory as the SmokeAPI DLL files
fn find_smokeapi_config_path(game_path: &str) -> Result<std::path::PathBuf, String> {
    let game_path_obj = Path::new(game_path);

    // Search for steam_api*.dll files with _o.dll backups (indicating SmokeAPI installation)
    let mut smokeapi_dir: Option<std::path::PathBuf> = None;

    // Use walkdir to search recursively
    for entry in walkdir::WalkDir::new(game_path_obj)
        .max_depth(5)
        .into_iter()
        .filter_map(Result::ok)
    {
        let path = entry.path();
        let filename = path.file_name().unwrap_or_default().to_string_lossy();

        // Look for steam_api*_o.dll (backup files created by SmokeAPI)
        if filename.starts_with("steam_api") && filename.ends_with("_o.dll") {
            smokeapi_dir = path.parent().map(|p| p.to_path_buf());
            break;
        }
    }

    // If we found a SmokeAPI directory, return the config path
    if let Some(dir) = smokeapi_dir {
        Ok(dir.join("SmokeAPI.config.json"))
    } else {
        // Fallback to game root directory
        warn!("Could not find SmokeAPI DLL directory, using game root");
        Ok(game_path_obj.join("SmokeAPI.config.json"))
    }
}