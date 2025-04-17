#!/usr/bin/env python3

import argparse
import os
from helper import SteamHelper, RequirementsError, NetworkError, InstallationError
from ui_handler import UIHandler
from updater import check_for_updates, UpdateError 

def handle_dlc_operation(ui, helper, app_id, game_name, install_dir):
    """Handle DLC fetching and installation"""
    ui.show_info(f"\nSelected: {game_name} (App ID: {app_id})")
    
    with ui.create_progress_context() as progress:
        progress_task = progress.add_task("🔍 Fetching DLC details...", total=None)
        def update_progress(current, total):
            progress.update(progress_task, completed=current, total=total)
        dlcs = helper.fetch_dlc_details(app_id, update_progress)
    
    if dlcs:
        ui.show_dlc_table(dlcs)
        if ui.get_user_confirmation("\nProceed with installation?"):
            with ui.create_status_context("Installing CreamLinux..."):
                success = helper.install_creamlinux(app_id, install_dir, dlcs)
            if success:
                ui.show_success("Installation complete!")
                ui.show_launch_options(game_name)
    else:
        ui.show_warning("No DLCs found for this game.")

def handle_smokeapi_operation(ui, helper, install_path, steam_api_files, game_name, is_install=True):
    """Handle SmokeAPI installation/uninstallation"""
    operation = "installation" if is_install else "uninstallation"
    
    ui.show_info(f"\nProceeding with SmokeAPI {operation} for {game_name}")
    
    try:
        with ui.create_status_context(f"{'Installing' if is_install else 'Uninstalling'} SmokeAPI..."):
            if is_install:
                success = helper.install_smokeapi(install_path, steam_api_files)
            else:
                success = helper.uninstall_smokeapi(install_path, steam_api_files)
        
        if success:
            ui.show_success(f"Successfully {'installed' if is_install else 'uninstalled'} SmokeAPI!")
        else:
            ui.show_error(f"Failed to {'install' if is_install else 'uninstall'} SmokeAPI")
    except Exception as e:
        ui.show_error(str(e))

def main():
    parser = argparse.ArgumentParser(description="Steam DLC Fetcher")
    parser.add_argument("--manual", metavar='steamapps_path', help="Sets the steamapps path for faster operation", required=False)
    parser.add_argument("--debug", action="store_true", help="Enable debug logging")
    parser.add_argument("--no-update", action="store_true", help="Skip update check")
    args = parser.parse_args()

    ui = UIHandler(debug=args.debug)
    helper = SteamHelper(debug=args.debug)
    
    try:
        if not args.no_update:
            try:
                if check_for_updates(ui, helper):
                    return  # Exit if update was performed
            except UpdateError as e:
                ui.show_error(f"Update failed: {str(e)}")
                if not ui.get_user_confirmation("Would you like to continue anyway?"):
                    return
        
        # Use version from config instead of fetching
        app_version = helper.config['version']
        ui.show_header(app_version, args.debug)

        helper.check_requirements()
    except RequirementsError as e:
        ui.show_error("Missing dependencies:", show_details=str(e))
        return

    try:
        with ui.create_status_context("Finding Steam library folders..."):
            library_folders = helper.find_steam_library_folders(args.manual)
        
        if not library_folders:
            if args.manual:
                ui.show_error(f"Could not find Steam library at specified path: {args.manual}")
            else:
                ui.show_warning("No Steam library folders found. Please enter the path manually.")
                steamapps_path = ui.get_user_input("Enter Steamapps Path")
                if len(steamapps_path) > 3 and os.path.exists(steamapps_path):
                    library_folders = [steamapps_path]
                else:
                    ui.show_error("Invalid path or path does not exist!")
                    return

        while True:
            # Refresh games list at the start of each loop
            with ui.create_status_context("Scanning for games..."):
                games = helper.find_steam_apps(library_folders)
            
            if not games:
                ui.show_error("No Steam games found.")
                return

            games_list = list(games.items())
            ui.show_games_table(games_list)

            try:
                ui.console.print("\n[dim]Enter game number or 'q' to quit[/dim]")
                user_input = ui.get_user_input("Select game number")
                
                if user_input.lower() == 'q':
                    return
                    
                choice = int(user_input) - 1
                if not (0 <= choice < len(games_list)):
                    ui.show_error("Invalid selection.")
                    continue
                
                # Show the selected game and options
                ui.clear_screen()
                ui.show_header(app_version, args.debug)
                ui.show_games_table(games_list, choice)
                
                # Get game's status
                is_installed = games_list[choice][1][1]  # cream_status
                needs_proton = games_list[choice][1][3]  # needs_proton
                steam_api_files = games_list[choice][1][4]  # steam_api_files
                smoke_status = games_list[choice][1][5]  # smoke_status
                game_info = (games_list[choice][0], games_list[choice][1])
                
                # Different choices based on installation status and game type
                if needs_proton and steam_api_files:
                    if smoke_status:
                        max_options = 2  # Uninstall and Go Back
                        action = ui.get_user_input("\nChoose action", choices=["1", "2"])
                        
                        if action == "2":  # Go back
                            ui.clear_screen()
                            ui.show_header(app_version, args.debug)
                            continue
                        
                        if action == "1":  # Uninstall SmokeAPI
                            handle_smokeapi_operation(ui, helper, game_info[1][2], steam_api_files, game_info[1][0], False)
                    else:
                        max_options = 2  # Install and Go Back
                        action = ui.get_user_input("\nChoose action", choices=["1", "2"])
                        
                        if action == "2":  # Go back
                            ui.clear_screen()
                            ui.show_header(app_version, args.debug)
                            continue
                        
                        if action == "1":  # Install SmokeAPI
                            handle_smokeapi_operation(ui, helper, game_info[1][2], steam_api_files, game_info[1][0], True)
                else:
                    # Handle non-Proton games (original logic)
                    if is_installed:
                        action = ui.get_user_input("\nChoose action", choices=["1", "2", "3"])
                        if action == "3":  # Go back
                            ui.clear_screen()
                            ui.show_header(app_version, args.debug)
                            continue
                        
                        if action == "1":  # Fetch DLCs
                            handle_dlc_operation(ui, helper, game_info[0], game_info[1][0], game_info[1][2])
                        else:  # Uninstall
                            if ui.get_user_confirmation("\nAre you sure you want to uninstall CreamLinux?"):
                                with ui.create_status_context("Uninstalling CreamLinux..."):
                                    success = helper.uninstall_creamlinux(game_info[1][2])
                                if success:
                                    ui.show_success(f"Successfully uninstalled CreamLinux from {game_info[1][0]}")
                                    ui.show_uninstall_reminder()
                    else:
                        action = ui.get_user_input("\nChoose action", choices=["1", "2"])
                        if action == "2":  # Go back
                            ui.clear_screen()
                            ui.show_header(app_version, args.debug)
                            continue
                        
                        # Proceed with DLC operation
                        handle_dlc_operation(ui, helper, game_info[0], game_info[1][0], game_info[1][2])

                # After any operation, ask if user wants to continue
                if ui.get_user_confirmation("\nWould you like to perform another operation?"):
                    ui.clear_screen()
                    ui.show_header(app_version, args.debug)
                    continue
                else:
                    break
                    
            except ValueError:
                ui.show_error("Invalid input. Please enter a number.")
                continue

    except Exception as e:
        if isinstance(e, (RequirementsError, NetworkError, InstallationError)):
            ui.show_error(str(e))
        else:
            helper._log_error(f"Unexpected error: {str(e)}")
            ui.show_error(f"An unexpected error occurred: {str(e)}", show_exception=args.debug)

if __name__ == "__main__":
    main()