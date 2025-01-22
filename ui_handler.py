from rich.console import Console
from rich.panel import Panel
from rich.progress import Progress, SpinnerColumn, TextColumn, BarColumn, TaskProgressColumn
from rich.table import Table
from rich.prompt import Prompt, Confirm
from rich.text import Text
from rich import box

class UIHandler:
    def __init__(self, debug=False):
        self.console = Console()
        self.debug = debug

    def clear_screen(self):
        """Clear the console screen"""
        import os
        os.system('cls' if os.name == 'nt' else 'clear')

    def show_header(self, app_version, debug_mode):
        """Display the application header"""
        self.clear_screen()
        logo = r"""
  _    _ _   _ _      ____   _____ _  ________ _____  
 | |  | | \ | | |    / __ \ / ____| |/ /  ____|  __ \ 
 | |  | |  \| | |   | |  | | |    | ' /| |__  | |__) |
 | |  | | . ` | |   | |  | | |    |  < |  __| |  _  / 
 | |__| | |\  | |___| |__| | |____| . \| |____| | \ \ 
  \____/|_| \_|______\____/ \_____|_|\_\______|_|  \_\\
        """
        
        info_text = f"\n> Made by Tickbase\n> GitHub: https://github.com/Novattz/creamlinux-installer\n> Version: {app_version}"
        
        if debug_mode:
            info_text += "\n[red][Running in DEBUG mode][/red]"
        
        self.console.print(
            Panel.fit(
                Text.from_markup(f"{logo}\n{info_text}"),
                style="cyan",
                border_style="cyan",
                box=box.ROUNDED,
            )
        )

    def show_games_table(self, games_list, selected_idx=None):
        """Display the table of available games"""
        table = Table(show_header=True, header_style="cyan", box=box.ROUNDED)
        table.add_column("#", style="dim")
        table.add_column("Game Name")
        table.add_column("Type", style="dim")
        table.add_column("Status")

        for idx, (app_id, (name, cream_status, _, needs_proton, _, smoke_status)) in enumerate(games_list, 1):
            if needs_proton:
                status = "[green]✓ Smoke installed[/green]" if smoke_status else "[yellow]Not Installed[/yellow]"
            else:
                status = "[green]✓ Cream installed[/green]" if cream_status else "[yellow]Not Installed[/yellow]"
                
            game_type = "[blue]Proton[/blue]" if needs_proton else "[green]Native[/green]"
            
            # Highlight only the game name if selected
            if selected_idx is not None and idx == selected_idx + 1:
                name = f"[bold white on blue]{name}[/bold white on blue]"
            
            table.add_row(
                f"[bold cyan]{idx}[/bold cyan]",
                name,
                game_type,
                status
            )

        self.console.print("\n[cyan]Available Games:[/cyan]")
        self.console.print(table)
        
        if selected_idx is not None:
            # Get selected game details
            _, (game_name, cream_status, install_path, needs_proton, steam_api_files, smoke_status) = games_list[selected_idx]
            if needs_proton:
                status = "[green]✓ Smoke installed[/green]" if smoke_status else "[yellow]Not Installed[/yellow]"
            else:
                status = "[green]✓ Cream installed[/green]" if cream_status else "[yellow]Not Installed[/yellow]"
                
            game_type = "[blue]Proton[/blue]" if needs_proton else "[green]Native[/green]"
            app_id = games_list[selected_idx][0]
            
            # Show footer with selected game info
            self.console.print(f"[dim]Selected: {game_name} (Type: {game_type}) - Status: {status}[/dim]")
            
            # Show Steam API files if present for Proton games
            if needs_proton and steam_api_files:
                self.console.print("\n[cyan]Steam API files found:[/cyan]")
                for api_file in steam_api_files:
                    self.console.print(f"[dim]- {api_file}[/dim]")
            
            # Show options based on game type and status
            self.console.print("\n[cyan]Selected Game Options:[/cyan]")
            options = []
            
            if needs_proton and steam_api_files:
                if smoke_status:
                    options.append("1. Uninstall SmokeAPI")
                    options.append("2. Go Back")
                else:
                    options.append("1. Install SmokeAPI")
                    options.append("2. Go Back")
            else:
                if cream_status:
                    options.append("1. Fetch DLCs")
                    options.append("2. Uninstall CreamLinux")
                    options.append("3. Go Back")
                else:
                    options.append("1. Install CreamLinux")
                    options.append("2. Go Back")
            
            for option in options:
                self.console.print(option)

    def show_dlc_table(self, dlcs):
        """Display the table of available DLCs"""
        table = Table(show_header=True, header_style="cyan", box=box.ROUNDED)
        table.add_column("#", style="dim")
        table.add_column("DLC Name")
        table.add_column("DLC ID", style="dim")

        for idx, dlc in enumerate(dlcs, 1):
            table.add_row(
                f"[bold cyan]{idx}[/bold cyan]",
                dlc['name'],
                str(dlc['appid'])
            )

        self.console.print(Panel.fit(table, title="[bold cyan]📦 Found DLCs[/bold cyan]", border_style="cyan"))

    def create_progress_context(self):
        """Create and return a progress context"""
        return Progress()

    def show_error(self, message, show_exception=False):
        """Display an error message"""
        self.console.print(f"[red]{message}[/red]")
        if show_exception:
            self.console.print_exception()

    def show_warning(self, message):
        """Display a warning message"""
        self.console.print(f"[yellow]{message}[/yellow]")

    def show_success(self, message):
        """Display a success message"""
        self.console.print(f"[green]✓ {message}[/green]")

    def show_info(self, message):
        """Display an info message"""
        self.console.print(f"[cyan]{message}[/cyan]")

    def create_status_context(self, message):
        """Create and return a status context"""
        return self.console.status(f"[cyan]{message}", spinner="dots")

    def get_user_input(self, prompt_message, choices=None):
        """Get user input with optional choices"""
        if choices:
            return Prompt.ask(prompt_message, choices=choices)
        return Prompt.ask(prompt_message)

    def get_user_confirmation(self, message):
        """Get user confirmation"""
        return Confirm.ask(message)

    def show_cream_options(self, game_name):
        """Show CreamLinux options for installed games"""
        self.show_info(f"\nCreamLinux is installed for {game_name}")
        self.console.print("1. Fetch DLC IDs")
        self.console.print("2. Uninstall CreamLinux")

    def show_launch_options(self, game_name):
        """Show launch options after installation"""
        self.console.print("\n[yellow]Steam Launch Options:[/yellow]")
        self.console.print(f"[green]sh ./cream.sh %command%[/green] for {game_name}")

    def show_uninstall_reminder(self):
        """Show reminder about launch options after uninstall"""
        self.console.print("\n[yellow]Remember to remove[/yellow] [green]'sh ./cream.sh %command%'[/green] [yellow]from launch options[/yellow]")