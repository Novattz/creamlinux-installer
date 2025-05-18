# Adding New Icons to Creamlinux

This guide explains how to add new icons to the Creamlinux project.

## Prerequisites

- Basic knowledge of SVG files
- Node.js and npm installed
- Creamlinux project set up

## Step 1: Find or Create SVG Icons

You can:

- Create your own SVG icons using tools like Figma, Sketch, or Illustrator
- Download icons from libraries like Heroicons, Material Icons, or Feather Icons
- Use existing SVG files

Ideally, icons should:

- Be 24x24px or have a viewBox of "0 0 24 24"
- Have a consistent style with existing icons
- Use stroke-width of 2 for outline variants
- Use solid fills for bold variants

## Step 2: Optimize SVG Files

We have a script to optimize SVG files for the icon system:

```bash
# Install dependencies
npm install

# Optimize a single SVG
npm run optimize-svg path/to/icon.svg

# Optimize all SVGs in a directory
npm run optimize-svg src/components/icons/ui/outline
```

The optimizer will:

- Remove unnecessary attributes
- Set the viewBox to "0 0 24 24"
- Add currentColor for fills/strokes for proper color inheritance
- Remove width and height attributes for flexible sizing

## Step 3: Add SVG Files to the Project

1. Decide if your icon is a "bold" (filled) or "outline" (stroked) variant
2. Place the file in the appropriate directory:
   - For outline variants: `src/components/icons/ui/outline/`
   - For bold variants: `src/components/icons/ui/bold/`
3. Use a descriptive name like `download.svg` or `settings.svg`

## Step 4: Export the Icons

1. Open the index.ts file in the respective directory:

   - `src/components/icons/ui/outline/index.ts` for outline variants
   - `src/components/icons/ui/bold/index.ts` for bold variants

2. Add an export statement for your new icon:

```typescript
// For outline variant
export { ReactComponent as NewIconOutlineIcon } from './new-icon.svg'

// For bold variant
export { ReactComponent as NewIconBoldIcon } from './new-icon.svg'
```

Use a consistent naming pattern:

- CamelCase
- Descriptive name
- Suffix with BoldIcon or OutlineIcon based on variant

## Step 5: Use the Icon in Your Components

Now you can use your new icon in any component:

```tsx
import { Icon } from '@/components/icons'
import { NewIconOutlineIcon, NewIconBoldIcon } from '@/components/icons'

// In your component:
<Icon icon={NewIconOutlineIcon} size="md" />
<Icon icon={NewIconBoldIcon} size="lg" fillColor="var(--primary-color)" />
```

## Best Practices

1. **Create both variants**: When possible, create both bold and outline variants for consistency.

2. **Use semantic names**: Name icons based on their meaning, not appearance (e.g., "success" instead of "checkmark").

3. **Be consistent**: Follow the existing icon style for visual harmony.

4. **Test different sizes**: Ensure icons look good at all standard sizes: xs, sm, md, lg, xl.

5. **Optimize manually if needed**: Sometimes automatic optimization may not work perfectly. You might need to manually edit SVG files.

6. **Add accessibility**: When using icons, provide proper accessibility:

```tsx
<Icon icon={InfoOutlineIcon} title="Additional information" size="md" />
```

## Troubleshooting

**Problem**: Icon doesn't change color with CSS
**Solution**: Make sure your SVG uses `currentColor` for fill or stroke

**Problem**: Icon looks pixelated
**Solution**: Ensure your SVG has a proper viewBox attribute

**Problem**: Icon sizing is inconsistent
**Solution**: Use the standard size props (xs, sm, md, lg, xl) instead of custom sizes

**Problem**: SVG has complex gradients or effects that don't render correctly
**Solution**: Simplify the SVG design; complex effects aren't ideal for UI icons

## Additional Resources

- [SVGR documentation](https://react-svgr.com/docs/what-is-svgr/)
- [SVGO documentation](https://github.com/svg/svgo)
- [SVG MDN documentation](https://developer.mozilla.org/en-US/docs/Web/SVG)
