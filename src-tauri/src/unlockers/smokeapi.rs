use super::Unlocker;
use async_trait::async_trait;
use log::{error, info, warn};
use reqwest;
use std::fs;
use std::io;
use std::path::Path;
use std::time::Duration;
use tempfile::tempdir;
use zip::ZipArchive;

const SMOKEAPI_REPO: &str = "acidicoala/SmokeAPI";

pub struct SmokeAPI;

#[async_trait]
impl Unlocker for SmokeAPI {
    async fn get_latest_version() -> Result<String, String> {
        info!("Fetching latest SmokeAPI version...");

        let client = reqwest::Client::new();
        let releases_url = format!(
            "https://api.github.com/repos/{}/releases/latest",
            SMOKEAPI_REPO
        );

        let response = client
            .get(&releases_url)
            .header("User-Agent", "CreamLinux")
            .timeout(Duration::from_secs(10))
            .send()
            .await
            .map_err(|e| format!("Failed to fetch SmokeAPI releases: {}", e))?;

        if !response.status().is_success() {
            return Err(format!(
                "Failed to fetch SmokeAPI releases: HTTP {}",
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

        info!("Latest SmokeAPI version: {}", version);
        Ok(version)
    }

    async fn download_to_cache() -> Result<String, String> {
        let version = Self::get_latest_version().await?;
        info!("Downloading SmokeAPI version {}...", version);

        let client = reqwest::Client::new();
        let zip_url = format!(
            "https://github.com/{}/releases/download/{}/SmokeAPI-{}.zip",
            SMOKEAPI_REPO, version, version
        );

        // Download the zip
        let response = client
            .get(&zip_url)
            .timeout(Duration::from_secs(30))
            .send()
            .await
            .map_err(|e| format!("Failed to download SmokeAPI: {}", e))?;

        if !response.status().is_success() {
            return Err(format!(
                "Failed to download SmokeAPI: HTTP {}",
                response.status()
            ));
        }

        // Save to temporary file
        let temp_dir = tempdir().map_err(|e| format!("Failed to create temp dir: {}", e))?;
        let zip_path = temp_dir.path().join("smokeapi.zip");
        let content = response
            .bytes()
            .await
            .map_err(|e| format!("Failed to read response bytes: {}", e))?;
        fs::write(&zip_path, &content).map_err(|e| format!("Failed to write zip file: {}", e))?;

        // Extract to cache directory
        let version_dir = crate::cache::get_smokeapi_version_dir(&version)?;
        let file = fs::File::open(&zip_path).map_err(|e| format!("Failed to open zip: {}", e))?;
        let mut archive =
            ZipArchive::new(file).map_err(|e| format!("Failed to read zip archive: {}", e))?;

        // Extract all DLL files
        for i in 0..archive.len() {
            let mut file = archive
                .by_index(i)
                .map_err(|e| format!("Failed to access zip entry: {}", e))?;

            let file_name = file.name();

            // Only extract DLL files
            if file_name.to_lowercase().ends_with(".dll") {
                let output_path = version_dir.join(
                    Path::new(file_name)
                        .file_name()
                        .unwrap_or_else(|| std::ffi::OsStr::new(file_name)),
                );

                let mut outfile = fs::File::create(&output_path)
                    .map_err(|e| format!("Failed to create output file: {}", e))?;
                io::copy(&mut file, &mut outfile)
                    .map_err(|e| format!("Failed to extract file: {}", e))?;

                info!("Extracted: {}", output_path.display());
            }
        }

        info!(
            "SmokeAPI version {} downloaded to cache successfully",
            version
        );
        Ok(version)
    }

    async fn install_to_game(game_path: &str, api_files_str: &str) -> Result<(), String> {
        // Parse api_files from the context string (comma-separated)
        let api_files: Vec<String> = api_files_str.split(',').map(|s| s.to_string()).collect();

        info!(
            "Installing SmokeAPI to {} for {} API files",
            game_path,
            api_files.len()
        );

        // Get the cached SmokeAPI DLLs
        let cached_dlls = crate::cache::list_smokeapi_dlls()?;
        if cached_dlls.is_empty() {
            return Err("No SmokeAPI DLLs found in cache".to_string());
        }

        for api_file in &api_files {
            let api_dir = Path::new(game_path).join(
                Path::new(api_file)
                    .parent()
                    .unwrap_or_else(|| Path::new("")),
            );
            let api_name = Path::new(api_file).file_name().unwrap_or_default();

            // Backup original file
            let original_path = api_dir.join(api_name);
            let backup_path = api_dir.join(api_name.to_string_lossy().replace(".dll", "_o.dll"));

            info!("Processing: {}", original_path.display());

            // Only backup if not already backed up
            if !backup_path.exists() && original_path.exists() {
                fs::copy(&original_path, &backup_path)
                    .map_err(|e| format!("Failed to backup original file: {}", e))?;
                info!("Created backup: {}", backup_path.display());
            }

            // Determine if we need 32-bit or 64-bit SmokeAPI DLL
            let is_64bit = api_name.to_string_lossy().contains("64");
            let target_arch = if is_64bit { "64" } else { "32" };

            // Find the matching DLL
            let matching_dll = cached_dlls
                .iter()
                .find(|dll| {
                    let dll_name = dll.file_name().unwrap_or_default().to_string_lossy();
                    dll_name.to_lowercase().contains("smoke")
                        && dll_name
                            .to_lowercase()
                            .contains(&format!("{}.dll", target_arch))
                })
                .ok_or_else(|| {
                    format!(
                        "No matching {}-bit SmokeAPI DLL found in cache",
                        target_arch
                    )
                })?;

            // Copy the DLL to the game directory
            fs::copy(matching_dll, &original_path)
                .map_err(|e| format!("Failed to install SmokeAPI DLL: {}", e))?;

            info!(
                "Installed {} as: {}",
                matching_dll.display(),
                original_path.display()
            );
        }

        info!("SmokeAPI installation completed for: {}", game_path);
        Ok(())
    }

    async fn uninstall_from_game(game_path: &str, api_files_str: &str) -> Result<(), String> {
        // Parse api_files from the context string (comma-separated)
        let api_files: Vec<String> = api_files_str.split(',').map(|s| s.to_string()).collect();

        info!("Uninstalling SmokeAPI from: {}", game_path);

        for api_file in &api_files {
            let api_path = Path::new(game_path).join(api_file);
            let api_dir = api_path.parent().unwrap_or_else(|| Path::new(game_path));
            let api_name = api_path.file_name().unwrap_or_default();

            let original_path = api_dir.join(api_name);
            let backup_path = api_dir.join(api_name.to_string_lossy().replace(".dll", "_o.dll"));

            info!("Processing: {}", original_path.display());

            if backup_path.exists() {
                // Remove the SmokeAPI version
                if original_path.exists() {
                    match fs::remove_file(&original_path) {
                        Ok(_) => info!("Removed SmokeAPI file: {}", original_path.display()),
                        Err(e) => warn!(
                            "Failed to remove SmokeAPI file: {}, error: {}",
                            original_path.display(),
                            e
                        ),
                    }
                }

                // Restore the original file
                match fs::rename(&backup_path, &original_path) {
                    Ok(_) => info!("Restored original file: {}", original_path.display()),
                    Err(e) => {
                        warn!(
                            "Failed to restore original file: {}, error: {}",
                            original_path.display(),
                            e
                        );
                        // Try to copy instead if rename fails
                        if let Err(copy_err) = fs::copy(&backup_path, &original_path)
                            .and_then(|_| fs::remove_file(&backup_path))
                        {
                            error!("Failed to copy backup file: {}", copy_err);
                        }
                    }
                }
            } else {
                info!("No backup found for: {}", api_file);
            }
        }

        info!("SmokeAPI uninstallation completed for: {}", game_path);
        Ok(())
    }

    fn name() -> &'static str {
        "SmokeAPI"
    }
}