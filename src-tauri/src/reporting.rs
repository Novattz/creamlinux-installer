use crate::cache::get_cache_dir;
use crate::config;
use log::{info, warn};
use rand::distr::Alphanumeric;
use rand::Rng;
use reqwest::Client;
use serde::{Serialize, Deserialize};
use sha2::{Digest, Sha256};
use std::fs;
use std::time::Duration;

const API_BASE: &str = "https://api.shibe.fun/v1";
const SALT_LENGTH: usize = 32;
 
// Report payload
 
#[derive(Serialize, Debug)]
pub struct ReportPayload {
    pub user_hash: String,
    pub game_id: String,
    /// "creamlinux" | "smokeapi"
    pub unlocker: String,
    /// true = worked, false = didn't work
    pub worked: bool,
}

/// Mirrors the JSON returned by GET /v1/votes/:game_id
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct VoteResult {
    pub unlocker: String,
    pub success: u32,
    pub fail: u32,
}

// Local report record

/// One entry in the local reports.json cache.
/// Tracks what the user has already voted so we can disable buttons in the UI.
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct LocalReport {
    pub game_id: String,
    pub unlocker: String,   // "creamlinux" | "smokeapi"
    pub worked: bool,
}

// reports.json helpers

fn reports_cache_path() -> Result<std::path::PathBuf, String> {
    Ok(get_cache_dir()?.join("reports.json"))
}

/// Load all locally recorded votes.
pub fn load_local_reports() -> Vec<LocalReport> {
    match reports_cache_path() {
        Ok(path) if path.exists() => {
            fs::read_to_string(&path)
                .ok()
                .and_then(|s| serde_json::from_str(&s).ok())
                .unwrap_or_default()
        }
        _ => Vec::new(),
    }
}

/// Save a new vote to reports.json (or overwrite an existing one for the same
/// game_id + unlocker combo).
pub fn save_local_report(report: LocalReport) -> Result<(), String> {
    let path = reports_cache_path()?;
    let mut reports = load_local_reports();

    // Upsert: replace existing entry for the same game + unlocker, otherwise push
    let pos = reports
        .iter()
        .position(|r| r.game_id == report.game_id && r.unlocker == report.unlocker);

    match pos {
        Some(i) => reports[i] = report,
        None => reports.push(report),
    }

    let json = serde_json::to_string_pretty(&reports)
        .map_err(|e| format!("Failed to serialize reports cache: {}", e))?;
    fs::write(&path, json)
        .map_err(|e| format!("Failed to write reports cache: {}", e))?;

    Ok(())
}

// Salt management
 
fn get_or_create_salt() -> Result<String, String> {
    let salt_path = get_cache_dir()?.join("salt");
 
    if salt_path.exists() {
        let salt = fs::read_to_string(&salt_path)
            .map_err(|e| format!("Failed to read salt file: {}", e))?;
        let salt = salt.trim().to_string();
 
        if salt.len() == SALT_LENGTH {
            return Ok(salt);
        }
 
        warn!("Salt file has invalid data, regenerating...");
    }
 
    let salt: String = rand::rng()
        .sample_iter(&Alphanumeric)
        .take(SALT_LENGTH)
        .map(char::from)
        .collect();
 
    fs::write(&salt_path, &salt)
        .map_err(|e| format!("Failed to write salt file: {}", e))?;
 
    info!("Generated new reporting salt");
    Ok(salt)
}
 
pub fn delete_salt() -> Result<(), String> {
    let salt_path = get_cache_dir()?.join("salt");
 
    if salt_path.exists() {
        fs::remove_file(&salt_path)
            .map_err(|e| format!("Failed to delete salt: {}", e))?;
        info!("Deleted reporting salt (user opted out)");
    }
    Ok(())
}
 
// Hash generation
 
pub fn generate_user_hash(steam_path: &str) -> Result<String, String> {
    let machine_id = fs::read_to_string("/etc/machine-id")
        .map_err(|e| format!("Failed to read machine-id: {}", e))?;
    let machine_id = machine_id.trim();
 
    let salt = get_or_create_salt()?;
    let combined = format!("{}{}{}", machine_id, steam_path, salt);
 
    let mut hasher = Sha256::new();
    hasher.update(combined.as_bytes());
    Ok(format!("{:x}", hasher.finalize()))
}
 
// HTTP
 
pub async fn post_report(payload: ReportPayload) -> Result<(), String> {
    let cfg = config::load_config()?;
 
    if !cfg.reporting_opted_in {
        info!("Reporting disabled - skipping report for game {}", payload.game_id);
        return Ok(());
    }
 
    let client = Client::new();
    let url = format!("{}/report", API_BASE);
 
    info!(
        "Submitting report: game={}, unlocker={}, worked={}",
        payload.game_id, payload.unlocker, payload.worked
    );
 
    let response = client
        .post(&url)
        .json(&payload)
        .timeout(Duration::from_secs(10))
        .send()
        .await
        .map_err(|e| format!("Failed to send report: {}", e))?;
 
    if response.status().is_success() {
        info!("Report submitted successfully");
        Ok(())
    } else {
        Err(format!("Report submission failed: HTTP {}", response.status()))
    }
}