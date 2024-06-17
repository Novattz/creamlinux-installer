# Steam DLC Fetcher and installer for Linux
- Python script designed for linux to automate fetching of DLC id's for steam games and the installation of creamlinux automatically.

# Features
- Automatically fetches and lists DLC's for selected steam game(s) installed on the computer.
- Automatically installs creamlinux and its components into selected steam games, excluding and handling specific config files.
- Provides a simple cli to navigate and operate the entire process.

# Demo
https://www.youtube.com/watch?v=22LDDUoBvus&ab_channel=Nova

# To do
- Cross reference dlc files and dlc id's. Incase dlc id's and dlc files differ in terms of quantity it will notify the user.
- Possibly add functionality to search for dlc files/automatically installing them.
- Add the possibility to install cream/smokeapi for games running proton.

# Prerequisites
- `python 3.x`
- `requests` library
- `zipfile` library

# Usage
- Clone the repo or download the script.
- Navigate to the directory containing the script.
- Run the script using python.
```bash
python steam_dlc_fetcher.py
```

# Issues?
- Open a issue and attach all relevant errors/logs.

# Credits
- [All credits for creamlinux go to its original author and contributors.](https://github.com/anticitizn/creamlinux)
