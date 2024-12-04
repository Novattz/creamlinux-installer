
# Steam DLC Fetcher and installer for Linux
- Python script designed for linux to automate fetching of DLC id's for steam games and the installation of creamlinux automatically. [Demo/Tutorial](https://www.youtube.com/watch?v=Y1E15rUsdDw)
### Features
- Automatically fetches and lists DLC's for selected steam game(s) installed on the computer.
- Automatically installs creamlinux and its components into selected steam games, excluding and handling specific config files.
- Provides a simple cli to navigate and operate the entire process.

## Usage
### Prerequisites
- `python 3.x`
- `requests` library
- `zipfile` library
- `tqdm` >=4.65.0


### Installation

- Clone the repo or download the script.
- Navigate to the directory containing the script.
- Run the script using python.

#### OR
Use this one-line shell script.
```bash
git clone https://github.com/Novattz/creamlinux-installer;cd creamlinux-installer;python dlc_fetcher.py
```
## TODO
- [ ] Cross reference dlc files and dlc id's. Incase dlc id's and dlc files differ in terms of quantity it will notify the user.
- [ ] Possibly add functionality to search for dlc files/automatically installing them.
- [ ] Add the possibility to install cream/smokeapi for games running proton.
- [ ] Check if the game already has dlc files installed
- [ ] Gui? (most likely not but ill see what i can do ¯\_(ツ)_/¯ )
- [ ] Add checker for configs already applied to games. (i.e script will check for new dlc id's for already applied games.)
- [ ] Add a way to check if a game blocks LD_PRELOAD.
- [ ] Update/notifier if creamlinux itself is outdated.

### Issues?
- Open a issue and attach all relevant errors/logs.

# Credits
- [All credits for creamlinux go to its original author and contributors.](https://github.com/anticitizn/creamlinux)
