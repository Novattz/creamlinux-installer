# Steam DLC Fetcher and installer for Linux

- A user-friendly tool for managing DLC for Steam games on Linux systems.

[Demo/Tutorial](https://www.youtube.com/watch?v=Y1E15rUsdDw) - [OUTDATED]

## Preview

![ss-20250122-135304](https://github.com/user-attachments/assets/899ff1dd-0c4b-4d95-bea5-77e8af0e3c90)

### Features

- Automatic Steam library detection
- Support for Linux and Proton
- Automatic updates (Soon)
- DLC detection and installation

### Prerequisites

- Python 3.7 or higher
- requests
- rich
- argparse
- json

### Nix Installation

#### Option 1: Run directly with `nix run`

```bash
nix run github:Novattz/creamlinux-installer
```

#### Option 2: Add the package to your NixOS flake configuration

Add the repository to your flake inputs (flake.nix)

```nix
inputs = {
  creamlinux = {
    url = "github:Novattz/creamlinux-installer";
    inputs.nixpkgs.follows = "nixpkgs";
  };
}
```

The package will then be available under

```nix
inputs.creamlinux.packages.${pkgs.system}.default
```

This can be added to your `environment.systemPackages` (for system-wide) or
`home.packages` (for home-manager). The binary `creamlinux` will then be
available.

### Installation (for non-Nix users)

- Clone the repo.
- Navigate to the directory containing the script.
- Run the script using python:

```bash
python main.py
```

### Basic Usage

- `--manual <path>`: Specify steam library path manually

```bash
python main.py --manual "/path/to/steamapps"
```

- `--debug`: Enable debug logging

```bash
python main.py --debug
```

### Issues?

- Open a issue and attach all relevant errors/logs.

## Credits

- [Creamlinux](https://github.com/anticitizn/creamlinux) by anticitizn
- [SmokeAPI](https://github.com/acidicoala/SmokeAPI) by acidicoala
