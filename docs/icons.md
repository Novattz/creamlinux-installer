# Icon Usage Methods

There are two ways to use icons in Creamlinux, both fully supported and completely interchangeable.

## Method 1: Using Icon component with name prop

This approach uses the `Icon` component with a `name` prop:

```tsx
import { Icon, refresh, check, info, steam } from '@/components/icons'

<Icon name={refresh} />
<Icon name={check} variant="bold" />
<Icon name={info} size="lg" fillColor="var(--info)" />
<Icon name={steam} /> {/* Brand icons auto-detect the variant */}
```

## Method 2: Using direct icon components

This approach imports pre-configured icon components directly:

```tsx
import { RefreshIcon, CheckBoldIcon, InfoIcon, SteamIcon } from '@/components/icons'

<RefreshIcon />               {/* Outline variant */}
<CheckBoldIcon />             {/* Bold variant */}
<InfoIcon size="lg" fillColor="var(--info)" />
<SteamIcon />                 {/* Brand icon */}
```

## When to use each method

### Use Method 1 (Icon + name) when:

- You have dynamic icon selection based on data or state
- You want to keep your imports list shorter
- You're working with icons in loops or maps
- You want to change variants dynamically

Example of dynamic icon selection:

```tsx
import { Icon } from '@/components/icons'

function StatusIndicator({ status }) {
  const iconName =
    status === 'success'
      ? 'Check'
      : status === 'warning'
        ? 'Warning'
        : status === 'error'
          ? 'Close'
          : 'Info'

  return <Icon name={iconName} variant="bold" />
}
```

### Use Method 2 (direct components) when:

- You want the most concise syntax
- You're using a fixed set of icons that won't change
- You want specific variants (like InfoBoldIcon vs InfoIcon)
- You prefer more explicit component names in your JSX

Example of fixed icon usage:

```tsx
import { InfoIcon, CloseIcon } from '@/components/icons'

function ModalHeader({ title, onClose }) {
  return (
    <div className="modal-header">
      <div className="title">
        <InfoIcon size="sm" />
        <h3>{title}</h3>
      </div>
      <button onClick={onClose}>
        <CloseIcon size="md" />
      </button>
    </div>
  )
}
```

## Available Icon Component Exports

### UI Icons (Outline variant by default)

```tsx
import {
  ArrowUpIcon,
  CheckIcon,
  CloseIcon,
  ControllerIcon,
  CopyIcon,
  DownloadIcon,
  EditIcon,
  InfoIcon,
  LayersIcon,
  RefreshIcon,
  SearchIcon,
  TrashIcon,
  WarningIcon,
  WineIcon,
} from '@/components/icons'
```

### Bold Variants

```tsx
import { CheckBoldIcon, InfoBoldIcon, WarningBoldIcon } from '@/components/icons'
```

### Brand Icons

```tsx
import { DiscordIcon, GitHubIcon, LinuxIcon, SteamIcon, WindowsIcon } from '@/components/icons'
```

## Combining Methods

Both methods work perfectly together and can be mixed in the same component:

```tsx
import {
  Icon,
  refresh, // Method 1
  CheckBoldIcon, // Method 2
} from '@/components/icons'

function MyComponent() {
  return (
    <div>
      <Icon name={refresh} />
      <CheckBoldIcon />
    </div>
  )
}
```

## Props are Identical

Both methods accept the same props:

```tsx
// These are equivalent:
<InfoIcon size="lg" fillColor="blue" className="my-icon" />
<Icon name={info} size="lg" fillColor="blue" className="my-icon" />
```

Available props in both cases:

- `size`: "xs" | "sm" | "md" | "lg" | "xl" | number
- `variant`: "outline" | "bold" | "brand" (only for Icon + name method)
- `fillColor`: CSS color string
- `strokeColor`: CSS color string
- `className`: CSS class string
- `title`: Accessibility title
- ...plus all standard SVG attributes
