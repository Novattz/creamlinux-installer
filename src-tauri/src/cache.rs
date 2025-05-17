// src/cache.rs

use serde::{Serialize, Deserialize};
use serde_json::json;
use std::path::{PathBuf};
use std::fs;
use std::io;
use std::time::{SystemTime};
use log::{info, warn};
use crate::dlc_manager::DlcInfoWithState;

// Cache entry with timestamp for expiration
#[derive(Serialize, Deserialize)]
struct CacheEntry<T> {
    data: T,
    timestamp: u64, // Unix timestamp in seconds
}

// Get the cache directory
fn get_cache_dir() -> io::Result<PathBuf> {
    let xdg_dirs = xdg::BaseDirectories::with_prefix("creamlinux")
        .map_err(|e| io::Error::new(io::ErrorKind::Other, e))?;
    
    let cache_dir = xdg_dirs.get_cache_home();
    
    // Make sure the cache directory exists
    if !cache_dir.exists() {
        fs::create_dir_all(&cache_dir)?;
    }
    
    Ok(cache_dir)
}

// Save data to cache file
pub fn save_to_cache<T>(key: &str, data: &T, _ttl_hours: u64) -> io::Result<()>
where
    T: Serialize + ?Sized,
{
    let cache_dir = get_cache_dir()?;
    let cache_file = cache_dir.join(format!("{}.cache", key));
    
    // Get current timestamp
    let now = SystemTime::now()
        .duration_since(SystemTime::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();
    
    // Create a JSON object with timestamp and data directly
    let json_data = json!({
        "timestamp": now,
        "data": data  // No clone needed here
    });
    
    // Serialize and write to file
    let serialized = serde_json::to_string(&json_data)
        .map_err(|e| io::Error::new(io::ErrorKind::Other, e))?;
    
    fs::write(cache_file, serialized)?;
    info!("Saved cache for key: {}", key);
    
    Ok(())
}

// Load data from cache file if it exists and is not expired
pub fn load_from_cache<T>(key: &str, ttl_hours: u64) -> Option<T>
where
    T: for<'de> Deserialize<'de>,
{
    let cache_dir = match get_cache_dir() {
        Ok(dir) => dir,
        Err(e) => {
            warn!("Failed to get cache directory: {}", e);
            return None;
        }
    };
    
    let cache_file = cache_dir.join(format!("{}.cache", key));
    
    // Check if cache file exists
    if !cache_file.exists() {
        return None;
    }
    
    // Read and deserialize
    let cached_data = match fs::read_to_string(&cache_file) {
        Ok(data) => data,
        Err(e) => {
            warn!("Failed to read cache file {}: {}", cache_file.display(), e);
            return None;
        }
    };
    
    // Parse the JSON
    let json_value: serde_json::Value = match serde_json::from_str(&cached_data) {
      Ok(v) => v,
      Err(e) => {
          warn!("Failed to parse cache file {}: {}", cache_file.display(), e);
          return None;
      }
  };
  
  // Extract timestamp
  let timestamp = match json_value.get("timestamp").and_then(|v| v.as_u64()) {
      Some(ts) => ts,
      None => {
          warn!("Invalid timestamp in cache file {}", cache_file.display());
          return None;
      }
  };
  
  // Check expiration
  let now = SystemTime::now()
      .duration_since(SystemTime::UNIX_EPOCH)
      .unwrap_or_default()
      .as_secs();
  
  let age_hours = (now - timestamp) / 3600;
  
  if age_hours > ttl_hours {
      info!("Cache for key {} is expired ({} hours old)", key, age_hours);
      return None;
  }
  
  // Extract data
  let data: T = match serde_json::from_value(json_value["data"].clone()) {
      Ok(d) => d,
      Err(e) => {
          warn!("Failed to parse data in cache file {}: {}", cache_file.display(), e);
          return None;
      }
  };
  
  info!("Using cache for key {} ({} hours old)", key, age_hours);
  Some(data)
}

// Cache game scanning results
pub fn cache_games(games: &[crate::installer::Game]) -> io::Result<()> {
  save_to_cache("games", games, 24) // Cache games for 24 hours
}

// Load cached game scanning results
pub fn load_cached_games() -> Option<Vec<crate::installer::Game>> {
    load_from_cache("games", 24)
}

// Cache DLC list for a game
pub fn cache_dlcs(game_id: &str, dlcs: &[DlcInfoWithState]) -> io::Result<()> {
  save_to_cache(&format!("dlc_{}", game_id), dlcs, 168) // Cache DLCs for 7 days (168 hours)
}

// Load cached DLC list
pub fn load_cached_dlcs(game_id: &str) -> Option<Vec<DlcInfoWithState>> {
    load_from_cache(&format!("dlc_{}", game_id), 168)
}

// Clear all caches
pub fn clear_all_caches() -> io::Result<()> {
    let cache_dir = get_cache_dir()?;
    
    for entry in fs::read_dir(cache_dir)? {
        let entry = entry?;
        let path = entry.path();
        
        if path.is_file() && path.extension().map_or(false, |ext| ext == "cache") {
            if let Err(e) = fs::remove_file(&path) {
                warn!("Failed to remove cache file {}: {}", path.display(), e);
            } else {
                info!("Removed cache file: {}", path.display());
            }
        }
    }
    
    info!("All caches cleared");
    Ok(())
}