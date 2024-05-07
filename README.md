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

# Credits
- [All credits for creamlinux go to its original author and contributors.](https://github.com/anticitizn/creamlinux)

# Source
```python
import os
import re
import requests
import zipfile
import time
import stat

def parse_vdf(file_path):
    library_paths = []
    try:
        with open(file_path, 'r', encoding='utf-8') as file:
            content = file.read()
            paths = re.findall(r'"path"\s*"(.*?)"', content, re.IGNORECASE)
            library_paths.extend([os.path.normpath(path) for path in paths])
    except Exception as e:
        print(f"Failed to read {file_path}: {str(e)}")
    return library_paths

def find_steam_library_folders():
    base_paths = [os.path.expanduser('~/.steam/steam'), os.path.expanduser('~/.local/share/Steam'), '/mnt', '/media']
    library_folders = []
    for base_path in base_paths:
        if os.path.exists(base_path):
            for root, dirs, files in os.walk(base_path, topdown=True):
                if 'steamapps' in dirs:
                    steamapps_path = os.path.join(root, 'steamapps')
                    library_folders.append(steamapps_path)
                    vdf_path = os.path.join(steamapps_path, 'libraryfolders.vdf')
                    if os.path.exists(vdf_path):
                        additional_paths = parse_vdf(vdf_path)
                        for path in additional_paths:
                            new_steamapps_path = os.path.join(path, 'steamapps')
                            if os.path.exists(new_steamapps_path):
                                library_folders.append(new_steamapps_path)
                    dirs[:] = []  # Prevent further scanning into subdirectories
    return library_folders

def find_steam_apps(library_folders):
    acf_pattern = re.compile(r'^appmanifest_(\d+)\.acf$')
    games = {}
    for folder in library_folders:
        if os.path.exists(folder):
            for item in os.listdir(folder):
                if acf_pattern.match(item):
                    app_id, game_name, install_dir = parse_acf(os.path.join(folder, item))
                    if app_id and game_name:
                        install_path = os.path.join(folder, 'common', install_dir)
                        if os.path.exists(install_path):
                            cream_installed = 'Cream installed' if 'cream.sh' in os.listdir(install_path) else ''
                            games[app_id] = (game_name, cream_installed, install_path)
    return games

def parse_acf(file_path):
    with open(file_path, 'r', encoding='utf-8') as file:
        data = file.read()
    app_id = re.search(r'"appid"\s+"(\d+)"', data)
    name = re.search(r'"name"\s+"([^"]+)"', data)
    install_dir = re.search(r'"installdir"\s+"([^"]+)"', data)
    return app_id.group(1), name.group(1), install_dir.group(1)

def fetch_dlc_details(app_id):
    base_url = f"https://store.steampowered.com/api/appdetails?appids={app_id}"
    response = requests.get(base_url)
    data = response.json()
    if app_id not in data or "data" not in data[app_id]:
        print("Error: Unable to fetch game details.")
        return []
    game_data = data[app_id]["data"]
    dlcs = game_data.get("dlc", [])
    dlc_details = []
    for dlc_id in dlcs:
        try:
            time.sleep(0.3)
            dlc_url = f"https://store.steampowered.com/api/appdetails?appids={dlc_id}"
            dlc_response = requests.get(dlc_url)
            if dlc_response.status_code == 200:
                dlc_data = dlc_response.json()
                if str(dlc_id) in dlc_data and "data" in dlc_data[str(dlc_id)]:
                    dlc_name = dlc_data[str(dlc_id)]["data"].get("name", "Unknown DLC")
                    dlc_details.append({"appid": dlc_id, "name": dlc_name})
                else:
                    print(f"Data missing for DLC {dlc_id}")
            elif dlc_response.status_code == 429:
                print("Rate limited! Please wait before trying again.")
                time.sleep(10)
            else:
                print(f"Failed to fetch details for DLC {dlc_id}, Status Code: {dlc_response.status_code}")
        except Exception as e:
            print(f"Exception for DLC {dlc_id}: {str(e)}")
    return dlc_details

def install_files(app_id, game_install_dir, dlcs, game_name):
    zip_url = "https://github.com/anticitizn/creamlinux/releases/latest/download/creamlinux.zip"
    zip_path = os.path.join(game_install_dir, 'creamlinux.zip')
    response = requests.get(zip_url)
    if response.status_code == 200:
        with open(zip_path, 'wb') as f:
            f.write(response.content)
        with zipfile.ZipFile(zip_path, 'r') as zip_ref:
            zip_ref.extractall(game_install_dir)
        os.remove(zip_path)

        cream_sh_path = os.path.join(game_install_dir, 'cream.sh')
        os.chmod(cream_sh_path, os.stat(cream_sh_path).st_mode | stat.S_IEXEC)

        dlc_list = "\n".join([f"{dlc['appid']} = {dlc['name']}" for dlc in dlcs])
        cream_api_path = os.path.join(game_install_dir, 'cream_api.ini')
        with open(cream_api_path, 'w') as f:
            f.write(f"APPID = {app_id}\n[config]\nissubscribedapp_on_false_use_real = true\n[methods]\ndisable_steamapps_issubscribedapp = false\n[dlc]\n{dlc_list}")
        print(f"Custom cream_api.ini has been written to {game_install_dir}.")
        print(f"Installation complete. Set launch options in Steam: 'sh ./cream.sh %command%' for {game_name}.")
    else:
        print("Failed to download the files needed for installation.")

def main():
    library_folders = find_steam_library_folders()
    games = find_steam_apps(library_folders)
    if games:
        print("Select the game for which you want to fetch DLCs:")
        games_list = list(games.items())
        GREEN = '\033[92m'
        RESET = '\033[0m'
        for idx, (app_id, (name, cream_status, _)) in enumerate(games_list, 1):
            if cream_status:
                print(f"{idx}. {GREEN}{name} (App ID: {app_id}) - Cream installed{RESET}")
            else:
                print(f"{idx}. {name} (App ID: {app_id})")

        choice = int(input("Enter the number of the game: ")) - 1
        selected_app_id, (selected_game_name, _, selected_install_dir) = games_list[choice]
        print(f"You selected: {selected_game_name} (App ID: {selected_app_id})")

        dlcs = fetch_dlc_details(selected_app_id)
        print("DLC IDs found:", [dlc['appid'] for dlc in dlcs])  # Only print app IDs for clarity
        install_files(selected_app_id, selected_install_dir, dlcs, selected_game_name)
    else:
        print("No Steam games found on this computer or connected drives.")

if __name__ == "__main__":
    main()
```
