# CreamLinux

CreamLinux is a GUI application for Linux that simplifies the management of DLC IDs in Steam games. It provides a user-friendly interface to install and configure CreamAPI (for native Linux games), SmokeAPI (for Windows games running through Proton) and ScreamAPI (Epic Games).

## Watch the demo here:

[![Watch the demo](./src/assets/screenshot1.png)](https://www.youtube.com/watch?v=neUDotrqnDM)

## Features

- **Auto-discovery**: Automatically finds Steam games installed on your system
- **Native support**: Installs CreamLinux for native Linux games
- **Proton support**: Installs SmokeAPI for Windows games running through Proton
- **Epic Games support**: Installs ScreamAPI for games running through Heroic/Legendary
- **DLC management**: Easily select which DLCs to enable
- **Modern UI**: Clean, responsive interface that's easy to use

## Installation

### AppImage (Recommended)

1. Download the latest `creamlinux.AppImage` from the [Releases](https://github.com/Novattz/creamlinux-installer/releases) page
2. Make it executable:
   ```bash
   chmod +x creamlinux.AppImage
   ```
3. Run it:

   ```bash
   ./creamlinux.AppImage
   ```

   For Nvidia users use this command:

   ```
   WEBKIT_DISABLE_DMABUF_RENDERER=1 ./creamlinux.AppImage
   ```

### Nix
You can add this package to your configuration using `pkgs.fetchFromGitHub`:
```nix
let
  creamlinux = import (pkgs.fetchFromGitHub {
    owner = "Novattz";
    repo = "creamlinux-installer";
    rev = "main"; # replace with a commit hash to pin the version
    hash = ""; # paste the value returned by the error your rebuild will output
  }) { inherit pkgs; };
in
{
  environment.systemPackages = [ creamlinux ];
}
```
or, using `builtins.fetchTarball`:
```nix
let
  creamlinux = import (builtins.fetchTarball {
    url = "https://github.com/Novattz/creamlinux-installer/archive/main.tar.gz";
    sha256 = ""; # See above
  }) { inherit pkgs; };
in
{
  environment.systemPackages = [ creamlinux ];
}
```
alternatively and if you want to pin the package version, using [npins](https://github.com/andir/npins):
```bash
npins add github Novattz creamlinux-installer --branch main
```
```nix
let
  sources = import ./npins;
in
{
  environment.systemPackages = [
    (import sources.creamlinux-installer { inherit pkgs; })
  ];
}
```
Those are the recommended methods to add creamlinux-installer to your environment. However, you could also add it as an input of your flake, like so:
```nix
{
  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    creamlinux-installer = {
      type = "github";
      owner = "Novattz";
      repo = "creamlinux-installer";
      flake = false;
    };
  };
}
```
Then, in your configuration:
```nix
environment.systemPackages = [
  (import inputs.creamlinux-installer { inherit pkgs; })
];
```
Similarly to running the AppImage, you will need to set `WEBKIT_DISABLE_DMABUF_RENDERER=1` if your GPU is from Nvidia in order to run the package.

### Building from Source

#### Prerequisites

- [Rust](https://rustup.rs/) — `src-tauri/Cargo.toml` declares `rust-version = "1.77.2"`, but the locked dependency tree in `src-tauri/Cargo.lock` currently requires **Rust 1.88 or newer**. Install a current stable toolchain via `rustup` to be safe.
- Node.js 18 or later
- npm or yarn
- Tauri v2 system dependencies (see below)

If you don't have Rust installed yet, `rustup` installs it without root privileges:

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source "$HOME/.cargo/env"
```

##### System dependencies

<details>
<summary>Arch Linux / CachyOS / Manjaro</summary>

```bash
sudo pacman -S --needed base-devel curl wget file openssl gtk3 webkit2gtk-4.1 libsoup3 librsvg
```

</details>

<details>
<summary>Debian / Ubuntu</summary>

```bash
sudo apt install build-essential curl wget file libssl-dev libgtk-3-dev \
  libwebkit2gtk-4.1-dev libsoup-3.0-dev librsvg2-dev
```

</details>

For other distributions, see the [Tauri prerequisites](https://tauri.app/start/prerequisites/) and look for the **webkit2gtk-4.1** / **libsoup-3.0** packages.

#### Steps

1. Clone the repository:

   ```bash
   git clone https://github.com/Novattz/creamlinux-installer.git
   cd creamlinux-installer
   ```

2. Install dependencies:

   ```bash
   npm install # or yarn
   ```

3. Build the application:

   ```bash
   NO_STRIP=true npm run tauri build
   ```

   > **Note:** `src-tauri/tauri.conf.json` sets `bundle.createUpdaterArtifacts` to `true`, which requires the private key used for release signing. Without `TAURI_SIGNING_PRIVATE_KEY` the build still produces the binary and all bundles, but exits with:
   >
   > ```
   > A public key has been found, but no private key. Make sure to set `TAURI_SIGNING_PRIVATE_KEY` environment variable.
   > ```
   >
   > That is expected for a local build. To finish without a signing key, disable updater artifacts for that run:
   >
   > ```bash
   > NO_STRIP=true npm run tauri build -- --config '{"bundle":{"createUpdaterArtifacts":false}}'
   > ```
   >
   > A build like this still receives updates from the official releases (it embeds the official public key), but it cannot publish signed updates itself.

4. The compiled binary will be available in `src-tauri/target/release/creamlinux`, and the installable bundles (AppImage, `.deb`, `.rpm`) in `src-tauri/target/release/bundle/`.

5. When running the binary directly on an NVIDIA GPU, prefix the command with `WEBKIT_DISABLE_DMABUF_RENDERER=1` as described above.

### Desktop Integration

If you're using the AppImage version, you can integrate it into your desktop environment:

1. Create a desktop entry file:

   ```bash
   mkdir -p ~/.local/share/applications
   ```

2. Create `~/.local/share/applications/creamlinux.desktop` with the following content (adjust the path to your AppImage):

   ```
   [Desktop Entry]
   Name=Creamlinux
   Exec=/absolute/path/to/CreamLinux.AppImage
   Icon=/absolute/path/to/creamlinux-icon.png
   Type=Application
   Categories=Game;Utility;
   Comment=DLC Manager for Steam games on Linux
   ```

3. Update your desktop database so creamlinux appears in your app launcher:

```bash
update-desktop-database ~/.local/share/applications
```

## Troubleshooting

### Common Issues

- **Game doesn't load**: Make sure the launch options are correctly set in Steam
- **DLCs not showing up**: Try refreshing the game list and reinstalling
- **Cannot find Steam**: Ensure Steam is installed and you've launched it at least once

### Debug Logs

Logs are stored at: `~/.cache/creamlinux/creamlinux.log`

Found a bug? Please report it on the [GitHub Issues page](https://github.com/Novattz/creamlinux-installer/issues).

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE.md) file for details.

## Credits

- [Creamlinux](https://github.com/anticitizn/creamlinux) - Native support
- [SmokeAPI](https://github.com/acidicoala/SmokeAPI) - Proton support
- [Tauri](https://tauri.app/) - Framework for building the desktop application
- [React](https://reactjs.org/) - UI library
