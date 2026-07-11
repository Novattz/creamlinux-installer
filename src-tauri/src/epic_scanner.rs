use log::{info, warn};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use walkdir::WalkDir;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EpicGame {
    pub app_name: String,
    pub title: String,
    pub install_path: String,
    pub executable: String,
    pub box_art_url: Option<String>,
    pub scream_installed: bool,
    pub koaloader_installed: bool,
    /// True when Koaloader was installed using version.dll as a fallback
    /// because no matching proxy import was detected in the game's PE files.
    pub proxy_fallback_used: bool,
}

/// Minimal fields we need from installed.json entries.
#[derive(Debug, Deserialize)]
struct InstalledEntry {
    title: String,
    install_path: String,
    executable: String,
    #[serde(default)]
    is_dlc: bool,
}

fn legendary_config_dir() -> Option<PathBuf> {
    let home = std::env::var("HOME").ok()?;
    let home = PathBuf::from(&home);

    // Heroic can be installed natively or via Flatpak. Flatpak sandboxes
    // XDG_CONFIG_HOME to ~/.var/app/<app-id>/config, so ~/.config/heroic
    // never exists in that case even though the game library itself lives
    // on the normal host path (e.g. on Steam Deck installs via Discover).
    let candidates = [
        home.join(".config").join("heroic"),
        home.join(".var")
            .join("app")
            .join("com.heroicgameslauncher.hgl")
            .join("config")
            .join("heroic"),
    ];

    for candidate in &candidates {
        let path = candidate.join("legendaryConfig").join("legendary");
        if path.exists() {
            return Some(path);
        }
    }

    warn!(
        "Heroic legendary config dir not found in any known location (checked native and Flatpak paths)"
    );
    None
}

pub fn scan_epic_games() -> Vec<EpicGame> {
    let legendary_dir = match legendary_config_dir() {
        Some(d) => d,
        None => return Vec::new(),
    };

    let installed_path = legendary_dir.join("installed.json");
    if !installed_path.exists() {
        warn!("installed.json not found at: {}", installed_path.display());
        return Vec::new();
    }

    let content = match fs::read_to_string(&installed_path) {
        Ok(c) => c,
        Err(e) => {
            warn!("Failed to read installed.json: {}", e);
            return Vec::new();
        }
    };

    let installed: serde_json::Value = match serde_json::from_str(&content) {
        Ok(v) => v,
        Err(e) => {
            warn!("Failed to parse installed.json: {}", e);
            return Vec::new();
        }
    };

    let metadata_dir = legendary_dir.join("metadata");
    let mut games = Vec::new();

    if let Some(obj) = installed.as_object() {
        for (app_name, entry_val) in obj {
            let entry: InstalledEntry = match serde_json::from_value(entry_val.clone()) {
                Ok(e) => e,
                Err(e) => {
                    warn!("Failed to parse installed entry {}: {}", app_name, e);
                    continue;
                }
            };

            if entry.is_dlc {
                continue;
            }

            let install_path = PathBuf::from(&entry.install_path);
            if !install_path.exists() {
                warn!(
                    "Install path does not exist for {}: {}",
                    app_name, entry.install_path
                );
                continue;
            }

            let box_art_url = get_box_art(&metadata_dir, app_name);
            let scream_installed = check_screamapi_installed(&install_path);
            let koaloader_installed = check_koaloader_installed(&install_path);

            info!(
                "Found Epic game: {} ({}), ScreamAPI={}, Koaloader={}",
                entry.title, app_name, scream_installed, koaloader_installed
            );

            games.push(EpicGame {
                app_name: app_name.clone(),
                title: entry.title,
                install_path: entry.install_path,
                executable: entry.executable,
                box_art_url,
                scream_installed,
                koaloader_installed,
                proxy_fallback_used: false,
            });
        }
    }

    info!("Found {} Epic games", games.len());
    games
}

/// Extract the "DieselGameBox" image URL from a game's metadata JSON.
/// We read the top-level keyImages array directly from the JSON value,
/// which avoids pulling in DLC images from dlcItemList.
fn get_box_art(metadata_dir: &Path, app_name: &str) -> Option<String> {
    let meta_path = metadata_dir.join(format!("{}.json", app_name));
    if !meta_path.exists() {
        return None;
    }

    let content = fs::read_to_string(&meta_path).ok()?;
    let val: serde_json::Value = serde_json::from_str(&content).ok()?;

    let key_images = val
        .get("metadata")
        .and_then(|m| m.get("keyImages"))
        .and_then(|k| k.as_array())?;

    // Prefer landscape (DieselGameBox), fall back to portrait or logo
    for preferred in &["DieselGameBox", "DieselGameBoxTall", "DieselGameBoxLogo"] {
        if let Some(url) = key_images.iter().find_map(|img| {
            if img.get("type").and_then(|t| t.as_str()) == Some(preferred) {
                img.get("url").and_then(|u| u.as_str()).map(str::to_owned)
            } else {
                None
            }
        }) {
            return Some(url);
        }
    }

    None
}

pub fn check_screamapi_installed(install_path: &Path) -> bool {
    for entry in WalkDir::new(install_path)
        .max_depth(8)
        .into_iter()
        .filter_map(Result::ok)
    {
        let filename = entry.file_name().to_string_lossy().to_lowercase();
        if filename.starts_with("eossdk-win") && filename.ends_with("_o.dll") {
            return true;
        }
    }
    false
}

pub fn check_koaloader_installed(install_path: &Path) -> bool {
    for entry in WalkDir::new(install_path)
        .max_depth(4)
        .into_iter()
        .filter_map(Result::ok)
    {
        if entry.file_name().to_string_lossy() == "Koaloader.config.json" {
            return true;
        }
    }
    false
}