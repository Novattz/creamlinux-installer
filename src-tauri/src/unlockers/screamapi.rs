use super::Unlocker;
use async_trait::async_trait;
use log::info;
use reqwest;
use std::fs;
use std::io;
use std::path::{Path, PathBuf};
use std::time::Duration;
use tempfile::tempdir;
use walkdir::WalkDir;
use zip::ZipArchive;

const SCREAMAPI_REPO: &str = "acidicoala/ScreamAPI";

pub struct ScreamAPI;

#[async_trait]
impl Unlocker for ScreamAPI {
    async fn get_latest_version() -> Result<String, String> {
        info!("Fetching latest ScreamAPI version...");

        let client = reqwest::Client::new();
        let releases_url = format!(
            "https://api.github.com/repos/{}/releases/latest",
            SCREAMAPI_REPO
        );

        let response = client
            .get(&releases_url)
            .header("User-Agent", "CreamLinux")
            .timeout(Duration::from_secs(10))
            .send()
            .await
            .map_err(|e| format!("Failed to fetch ScreamAPI releases: {}", e))?;

        // GitHub disabled the repo for a TOS violation, it answers 403 now
        if response.status() == reqwest::StatusCode::FORBIDDEN {
            return Err(
                "ScreamAPI repo has been disabled by GitHub (TOS violation), skipping download"
                    .to_string(),
            );
        }

        if !response.status().is_success() {
            return Err(format!(
                "Failed to fetch ScreamAPI releases: HTTP {}",
                response.status()
            ));
        }

        let release_info: serde_json::Value = response
            .json()
            .await
            .map_err(|e| format!("Failed to parse release info: {}", e))?;

        let version = release_info
            .get("tag_name")
            .and_then(|v| v.as_str())
            .ok_or_else(|| "Failed to extract version from release info".to_string())?
            .to_string();

        info!("Latest ScreamAPI version: {}", version);
        Ok(version)
    }

    async fn download_to_cache() -> Result<String, String> {
        let version = Self::get_latest_version().await?;
        info!("Downloading ScreamAPI version {}...", version);

        let client = reqwest::Client::new();

        let releases_url = format!(
            "https://api.github.com/repos/{}/releases/latest",
            SCREAMAPI_REPO
        );
        let release_info: serde_json::Value = client
            .get(&releases_url)
            .header("User-Agent", "CreamLinux")
            .timeout(Duration::from_secs(10))
            .send()
            .await
            .map_err(|e| format!("Failed to fetch ScreamAPI release: {}", e))?
            .json()
            .await
            .map_err(|e| format!("Failed to parse release info: {}", e))?;

        let zip_url = release_info
            .get("assets")
            .and_then(|a| a.as_array())
            .and_then(|assets| {
                assets.iter().find(|asset| {
                    asset
                        .get("name")
                        .and_then(|n| n.as_str())
                        .map(|n| n.ends_with(".zip"))
                        .unwrap_or(false)
                })
            })
            .and_then(|asset| asset.get("browser_download_url"))
            .and_then(|u| u.as_str())
            .ok_or_else(|| "No zip asset found in ScreamAPI release".to_string())?
            .to_string();

        info!("Downloading ScreamAPI from: {}", zip_url);

        let response = client
            .get(&zip_url)
            .timeout(Duration::from_secs(60))
            .send()
            .await
            .map_err(|e| format!("Failed to download ScreamAPI: {}", e))?;

        if !response.status().is_success() {
            return Err(format!(
                "Failed to download ScreamAPI: HTTP {}",
                response.status()
            ));
        }

        let temp_dir = tempdir().map_err(|e| format!("Failed to create temp dir: {}", e))?;
        let zip_path = temp_dir.path().join("screamapi.zip");
        let content = response
            .bytes()
            .await
            .map_err(|e| format!("Failed to read response bytes: {}", e))?;
        fs::write(&zip_path, &content)
            .map_err(|e| format!("Failed to write zip file: {}", e))?;

        let version_dir = crate::cache::get_screamapi_version_dir(&version)?;
        let file =
            fs::File::open(&zip_path).map_err(|e| format!("Failed to open zip: {}", e))?;
        let mut archive =
            ZipArchive::new(file).map_err(|e| format!("Failed to read zip archive: {}", e))?;

        for i in 0..archive.len() {
            let mut file = archive
                .by_index(i)
                .map_err(|e| format!("Failed to access zip entry: {}", e))?;

            let file_name = file.name().to_string();
            let base_name = Path::new(&file_name)
                .file_name()
                .unwrap_or_default()
                .to_string_lossy()
                .to_string();

            let should_extract = base_name.to_lowercase().ends_with(".dll")
                || base_name == "ScreamAPI.config.json";

            if should_extract {
                let output_path = version_dir.join(&base_name);
                let mut outfile = fs::File::create(&output_path)
                    .map_err(|e| format!("Failed to create output file: {}", e))?;
                io::copy(&mut file, &mut outfile)
                    .map_err(|e| format!("Failed to extract file: {}", e))?;
                info!("Extracted: {}", output_path.display());
            }
        }

        info!("ScreamAPI version {} downloaded to cache successfully", version);
        Ok(version)
    }

    /// context = "" -> direct install (replace EOSSDK DLLs)
    /// context = "koaloader" -> payload install (drop DLL in exe dir)
    async fn install_to_game(game_path: &str, context: &str) -> Result<(), String> {
        if context == "koaloader" {
            Self::install_as_koaloader_payload(game_path).await
        } else {
            Self::install_direct(game_path).await
        }
    }

    async fn uninstall_from_game(game_path: &str, context: &str) -> Result<(), String> {
        if context == "koaloader" {
            Self::uninstall_as_koaloader_payload(game_path).await
        } else {
            Self::uninstall_direct(game_path).await
        }
    }

    fn name() -> &'static str {
        "ScreamAPI"
    }
}

impl ScreamAPI {
    // Direct install

    async fn install_direct(game_path: &str) -> Result<(), String> {
        info!("Installing ScreamAPI (direct) to: {}", game_path);

        let install_path = Path::new(game_path);
        let eos_dlls = Self::find_eossdk_dlls(install_path);

        if eos_dlls.is_empty() {
            return Err(format!(
                "No EOSSDK-Win*-Shipping.dll found in {}",
                game_path
            ));
        }

        info!("Found {} EOSSDK DLL(s)", eos_dlls.len());

        let versions = crate::cache::read_versions()?;
        if versions.screamapi.latest.is_empty() {
            return Err("ScreamAPI is not available, the download failed (check the log)".to_string());
        }
        let scream_dir = crate::cache::get_screamapi_version_dir(&versions.screamapi.latest)?;

        for eos_dll in &eos_dlls {
            let filename = eos_dll.file_name().unwrap_or_default().to_string_lossy();
            let is_64bit = filename.to_lowercase().contains("64");

            let stem = filename.trim_end_matches(".dll");
            let backup = eos_dll.with_file_name(format!("{}_o.dll", stem));

            if !backup.exists() && eos_dll.exists() {
                fs::copy(eos_dll, &backup)
                    .map_err(|e| format!("Failed to backup {}: {}", filename, e))?;
                info!("Backed up {} -> {}", eos_dll.display(), backup.display());
            }

            let scream_dll_name = if is_64bit { "ScreamAPI64.dll" } else { "ScreamAPI32.dll" };
            let src = scream_dir.join(scream_dll_name);
            if !src.exists() {
                return Err(format!("ScreamAPI DLL not found in cache: {}", src.display()));
            }

            fs::copy(&src, eos_dll)
                .map_err(|e| format!("Failed to install ScreamAPI DLL: {}", e))?;
            info!("Installed {} as {}", scream_dll_name, eos_dll.display());
        }

        let config_dir = eos_dlls[0].parent().ok_or("Failed to get parent of EOS DLL")?;
        crate::screamapi_config::write_default_config(config_dir)?;

        info!("ScreamAPI (direct) installation complete for: {}", game_path);
        Ok(())
    }

    async fn uninstall_direct(game_path: &str) -> Result<(), String> {
        info!("Uninstalling ScreamAPI (direct) from: {}", game_path);

        let install_path = Path::new(game_path);

        for entry in WalkDir::new(install_path)
            .max_depth(8)
            .into_iter()
            .filter_map(Result::ok)
        {
            let path = entry.path();
            let filename = path.file_name().unwrap_or_default().to_string_lossy();
            let lower = filename.to_lowercase();

            if lower.starts_with("eossdk-win") && lower.ends_with("_o.dll") {
                let original_name = filename.trim_end_matches("_o.dll").to_string() + ".dll";
                let original = path.parent().unwrap_or(install_path).join(&original_name);

                fs::copy(path, &original)
                    .map_err(|e| format!("Failed to restore {}: {}", original_name, e))?;
                fs::remove_file(path)
                    .map_err(|e| format!("Failed to remove backup file: {}", e))?;
                info!("Restored {} from backup", original.display());
            }
        }

        crate::screamapi_config::delete_config(game_path)?;
        info!("ScreamAPI (direct) uninstallation complete for: {}", game_path);
        Ok(())
    }

    // Koaloader payload

    async fn install_as_koaloader_payload(exe_dir: &str) -> Result<(), String> {
        info!("Installing ScreamAPI as Koaloader payload in: {}", exe_dir);

        let versions = crate::cache::read_versions()?;
        if versions.screamapi.latest.is_empty() {
            return Err("ScreamAPI is not available, the download failed (check the log)".to_string());
        }
        let scream_dir = crate::cache::get_screamapi_version_dir(&versions.screamapi.latest)?;
        let exe_dir_path = Path::new(exe_dir);

        for dll_name in &["ScreamAPI32.dll", "ScreamAPI64.dll"] {
            let src = scream_dir.join(dll_name);
            if src.exists() {
                let dest = exe_dir_path.join(dll_name);
                fs::copy(&src, &dest)
                    .map_err(|e| format!("Failed to copy {}: {}", dll_name, e))?;
                info!("Placed {} in exe dir", dll_name);
            }
        }

        crate::screamapi_config::write_default_config(exe_dir_path)?;
        info!("ScreamAPI (Koaloader payload) install complete");
        Ok(())
    }

    async fn uninstall_as_koaloader_payload(exe_dir: &str) -> Result<(), String> {
        info!("Removing ScreamAPI Koaloader payload from: {}", exe_dir);

        let exe_dir_path = Path::new(exe_dir);
        for dll_name in &["ScreamAPI32.dll", "ScreamAPI64.dll"] {
            let path = exe_dir_path.join(dll_name);
            if path.exists() {
                fs::remove_file(&path)
                    .map_err(|e| format!("Failed to remove {}: {}", dll_name, e))?;
                info!("Removed {}", dll_name);
            }
        }

        let cfg = exe_dir_path.join("ScreamAPI.config.json");
        if cfg.exists() {
            fs::remove_file(&cfg).ok();
        }

        info!("ScreamAPI (Koaloader payload) uninstall complete");
        Ok(())
    }

    // Helpers

    pub fn find_eossdk_dlls(root: &Path) -> Vec<PathBuf> {
        let mut found = Vec::new();
        for entry in WalkDir::new(root)
            .max_depth(8)
            .into_iter()
            .filter_map(Result::ok)
        {
            let path = entry.path();
            let lower = path
                .file_name()
                .unwrap_or_default()
                .to_string_lossy()
                .to_lowercase();

            if lower.starts_with("eossdk-win")
                && lower.ends_with("-shipping.dll")
                && !lower.contains("_o")
            {
                found.push(path.to_path_buf());
            }
        }
        found
    }
}