use log::{info, warn};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

// Represents the versions.json file in the cache root
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct CacheVersions {
    pub smokeapi: VersionInfo,
    pub creamlinux: VersionInfo,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct VersionInfo {
    pub latest: String,
}

impl Default for CacheVersions {
    fn default() -> Self {
        Self {
            smokeapi: VersionInfo {
                latest: String::new(),
            },
            creamlinux: VersionInfo {
                latest: String::new(),
            },
        }
    }
}

// Get the cache directory path (~/.cache/creamlinux)
pub fn get_cache_dir() -> Result<PathBuf, String> {
    let xdg_dirs = xdg::BaseDirectories::with_prefix("creamlinux")
        .map_err(|e| format!("Failed to get XDG directories: {}", e))?;

    let cache_dir = xdg_dirs
        .get_cache_home()
        .parent()
        .ok_or_else(|| "Failed to get cache parent directory".to_string())?
        .join("creamlinux");

    // Create the directory if it doesn't exist
    if !cache_dir.exists() {
        fs::create_dir_all(&cache_dir)
            .map_err(|e| format!("Failed to create cache directory: {}", e))?;
        info!("Created cache directory: {}", cache_dir.display());
    }

    Ok(cache_dir)
}

// Get the SmokeAPI cache directory path
pub fn get_smokeapi_dir() -> Result<PathBuf, String> {
    let cache_dir = get_cache_dir()?;
    let smokeapi_dir = cache_dir.join("smokeapi");

    if !smokeapi_dir.exists() {
        fs::create_dir_all(&smokeapi_dir)
            .map_err(|e| format!("Failed to create SmokeAPI directory: {}", e))?;
        info!("Created SmokeAPI directory: {}", smokeapi_dir.display());
    }

    Ok(smokeapi_dir)
}

// Get the CreamLinux cache directory path
pub fn get_creamlinux_dir() -> Result<PathBuf, String> {
    let cache_dir = get_cache_dir()?;
    let creamlinux_dir = cache_dir.join("creamlinux");

    if !creamlinux_dir.exists() {
        fs::create_dir_all(&creamlinux_dir)
            .map_err(|e| format!("Failed to create CreamLinux directory: {}", e))?;
        info!("Created CreamLinux directory: {}", creamlinux_dir.display());
    }

    Ok(creamlinux_dir)
}

// Get the path to a versioned SmokeAPI directory
pub fn get_smokeapi_version_dir(version: &str) -> Result<PathBuf, String> {
    let smokeapi_dir = get_smokeapi_dir()?;
    let version_dir = smokeapi_dir.join(version);

    if !version_dir.exists() {
        fs::create_dir_all(&version_dir)
            .map_err(|e| format!("Failed to create SmokeAPI version directory: {}", e))?;
        info!(
            "Created SmokeAPI version directory: {}",
            version_dir.display()
        );
    }

    Ok(version_dir)
}

// Get the path to a versioned CreamLinux directory
pub fn get_creamlinux_version_dir(version: &str) -> Result<PathBuf, String> {
    let creamlinux_dir = get_creamlinux_dir()?;
    let version_dir = creamlinux_dir.join(version);

    if !version_dir.exists() {
        fs::create_dir_all(&version_dir)
            .map_err(|e| format!("Failed to create CreamLinux version directory: {}", e))?;
        info!(
            "Created CreamLinux version directory: {}",
            version_dir.display()
        );
    }

    Ok(version_dir)
}

// Read the versions.json file from cache
pub fn read_versions() -> Result<CacheVersions, String> {
    let cache_dir = get_cache_dir()?;
    let versions_path = cache_dir.join("versions.json");

    if !versions_path.exists() {
        info!("versions.json doesn't exist, creating default");
        return Ok(CacheVersions::default());
    }

    let content = fs::read_to_string(&versions_path)
        .map_err(|e| format!("Failed to read versions.json: {}", e))?;

    let versions: CacheVersions = serde_json::from_str(&content)
        .map_err(|e| format!("Failed to parse versions.json: {}", e))?;

    info!(
        "Read cached versions - SmokeAPI: {}, CreamLinux: {}",
        versions.smokeapi.latest, versions.creamlinux.latest
    );

    Ok(versions)
}

// Write the versions.json file to cache
pub fn write_versions(versions: &CacheVersions) -> Result<(), String> {
    let cache_dir = get_cache_dir()?;
    let versions_path = cache_dir.join("versions.json");

    let content = serde_json::to_string_pretty(versions)
        .map_err(|e| format!("Failed to serialize versions: {}", e))?;

    fs::write(&versions_path, content)
        .map_err(|e| format!("Failed to write versions.json: {}", e))?;

    info!(
        "Wrote versions.json - SmokeAPI: {}, CreamLinux: {}",
        versions.smokeapi.latest, versions.creamlinux.latest
    );

    Ok(())
}

// Update the SmokeAPI version in versions.json and clean old version directories
pub fn update_smokeapi_version(new_version: &str) -> Result<(), String> {
    let mut versions = read_versions()?;
    let old_version = versions.smokeapi.latest.clone();

    versions.smokeapi.latest = new_version.to_string();
    write_versions(&versions)?;

    // Delete old version directory if it exists and is different
    if !old_version.is_empty() && old_version != new_version {
        let old_dir = get_smokeapi_dir()?.join(&old_version);
        if old_dir.exists() {
            match fs::remove_dir_all(&old_dir) {
                Ok(_) => info!("Deleted old SmokeAPI version directory: {}", old_version),
                Err(e) => warn!(
                    "Failed to delete old SmokeAPI version directory: {}",
                    e
                ),
            }
        }
    }

    Ok(())
}

// Update the CreamLinux version in versions.json and clean old version directories
pub fn update_creamlinux_version(new_version: &str) -> Result<(), String> {
    let mut versions = read_versions()?;
    let old_version = versions.creamlinux.latest.clone();

    versions.creamlinux.latest = new_version.to_string();
    write_versions(&versions)?;

    // Delete old version directory if it exists and is different
    if !old_version.is_empty() && old_version != new_version {
        let old_dir = get_creamlinux_dir()?.join(&old_version);
        if old_dir.exists() {
            match fs::remove_dir_all(&old_dir) {
                Ok(_) => info!("Deleted old CreamLinux version directory: {}", old_version),
                Err(e) => warn!(
                    "Failed to delete old CreamLinux version directory: {}",
                    e
                ),
            }
        }
    }

    Ok(())
}

// Check if the cache is initialized (has both unlockers cached)
pub fn is_cache_initialized() -> Result<bool, String> {
    let versions = read_versions()?;
    Ok(!versions.smokeapi.latest.is_empty() && !versions.creamlinux.latest.is_empty())
}

// Get the SmokeAPI DLL path for the latest cached version
#[allow(dead_code)]
pub fn get_smokeapi_dll_path() -> Result<PathBuf, String> {
    let versions = read_versions()?;
    if versions.smokeapi.latest.is_empty() {
        return Err("SmokeAPI is not cached".to_string());
    }

    let version_dir = get_smokeapi_version_dir(&versions.smokeapi.latest)?;
    Ok(version_dir.join("SmokeAPI.dll"))
}

// Get the CreamLinux files directory path for the latest cached version
#[allow(dead_code)]
pub fn get_creamlinux_files_dir() -> Result<PathBuf, String> {
    let versions = read_versions()?;
    if versions.creamlinux.latest.is_empty() {
        return Err("CreamLinux is not cached".to_string());
    }

    get_creamlinux_version_dir(&versions.creamlinux.latest)
}

// List all SmokeAPI DLL files in the cached version directory
pub fn list_smokeapi_dlls() -> Result<Vec<PathBuf>, String> {
    let versions = read_versions()?;
    if versions.smokeapi.latest.is_empty() {
        return Ok(Vec::new());
    }

    let version_dir = get_smokeapi_version_dir(&versions.smokeapi.latest)?;

    if !version_dir.exists() {
        return Ok(Vec::new());
    }

    let entries = fs::read_dir(&version_dir)
        .map_err(|e| format!("Failed to read SmokeAPI directory: {}", e))?;

    let mut dlls = Vec::new();
    for entry in entries {
        if let Ok(entry) = entry {
            let path = entry.path();
            if path.extension().and_then(|s| s.to_str()) == Some("dll") {
                dlls.push(path);
            }
        }
    }

    Ok(dlls)
}

// List all CreamLinux files in the cached version directory
pub fn list_creamlinux_files() -> Result<Vec<PathBuf>, String> {
    let versions = read_versions()?;
    if versions.creamlinux.latest.is_empty() {
        return Ok(Vec::new());
    }

    let version_dir = get_creamlinux_version_dir(&versions.creamlinux.latest)?;

    if !version_dir.exists() {
        return Ok(Vec::new());
    }

    let entries = fs::read_dir(&version_dir)
        .map_err(|e| format!("Failed to read CreamLinux directory: {}", e))?;

    let mut files = Vec::new();
    for entry in entries {
        if let Ok(entry) = entry {
            let path = entry.path();
            if path.is_file() {
                files.push(path);
            }
        }
    }

    Ok(files)
}