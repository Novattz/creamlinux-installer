import os
import re
import requests
import zipfile
import time
import stat
import subprocess
from collections import defaultdict
import logging
import argparse
from concurrent.futures import ThreadPoolExecutor
from tqdm import tqdm

LOG_FILE = 'script.log'
DEBUG_FILE = 'debug_script.log'
TIMEOUT = 180  # Timeout in seconds (3 minutes)

def setup_logging(debug):
    log_format = '%(asctime)s [%(levelname)s] %(message)s'
    date_format = '%m-%d %H:%M:%S'
    if debug:
        logging.basicConfig(filename=DEBUG_FILE, level=logging.DEBUG, format=log_format, datefmt=date_format)
    else:
        logging.basicConfig(filename=LOG_FILE, level=logging.ERROR, format=log_format, datefmt=date_format)

def clear_screen():
    os.system('cls' if os.name == 'nt' else 'clear')

def log_error(message):
    logging.error(message)
    print(message)

def log_debug(message):
    logging.debug(message)

def read_steam_registry():
    registry_path = os.path.expanduser('~/.steam/registry.vdf')
    if os.path.exists(registry_path):
        log_debug(f"Found Steam registry file: {registry_path}")
        with open(registry_path, 'r') as f:
            content = f.read()
            install_path = re.search(r'"InstallPath"\s*"([^"]+)"', content)
            if install_path:
                return install_path.group(1)
    return None

def fetch_latest_version():
    try:
        response = requests.get("https://api.github.com/repos/Novattz/creamlinux-installer/releases/latest")
        data = response.json()
        return data['tag_name']
    except requests.exceptions.RequestException as e:
        log_error(f"Failed to fetch latest version: {str(e)}")
        return "Unknown"

def show_header(app_version, debug_mode):
    clear_screen()
    cyan = '\033[96m'
    red = '\033[91m'
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
    if debug_mode:
        print(f"{red}    [Running in DEBUG mode]{reset}\n")
    print()

app_version = fetch_latest_version()
#app_version = "TESTING / LETS NOT OVERLOAD GITHUB FOR NO REASON"

def parse_vdf(file_path):
    library_paths = []
    try:
        with open(file_path, 'r', encoding='utf-8') as file:
            content = file.read()
            paths = re.findall(r'"path"\s*"(.*?)"', content, re.IGNORECASE)
            library_paths.extend([os.path.normpath(path) for path in paths])
    except Exception as e:
        log_error(f"Failed to read {file_path}: {str(e)}")
    return library_paths

def find_steam_binary():
    try:
        result = subprocess.run(['which', 'steam'], stdout=subprocess.PIPE)
        steam_path = result.stdout.decode('utf-8').strip()
        if steam_path:
            return os.path.dirname(steam_path)
    except Exception as e:
        log_error(f"Failed to locate steam binary: {str(e)}")
    return None

def find_steam_library_folders(manual_path=""):
    search_list = [
        # Default
        os.path.expanduser('~/.steam/steam'),
        os.path.expanduser('~/.local/share/Steam'),

        # Steam Deck
        os.path.expanduser('/home/deck/.steam/steam'),
        os.path.expanduser('/home/deck/.local/share/Steam'),

        # Others
        '/mnt/Jogos/Steam',
        '/run/media/mmcblk0p1',

        # Flatpak
        os.path.expanduser('~/.var/app/com.valvesoftware.Steam/.local/share/Steam'),
        os.path.expanduser('~/.var/app/com.valvesoftware.Steam/data/Steam/steamapps/common')
    ]

    library_folders = []
    try:
        if manual_path:
            log_debug(f"Manual game path set to \"{manual_path}\" skipping path lookup")
            library_folders.append(manual_path)
        else:
            steam_binary_path = find_steam_binary()
            if steam_binary_path and steam_binary_path not in search_list:
                search_list.append(steam_binary_path)

            steam_install_path = read_steam_registry()
            if steam_install_path and steam_install_path not in search_list:
                search_list.append(steam_install_path)

            log_debug(f"Paths that will be searched: {search_list}")

            for search_path in search_list:
                if os.path.exists(search_path):
                    log_debug(f"Scanning path: {search_path}")
                    steamapps_path = str(os.path.normpath(f"{search_path}/steamapps"))
                    if os.path.exists(steamapps_path):
                        library_folders.append(steamapps_path)
                        log_debug(f"Found steamapps folder: {steamapps_path}")

                        vdf_path = os.path.join(steamapps_path, 'libraryfolders.vdf')
                        if os.path.exists(vdf_path):
                            log_debug(f"Found libraryfolders.vdf: {vdf_path}")
                            additional_paths = parse_vdf(vdf_path)
                            for path in additional_paths:
                                new_steamapps_path = os.path.join(path, 'steamapps')
                                if os.path.exists(new_steamapps_path):
                                    library_folders.append(new_steamapps_path)
                                    log_debug(f"Added additional steamapps folder: {new_steamapps_path}")

            if not library_folders:
                raise FileNotFoundError("No Steam library folders found.")
    except Exception as e:
        log_error(f"Error finding Steam library folders: {e}")
        log_error("Scanned paths:")
        for path in search_list:
            log_error(f"  - {path}")
    return library_folders

def process_acf_file(folder, item):
    try:
        app_id, game_name, install_dir = parse_acf(os.path.join(folder, item))
        if app_id and game_name:
            install_path = os.path.join(folder, 'common', install_dir)
            if os.path.exists(install_path):
                return app_id, game_name, install_path
    except Exception as e:
        log_error(f"Error processing {item}: {e}")
    return None

def find_steam_apps(library_folders):
    acf_pattern = re.compile(r'^appmanifest_(\d+)\.acf$')
    games = {}
    
    with ThreadPoolExecutor() as executor:
        futures = []
        for folder in library_folders:
            if os.path.exists(folder):
                for item in os.listdir(folder):
                    if acf_pattern.match(item):
                        futures.append(
                            executor.submit(process_acf_file, folder, item)
                        )
        
        for future in futures:
            result = future.result()
            if result:
                app_id, game_name, install_path = result
                cream_installed = 'Cream installed' if os.path.exists(os.path.join(install_path, 'cream.sh')) else ''
                games[app_id] = (game_name, cream_installed, install_path)
    
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
        log_error(f"Error reading ACF file {file_path}: {e}")
        return None, None, None

def fetch_dlc_details(app_id):
    base_url = f"https://store.steampowered.com/api/appdetails?appids={app_id}"
    try:
        response = requests.get(base_url)
        data = response.json()
        if app_id not in data or "data" not in data[app_id]:
            return []
        
        game_data = data[app_id]["data"]
        dlcs = game_data.get("dlc", [])
        dlc_details = []
        
        with tqdm(total=len(dlcs), desc="Fetching DLC details") as pbar:
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
                    elif dlc_response.status_code == 429:
                        time.sleep(10)
                        
                    pbar.update(1)
                except Exception as e:
                    log_error(f"Exception for DLC {dlc_id}: {str(e)}")
                    
        return dlc_details
        
    except requests.exceptions.RequestException as e:
        log_error(f"Failed to fetch DLC details for {app_id}: {e}")
        return []

def install_files(app_id, game_install_dir, dlcs, game_name):
    GREEN = '\033[92m'
    YELLOW = '\033[93m'
    RESET = '\033[0m'
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
            print(f"\n{GREEN}Installation complete!{RESET}")
            print(f"\n{YELLOW}Set launch options in Steam:{RESET}")
            print(f"{GREEN}'sh ./cream.sh %command%'{RESET} for {game_name}")
        else:
            log_error("Failed to download the files needed for installation.")
    except Exception as e:
        log_error(f"Failed to install files for {game_name}: {e}")

def uninstall_creamlinux(install_path, game_name):
    YELLOW = '\033[93m'
    GREEN = '\033[92m'
    RESET = '\033[0m'
    try:
        files_to_remove = ['cream.sh', 'cream_api.ini', 'cream_api.so', 'lib32Creamlinux.so', 'lib64Creamlinux.so']
        for file in files_to_remove:
            file_path = os.path.join(install_path, file)
            if os.path.exists(file_path):
                os.remove(file_path)
        print(f"\n{GREEN}Successfully uninstalled CreamLinux from {game_name}{RESET}")
        print(f"\n{YELLOW}Make sure to remove{RESET} {GREEN}'sh ./cream.sh %command%'{RESET} {YELLOW}from launch options{RESET}")
    except Exception as e:
        log_error(f"Failed to uninstall CreamLinux: {e}")

def main():
    parser = argparse.ArgumentParser(description="Steam DLC Fetcher")
    parser.add_argument("--manual", metavar='steamapps_path', help="Sets the steamapps path for faster operation", required=False)
    parser.add_argument("--debug", action="store_true", help="Enable debug logging")
    args = parser.parse_args()

    setup_logging(args.debug)
    show_header(app_version, args.debug)

    try:
        library_folders = find_steam_library_folders(args.manual)
        if not library_folders:
            print("Falling back to Manual Method since no library folder was found")
            steamapps_path = input("Steamapps Path: ")
            if len(steamapps_path) > 3:
                library_folders = [steamapps_path]
            else:
                print("Invalid path! Closing the program...")
                return

        games = find_steam_apps(library_folders)
        if games:
            print("\nSelect the game for which you want to fetch DLCs:")
            games_list = list(games.items())
            GREEN = '\033[92m'
            RESET = '\033[0m'
            
            for idx, (app_id, (name, cream_status, _)) in enumerate(games_list, 1):
                status = []
                if cream_status:
                    status.append(f"{GREEN}Cream installed{RESET}")
                
                status_str = f" ({', '.join(status)})" if status else ""
                print(f"{idx}. {name} (App ID: {app_id}){status_str}")

            choice = int(input("\nEnter the number of the game: ")) - 1
            if 0 <= choice < len(games_list):
                selected_app_id, (selected_game_name, cream_status, selected_install_dir) = games_list[choice]
                
                if cream_status:
                    print("\nCreamLinux is installed. What would you like to do?")
                    print("1. Fetch DLC IDs")
                    print("2. Uninstall CreamLinux")
                    action = input("Enter your choice (1-2): ")
                    
                    if action == "1":
                        print(f"\nSelected: {selected_game_name} (App ID: {selected_app_id})")
                        dlcs = fetch_dlc_details(selected_app_id)
                        if dlcs:
                            install_files(selected_app_id, selected_install_dir, dlcs, selected_game_name)
                        else:
                            print("No DLCs found for the selected game.")
                    elif action == "2":
                        uninstall_creamlinux(selected_install_dir, selected_game_name)
                    else:
                        print("Invalid choice.")
                else:
                    print(f"\nSelected: {selected_game_name} (App ID: {selected_app_id})")
                    dlcs = fetch_dlc_details(selected_app_id)
                    if dlcs:
                        install_files(selected_app_id, selected_install_dir, dlcs, selected_game_name)
                    else:
                        print("No DLCs found for the selected game.")
            else:
                print("Invalid selection.")
        else:
            print("No Steam games found on this computer or connected drives.")
    except Exception as e:
        logging.exception("An error occurred:")
        log_error(f"An error occurred: {e}")

if __name__ == "__main__":
    main()
