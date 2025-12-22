// This module contains helper functions for file operations during installation

use std::fs;
use std::io;
use std::path::Path;

// Copy a file with backup
#[allow(dead_code)]
pub fn copy_with_backup(src: &Path, dest: &Path) -> io::Result<()> {
    // If destination exists, create a backup
    if dest.exists() {
        let backup = dest.with_extension("bak");
        fs::copy(dest, &backup)?;
    }

    fs::copy(src, dest)?;
    Ok(())
}

// Safely remove a file (doesn't error if it doesn't exist)
#[allow(dead_code)]
pub fn safe_remove(path: &Path) -> io::Result<()> {
    if path.exists() {
        fs::remove_file(path)?;
    }
    Ok(())
}

// Make a file executable (Unix only)
#[cfg(unix)]
#[allow(dead_code)]
pub fn make_executable(path: &Path) -> io::Result<()> {
    use std::os::unix::fs::PermissionsExt;

    let mut perms = fs::metadata(path)?.permissions();
    perms.set_mode(0o755);
    fs::set_permissions(path, perms)?;
    Ok(())
}

#[cfg(not(unix))]
pub fn make_executable(_path: &Path) -> io::Result<()> {
    Ok(())
}