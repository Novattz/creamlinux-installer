use serde::Serialize;
use std::fs;
use std::process::Command;

// Basic host info shown on the Overview page, purely informational.
#[derive(Debug, Clone, Serialize)]
pub struct SystemInfo {
    pub os_name: String,
    pub cpu_model: String,
    pub cpu_cores: usize,
    pub gpu_name: String,
}

fn read_os_name() -> String {
    if let Ok(contents) = fs::read_to_string("/etc/os-release") {
        for line in contents.lines() {
            if let Some(value) = line.strip_prefix("PRETTY_NAME=") {
                return value.trim_matches('"').to_string();
            }
        }
    }
    format!("{} (unknown distro)", std::env::consts::OS)
}

fn read_cpu_model() -> String {
    if let Ok(contents) = fs::read_to_string("/proc/cpuinfo") {
        for line in contents.lines() {
            if let Some((key, value)) = line.split_once(':') {
                if key.trim() == "model name" {
                    return value.trim().to_string();
                }
            }
        }
    }
    "Unknown CPU".to_string()
}

// This can't tell *which* SKU in that family you actually have (lspci
// doesn't expose that either) so it's a best guess, not a precise model.
fn simplify_gpu_name(raw: &str) -> String {
    let without_rev = raw.split(" (rev").next().unwrap_or(raw).trim();

    // The marketing name is almost always the last bracketed group.
    let brackets: Vec<&str> = without_rev
        .split('[')
        .skip(1)
        .filter_map(|s| s.split(']').next())
        .collect();

    let model = brackets
        .last()
        .and_then(|group| group.split('/').next())
        .unwrap_or(without_rev)
        .trim();

    let vendor = if without_rev.contains("NVIDIA") {
        Some("NVIDIA")
    } else if without_rev.contains("AMD") || without_rev.contains("ATI") {
        Some("AMD")
    } else if without_rev.contains("Intel") {
        Some("Intel")
    } else {
        None
    };

    match vendor {
        Some(v) if !model.to_uppercase().contains(&v.to_uppercase()) => format!("{} {}", v, model),
        _ => model.to_string(),
    }
}

// Best-effort: parse `lspci` for the primary display controller. Not every
// system has `lspci` (minimal containers, some distros), so this degrades
// to "Unknown GPU" instead of failing the whole system-info fetch.
fn read_gpu_name() -> String {
    let output = match Command::new("lspci").output() {
        Ok(output) if output.status.success() => output,
        _ => return "Unknown GPU".to_string(),
    };

    let stdout = String::from_utf8_lossy(&output.stdout);
    for line in stdout.lines() {
        if line.contains("VGA compatible controller") || line.contains("3D controller") {
            if let Some((_, rest)) = line.split_once(": ") {
                return simplify_gpu_name(rest.trim());
            }
        }
    }
    "Unknown GPU".to_string()
}

pub fn get_system_info() -> SystemInfo {
    SystemInfo {
        os_name: read_os_name(),
        cpu_model: read_cpu_model(),
        cpu_cores: num_cpus::get(),
        gpu_name: read_gpu_name(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn simplifies_amd_gpu_names() {
        assert_eq!(
            simplify_gpu_name(
                "Advanced Micro Devices, Inc. [AMD/ATI] Navi 33 [Radeon RX 7600/7600 XT/7600M XT/7600S/7700S / PRO W7600] (rev cf)"
            ),
            "AMD Radeon RX 7600"
        );
    }

    #[test]
    fn simplifies_nvidia_gpu_names() {
        assert_eq!(
            simplify_gpu_name("NVIDIA Corporation GA104 [GeForce RTX 3070/3070 Ti] (rev a1)"),
            "NVIDIA GeForce RTX 3070"
        );
    }

    #[test]
    fn simplifies_intel_gpu_names() {
        assert_eq!(
            simplify_gpu_name("Intel Corporation TigerLake-LP GT2 [Iris Xe Graphics] (rev 01)"),
            "Intel Iris Xe Graphics"
        );
    }
}
