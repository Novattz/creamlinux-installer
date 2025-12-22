use super::Unlocker;
use async_trait::async_trait;
use log::{info, warn};
use reqwest;
use std::fs;
use std::io;
use std::path::Path;
use std::time::Duration;
use tempfile::tempdir;
use zip::ZipArchive;

pub struct CreamLinux;

#[async_trait]
impl Unlocker for CreamLinux {
    async fn get_latest_version() -> Result<String, String> {
        info!("Fetching latest CreamLinux version...");

        let client = reqwest::Client::new();
        
        // Fetch the latest release from GitHub API
        let api_url = "https://api.github.com/repos/anticitizn/creamlinux/releases/latest";
        
        let response = client
            .get(api_url)
            .header("User-Agent", "CreamLinux-Installer")
            .timeout(Duration::from_secs(10))
            .send()
            .await
            .map_err(|e| format!("Failed to fetch CreamLinux releases: {}", e))?;

        if !response.status().is_success() {
            return Err(format!(
                "Failed to fetch CreamLinux releases: HTTP {}",
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

        info!("Latest CreamLinux version: {}", version);
        Ok(version)
    }

    async fn download_to_cache() -> Result<String, String> {
        let version = Self::get_latest_version().await?;
        info!("Downloading CreamLinux version {}...", version);

        let client = reqwest::Client::new();
        
        // Construct the download URL using the version
        let download_url = format!(
            "https://github.com/anticitizn/creamlinux/releases/download/{}/creamlinux.zip",
            version
        );

        // Download the zip
        let response = client
            .get(&download_url)
            .timeout(Duration::from_secs(30))
            .send()
            .await
            .map_err(|e| format!("Failed to download CreamLinux: {}", e))?;

        if !response.status().is_success() {
            return Err(format!(
                "Failed to download CreamLinux: HTTP {}",
                response.status()
            ));
        }

        // Save to temporary file
        let temp_dir = tempdir().map_err(|e| format!("Failed to create temp dir: {}", e))?;
        let zip_path = temp_dir.path().join("creamlinux.zip");
        let content = response
            .bytes()
            .await
            .map_err(|e| format!("Failed to read response bytes: {}", e))?;
        fs::write(&zip_path, &content).map_err(|e| format!("Failed to write zip file: {}", e))?;

        // Extract to cache directory
        let version_dir = crate::cache::get_creamlinux_version_dir(&version)?;
        let file = fs::File::open(&zip_path).map_err(|e| format!("Failed to open zip: {}", e))?;
        let mut archive =
            ZipArchive::new(file).map_err(|e| format!("Failed to read zip archive: {}", e))?;

        // Extract all files
        for i in 0..archive.len() {
            let mut file = archive
                .by_index(i)
                .map_err(|e| format!("Failed to access zip entry: {}", e))?;

            let file_name = file.name().to_string(); // Clone the name early

            // Skip directories
            if file_name.ends_with('/') {
                continue;
            }

            let output_path = version_dir.join(
                Path::new(&file_name)
                    .file_name()
                    .unwrap_or_else(|| std::ffi::OsStr::new(&file_name)),
            );

            let mut outfile = fs::File::create(&output_path)
                .map_err(|e| format!("Failed to create output file: {}", e))?;
            io::copy(&mut file, &mut outfile)
                .map_err(|e| format!("Failed to extract file: {}", e))?;

            // Make .sh files executable
            if file_name.ends_with(".sh") {
                #[cfg(unix)]
                {
                    use std::os::unix::fs::PermissionsExt;
                    let mut perms = fs::metadata(&output_path)
                        .map_err(|e| format!("Failed to get file metadata: {}", e))?
                        .permissions();
                    perms.set_mode(0o755);
                    fs::set_permissions(&output_path, perms)
                        .map_err(|e| format!("Failed to set permissions: {}", e))?;
                }
            }

            info!("Extracted: {}", output_path.display());
        }

        info!(
            "CreamLinux version {} downloaded to cache successfully",
            version
        );
        Ok(version)
    }

    async fn install_to_game(game_path: &str, _game_id: &str) -> Result<(), String> {
        info!("Installing CreamLinux to {}", game_path);

        // Get the cached CreamLinux files
        let cached_files = crate::cache::list_creamlinux_files()?;
        if cached_files.is_empty() {
            return Err("No CreamLinux files found in cache".to_string());
        }

        let game_path_obj = Path::new(game_path);

        // Copy all files to the game directory
        for file in &cached_files {
            let file_name = file.file_name().ok_or_else(|| {
                format!("Failed to get filename from: {}", file.display())
            })?;

            let dest_path = game_path_obj.join(file_name);

            fs::copy(file, &dest_path)
                .map_err(|e| format!("Failed to copy {} to game directory: {}", file_name.to_string_lossy(), e))?;

            // Make .sh files executable
            if file_name.to_string_lossy().ends_with(".sh") {
                #[cfg(unix)]
                {
                    use std::os::unix::fs::PermissionsExt;
                    let mut perms = fs::metadata(&dest_path)
                        .map_err(|e| format!("Failed to get file metadata: {}", e))?
                        .permissions();
                    perms.set_mode(0o755);
                    fs::set_permissions(&dest_path, perms)
                        .map_err(|e| format!("Failed to set permissions: {}", e))?;
                }
            }

            info!("Installed: {}", dest_path.display());
        }

        // Note: cream_api.ini is managed separately by dlc_manager
        // This function only installs the binaries

        info!("CreamLinux installation completed for: {}", game_path);
        Ok(())
    }

    async fn uninstall_from_game(game_path: &str, _game_id: &str) -> Result<(), String> {
        info!("Uninstalling CreamLinux from: {}", game_path);

        let game_path_obj = Path::new(game_path);

        // List of CreamLinux files to remove
        let files_to_remove = vec![
            "cream.sh",
            "lib32Creamlinux.so",
            "lib64Creamlinux.so",
            "cream_api.ini",
        ];

        for file_name in files_to_remove {
            let file_path = game_path_obj.join(file_name);

            if file_path.exists() {
                match fs::remove_file(&file_path) {
                    Ok(_) => info!("Removed: {}", file_path.display()),
                    Err(e) => warn!(
                        "Failed to remove {}: {}",
                        file_path.display(),
                        e
                    ),
                }
            }
        }

        info!("CreamLinux uninstallation completed for: {}", game_path);
        Ok(())
    }

    fn name() -> &'static str {
        "CreamLinux"
    }
}