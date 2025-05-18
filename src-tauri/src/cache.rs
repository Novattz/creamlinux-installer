// This is a placeholder file - cache functionality has been removed
// and now only exists in memory within the App state

pub fn cache_dlcs(_game_id: &str, _dlcs: &[crate::dlc_manager::DlcInfoWithState]) -> std::io::Result<()> {
  // This function is kept only for compatibility, but now does nothing
  // The DLCs are only cached in memory
  log::info!("Cache functionality has been removed - DLCs are only stored in memory");
  Ok(())
}

pub fn load_cached_dlcs(_game_id: &str) -> Option<Vec<crate::dlc_manager::DlcInfoWithState>> {
  // This function is kept only for compatibility, but now always returns None
  log::info!("Cache functionality has been removed - DLCs are only stored in memory");
  None
}

pub fn clear_all_caches() -> std::io::Result<()> {
  // This function is kept only for compatibility, but now does nothing
  log::info!("Cache functionality has been removed - DLCs are only stored in memory");
  Ok(())
}