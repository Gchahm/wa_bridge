Create or extend a shadcn/ui component in `src/components/ui/`.

## Process

1. Analyze requirements: variants, sizes, states
2. Choose foundation: Radix UI primitive or from scratch
3. Design props interface with sensible defaults and type-safe variants
4. Implement with CVA (class-variance-authority)
5. Ensure accessibility: ARIA attributes, keyboard navigation, focus management
6. Place in `src/components/ui/` with named exports

## Template

```typescript
import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const componentVariants = cva(
  "base-classes-here",
  {
    variants: {
      variant: {
        default: "variant-classes",
        secondary: "variant-classes",
      },
      size: {
        default: "size-classes",
        sm: "size-classes",
        lg: "size-classes",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ComponentProps
  extends React.HTMLAttributes<HTMLElement>,
    VariantProps<typeof componentVariants> {}

function Component({ className, variant, size, ...props }: ComponentProps) {
  return (
    <element
      data-slot="component"
      className={cn(componentVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Component, componentVariants }
```

## Principles

- **Composition over Configuration**: Smaller composable pieces, not monolithic components
- **Spread Props**: Pass through remaining props for native HTML attributes
- **cn() Utility**: Always merge classNames with `cn()`
- **data-slot**: Add `data-slot` attributes for semantic styling
- Use semantic color tokens: `bg-primary`, `text-muted-foreground`, `border-input`
- Focus states: `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring`
- Disabled states: `disabled:pointer-events-none disabled:opacity-50`
- Transitions: `transition-colors`, `transition-all`

## After creating the component

Run `cd wa-sales && pnpm check && cd /Users/gchahm/dev/gchahm/wa_bridge` to format and lint.
