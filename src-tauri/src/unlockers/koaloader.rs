use super::Unlocker;
use async_trait::async_trait;
use log::info;
use reqwest;
use std::fs;
use std::io;
use std::path::Path;
use std::time::Duration;
use tempfile::tempdir;
use zip::ZipArchive;

const KOALOADER_REPO: &str = "acidicoala/Koaloader";
pub use crate::pe_inspector::KOA_VARIANTS;

pub struct Koaloader;

#[async_trait]
impl Unlocker for Koaloader {
    async fn get_latest_version() -> Result<String, String> {
        info!("Fetching latest Koaloader version...");

        let client = reqwest::Client::new();
        let releases_url = format!(
            "https://api.github.com/repos/{}/releases/latest",
            KOALOADER_REPO
        );

        let response = client
            .get(&releases_url)
            .header("User-Agent", "CreamLinux")
            .timeout(Duration::from_secs(10))
            .send()
            .await
            .map_err(|e| format!("Failed to fetch Koaloader releases: {}", e))?;

        if !response.status().is_success() {
            return Err(format!(
                "Failed to fetch Koaloader releases: HTTP {}",
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

        info!("Latest Koaloader version: {}", version);
        Ok(version)
    }

    async fn download_to_cache() -> Result<String, String> {
        let version = Self::get_latest_version().await?;
        info!("Downloading Koaloader version {}...", version);

        let client = reqwest::Client::new();

        let releases_url = format!(
            "https://api.github.com/repos/{}/releases/latest",
            KOALOADER_REPO
        );
        let release_info: serde_json::Value = client
            .get(&releases_url)
            .header("User-Agent", "CreamLinux")
            .timeout(Duration::from_secs(10))
            .send()
            .await
            .map_err(|e| format!("Failed to fetch Koaloader release: {}", e))?
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
            .ok_or_else(|| "No zip asset found in Koaloader release".to_string())?
            .to_string();

        let response = client
            .get(&zip_url)
            .timeout(Duration::from_secs(60))
            .send()
            .await
            .map_err(|e| format!("Failed to download Koaloader: {}", e))?;

        if !response.status().is_success() {
            return Err(format!(
                "Failed to download Koaloader: HTTP {}",
                response.status()
            ));
        }

        let temp_dir = tempdir().map_err(|e| format!("Failed to create temp dir: {}", e))?;
        let zip_path = temp_dir.path().join("koaloader.zip");
        let content = response
            .bytes()
            .await
            .map_err(|e| format!("Failed to read response bytes: {}", e))?;
        fs::write(&zip_path, &content)
            .map_err(|e| format!("Failed to write zip file: {}", e))?;

        let version_dir = crate::cache::get_koaloader_version_dir(&version)?;
        let file =
            fs::File::open(&zip_path).map_err(|e| format!("Failed to open zip: {}", e))?;
        let mut archive =
            ZipArchive::new(file).map_err(|e| format!("Failed to read zip archive: {}", e))?;

        for i in 0..archive.len() {
            let mut file = archive
                .by_index(i)
                .map_err(|e| format!("Failed to access zip entry: {}", e))?;

            let zip_entry = file.name().to_string();
            if zip_entry.ends_with('/') {
                continue;
            }

            let out_path = version_dir.join(&zip_entry);
            if let Some(parent) = out_path.parent() {
                fs::create_dir_all(parent)
                    .map_err(|e| format!("Failed to create directory: {}", e))?;
            }

            let mut outfile = fs::File::create(&out_path).map_err(|e| {
                format!("Failed to create output file {}: {}", out_path.display(), e)
            })?;
            io::copy(&mut file, &mut outfile)
                .map_err(|e| format!("Failed to extract file: {}", e))?;
        }

        info!("Koaloader version {} downloaded to cache successfully", version);
        Ok(version)
    }

    /// context = relative executable path (e.g. "en_us/Sources/Bin/SnowRunner.exe")
    /// Progress events are emitted by installer/mod.rs, not here.
    async fn install_to_game(game_path: &str, context: &str) -> Result<(), String> {
        let exe_path = Self::resolve_exe(game_path, context)?;
        Self::install_proxy(&exe_path)?;

        let exe_dir = exe_path.parent().ok_or("Failed to get executable directory")?;
        let exe_dir_str = exe_dir.to_string_lossy().to_string();
        crate::unlockers::ScreamAPI::install_to_game(&exe_dir_str, "koaloader").await?;

        Self::write_koaloader_config(&exe_path)?;

        info!("Koaloader installation complete for: {}", game_path);
        Ok(())
    }

    async fn uninstall_from_game(game_path: &str, context: &str) -> Result<(), String> {
        let exe_path = Self::resolve_exe(game_path, context)?;
        let exe_dir = exe_path.parent().ok_or("Failed to get executable directory")?;
        let exe_dir_str = exe_dir.to_string_lossy().to_string();

        Self::remove_proxy_and_config(exe_dir)?;

        crate::unlockers::ScreamAPI::uninstall_from_game(&exe_dir_str, "koaloader").await?;

        info!("Koaloader uninstallation complete for: {}", game_path);
        Ok(())
    }

    fn name() -> &'static str {
        "Koaloader"
    }
}

impl Koaloader {
    /// Public wrapper for installer/mod.rs to call.
    pub fn resolve_exe_pub(game_path: &str, exe_relative: &str) -> Result<std::path::PathBuf, String> {
        Self::resolve_exe(game_path, exe_relative)
    }

    fn resolve_exe(game_path: &str, exe_relative: &str) -> Result<std::path::PathBuf, String> {
        use walkdir::WalkDir;

        let full = Path::new(game_path).join(exe_relative);
        if full.exists() {
            return Ok(full);
        }

        let exe_name = Path::new(exe_relative)
            .file_name()
            .unwrap_or_default()
            .to_string_lossy()
            .to_string();

        for entry in WalkDir::new(game_path)
            .max_depth(8)
            .into_iter()
            .filter_map(Result::ok)
        {
            if entry.file_name().to_string_lossy() == exe_name {
                return Ok(entry.path().to_path_buf());
            }
        }

        Err(format!(
            "Executable not found: {} (searched in {})",
            exe_relative, game_path
        ))
    }

    /// Detects bitness, scans for the best-match Koaloader proxy, and copies
    /// it next to `exe_path`. Returns the scan result so callers can report
    /// which proxy was used and whether it was a version.dll fallback.
    /// Shared by the Unlocker trait impl above and installer/mod.rs (which
    /// wraps this with progress events).
    pub(crate) fn install_proxy(
        exe_path: &Path,
    ) -> Result<crate::pe_inspector::ProxyScanResult, String> {
        let exe_dir = exe_path.parent().ok_or("Failed to get executable directory")?;
        let is_64bit = crate::pe_inspector::is_64bit_exe(exe_path);
        let scan = crate::pe_inspector::find_best_proxy(exe_path);
        let proxy_stem = scan.proxy_name.trim_end_matches(".dll").to_string();

        let proxy_src = Self::get_proxy_dll(&proxy_stem, is_64bit)?;
        fs::copy(&proxy_src, exe_dir.join(&scan.proxy_name))
            .map_err(|e| format!("Failed to copy Koaloader proxy DLL: {}", e))?;

        info!("Selected proxy: {} (fallback={})", scan.proxy_name, scan.is_fallback);
        Ok(scan)
    }

    /// Writes Koaloader.config.json targeting the given executable, next to it.
    pub(crate) fn write_koaloader_config(exe_path: &Path) -> Result<(), String> {
        let exe_dir = exe_path.parent().ok_or("Failed to get executable directory")?;
        let exe_name = exe_path.file_name().unwrap_or_default().to_string_lossy().to_string();
        let koa_config = serde_json::json!({
            "logging": false,
            "enabled": true,
            "auto_load": true,
            "targets": [exe_name],
            "modules": []
        });
        fs::write(
            exe_dir.join("Koaloader.config.json"),
            serde_json::to_string_pretty(&koa_config).unwrap(),
        )
        .map_err(|e| format!("Failed to write Koaloader config: {}", e))
    }

    /// Removes Koaloader.config.json and any installed proxy DLL from `exe_dir`.
    pub(crate) fn remove_proxy_and_config(exe_dir: &Path) -> Result<(), String> {
        let koa_config = exe_dir.join("Koaloader.config.json");
        if koa_config.exists() {
            fs::remove_file(&koa_config)
                .map_err(|e| format!("Failed to remove Koaloader config: {}", e))?;
        }

        if let Ok(entries) = fs::read_dir(exe_dir) {
            for entry in entries.filter_map(Result::ok) {
                let path = entry.path();
                let name_lower = path
                    .file_name()
                    .unwrap_or_default()
                    .to_string_lossy()
                    .to_lowercase();
                if KOA_VARIANTS.contains(&name_lower.as_str()) {
                    fs::remove_file(&path).ok();
                    info!("Removed proxy DLL: {}", path.display());
                }
            }
        }

        Ok(())
    }

    pub fn get_proxy_dll(proxy_stem: &str, is_64bit: bool) -> Result<std::path::PathBuf, String> {
        let versions = crate::cache::read_versions()?;
        if versions.koaloader.latest.is_empty() {
            return Err("Koaloader is not cached. Please restart the app.".to_string());
        }

        let version_dir = crate::cache::get_koaloader_version_dir(&versions.koaloader.latest)?;
        let bitness = if is_64bit { "64" } else { "32" };
        let folder = format!("{}-{}", proxy_stem, bitness);
        let dll_path = version_dir.join(&folder).join(format!("{}.dll", proxy_stem));

        if !dll_path.exists() {
            return Err(format!(
                "Koaloader proxy DLL not found in cache: {}",
                dll_path.display()
            ));
        }

        Ok(dll_path)
    }
}