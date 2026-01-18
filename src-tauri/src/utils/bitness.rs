use log::{debug, info, warn};
use std::fs;
use std::path::Path;
use walkdir::WalkDir;

/// Represents the bitness of a binary
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Bitness {
    Bit32,
    Bit64,
}

/// Detect the bitness of a Linux Binary by reading ELF header
/// ELF format: https://en.wikipedia.org/wiki/Executable_and_Linkable_Format
fn detect_binary_bitness(file_path: &Path) -> Option<Bitness> {
    use std::io::Read;

    // Only read first 5 bytes
    let mut file = fs::File::open(file_path).ok()?;
    let mut bytes = [0u8; 5];

    // Read exactly 5 bytes or fail
    if file.read_exact(&mut bytes).is_err() {
        return None;
    }

    // Check for ELF magic number (0x7F 'E' 'L' 'F')
    if &bytes[0..4] != b"\x7FELF" {
        return None;
    }

    // Byte 4 (EI_CLASS) indicates 32-bit or 64-bit
    // 1 = ELFCLASS32 (32-bit)
    // 2 = ELFCLASS64 (64-bit)
    match bytes[4] {
        1 => Some(Bitness::Bit32),
        2 => Some(Bitness::Bit64),
        _ => None,
    }
}

/// Scan game directory for Linux binaries and determine bitness
/// Returns the detected bitness, prioritizing the main game executable
pub fn detect_game_bitness(game_path: &str) -> Result<Bitness, String> {
    info!("Detecting bitness for game at: {}", game_path);

    let game_path_obj = Path::new(game_path);
    if !game_path_obj.exists() {
        return Err("Game path does not exist".to_string());
    }

    // Directories to skip for performance
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
        "assets",
        "_CommonRedist",
        "data",
        "Data",
        "Docs",
        "docs",
        "screenshots",
        "Screenshots",
        "saves",
        "Saves",
        "mods",
        "Mods",
        "maps",
        "Maps",
    ];

    // Limit scan depth to avoid deep recursion
    const MAX_DEPTH: usize = 3;

    // Stop after finding reasonable confidence (10 binaries)
    const CONFIDENCE_THRESHOLD: usize = 10;

    let mut bit64_binaries = Vec::new();
    let mut bit32_binaries = Vec::new();

    #[cfg(unix)]
    use std::os::unix::fs::PermissionsExt;

    // Scan for Linux binaries
    for entry in WalkDir::new(game_path_obj)
        .max_depth(MAX_DEPTH)
        .follow_links(false)
        .into_iter()
        .filter_entry(|e| {
            if e.file_type().is_dir() {
                let dir_name = e.file_name().to_string_lossy().to_lowercase();
                !skip_dirs.iter().any(|&skip| dir_name.contains(skip))
            } else {
                true
            }
        })
        .filter_map(Result::ok)
    {
        // Early termination when we have high confidence
        if bit64_binaries.len() >= CONFIDENCE_THRESHOLD || bit32_binaries.len() >= CONFIDENCE_THRESHOLD {
            debug!("Reached confidence threshold, stopping scan early");
            break;
        }

        let path = entry.path();

        // Only check files
        if !path.is_file() {
            continue;
        }

        // Skip non-binary files early for performance
        let filename = path.file_name().unwrap_or_default().to_string_lossy();
        
        // Check for common Linux executable extensions or shared libraries
        let has_binary_extension = filename.ends_with(".x86")
            || filename.ends_with(".x86_64")
            || filename.ends_with(".bin")
            || filename.ends_with(".so")
            || filename.contains(".so.")
            || filename.starts_with("lib");

        // Check if file is executable
        let is_executable = {
            {
                // Get metadata once and check both extension and permissions
                if let Ok(metadata) = fs::metadata(path) {
                    let permissions = metadata.permissions();
                    let executable = permissions.mode() & 0o111 != 0;

                    // Skip files that are neither executable nor have binary extensions
                    executable || has_binary_extension
                } else {
                    // If we can't read metadata, only proceed if it has binary extension
                    has_binary_extension
                }
            }
        };

        if !is_executable {
            continue;
        }

        // Detect bitness
        if let Some(bitness) = detect_binary_bitness(path) {
            debug!("Found {:?} binary: {}", bitness, path.display());

            match bitness {
                Bitness::Bit64 => {
                    bit64_binaries.push(path.to_path_buf());

                    // If we find libsteam_api.so and it's 64-bit, we can be very confident
                    if filename == "libsteam_api.so" {
                        info!("Found 64-bit libsteam_api.so");
                        return Ok(Bitness::Bit64);
                    }
                },
                Bitness::Bit32 => {
                    bit32_binaries.push(path.to_path_buf());

                    // If we find libsteam_api.so and it's 32-bit, we can be very confident
                    if filename == "libsteam_api.so" {
                        info!("Found 32-bit libsteam_api.so");
                        return Ok(Bitness::Bit32);
                    }
                },
            }
        }
    }

    // Decision logic: prioritize finding the main game executable
    // 1. If we found any 64-bit binaries and no 32-bit, it's 64-bit
    // 2. If we found any 32-bit binaries and no 64-bit, it's 32-bit
    // 3. If we found both, prefer 64-bit (modern games are usually 64-bit)
    // 4. If we found neither, return an error

    if !bit64_binaries.is_empty() && bit32_binaries.is_empty() {
        info!("Detected 64-bit game (Only 64-bit binaries found)");
        Ok(Bitness::Bit64)
    } else if !bit32_binaries.is_empty() && bit64_binaries.is_empty() {
        info!("Detected 32-bit game (Only 32-bit binaries found)");
        Ok(Bitness::Bit32)
    } else if !bit64_binaries.is_empty() && !bit32_binaries.is_empty() {
        warn!(
            "Found both 32-bit and 64-bit binaries, defaulting to 64-bit. 32-bit: {}, 64-bit: {}",
            bit32_binaries.len(),
            bit64_binaries.len()
        );
        info!("Detected 64-bit game (mixed binaries, defaulting to 64-bit)");
        Ok(Bitness::Bit64)
    } else {
        Err("Could not detect game bitness: no Linux binaries found".to_string())
    }
}