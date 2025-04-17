import os
import sys
import shutil
import requests
import tempfile
import subprocess
from zipfile import ZipFile
from helper import SteamHelper


class UpdateError(Exception):
    """Raised when update operations fail"""

    pass


def check_for_updates(ui_handler, helper):
    """
    Check for updates and handle the update process if needed
    Returns True if update was performed, False otherwise
    """
    try:
        helper._log_debug("Starting update check")

        helper._log_debug(f"Current version: {helper.config['version']}")
        helper._log_debug(f"Checking for updates from: {helper.config['github_repo']}")

        # Get latest release info from GitHub
        api_url = f"{helper.config['github_api']}{helper.config['github_repo']}/releases/latest"
        helper._log_debug(f"Fetching from: {api_url}")

        response = requests.get(api_url)
        latest_release = response.json()
        latest_version = latest_release["tag_name"]
        helper._log_debug(f"Latest version found: {latest_version}")

        if latest_version != helper.config["version"]:
            ui_handler.show_info(f"\nNew version available: {latest_version}")
            ui_handler.show_info(f"Current version: {helper.config['version']}")

            if ui_handler.get_user_confirmation("Would you like to update?"):
                perform_update(latest_release, ui_handler, helper)
                # Update config with new version
                helper.config["version"] = latest_version
                helper.save_config()
                helper._log_debug("Updated config.json with new version")
                return True

        return False

    except requests.exceptions.RequestException as e:
        helper._log_error(f"Failed to check for updates: {str(e)}")
        ui_handler.show_warning(f"Failed to check for updates: {str(e)}")
        return False


def perform_update(release_info, ui_handler, helper):
    """Download and install the update"""
    script_path = os.path.abspath(sys.argv[0])
    script_dir = os.path.dirname(script_path)
    helper._log_debug(f"Script directory: {script_dir}")

    try:
        # Find the asset URL
        zip_asset = next(
            (
                asset
                for asset in release_info["assets"]
                if asset["name"].endswith(".zip")
            ),
            None,
        )

        if not zip_asset:
            helper._log_debug("No zip asset found in release")
            raise UpdateError("No valid update package found")

        helper._log_debug(f"Found update package: {zip_asset['name']}")

        # Create temporary directory
        with tempfile.TemporaryDirectory() as temp_dir:
            helper._log_debug(f"Created temp directory: {temp_dir}")

            # Download the update
            with ui_handler.create_status_context("Downloading update..."):
                response = requests.get(zip_asset["browser_download_url"], stream=True)
                zip_path = os.path.join(temp_dir, "update.zip")
                helper._log_debug(f"Downloading to: {zip_path}")

                with open(zip_path, "wb") as f:
                    for chunk in response.iter_content(chunk_size=8192):
                        if chunk:
                            f.write(chunk)

            # Extract update
            with ui_handler.create_status_context("Installing update..."):
                helper._log_debug("Extracting update files")
                with ZipFile(zip_path, "r") as zip_ref:
                    zip_ref.extractall(temp_dir)

                # Create backup of current files
                backup_dir = os.path.join(script_dir, "backup")
                os.makedirs(backup_dir, exist_ok=True)
                helper._log_debug(f"Created backup directory: {backup_dir}")

                # Copy current files to backup
                for file in os.listdir(script_dir):
                    if file.endswith(".py") or file == "config.json":
                        helper._log_debug(f"Backing up: {file}")
                        shutil.copy2(
                            os.path.join(script_dir, file),
                            os.path.join(backup_dir, file),
                        )

                # Copy new files
                for file in os.listdir(temp_dir):
                    if file.endswith(".py"):
                        helper._log_debug(f"Installing new file: {file}")
                        shutil.copy2(
                            os.path.join(temp_dir, file), os.path.join(script_dir, file)
                        )

        ui_handler.show_success("Update completed successfully!")
        ui_handler.show_info("Restarting application...")
        helper._log_debug("Preparing to restart application")

        # Restart the application
        python = sys.executable
        os.execl(python, python, *sys.argv)

    except Exception as e:
        helper._log_error(f"Update failed: {str(e)}")
        # Attempt to restore from backup if available
        backup_dir = os.path.join(script_dir, "backup")
        if os.path.exists(backup_dir):
            helper._log_debug("Attempting to restore from backup")
            for file in os.listdir(backup_dir):
                helper._log_debug(f"Restoring: {file}")
                shutil.copy2(
                    os.path.join(backup_dir, file), os.path.join(script_dir, file)
                )
            shutil.rmtree(backup_dir)

        raise UpdateError(f"Update failed: {str(e)}")
