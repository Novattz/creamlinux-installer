use log::{debug, error, info, warn};
use regex::Regex;
use std::collections::HashSet;
use std::fs;
use std::io::Read;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use tokio::sync::mpsc;
use walkdir::WalkDir;

// Game information structure
#[derive(Debug, Clone)]
pub struct GameInfo {
    pub id: String,
    pub title: String,
    pub path: PathBuf,
    pub native: bool,
    pub api_files: Vec<String>,
    pub cream_installed: bool,
    pub smoke_installed: bool,
}

// Find potential Steam installation directories
pub fn get_default_steam_paths() -> Vec<PathBuf> {
    let mut paths = Vec::new();

    // Get user's home directory
    if let Ok(home) = std::env::var("HOME") {
        info!("Searching for Steam in home directory: {}", home);

        // Common Steam installation locations on Linux
        let common_paths = [
            ".steam/steam",                                        // Steam symlink directory
            ".steam/root",                                         // Alternative symlink
            ".local/share/Steam",                                  // Flatpak Steam installation
            ".var/app/com.valvesoftware.Steam/.local/share/Steam", // Flatpak container path
            ".var/app/com.valvesoftware.Steam/data/Steam",         // Alternative Flatpak path
            "/run/media/mmcblk0p1",                                // Removable Storage path
        ];

        for path in &common_paths {
            let full_path = PathBuf::from(&home).join(path);
            if full_path.exists() {
                debug!("Found Steam directory: {}", full_path.display());
                paths.push(full_path);
            }
        }
    }

    // Add Steam Deck paths if they exist
    let deck_paths = ["/home/deck/.steam/steam", "/home/deck/.local/share/Steam"];

    for path in &deck_paths {
        let p = PathBuf::from(path);
        if p.exists() && !paths.contains(&p) {
            debug!("Found Steam Deck path: {}", p.display());
            paths.push(p);
        }
    }

    // Try to extract paths from Steam registry file
    if let Some(registry_paths) = read_steam_registry() {
        for path in registry_paths {
            if !paths.contains(&path) && path.exists() {
                debug!("Adding Steam path from registry: {}", path.display());
                paths.push(path);
            }
        }
    }

    info!("Found {} potential Steam directories", paths.len());
    paths
}

// Try to read the Steam registry file to find installation paths
fn read_steam_registry() -> Option<Vec<PathBuf>> {
    let home = match std::env::var("HOME") {
        Ok(h) => h,
        Err(_) => return None,
    };

    let registry_paths = [
        format!("{}/.steam/registry.vdf", home),
        format!("{}/.steam/steam/registry.vdf", home),
        format!("{}/.local/share/Steam/registry.vdf", home),
    ];

    for registry_path in registry_paths {
        let path = Path::new(&registry_path);
        if path.exists() {
            debug!("Found Steam registry at: {}", path.display());

            if let Ok(content) = fs::read_to_string(path) {
                let mut paths = Vec::new();

                // Extract Steam installation paths
                let re_steam_path = Regex::new(r#""SteamPath"\s+"([^"]+)""#).unwrap();
                if let Some(cap) = re_steam_path.captures(&content) {
                    let steam_path = PathBuf::from(&cap[1]);
                    paths.push(steam_path);
                }

                // Look for install path
                let re_install_path = Regex::new(r#""InstallPath"\s+"([^"]+)""#).unwrap();
                if let Some(cap) = re_install_path.captures(&content) {
                    let install_path = PathBuf::from(&cap[1]);
                    if !paths.contains(&install_path) {
                        paths.push(install_path);
                    }
                }

                if !paths.is_empty() {
                    return Some(paths);
                }
            }
        }
    }

    None
}

// Find all Steam library folders from base Steam installation paths
pub fn find_steam_libraries(base_paths: &[PathBuf]) -> Vec<PathBuf> {
    let mut libraries = HashSet::new();

    for base_path in base_paths {
        debug!("Looking for Steam libraries in: {}", base_path.display());

        // Check if this path contains a steamapps directory
        let steamapps_path = base_path.join("steamapps");
        if steamapps_path.exists() && steamapps_path.is_dir() {
            debug!("Found steamapps directory: {}", steamapps_path.display());
            libraries.insert(steamapps_path.clone());

            // Check for additional libraries in libraryfolders.vdf
            parse_library_folders_vdf(&steamapps_path, &mut libraries);
        }

        // Also check for steamapps in common locations relative to this path
        let possible_steamapps = [
            base_path.join("steam/steamapps"),
            base_path.join("Steam/steamapps"),
        ];

        for path in &possible_steamapps {
            if path.exists() && path.is_dir() && !libraries.contains(path) {
                debug!("Found steamapps directory: {}", path.display());
                libraries.insert(path.clone());

                // Check for additional libraries in libraryfolders.vdf
                parse_library_folders_vdf(path, &mut libraries);
            }
        }
    }

    let result: Vec<PathBuf> = libraries.into_iter().collect();
    info!("Found {} Steam library directories", result.len());
    for (i, lib) in result.iter().enumerate() {
        info!("  Library {}: {}", i + 1, lib.display());
    }
    result
}

// Parse libraryfolders.vdf to extract additional library paths
fn parse_library_folders_vdf(steamapps_path: &Path, libraries: &mut HashSet<PathBuf>) {
    // Check both possible locations of the VDF file
    let vdf_paths = [
        steamapps_path.join("libraryfolders.vdf"),
        steamapps_path.join("config/libraryfolders.vdf"),
    ];

    for vdf_path in &vdf_paths {
        if vdf_path.exists() {
            debug!("Found library folders VDF: {}", vdf_path.display());

            if let Ok(content) = fs::read_to_string(vdf_path) {
                // Extract library paths using regex for both new and old format VDFs
                let re_path = Regex::new(r#""path"\s+"([^"]+)""#).unwrap();
                for cap in re_path.captures_iter(&content) {
                    let path_str = &cap[1];
                    let lib_path = PathBuf::from(path_str).join("steamapps");

                    if lib_path.exists() && lib_path.is_dir() && !libraries.contains(&lib_path) {
                        debug!("Found library from VDF: {}", lib_path.display());
                        // Clone lib_path before inserting to avoid ownership issues
                        let lib_path_clone = lib_path.clone();
                        libraries.insert(lib_path_clone);

                        // Recursively check this library for more libraries
                        parse_library_folders_vdf(&lib_path, libraries);
                    }
                }
            }
        }
    }
}

// Parse an appmanifest ACF file to extract game information
fn parse_appmanifest(path: &Path) -> Option<(String, String, String)> {
    match fs::read_to_string(path) {
        Ok(content) => {
            // Use regex to extract the app ID, name, and install directory
            let re_appid = Regex::new(r#""appid"\s+"(\d+)""#).unwrap();
            let re_name = Regex::new(r#""name"\s+"([^"]+)""#).unwrap();
            let re_installdir = Regex::new(r#""installdir"\s+"([^"]+)""#).unwrap();

            if let (Some(app_id_cap), Some(name_cap), Some(dir_cap)) = (
                re_appid.captures(&content),
                re_name.captures(&content),
                re_installdir.captures(&content),
            ) {
                let app_id = app_id_cap[1].to_string();
                let name = name_cap[1].to_string();
                let install_dir = dir_cap[1].to_string();

                return Some((app_id, name, install_dir));
            }
        }
        Err(e) => {
            error!("Failed to read ACF file {}: {}", path.display(), e);
        }
    }

    None
}

// Check if a file is a Linux ELF binary
fn is_elf_binary(path: &Path) -> bool {
    if let Ok(mut file) = fs::File::open(path) {
        let mut buffer = [0; 4];
        if file.read_exact(&mut buffer).is_ok() {
            // Check for ELF magic number (0x7F 'E' 'L' 'F')
            return buffer[0] == 0x7F
                && buffer[1] == b'E'
                && buffer[2] == b'L'
                && buffer[3] == b'F';
        }
    }

    false
}

// Check if a game has CreamLinux installed
fn check_creamlinux_installed(game_path: &Path) -> bool {
    let cream_files = ["cream.sh", "cream_api.ini", "cream_api.so"];

    for file in &cream_files {
        if game_path.join(file).exists() {
            debug!("CreamLinux installation detected: {}", file);
            return true;
        }
    }

    false
}

// Check if a game has SmokeAPI installed
fn check_smokeapi_installed(game_path: &Path, api_files: &[String]) -> bool {
    if api_files.is_empty() {
        return false;
    }

    // SmokeAPI creates backups with _o.dll suffix
    for api_file in api_files {
        let api_path = game_path.join(api_file);
        let api_dir = api_path.parent().unwrap_or(game_path);
        let api_filename = api_path.file_name().unwrap_or_default();

        // Check for backup file (original file renamed with _o.dll suffix)
        let backup_name = api_filename.to_string_lossy().replace(".dll", "_o.dll");
        let backup_path = api_dir.join(backup_name);

        if backup_path.exists() {
            debug!("SmokeAPI backup file found: {}", backup_path.display());
            return true;
        }
    }

    false
}

// Scan a game directory to determine if it's native or needs Proton
// Also collect any Steam API DLLs for potential SmokeAPI installation
fn scan_game_directory(game_path: &Path) -> (bool, Vec<String>) {
    let mut found_exe = false;
    let mut found_linux_binary = false;
    let mut steam_api_files = Vec::new();

    // Directories to skip for better performance
    let skip_dirs = [
        "videos",
        "video",
        "movies",
        "movie",
        "sound",
        "sounds",
        "audio",
        "textures",
        "music",
        "localization",
        "shaders",
        "logs",
        "assets/audio",
        "assets/video",
        "assets/textures",
    ];

    // Only scan to a reasonable depth (avoid extreme recursion)
    const MAX_DEPTH: usize = 8;

    // File extensions to check for (executable and Steam API files)
    let exe_extensions = ["exe", "bat", "cmd", "msi"];
    let binary_extensions = ["so", "bin", "sh", "x86", "x86_64"];

    // Recursively walk through the game directory
    for entry in WalkDir::new(game_path)
        .max_depth(MAX_DEPTH) // Limit depth to avoid traversing too deep
        .follow_links(false) // Don't follow symlinks to prevent cycles
        .into_iter()
        .filter_entry(|e| {
            // Skip certain directories for performance
            if e.file_type().is_dir() {
                let file_name = e.file_name().to_string_lossy().to_lowercase();
                if skip_dirs.iter().any(|&dir| file_name == dir) {
                    debug!("Skipping directory: {}", e.path().display());
                    return false;
                }
            }
            true
        })
        .filter_map(Result::ok)
    {
        let path = entry.path();
        if !path.is_file() {
            continue;
        }

        // Check file extension
        if let Some(ext) = path.extension() {
            let ext_str = ext.to_string_lossy().to_lowercase();

            // Check for Windows executables
            if exe_extensions.iter().any(|&e| ext_str == e) {
                found_exe = true;
            }

            // Check for Steam API DLLs
            if ext_str == "dll" {
                let filename = path
                    .file_name()
                    .unwrap_or_default()
                    .to_string_lossy()
                    .to_lowercase();
                if filename == "steam_api.dll" || filename == "steam_api64.dll" {
                    if let Ok(rel_path) = path.strip_prefix(game_path) {
                        let rel_path_str = rel_path.to_string_lossy().to_string();
                        debug!("Found Steam API DLL: {}", rel_path_str);
                        steam_api_files.push(rel_path_str);
                    }
                }
            }

            // Check for Linux binary files
            if binary_extensions.iter().any(|&e| ext_str == e) {
                found_linux_binary = true;

                // Check if it's actually an ELF binary for more certainty
                if ext_str == "so" && is_elf_binary(path) {
                    found_linux_binary = true;
                }
            }
        }

        // Check for Linux executables (no extension)
        #[cfg(unix)]
        if !path.extension().is_some() {
            use std::os::unix::fs::PermissionsExt;

            if let Ok(metadata) = path.metadata() {
                let is_executable = metadata.permissions().mode() & 0o111 != 0;

                // Check executable permission and ELF format
                if is_executable && is_elf_binary(path) {
                    found_linux_binary = true;
                }
            }
        }

        // If we've found enough evidence for both platforms and Steam API DLLs, we can stop
        if found_exe && found_linux_binary && !steam_api_files.is_empty() {
            debug!("Found sufficient evidence, breaking scan early");
            break;
        }
    }

    // A game is considered native if it has Linux binaries but no Windows executables
    let is_native = found_linux_binary && !found_exe;

    debug!(
        "Game scan results: native={}, exe={}, api_dlls={}",
        is_native,
        found_exe,
        steam_api_files.len()
    );
    (is_native, steam_api_files)
}

// Find all installed Steam games from library folders
pub async fn find_installed_games(steamapps_paths: &[PathBuf]) -> Vec<GameInfo> {
    let mut games = Vec::new();
    let seen_ids = Arc::new(tokio::sync::Mutex::new(HashSet::new()));

    // IDs to skip (tools, redistributables, etc.)
    let skip_ids = Arc::new(
        [
            "228980",  // Steamworks Common Redistributables
            "1070560", // Steam Linux Runtime
            "1391110", // Steam Linux Runtime - Soldier
            "1628350", // Steam Linux Runtime - Sniper
            "1493710", // Proton Experimental
            "2180100", // Steam Linux Runtime - Scout
        ]
        .iter()
        .copied()
        .collect::<HashSet<&str>>(),
    );

    // Name patterns to skip (case insensitive)
    let skip_patterns = Arc::new(
        [
            r"(?i)steam linux runtime",
            r"(?i)proton",
            r"(?i)steamworks common",
            r"(?i)redistributable",
            r"(?i)dotnet",
            r"(?i)vc redist",
        ]
        .iter()
        .map(|pat| Regex::new(pat).unwrap())
        .collect::<Vec<_>>(),
    );

    info!("Scanning for installed games in parallel...");

    // Create a channel to collect results
    let (tx, mut rx) = mpsc::channel(32);

    // First collect all appmanifest files to process
    let mut app_manifests = Vec::new();
    for steamapps_dir in steamapps_paths {
        if let Ok(entries) = fs::read_dir(steamapps_dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                let filename = path.file_name().unwrap_or_default().to_string_lossy();

                // Check for appmanifest files
                if filename.starts_with("appmanifest_") && filename.ends_with(".acf") {
                    app_manifests.push((path, steamapps_dir.clone()));
                }
            }
        }
    }

    info!("Found {} appmanifest files to process", app_manifests.len());

    // Process appmanifest files
    let max_concurrent = num_cpus::get().max(1).min(8); // Use between 1 and 8 CPU cores
    info!("Using {} concurrent scanners", max_concurrent);

    // Use a semaphore to limit concurrency
    let semaphore = Arc::new(tokio::sync::Semaphore::new(max_concurrent));

    // Create a Vec to store all our task handles
    let mut handles = Vec::new();

    // Process each manifest file
    for (manifest_idx, (path, steamapps_dir)) in app_manifests.iter().enumerate() {
        // Clone what we need for the task
        let path = path.clone();
        let steamapps_dir = steamapps_dir.clone();
        let skip_patterns = Arc::clone(&skip_patterns);
        let tx = tx.clone();
        let seen_ids = Arc::clone(&seen_ids);
        let semaphore = Arc::clone(&semaphore);
        let skip_ids = Arc::clone(&skip_ids);

        // Create a new task
        let handle = tokio::spawn(async move {
            // Acquire a permit from the semaphore
            let _permit = semaphore.acquire().await.unwrap();

            // Parse the appmanifest file
            if let Some((id, name, install_dir)) = parse_appmanifest(&path) {
                // Skip if in exclusion list
                if skip_ids.contains(id.as_str()) {
                    return;
                }

                // Add a guard against duplicates
                {
                    let mut seen = seen_ids.lock().await;
                    if seen.contains(&id) {
                        return;
                    }
                    seen.insert(id.clone());
                }

                // Skip if the name matches any exclusion patterns
                if skip_patterns.iter().any(|re| re.is_match(&name)) {
                    debug!("Skipping runtime/tool: {} ({})", name, id);
                    return;
                }

                // Full path to the game directory
                let game_path = steamapps_dir.join("common").join(&install_dir);

                // Skip if game directory doesn't exist
                if !game_path.exists() {
                    warn!("Game directory not found: {}", game_path.display());
                    return;
                }

                // Scan the game directory to determine platform and find Steam API DLLs
                info!("Scanning game: {} at {}", name, game_path.display());

                // Scanning is I/O heavy but not CPU heavy, so we can just do it directly
                let (is_native, api_files) = scan_game_directory(&game_path);

                // Check for CreamLinux installation
                let cream_installed = check_creamlinux_installed(&game_path);

                // Check for SmokeAPI installation (only for non-native games with Steam API DLLs)
                let smoke_installed = if !is_native && !api_files.is_empty() {
                    check_smokeapi_installed(&game_path, &api_files)
                } else {
                    false
                };

                // Create the game info
                let game_info = GameInfo {
                    id,
                    title: name,
                    path: game_path,
                    native: is_native,
                    api_files,
                    cream_installed,
                    smoke_installed,
                };

                // Send the game info through the channel
                if tx.send(game_info).await.is_err() {
                    error!("Failed to send game info through channel");
                }
            }
        });

        handles.push(handle);

        // Every 10 files, yield to allow progress updates
        if manifest_idx % 10 == 0 {
            // We would update progress here in a full implementation
            tokio::task::yield_now().await;
        }
    }

    // Drop the original sender so the receiver knows when we're done
    drop(tx);

    // Spawn a task to collect all the results
    let receiver_task = tokio::spawn(async move {
        let mut results = Vec::new();
        while let Some(game) = rx.recv().await {
            info!("Found game: {} ({})", game.title, game.id);
            info!("   Path: {}", game.path.display());
            info!(
                "   Status: Native={}, Cream={}, Smoke={}",
                game.native, game.cream_installed, game.smoke_installed
            );

            // Log Steam API DLLs if any
            if !game.api_files.is_empty() {
                info!("   Steam API files:");
                for api_file in &game.api_files {
                    info!("     - {}", api_file);
                }
            }

            results.push(game);
        }
        results
    });

    // Wait for all scan tasks to complete but don't wait for the results yet
    for handle in handles {
        // Ignore errors the receiver task will just get fewer results
        let _ = handle.await;
    }

    // Now wait for all results to be collected
    if let Ok(results) = receiver_task.await {
        games = results;
    }

    info!("Found {} installed games", games.len());
    games
}
