// import { createIconComponent } from './IconFactory' <-- Broken atm
export { default as Icon } from './Icon'
export type { IconProps, IconSize, IconVariant, IconName } from './Icon'

// Re-export all icons by category for convenience
import * as OutlineIcons from './ui/outline'
import * as BoldIcons from './ui/bold'
import * as BrandIcons from './brands'

export { OutlineIcons, BoldIcons, BrandIcons }

// Export individual icon names as constants
// UI icons
export const arrowUp = 'ArrowUp'
export const check = 'Check'
export const close = 'Close'
export const controller = 'Controller'
export const copy = 'Copy'
export const download = 'Download'
export const download1 = 'Download1'
export const edit = 'Edit'
export const error = 'Error'
export const info = 'Info'
export const layers = 'Layers'
export const refresh = 'Refresh'
export const search = 'Search'
export const trash = 'Trash'
export const warning = 'Warning'
export const wine = 'Wine'
export const diamond = 'Diamond'

// Brand icons
export const discord = 'Discord'
export const github = 'GitHub'
export const linux = 'Linux'
export const proton = 'Proton'
export const steam = 'Steam'
export const windows = 'Windows'

// Keep the IconNames object for backward compatibility and autocompletion
export const IconNames = {
  // UI icons
  ArrowUp: arrowUp,
  Check: check,
  Close: close,
  Controller: controller,
  Copy: copy,
  Download: download,
  Download1: download1,
  Edit: edit,
  Error: error,
  Info: info,
  Layers: layers,
  Refresh: refresh,
  Search: search,
  Trash: trash,
  Warning: warning,
  Wine: wine,
  Diamond: diamond,

  // Brand icons
  Discord: discord,
  GitHub: github,
  Linux: linux,
  Proton: proton,
  Steam: steam,
  Windows: windows,
} as const

// Export direct icon components using createIconComponent from IconFactory
// UI icons (outline variant by default)
//export const ArrowUpIcon = createIconComponent(arrowUp, 'outline')
//export const CheckIcon = createIconComponent(check, 'outline')
//export const CloseIcon = createIconComponent(close, 'outline')
//export const ControllerIcon = createIconComponent(controller, 'outline')
//export const CopyIcon = createIconComponent(copy, 'outline')
//export const DownloadIcon = createIconComponent(download, 'outline')
//export const Download1Icon = createIconComponent(download1, 'outline')
//export const EditIcon = createIconComponent(edit, 'outline')
//export const ErrorIcon = createIconComponent(error, 'outline')
//export const InfoIcon = createIconComponent(info, 'outline')
//export const LayersIcon = createIconComponent(layers, 'outline')
//export const RefreshIcon = createIconComponent(refresh, 'outline')
//export const SearchIcon = createIconComponent(search, 'outline')
//export const TrashIcon = createIconComponent(trash, 'outline')
//export const WarningIcon = createIconComponent(warning, 'outline')
//export const WineIcon = createIconComponent(wine, 'outline')

// Brand icons
//export const DiscordIcon = createIconComponent(discord, 'brand')
//export const GitHubIcon = createIconComponent(github, 'brand')
//export const LinuxIcon = createIconComponent(linux, 'brand')
//export const SteamIcon = createIconComponent(steam, 'brand')
//export const WindowsIcon = createIconComponent(windows, 'brand')

// Bold variants for common icons
//export const CheckBoldIcon = createIconComponent(check, 'bold')
//export const InfoBoldIcon = createIconComponent(info, 'bold')
//export const WarningBoldIcon = createIconComponent(warning, 'bold')
//export const ErrorBoldIcon = createIconComponent(error, 'bold')
