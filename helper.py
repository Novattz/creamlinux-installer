import os
import re
import requests
import zipfile
import time
import shutil
import stat
import subprocess
import logging
import json
from datetime import datetime


class SteamHelper:
    def __init__(self, debug=False):
        self.debug = debug
        self.logger = None
        self.config = None
        # Only setup logging if debug is enabled - errors will setup logging on-demand
        if debug:
            self._setup_logging()
        self.load_config()

    def load_config(self):
        """Load configuration from config.json"""
        xdg_config_home = os.environ.get(
            "XDG_CONFIG_HOME", os.path.expanduser("~/.config")
        )
        config_dir = os.path.join(xdg_config_home, "creamlinux")
        os.makedirs(config_dir, exist_ok=True)
        config_path = os.path.join(config_dir, "config.json")
        version_file = os.path.join(os.path.dirname(__file__), "VERSION")
        with open(version_file, "r") as vf:
            version = vf.read().strip()

        # Create default config if it doesn't exist
        if not os.path.exists(config_path):
            default_config = {
                "version": f"v{version}",
                "github_repo": "Novattz/creamlinux-installer",
                "github_api": "https://api.github.com/repos/",
                "creamlinux_release": "https://github.com/anticitizn/creamlinux/releases/latest/download/creamlinux.zip",
                "smokeapi_release": "acidicoala/SmokeAPI",
            }
            with open(config_path, "w") as f:
                json.dump(default_config, f, indent=4)
            self.config = default_config
            if self.debug:
                self._log_debug("Created default config.json")
            return

        try:
            with open(config_path, "r") as f:
                self.config = json.load(f)
                if self.debug:
                    self._log_debug(f"Loaded config: {self.config}")
        except Exception as e:
            self._log_error(f"Failed to load config: {str(e)}")
            raise

    def _cleanup_old_logs(self, log_dir, keep_logs=5):
        """Clean up old log files, keeping only the most recent ones"""
        try:
            log_files = [
                os.path.join(log_dir, f)
                for f in os.listdir(log_dir)
                if f.endswith(".log")
            ]
            if len(log_files) > keep_logs:
                log_files.sort(key=lambda x: os.path.getmtime(x))
                for f in log_files[:-keep_logs]:
                    os.remove(f)
        except Exception:
            pass  # Silently fail cleanup since this is not critical

    def _setup_logging(self):
        """Setup logging to file with detailed formatting"""
        xdg_cache_home = os.environ.get(
            "XDG_CACHE_HOME", os.path.expanduser("~/.cache")
        )
        log_dir = os.path.join(xdg_cache_home, "creamlinux")
        os.makedirs(log_dir, exist_ok=True)

        self._cleanup_old_logs(log_dir)

        log_file = os.path.join(
            log_dir, f'cream_installer_{datetime.now().strftime("%Y%m%d_%H%M%S")}.log'
        )

        file_handler = logging.FileHandler(log_file)
        file_handler.setLevel(logging.DEBUG if self.debug else logging.ERROR)
        file_handler.setFormatter(
            logging.Formatter("%(asctime)s - %(levelname)s - %(message)s")
        )

        logger = logging.getLogger("cream_installer")
        logger.handlers = []
        logger.propagate = False
        logger.setLevel(logging.DEBUG if self.debug else logging.ERROR)
        logger.addHandler(file_handler)

        self.logger = logger

        if self.debug:
            self.logger.debug("=== Session Started ===")
            self.logger.debug(f"Debug mode enabled - Log file: {log_file}")
            self.logger.debug(
                f"System: {os.uname().sysname if hasattr(os, 'uname') else os.name}"
            )
            self.logger.debug(
                f"Python version: {subprocess.check_output(['python', '--version']).decode().strip()}"
            )
            self.logger.debug("Checking for Steam installation...")

    def _log_debug(self, message):
        """Log debug message if debug mode is enabled"""
        if self.debug and not self.logger:
            self._setup_logging()
        if self.logger:
            self.logger.debug(message)

    def _log_error(self, message):
        """Log error message, setting up logging if needed"""
        if not self.logger:
            self._setup_logging()
        self.logger.error(message)

    def check_requirements(self):
        """Check if all required commands and packages are available"""
        missing_commands = []
        missing_packages = []

        # Check commands
        required_commands = ["which", "steam"]
        for cmd in required_commands:
            if not subprocess.run(["which", cmd], capture_output=True).returncode == 0:
                missing_commands.append(cmd)
                self._log_error(f"Required command not found: {cmd}")

        # Check packages
        required_packages = ["requests", "argparse", "rich", "json"]
        for package in required_packages:
            try:
                __import__(package)
            except ImportError:
                missing_packages.append(package)
                self._log_error(f"Required Python package not found: {package}")

        if missing_commands or missing_packages:
            error_details = []
            if missing_commands:
                cmd_list = ", ".join(missing_commands)
                error_details.append(f"Missing commands: {cmd_list}")
            if missing_packages:
                pkg_list = ", ".join(missing_packages)
                error_details.append(f"Missing Python packages: {pkg_list}")
                error_details.append(
                    "Install them using: pip install " + " ".join(missing_packages)
                )

            raise RequirementsError("\n".join(error_details))

        return True

    def _is_excluded_app(self, app_id, name):
        """Check if the app should be excluded from the game list"""
        excluded_ids = {
            "228980",  # Steamworks Common Redistributables
            "1070560",  # Steam Linux Runtime
            "1391110",  # Steam Linux Runtime - Soldier
            "1628350",  # Steam Linux Runtime - Sniper
            "1493710",  # Proton Experimental
            "1826330",  # Steam Linux Runtime - Scout
        }
        excluded_patterns = [
            r"Proton \d+\.\d+",
            r"Steam Linux Runtime",
            r"Steamworks Common",
        ]

        if app_id in excluded_ids:
            return True

        for pattern in excluded_patterns:
            if re.match(pattern, name, re.IGNORECASE):
                return True

        return False

    def _read_steam_registry(self):
        """Read Steam registry file"""
        registry_path = os.path.expanduser("~/.steam/registry.vdf")
        if os.path.exists(registry_path):
            self._log_debug(f"Found Steam registry file: {registry_path}")
            with open(registry_path, "r") as f:
                content = f.read()
                install_path = re.search(r'"InstallPath"\s*"([^"]+)"', content)
                if install_path:
                    return install_path.group(1)
        return None

    def _parse_vdf(self, file_path):
        """Parse Steam library folders VDF file"""
        library_paths = []
        try:
            with open(file_path, "r", encoding="utf-8") as file:
                content = file.read()
                paths = re.findall(r'"path"\s*"(.*?)"', content, re.IGNORECASE)
                library_paths.extend([os.path.normpath(path) for path in paths])
        except Exception as e:
            self._log_error(f"Failed to read {file_path}: {str(e)}")
        return library_paths

    def _find_steam_binary(self):
        """Find Steam binary location"""
        try:
            result = subprocess.run(["which", "steam"], stdout=subprocess.PIPE)
            steam_path = result.stdout.decode("utf-8").strip()
            if steam_path:
                return os.path.dirname(steam_path)
        except Exception as e:
            self._log_error(f"Failed to locate steam binary: {str(e)}")
        return None

    def find_steam_library_folders(self, manual_path=""):
        """Find all Steam library folders"""
        self._log_debug("Starting Steam library folder search")

        search_list = [
            os.path.expanduser("~/.steam/steam"),
            os.path.expanduser("~/.local/share/Steam"),
            os.path.expanduser("/home/deck/.steam/steam"),
            os.path.expanduser("/home/deck/.local/share/Steam"),
            "/mnt/Jogos/Steam",
            "/run/media/mmcblk0p1",
            os.path.expanduser("~/.var/app/com.valvesoftware.Steam/.local/share/Steam"),
            os.path.expanduser(
                "~/.var/app/com.valvesoftware.Steam/data/Steam/steamapps/common"
            ),
        ]

        library_folders = []
        try:
            if manual_path:
                self._log_debug(f"Manual game path provided: {manual_path}")
                if os.path.exists(manual_path):
                    self._log_debug("Manual path exists, adding to library folders")
                    library_folders.append(manual_path)
                else:
                    self._log_debug(f"Manual path does not exist: {manual_path}")
                return library_folders

            steam_binary_path = self._find_steam_binary()
            if steam_binary_path:
                self._log_debug(f"Found Steam binary at: {steam_binary_path}")
                if steam_binary_path not in search_list:
                    search_list.append(steam_binary_path)

            steam_install_path = self._read_steam_registry()
            if steam_install_path:
                self._log_debug(
                    f"Found Steam installation path in registry: {steam_install_path}"
                )
                if steam_install_path not in search_list:
                    search_list.append(steam_install_path)

            self._log_debug(
                "Searching for Steam library folders in all potential locations"
            )
            for search_path in search_list:
                self._log_debug(f"Checking path: {search_path}")
                if os.path.exists(search_path):
                    steamapps_path = str(os.path.normpath(f"{search_path}/steamapps"))
                    if os.path.exists(steamapps_path):
                        self._log_debug(
                            f"Found valid steamapps folder: {steamapps_path}"
                        )
                        library_folders.append(steamapps_path)

                        vdf_path = os.path.join(steamapps_path, "libraryfolders.vdf")
                        if os.path.exists(vdf_path):
                            self._log_debug(f"Found libraryfolders.vdf at: {vdf_path}")
                            additional_paths = self._parse_vdf(vdf_path)
                            for path in additional_paths:
                                new_steamapps_path = os.path.join(path, "steamapps")
                                if os.path.exists(new_steamapps_path):
                                    self._log_debug(
                                        f"Found additional library folder: {new_steamapps_path}"
                                    )
                                    library_folders.append(new_steamapps_path)

            self._log_debug(f"Found {len(library_folders)} total library folders")
            for folder in library_folders:
                self._log_debug(f"Library folder: {folder}")

        except Exception as e:
            self._log_error(f"Error finding Steam library folders: {e}")
            self._log_debug(f"Stack trace:", exc_info=True)
        return library_folders

    def _parse_acf(self, file_path):
        """Parse Steam ACF file"""
        try:
            with open(file_path, "r", encoding="utf-8") as file:
                data = file.read()
            app_id = re.search(r'"appid"\s+"(\d+)"', data)
            name = re.search(r'"name"\s+"([^"]+)"', data)
            install_dir = re.search(r'"installdir"\s+"([^"]+)"', data)
            return app_id.group(1), name.group(1), install_dir.group(1)
        except Exception as e:
            self._log_error(f"Error reading ACF file {file_path}: {e}")
            return None, None, None

    def _check_proton_status(self, install_path):
        """
        Check if a game requires Proton by looking for .exe files and Steam API DLLs
        Returns: (needs_proton, steam_api_files)
        """
        try:
            has_exe = False
            steam_api_files = []
            steam_api_patterns = ["steam_api.dll", "steam_api64.dll"]

            for root, _, files in os.walk(install_path):
                # Check for .exe files
                if not has_exe and any(file.lower().endswith(".exe") for file in files):
                    has_exe = True

                # Check for Steam API files
                for file in files:
                    if file.lower() in steam_api_patterns:
                        steam_api_files.append(
                            os.path.relpath(os.path.join(root, file), install_path)
                        )

                # If we found both, we can stop searching
                if has_exe and steam_api_files:
                    break

            return has_exe, steam_api_files

        except Exception as e:
            self._log_error(f"Error checking Proton status: {e}")
            return False, []

    def find_steam_apps(self, library_folders):
        """Find all Steam apps in library folders"""
        self._log_debug("Starting Steam apps search")
        acf_pattern = re.compile(r"^appmanifest_(\d+)\.acf$")
        games = {}

        for folder in library_folders:
            self._log_debug(f"Searching for games in: {folder}")
            if os.path.exists(folder):
                for item in os.listdir(folder):
                    if acf_pattern.match(item):
                        app_id, game_name, install_dir = self._parse_acf(
                            os.path.join(folder, item)
                        )
                        if (
                            app_id
                            and game_name
                            and not self._is_excluded_app(app_id, game_name)
                        ):
                            install_path = os.path.join(folder, "common", install_dir)
                            if os.path.exists(install_path):
                                cream_installed = os.path.exists(
                                    os.path.join(install_path, "cream.sh")
                                )
                                needs_proton, steam_api_files = (
                                    self._check_proton_status(install_path)
                                )
                                smoke_installed = (
                                    self.check_smokeapi_status(
                                        install_path, steam_api_files
                                    )
                                    if needs_proton
                                    else False
                                )

                                games[app_id] = (
                                    game_name,  # [0] Name
                                    cream_installed,  # [1] CreamLinux status
                                    install_path,  # [2] Install path
                                    needs_proton,  # [3] Proton status
                                    steam_api_files,  # [4] Steam API files
                                    smoke_installed,  # [5] SmokeAPI status
                                )

                                self._log_debug(
                                    f"Found game: {game_name} (App ID: {app_id})"
                                )
                                self._log_debug(f"  Path: {install_path}")
                                self._log_debug(
                                    f"  Status: Cream={cream_installed}, Proton={needs_proton}, Smoke={smoke_installed}"
                                )
                                if steam_api_files:
                                    self._log_debug(
                                        f"  Steam API files: {', '.join(steam_api_files)}"
                                    )

        self._log_debug(f"Found {len(games)} total games")
        return games

    def fetch_dlc_details(self, app_id, progress_callback=None):
        """Fetch DLC details for a game"""
        base_url = f"https://store.steampowered.com/api/appdetails?appids={app_id}"
        try:
            response = requests.get(base_url)
            data = response.json()
            if str(app_id) not in data:
                return []

            app_data = data[str(app_id)]
            if not app_data.get("success") or "data" not in app_data:
                return []

            game_data = app_data["data"]
            dlcs = game_data.get("dlc", [])
            dlc_details = []

            total_dlcs = len(dlcs)
            for index, dlc_id in enumerate(dlcs):
                try:
                    time.sleep(0.3)
                    dlc_url = (
                        f"https://store.steampowered.com/api/appdetails?appids={dlc_id}"
                    )
                    dlc_response = requests.get(dlc_url)

                    if dlc_response.status_code == 200:
                        dlc_data = dlc_response.json()
                        if str(dlc_id) in dlc_data and "data" in dlc_data[str(dlc_id)]:
                            dlc_name = dlc_data[str(dlc_id)]["data"].get(
                                "name", "Unknown DLC"
                            )
                            dlc_details.append({"appid": dlc_id, "name": dlc_name})
                    elif dlc_response.status_code == 429:
                        time.sleep(10)

                    if progress_callback:
                        progress_callback(index + 1, total_dlcs)

                except Exception as e:
                    self._log_error(f"Error fetching DLC {dlc_id}: {str(e)}")

            return dlc_details

        except requests.exceptions.RequestException as e:
            self._log_error(f"Failed to fetch DLC details: {str(e)}")
            return []

    def install_creamlinux(self, app_id, game_install_dir, dlcs):
        """Install CreamLinux for a game"""
        try:
            zip_url = self.config["creamlinux_release"]
            zip_path = os.path.join(game_install_dir, "creamlinux.zip")

            self._log_debug(f"Downloading CreamLinux from {zip_url}")
            response = requests.get(zip_url)
            if response.status_code != 200:
                raise InstallationError(
                    f"Failed to download CreamLinux (HTTP {response.status_code})"
                )

            self._log_debug(f"Writing zip file to {zip_path}")
            with open(zip_path, "wb") as f:
                f.write(response.content)

            self._log_debug("Extracting CreamLinux files")
            try:
                with zipfile.ZipFile(zip_path, "r") as zip_ref:
                    zip_ref.extractall(game_install_dir)
            except zipfile.BadZipFile:
                raise InstallationError(
                    "Downloaded file is corrupted. Please try again."
                )

            os.remove(zip_path)

            cream_sh_path = os.path.join(game_install_dir, "cream.sh")
            self._log_debug(f"Setting permissions for {cream_sh_path}")
            try:
                os.chmod(cream_sh_path, os.stat(cream_sh_path).st_mode | stat.S_IEXEC)
            except OSError as e:
                raise InstallationError(f"Failed to set execute permissions: {str(e)}")

            cream_api_path = os.path.join(game_install_dir, "cream_api.ini")
            self._log_debug(f"Creating config at {cream_api_path}")
            try:
                dlc_list = "\n".join(
                    [f"{dlc['appid']} = {dlc['name']}" for dlc in dlcs]
                )
                with open(cream_api_path, "w") as f:
                    f.write(
                        f"APPID = {app_id}\n[config]\nissubscribedapp_on_false_use_real = true\n[methods]\ndisable_steamapps_issubscribedapp = false\n[dlc]\n{dlc_list}"
                    )
            except IOError as e:
                raise InstallationError(f"Failed to create config file: {str(e)}")

            return True
        except Exception as e:
            self._log_error(f"Installation failed: {str(e)}")
            if isinstance(e, InstallationError):
                raise
            raise InstallationError(f"Installation failed: {str(e)}")

    def uninstall_creamlinux(self, install_path):
        """Uninstall CreamLinux from a game"""
        try:
            files_to_remove = [
                "cream.sh",
                "cream_api.ini",
                "cream_api.so",
                "lib32Creamlinux.so",
                "lib64Creamlinux.so",
            ]
            for file in files_to_remove:
                file_path = os.path.join(install_path, file)
                if os.path.exists(file_path):
                    os.remove(file_path)
            return True
        except Exception as e:
            self._log_error(f"Uninstallation failed: {str(e)}")
            return False

    def install_smokeapi(self, install_path, steam_api_files):
        """Install SmokeAPI for a Proton game"""
        try:
            # Construct the correct URL using latest version
            response = requests.get(
                f"{self.config['github_api']}{self.config['smokeapi_release']}/releases/latest"
            )
            if response.status_code != 200:
                raise InstallationError("Failed to fetch latest SmokeAPI version")

            latest_release = response.json()
            latest_version = latest_release["tag_name"]
            zip_url = (
                f"https://github.com/{self.config['smokeapi_release']}/releases/download/"
                f"{latest_version}/SmokeAPI-{latest_version}.zip"
            )

            zip_path = os.path.join(install_path, "smokeapi.zip")

            self._log_debug(f"Downloading SmokeAPI from {zip_url}")
            response = requests.get(zip_url)
            if response.status_code != 200:
                raise InstallationError(
                    f"Failed to download SmokeAPI (HTTP {response.status_code})"
                )

            self._log_debug(f"Writing zip file to {zip_path}")
            with open(zip_path, "wb") as f:
                f.write(response.content)

            self._log_debug("Extracting SmokeAPI files")
            try:
                with zipfile.ZipFile(zip_path, "r") as zip_ref:
                    for api_file in steam_api_files:
                        api_dir = os.path.dirname(os.path.join(install_path, api_file))
                        api_name = os.path.basename(api_file)

                        # Backup original file
                        original_path = os.path.join(api_dir, api_name)
                        backup_path = os.path.join(
                            api_dir, api_name.replace(".dll", "_o.dll")
                        )

                        self._log_debug(f"Processing {api_file}:")
                        self._log_debug(f"  Original: {original_path}")
                        self._log_debug(f"  Backup: {backup_path}")

                        # Only backup if not already backed up
                        if not os.path.exists(backup_path):
                            shutil.move(original_path, backup_path)

                        # Extract the appropriate DLL directly to the game directory
                        zip_ref.extract(api_name, api_dir)

                        self._log_debug(f"  Installed SmokeAPI as: {original_path}")

            except zipfile.BadZipFile:
                raise InstallationError(
                    "Downloaded file is corrupted. Please try again."
                )

            os.remove(zip_path)
            return True

        except Exception as e:
            self._log_error(f"SmokeAPI installation failed: {str(e)}")
            raise InstallationError(f"Failed to install SmokeAPI: {str(e)}")

    def uninstall_smokeapi(self, install_path, steam_api_files):
        """Uninstall SmokeAPI and restore original files"""
        try:
            for api_file in steam_api_files:
                api_dir = os.path.dirname(os.path.join(install_path, api_file))
                api_name = os.path.basename(api_file)

                original_path = os.path.join(api_dir, api_name)
                backup_path = os.path.join(api_dir, api_name.replace(".dll", "_o.dll"))

                if os.path.exists(backup_path):
                    if os.path.exists(original_path):
                        os.remove(original_path)
                    shutil.move(backup_path, original_path)
                    self._log_debug(f"Restored original file: {original_path}")

            return True

        except Exception as e:
            self._log_error(f"SmokeAPI uninstallation failed: {str(e)}")
            return False

    def check_smokeapi_status(self, install_path, steam_api_files):
        """Check if SmokeAPI is installed"""
        try:
            for api_file in steam_api_files:
                backup_path = os.path.join(
                    install_path,
                    os.path.dirname(api_file),
                    os.path.basename(api_file).replace(".dll", "_o.dll"),
                )
                if os.path.exists(backup_path):
                    return True
            return False
        except Exception as e:
            self._log_error(f"Error checking SmokeAPI status: {str(e)}")
            return False


class RequirementsError(Exception):
    """Raised when system requirements are not met"""

    pass


class NetworkError(Exception):
    """Raised when network-related operations fail"""

    pass


class InstallationError(Exception):
    """Raised when installation operations fail"""

    pass
