import os
import re
import requests
import zipfile
import time
import stat
import subprocess

LOG_FILE = 'script.log'

def clear_screen():
    os.system('cls' if os.name == 'nt' else 'clear')

def fetch_latest_version():
    try:
        response = requests.get("https://api.github.com/repos/Novattz/creamlinux-installer/releases/latest")
        data = response.json()
        return data['tag_name']
    except requests.exceptions.RequestException as e:
        log_message(f"Failed to fetch latest version: {str(e)}")
        return "Unknown"

def show_header(app_version):
    clear_screen()
    cyan = '\033[96m'
    reset = '\033[0m'
    print(f"{cyan}")
    print(r"""
  _    _ _   _ _      ____   _____ _  ________ _____  
 | |  | | \ | | |    / __ \ / ____| |/ /  ____|  __ \ 
 | |  | |  \| | |   | |  | | |    | ' /| |__  | |__) |
 | |  | | . ` | |   | |  | | |    |  < |  __| |  _  / 
 | |__| | |\  | |___| |__| | |____| . \| |____| | \ \ 
  \____/|_| \_|______\____/ \_____|_|\_\______|_|  \_\
                                                      
    """)
    print(f"""
    > Made by Tickbase
    > GitHub: https://github.com/Novattz/creamlinux-installer
    > Version: {app_version}
    {reset}
    """)

app_version = fetch_latest_version()

def log_message(message):
    with open(LOG_FILE, 'a') as log_file:
        log_file.write(f"{message}\n")
    print(message)

def parse_vdf(file_path):
    library_paths = []
    try:
        with open(file_path, 'r', encoding='utf-8') as file:
            content = file.read()
            paths = re.findall(r'"path"\s*"(.*?)"', content, re.IGNORECASE)
            library_paths.extend([os.path.normpath(path) for path in paths])
    except Exception as e:
        log_message(f"Failed to read {file_path}: {str(e)}")
    return library_paths

def find_steam_binary():
    try:
        result = subprocess.run(['which', 'steam'], stdout=subprocess.PIPE)
        steam_path = result.stdout.decode('utf-8').strip()
        if steam_path:
            return os.path.dirname(steam_path)
    except Exception as e:
        log_message(f"Failed to locate steam binary: {str(e)}")
    return None

def find_steam_library_folders():
    steam_binary_path = find_steam_binary()
    base_paths = [
        os.path.expanduser('~/.steam/steam'),
        os.path.expanduser('~/.local/share/Steam'),
        os.path.expanduser('~/.steam/steam'),
        os.path.expanduser('~/.local/share/Steam'),
        '/mnt', '/media',
        '/run/media/mmcblk0p1/steamapps'
    ]
    if steam_binary_path:
        base_paths.append(steam_binary_path)

    library_folders = []
    try:
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
        if not library_folders:
            raise FileNotFoundError("No Steam library folders found.")
    except Exception as e:
        log_message(f"Error finding Steam library folders: {e}")
    return library_folders

def find_steam_apps(library_folders):
    acf_pattern = re.compile(r'^appmanifest_(\d+)\.acf$')
    games = {}
    try:
        for folder in library_folders:
            if os.path.exists(folder):
                for item in os.listdir(folder):
                    if acf_pattern.match(item):
                        try:
                            app_id, game_name, install_dir = parse_acf(os.path.join(folder, item))
                            if app_id and game_name:
                                install_path = os.path.join(folder, 'common', install_dir)
                                if os.path.exists(install_path):
                                    cream_installed = 'Cream installed' if 'cream.sh' in os.listdir(install_path) else ''
                                    games[app_id] = (game_name, cream_installed, install_path)
                        except Exception as e:
                            log_message(f"Error parsing {item}: {e}")
        if not games:
            raise FileNotFoundError("No Steam games found.")
    except Exception as e:
        log_message(f"Error finding Steam apps: {e}")
    return games

def parse_acf(file_path):
    try:
        with open(file_path, 'r', encoding='utf-8') as file:
            data = file.read()
        app_id = re.search(r'"appid"\s+"(\d+)"', data)
        name = re.search(r'"name"\s+"([^"]+)"', data)
        install_dir = re.search(r'"installdir"\s+"([^"]+)"', data)
        return app_id.group(1), name.group(1), install_dir.group(1)
    except Exception as e:
        log_message(f"Error reading ACF file {file_path}: {e}")
        return None, None, None

def fetch_dlc_details(app_id):
    base_url = f"https://store.steampowered.com/api/appdetails?appids={app_id}"
    try:
        response = requests.get(base_url)
        data = response.json()
        if app_id not in data or "data" not in data[app_id]:
            log_message("Error: Unable to fetch game details.")
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
                        log_message(f"Data missing for DLC {dlc_id}")
                elif dlc_response.status_code == 429:
                    log_message("Rate limited! Please wait before trying again.")
                    time.sleep(10)
                else:
                    log_message(f"Failed to fetch details for DLC {dlc_id}, Status Code: {dlc_response.status_code}")
            except Exception as e:
                log_message(f"Exception for DLC {dlc_id}: {str(e)}")
        return dlc_details
    except requests.exceptions.RequestException as e:
        log_message(f"Failed to fetch DLC details for {app_id}: {e}")
        return []

def install_files(app_id, game_install_dir, dlcs, game_name):
    zip_url = "https://github.com/anticitizn/creamlinux/releases/latest/download/creamlinux.zip"
    zip_path = os.path.join(game_install_dir, 'creamlinux.zip')
    try:
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
            log_message("Failed to download the files needed for installation.")
    except Exception as e:
        log_message(f"Failed to install files for {game_name}: {e}")

def main():
    show_header(app_version)
    try:
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
            if choice < 0 or choice >= len(games_list):
                raise ValueError("Invalid selection.")
            selected_app_id, (selected_game_name, _, selected_install_dir) = games_list[choice]
            print(f"You selected: {selected_game_name} (App ID: {selected_app_id})")

            dlcs = fetch_dlc_details(selected_app_id)
            if dlcs:
                print("DLC IDs found:", [dlc['appid'] for dlc in dlcs])  # Only print app IDs for clarity
                install_files(selected_app_id, selected_install_dir, dlcs, selected_game_name)
            else:
                print("No DLCs found for the selected game.")
        else:
            print("No Steam games found on this computer or connected drives.")
    except Exception as e:
        log_message(f"An error occurred: {e}")

if __name__ == "__main__":
    main()
