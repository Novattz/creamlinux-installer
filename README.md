
# Steam DLC Fetcher and installer for Linux
- A user-friendly tool for managing DLC for Steam games on Linux systems. 

[Demo/Tutorial](https://www.youtube.com/watch?v=Y1E15rUsdDw) - [OUTDATED]

## Preview:
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

### Installation

```bash
bash <(wget -qO- https://raw.githubusercontent.com/NL-TCH/creamlinux-installer/refs/heads/main/installer.sh)
```

### Basic Usage
- `--manual <path>`: Specify steam library path manually
```bash
creamlinux-installer --manual "/path/to/steamapps"
```
- `--debug`: Enable debug logging
```bash
creamlinux-installer --debug
```

### Issues?
- Open a issue and attach all relevant errors/logs.

## Credits
- [Creamlinux](https://github.com/anticitizn/creamlinux) by anticitizn
- [SmokeAPI](https://github.com/acidicoala/SmokeAPI) by acidicoala
