/// PE import scanner for finding a suitable Koaloader proxy DLL.
/// scan ALL PE files (exe + dll) in the executable's directory 
/// and collect every import that matches a Koaloader proxy variant.
use log::{info, warn};
use std::fs;
use std::io::Read;
use std::path::{Path, PathBuf};

/// All DLL names Koaloader can proxy as, ordered by preference.
/// Common system DLLs that games almost always load come first.
pub const KOA_VARIANTS: &[&str] = &[
    "version.dll",
    "winmm.dll",
    "winhttp.dll",
    "iphlpapi.dll",
    "dinput8.dll",
    "d3d11.dll",
    "dxgi.dll",
    "d3d9.dll",
    "d3d10.dll",
    "dwmapi.dll",
    "hid.dll",
    "msimg32.dll",
    "mswsock.dll",
    "opengl32.dll",
    "profapi.dll",
    "propsys.dll",
    "textshaping.dll",
    "glu32.dll",
    "audioses.dll",
    "msasn1.dll",
    "wldp.dll",
    "xinput9_1_0.dll",
];

/// Proxies Proton already replaces with DXVK, a Koaloader copy of these is a bad idea
pub const PROTON_SKIP_PROXIES: &[&str] = &["d3d9.dll", "d3d10.dll", "d3d11.dll", "dxgi.dll"];

/// Result of a proxy scan. Which proxy was chosen and whether it was a
/// direct match or a fallback.
pub struct ProxyScanResult {
    pub proxy_name: String,
    pub is_fallback: bool,
}

/// Scan all PE files in the exe's directory (both .exe and .dll, exactly like
/// the Python script) and return the best Koaloader proxy to use.
///
/// Priority:
///   1. Variants imported by the main exe itself
///   2. Variants imported by any other PE file in the same directory
///   3. Fallback to version.dll with is_fallback = true
///
/// Names in `exclude` are never picked.
pub fn find_best_proxy(exe_path: &Path, exclude: &[&str]) -> ProxyScanResult {
    let exe_dir = match exe_path.parent() {
        Some(d) => d,
        None => {
            warn!("Could not get exe directory, falling back to version.dll");
            return ProxyScanResult { proxy_name: "version.dll".to_string(), is_fallback: true };
        }
    };

    // Collect all PE files in the directory (.exe and .dll)
    let all_pe_files: Vec<PathBuf> = match fs::read_dir(exe_dir) {
        Ok(entries) => entries
            .filter_map(|e| e.ok())
            .map(|e| e.path())
            .filter(|p| {
                p.is_file() && p.extension()
                    .and_then(|e| e.to_str())
                    .map(|e| e.eq_ignore_ascii_case("exe") || e.eq_ignore_ascii_case("dll"))
                    .unwrap_or(false)
            })
            .filter(|p| is_pe_file(p))
            .collect(),
        Err(e) => {
            warn!("Could not read exe directory: {}, falling back to version.dll", e);
            return ProxyScanResult { proxy_name: "version.dll".to_string(), is_fallback: true };
        }
    };

    info!(
        "Scanning {} PE files in: {}",
        all_pe_files.len(),
        exe_dir.display()
    );

    // Build two import sets: main exe and everything else
    let exe_name = exe_path.file_name().unwrap_or_default();
    let mut exe_imports: std::collections::HashSet<String> = std::collections::HashSet::new();
    let mut other_imports: std::collections::HashSet<String> = std::collections::HashSet::new();

    for pe_path in &all_pe_files {
        let imports = get_pe_imports(pe_path);
        if pe_path.file_name().unwrap_or_default() == exe_name {
            info!(
                "  {} (main exe): {} imports",
                pe_path.file_name().unwrap_or_default().to_string_lossy(),
                imports.len()
            );
            for imp in imports { exe_imports.insert(imp); }
        } else {
            info!(
                "  {}: {} imports",
                pe_path.file_name().unwrap_or_default().to_string_lossy(),
                imports.len()
            );
            for imp in imports { other_imports.insert(imp); }
        }
    }

    // Pass 1: prefer a variant the main exe itself imports
    let variants: Vec<&str> = KOA_VARIANTS
        .iter()
        .copied()
        .filter(|v| !exclude.contains(v))
        .collect();

    for &variant in &variants {
        if exe_imports.contains(variant) {
            info!("Best proxy (main exe imports): {}", variant);
            return ProxyScanResult { proxy_name: variant.to_string(), is_fallback: false };
        }
    }

    // Pass 2: fall back to a variant imported by any other PE in the directory
    for &variant in &variants {
        if other_imports.contains(variant) {
            info!("Best proxy (sibling PE imports): {}", variant);
            return ProxyScanResult { proxy_name: variant.to_string(), is_fallback: false };
        }
    }

    // No match at all, use the first allowed variant (version.dll unless excluded)
    // and flag it so the caller can warn the user
    let fallback = variants.first().copied().unwrap_or("version.dll");
    warn!(
        "No Koaloader-compatible import found in {} PE files, falling back to {}",
        all_pe_files.len(),
        fallback
    );
    ProxyScanResult { proxy_name: fallback.to_string(), is_fallback: true }
}

/// Best guess at the real game exe of a Steam game.
/// Order: exe that imports steam_api, Unreal *-Shipping.exe, the exe Steam launches,
/// then the biggest exe. `launch_exe` is the path from the Steam launch config.
pub fn find_steam_exe(game_path: &Path, launch_exe: Option<&str>) -> Option<PathBuf> {
    const SKIP: &[&str] = &[
        "unins", "crash", "redist", "vc_", "dxsetup", "dotnet", "prereq", "setup",
        "easyanticheat", "battleye", "report",
    ];

    let exes: Vec<(PathBuf, u64)> = walkdir::WalkDir::new(game_path)
        .max_depth(8)
        .into_iter()
        .filter_map(Result::ok)
        .map(|e| e.into_path())
        .filter(|p| {
            p.is_file()
                && p.extension()
                    .and_then(|e| e.to_str())
                    .map(|e| e.eq_ignore_ascii_case("exe"))
                    .unwrap_or(false)
        })
        .filter(|p| {
            let name = p.file_name().unwrap_or_default().to_string_lossy().to_lowercase();
            !SKIP.iter().any(|s| name.contains(s))
        })
        .filter(|p| is_pe_file(p))
        .map(|p| {
            let size = fs::metadata(&p).map(|m| m.len()).unwrap_or(0);
            (p, size)
        })
        .collect();

    if exes.is_empty() {
        warn!("No game exe found in {}", game_path.display());
        return None;
    }

    let biggest = |list: Vec<&(PathBuf, u64)>| -> Option<PathBuf> {
        list.into_iter().max_by_key(|(_, size)| *size).map(|(p, _)| p.clone())
    };

    let imports_steam: Vec<_> = exes
        .iter()
        .filter(|(p, _)| {
            get_pe_imports(p)
                .iter()
                .any(|i| i == "steam_api64.dll" || i == "steam_api.dll")
        })
        .collect();
    if let Some(exe) = biggest(imports_steam) {
        info!("Game exe (imports steam_api): {}", exe.display());
        return Some(exe);
    }

    let shipping: Vec<_> = exes
        .iter()
        .filter(|(p, _)| {
            p.file_name()
                .unwrap_or_default()
                .to_string_lossy()
                .to_lowercase()
                .ends_with("-shipping.exe")
        })
        .collect();
    if let Some(exe) = biggest(shipping) {
        info!("Game exe (Unreal shipping exe): {}", exe.display());
        return Some(exe);
    }

    if let Some(launch) = launch_exe {
        let wanted = launch.replace('\\', "/").to_lowercase();
        let found = exes.iter().find(|(p, _)| {
            p.strip_prefix(game_path)
                .map(|rel| rel.to_string_lossy().to_lowercase() == wanted)
                .unwrap_or(false)
        });
        if let Some((exe, _)) = found {
            info!("Game exe (Steam launch config): {}", exe.display());
            return Some(exe.clone());
        }
    }

    let exe = biggest(exes.iter().collect());
    if let Some(exe) = &exe {
        info!("Game exe (biggest exe): {}", exe.display());
    }
    exe
}

/// Detect if a Windows PE executable is 64-bit.
/// Returns true for AMD64, false for i386. Defaults to true on parse failure.
pub fn is_64bit_exe(path: &Path) -> bool {
    let data = match fs::read(path) {
        Ok(d) => d,
        Err(_) => return true,
    };

    if data.len() < 0x40 || &data[0..2] != b"MZ" {
        return true;
    }

    let e_lfanew =
        u32::from_le_bytes(data[0x3C..0x40].try_into().unwrap_or([0; 4])) as usize;

    if e_lfanew + 6 > data.len() || &data[e_lfanew..e_lfanew + 4] != b"PE\0\0" {
        return true;
    }

    // 0x8664 = AMD64 (64-bit), 0x014C = i386 (32-bit)
    let machine = u16::from_le_bytes(
        data[e_lfanew + 4..e_lfanew + 6].try_into().unwrap_or([0; 2]),
    );

    machine != 0x014C
}

// Internal helpers

fn is_pe_file(path: &Path) -> bool {
    let mut file = match fs::File::open(path) {
        Ok(f) => f,
        Err(_) => return false,
    };
    let mut magic = [0u8; 2];
    file.read_exact(&mut magic).unwrap_or(());
    magic == [0x4D, 0x5A] // "MZ"
}

pub fn get_pe_imports(path: &Path) -> Vec<String> {
    match parse_pe_imports(path) {
        Ok(imports) => imports,
        Err(e) => {
            warn!("Failed to parse PE imports for {}: {}", path.display(), e);
            Vec::new()
        }
    }
}

fn parse_pe_imports(path: &Path) -> std::io::Result<Vec<String>> {
    let mut f = fs::File::open(path)?;
    let mut buf = Vec::new();
    f.read_to_end(&mut buf)?;

    let data = &buf;

    if data.len() < 0x40 || &data[0..2] != b"MZ" {
        return Ok(Vec::new());
    }

    let e_lfanew =
        u32::from_le_bytes(data[0x3C..0x40].try_into().unwrap_or([0; 4])) as usize;
    if e_lfanew + 4 > data.len() || &data[e_lfanew..e_lfanew + 4] != b"PE\0\0" {
        return Ok(Vec::new());
    }

    let coff_offset = e_lfanew + 4;
    if coff_offset + 20 > data.len() {
        return Ok(Vec::new());
    }

    let opt_header_size =
        u16::from_le_bytes(data[coff_offset + 16..coff_offset + 18].try_into().unwrap()) as usize;
    let opt_offset = coff_offset + 20;
    if opt_header_size < 4 || opt_offset + opt_header_size > data.len() {
        return Ok(Vec::new());
    }

    // Magic: 0x10B = PE32, 0x20B = PE32+
    let magic = u16::from_le_bytes(data[opt_offset..opt_offset + 2].try_into().unwrap());
    let is_pe32_plus = magic == 0x20B;

    let data_dir_offset = if is_pe32_plus { opt_offset + 112 } else { opt_offset + 96 };
    if data_dir_offset + 8 > data.len() {
        return Ok(Vec::new());
    }

    let import_rva =
        u32::from_le_bytes(data[data_dir_offset..data_dir_offset + 4].try_into().unwrap())
            as usize;
    let import_size =
        u32::from_le_bytes(data[data_dir_offset + 4..data_dir_offset + 8].try_into().unwrap())
            as usize;

    if import_rva == 0 || import_size == 0 {
        return Ok(Vec::new());
    }

    let sections_offset = opt_offset + opt_header_size;
    let num_sections =
        u16::from_le_bytes(data[coff_offset + 2..coff_offset + 4].try_into().unwrap()) as usize;

    let rva_to_offset = |rva: usize| -> Option<usize> {
        for i in 0..num_sections {
            let sec = sections_offset + i * 40;
            if sec + 40 > data.len() { break; }
            let virt_addr =
                u32::from_le_bytes(data[sec + 12..sec + 16].try_into().unwrap()) as usize;
            let raw_size =
                u32::from_le_bytes(data[sec + 16..sec + 20].try_into().unwrap()) as usize;
            let raw_offset =
                u32::from_le_bytes(data[sec + 20..sec + 24].try_into().unwrap()) as usize;
            if rva >= virt_addr && rva < virt_addr + raw_size {
                return Some(raw_offset + (rva - virt_addr));
            }
        }
        None
    };

    let import_file_offset = match rva_to_offset(import_rva) {
        Some(o) => o,
        None => return Ok(Vec::new()),
    };

    let mut imports = Vec::new();
    let mut entry_offset = import_file_offset;

    loop {
        if entry_offset + 20 > data.len() { break; }

        let name_rva =
            u32::from_le_bytes(data[entry_offset + 12..entry_offset + 16].try_into().unwrap())
                as usize;

        if name_rva == 0 { break; }

        if let Some(name_offset) = rva_to_offset(name_rva) {
            let end = data[name_offset..]
                .iter()
                .position(|&b| b == 0)
                .map(|n| name_offset + n)
                .unwrap_or(data.len());

            if let Ok(name) = std::str::from_utf8(&data[name_offset..end]) {
                let trimmed = name.trim();
                if !trimmed.is_empty() {
                    imports.push(trimmed.to_lowercase());
                }
            }
        }

        entry_offset += 20;
    }

    Ok(imports)
}
