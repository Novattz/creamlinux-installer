/**
 * User configuration structure
 * Matches the Rust Config struct
 */
export interface Config {
  /** Whether to show the disclaimer on startup */
  show_disclaimer: boolean
  reporting_opted_in: boolean
  reporting_has_seen_prompt: boolean
  /** Extra Steam library folders to scan, beyond the auto-detected ones */
  custom_steam_paths: string[]
}