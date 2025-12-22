use log::{info};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;

// Represents the version manifest stored in each game directory
#[derive(Serialize, Deserialize, Debug, Clone, Default)]
pub struct GameManifest {
    pub smokeapi_version: Option<String>,
    pub creamlinux_version: Option<String>,
}

#[allow(dead_code)]
impl GameManifest {
    // Create a new manifest with SmokeAPI version
    pub fn with_smokeapi(version: String) -> Self {
        Self {
            smokeapi_version: Some(version),
            creamlinux_version: None,
        }
    }

    // Create a new manifest with CreamLinux version
    pub fn with_creamlinux(version: String) -> Self {
        Self {
            smokeapi_version: None,
            creamlinux_version: Some(version),
        }
    }

    // Check if SmokeAPI is installed
    pub fn has_smokeapi(&self) -> bool {
        self.smokeapi_version.is_some()
    }

    // Check if CreamLinux is installed
    pub fn has_creamlinux(&self) -> bool {
        self.creamlinux_version.is_some()
    }

    // Check if SmokeAPI version is outdated
    pub fn is_smokeapi_outdated(&self, latest_version: &str) -> bool {
        match &self.smokeapi_version {
            Some(version) => version != latest_version,
            None => false,
        }
    }

    // Check if CreamLinux version is outdated
    pub fn is_creamlinux_outdated(&self, latest_version: &str) -> bool {
        match &self.creamlinux_version {
            Some(version) => version != latest_version,
            None => false,
        }
    }
}

// Read the creamlinux.json manifest from a game directory
pub fn read_manifest(game_path: &str) -> Result<GameManifest, String> {
    let manifest_path = Path::new(game_path).join("creamlinux.json");

    if !manifest_path.exists() {
        return Ok(GameManifest::default());
    }

    let content = fs::read_to_string(&manifest_path)
        .map_err(|e| format!("Failed to read manifest: {}", e))?;

    let manifest: GameManifest = serde_json::from_str(&content)
        .map_err(|e| format!("Failed to parse manifest: {}", e))?;

    info!(
        "Read manifest from {}: SmokeAPI: {:?}, CreamLinux: {:?}",
        game_path, manifest.smokeapi_version, manifest.creamlinux_version
    );

    Ok(manifest)
}

// Write the creamlinux.json manifest to a game directory
pub fn write_manifest(game_path: &str, manifest: &GameManifest) -> Result<(), String> {
    let manifest_path = Path::new(game_path).join("creamlinux.json");

    let content = serde_json::to_string_pretty(manifest)
        .map_err(|e| format!("Failed to serialize manifest: {}", e))?;

    fs::write(&manifest_path, content)
        .map_err(|e| format!("Failed to write manifest: {}", e))?;

    info!(
        "Wrote manifest to {}: SmokeAPI: {:?}, CreamLinux: {:?}",
        game_path, manifest.smokeapi_version, manifest.creamlinux_version
    );

    Ok(())
}

// Update the SmokeAPI version in the manifest
pub fn update_smokeapi_version(game_path: &str, version: String) -> Result<(), String> {
    let mut manifest = read_manifest(game_path)?;
    manifest.smokeapi_version = Some(version);
    write_manifest(game_path, &manifest)
}

// Update the CreamLinux version in the manifest
pub fn update_creamlinux_version(game_path: &str, version: String) -> Result<(), String> {
    let mut manifest = read_manifest(game_path)?;
    manifest.creamlinux_version = Some(version);
    write_manifest(game_path, &manifest)
}

// Remove SmokeAPI version from the manifest
pub fn remove_smokeapi_version(game_path: &str) -> Result<(), String> {
    let mut manifest = read_manifest(game_path)?;
    manifest.smokeapi_version = None;

    // If both versions are None, delete the manifest file
    if manifest.smokeapi_version.is_none() && manifest.creamlinux_version.is_none() {
        let manifest_path = Path::new(game_path).join("creamlinux.json");
        if manifest_path.exists() {
            fs::remove_file(&manifest_path)
                .map_err(|e| format!("Failed to delete manifest: {}", e))?;
            info!("Deleted empty manifest from {}", game_path);
        }
    } else {
        write_manifest(game_path, &manifest)?;
    }

    Ok(())
}

// Remove CreamLinux version from the manifest
pub fn remove_creamlinux_version(game_path: &str) -> Result<(), String> {
    let mut manifest = read_manifest(game_path)?;
    manifest.creamlinux_version = None;

    // If both versions are None, delete the manifest file
    if manifest.smokeapi_version.is_none() && manifest.creamlinux_version.is_none() {
        let manifest_path = Path::new(game_path).join("creamlinux.json");
        if manifest_path.exists() {
            fs::remove_file(&manifest_path)
                .map_err(|e| format!("Failed to delete manifest: {}", e))?;
            info!("Deleted empty manifest from {}", game_path);
        }
    } else {
        write_manifest(game_path, &manifest)?;
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_manifest_creation() {
        let manifest = GameManifest::with_smokeapi("v1.0.0".to_string());
        assert_eq!(manifest.smokeapi_version, Some("v1.0.0".to_string()));
        assert_eq!(manifest.creamlinux_version, None);

        let manifest = GameManifest::with_creamlinux("v2.0.0".to_string());
        assert_eq!(manifest.smokeapi_version, None);
        assert_eq!(manifest.creamlinux_version, Some("v2.0.0".to_string()));
    }

    #[test]
    fn test_outdated_check() {
        let mut manifest = GameManifest::with_smokeapi("v1.0.0".to_string());
        assert!(manifest.is_smokeapi_outdated("v2.0.0"));
        assert!(!manifest.is_smokeapi_outdated("v1.0.0"));

        manifest.creamlinux_version = Some("v1.5.0".to_string());
        assert!(manifest.is_creamlinux_outdated("v2.0.0"));
        assert!(!manifest.is_creamlinux_outdated("v1.5.0"));
    }
}