use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use log::info;

// User configuration structure
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Config {
    // Whether to show the disclaimer on startup
    pub show_disclaimer: bool,
}

impl Default for Config {
    fn default() -> Self {
        Self {
            show_disclaimer: true,
        }
    }
}

// Get the config directory path (~/.config/creamlinux)
fn get_config_dir() -> Result<PathBuf, String> {
    let home = std::env::var("HOME")
        .map_err(|_| "Failed to get HOME directory".to_string())?;
    
    let config_dir = PathBuf::from(home).join(".config").join("creamlinux");
    Ok(config_dir)
}

// Get the config file path
fn get_config_path() -> Result<PathBuf, String> {
    let config_dir = get_config_dir()?;
    Ok(config_dir.join("config.json"))
}

// Ensure the config directory exists
fn ensure_config_dir() -> Result<(), String> {
    let config_dir = get_config_dir()?;
    
    if !config_dir.exists() {
        fs::create_dir_all(&config_dir)
            .map_err(|e| format!("Failed to create config directory: {}", e))?;
        info!("Created config directory at {:?}", config_dir);
    }
    
    Ok(())
}

// Load configuration from disk
pub fn load_config() -> Result<Config, String> {
    ensure_config_dir()?;
    
    let config_path = get_config_path()?;
    
    // If config file doesn't exist, create default config
    if !config_path.exists() {
        let default_config = Config::default();
        save_config(&default_config)?;
        info!("Created default config file at {:?}", config_path);
        return Ok(default_config);
    }
    
    // Read and parse config file
    let config_str = fs::read_to_string(&config_path)
        .map_err(|e| format!("Failed to read config file: {}", e))?;
    
    let config: Config = serde_json::from_str(&config_str)
        .map_err(|e| format!("Failed to parse config file: {}", e))?;
    
    info!("Loaded config from {:?}", config_path);
    Ok(config)
}

// Save configuration to disk
pub fn save_config(config: &Config) -> Result<(), String> {
    ensure_config_dir()?;
    
    let config_path = get_config_path()?;
    
    let config_str = serde_json::to_string_pretty(config)
        .map_err(|e| format!("Failed to serialize config: {}", e))?;
    
    fs::write(&config_path, config_str)
        .map_err(|e| format!("Failed to write config file: {}", e))?;
    
    info!("Saved config to {:?}", config_path);
    Ok(())
}

// Update a specific config value
pub fn update_config<F>(updater: F) -> Result<Config, String>
where
    F: FnOnce(&mut Config),
{
    let mut config = load_config()?;
    updater(&mut config);
    save_config(&config)?;
    Ok(config)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_default_config() {
        let config = Config::default();
        assert!(config.show_disclaimer);
    }

    #[test]
    fn test_config_serialization() {
        let config = Config::default();
        let json = serde_json::to_string(&config).unwrap();
        let parsed: Config = serde_json::from_str(&json).unwrap();
        assert_eq!(config.show_disclaimer, parsed.show_disclaimer);
    }
}