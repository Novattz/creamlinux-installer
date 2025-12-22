mod creamlinux;
mod smokeapi;

pub use creamlinux::CreamLinux;
pub use smokeapi::SmokeAPI;

use async_trait::async_trait;

// Common trait for all unlockers (CreamLinux, SmokeAPI)
#[async_trait]
pub trait Unlocker {
    // Get the latest version from the remote source
    async fn get_latest_version() -> Result<String, String>;

    // Download the unlocker to the cache directory
    async fn download_to_cache() -> Result<String, String>;

    // Install the unlocker from cache to a game directory
    async fn install_to_game(game_path: &str, context: &str) -> Result<(), String>;

    // Uninstall the unlocker from a game directory
    async fn uninstall_from_game(game_path: &str, context: &str) -> Result<(), String>;

    // Get the name of the unlocker
    #[allow(dead_code)]
    fn name() -> &'static str;
}