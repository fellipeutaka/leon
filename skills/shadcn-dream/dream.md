# Dream shape

The shadcn-dream conventions. A file is in **dream shape** when it follows every rule below. The **dream rewrite** brings a file into dream shape.

The rewrite changes code _shape_ only: imports, exports, prop types, the `cva` call form. Classes, `data-slot` / `data-variant` / `data-size` attributes, `"use client"`, markup, and behavior stay exactly as shadcn wrote them.

## Contents

- [Scope](#scope)
- [The `lib/cva` module](#the-libcva-module)
- [Rules](#rules)
- [Per base](#per-base)
- [Done](#done)

---

## Scope

**Component files** get every rule: the `ui` path from `resolvedPaths`, and any file the CLI writes (blocks, hooks, lib files) or this skill copies in (`assets/showcase/*`).

**Other project files** (app code that uses components) get the import rules only: 1, 2, 3, 8, and the `null` rule in 2. They keep their own export and props style.

---

## The `lib/cva` module

`lib/cva.ts`, at the `lib` path from `resolvedPaths` (imported as `@/lib/cva`, or the project's `lib` alias), is the project's single source of `cva` and `cn`:

```ts
import { cn as merge } from "cn";
import { defineConfig } from "cva/config";

export const { cva, cx: cn } = defineConfig({ cx: merge });
```

`defineConfig` wires the [`cn`](https://www.npmjs.com/package/cn) package in as the concatenator, so every `cva` call and every `cn` call joins conditional classes and resolves Tailwind conflicts in one pass.

Dependencies, in `dependencies` (code imports them at runtime):

- `cva` pinned to the exact `1.0.0-beta.12`, never a range: `cva@beta` is outside semver and its npm `latest` tag is parked at `0.0.0`.
- `cn`.
- TypeScript `>=6` when the project has TypeScript (`cva`'s peer requirement).

`class-variance-authority`, `clsx`, and `tailwind-merge` have no place in a dream project, and neither does a `lib/utils.ts` that only exports `cn`.

---

## Rules

### 1. `cn` and `cva` come from `lib/cva`

Every `cn` import points at the `lib/cva` module, whatever the CLI wrote (`"cn"`, `@/lib/utils`, the `aliases.utils` path). `cva` comes from the same module. Types (`VariantProps`, `ClassValue`) are type imports from the `cva` package root.

**Incorrect:**

```tsx
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"
```

**Correct:**

```tsx
import { cn, cva } from "@/lib/cva";
import type { VariantProps } from "cva";
```

### 2. `cva` takes one config object

The base classes move into the `base` key. A base-only call becomes `cva({ base: "..." })`: a single-argument `cva("...")` type-checks yet renders nothing, so rewrite every `cva(` call rather than trusting the typechecker.

**Incorrect:**

```tsx
const badgeVariants = cva("inline-flex items-center", {
  variants: { variant: { default: "bg-primary" } },
  defaultVariants: { variant: "default" },
})
```

**Correct:**

```tsx
export const badgeVariants = cva({
  base: "inline-flex items-center",
  variants: { variant: { default: "bg-primary" } },
  defaultVariants: { variant: "default" },
});
```

`null` disables nothing anymore: as a prop, a `defaultVariants` value, or a `compoundVariants` selector it is rejected. Declare an explicit option and pass it instead:

```tsx
variants: { size: { unset: null, sm: "h-8" } }

buttonVariants({ size: "unset" }) // was: buttonVariants({ size: null })
```

### 3. Variant functions receive `className`

The `cva` from `lib/cva` already merges through `cn`, so pass `className` (or extra classes) into the variant call and drop the outer `cn`.

**Incorrect:**

```tsx
className={cn(buttonVariants({ variant, size, className }))}
className={cn(toggleVariants({ variant, size }), className)}
className={cn(buttonVariants({ variant: "ghost" }), "size-7 p-0")}
```

**Correct:**

```tsx
className={buttonVariants({ variant, size, className })}
className={toggleVariants({ variant, size, className })}
className={buttonVariants({ variant: "ghost", className: "size-7 p-0" })}
```

### 4. Export at the declaration

Every component, variants object, and props interface carries `export` where it is declared. The trailing `export { ... }` block goes away. Internal helpers (contexts, `useX` hooks, constants) keep the visibility shadcn gave them.

**Incorrect:**

```tsx
function Card({ className, ...props }: React.ComponentProps<"div">) { ... }

export { Card }
```

**Correct:**

```tsx
export interface CardProps extends React.ComponentProps<"div"> {}

export function Card({ className, ...props }: CardProps) { ... }
```

### 5. Every component has an exported `<Name>Props` interface

Declared directly above the component. Each member of an inline intersection becomes one `extends` entry; the inline object literal becomes the interface body. Use `type` only when the shape is a union (e.g. `ChartConfig`), since interfaces cannot extend unions.

**Incorrect:**

```tsx
function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
```

**Correct:**

```tsx
export interface ButtonProps
  extends React.ComponentProps<"button">,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: ButtonProps) {
```

When an imported primitive type already uses the name (`ButtonProps` from `react-aria-components`), alias the import: `type ButtonProps as ButtonPrimitiveProps`.

### 6. React types come from the global `React` namespace

No `import * as React` or `import type * as React`. Type positions keep `React.ComponentProps`, `React.ReactNode`, and friends through the global namespace. Runtime APIs become named imports.

**Incorrect:**

```tsx
import * as React from "react"

const CarouselContext = React.createContext<CarouselContextProps | null>(null)
const [api, setApi] = React.useState<CarouselApi>()
```

**Correct:**

```tsx
import { createContext, useState } from "react";

const CarouselContext = createContext<CarouselContextProps | null>(null);
const [api, setApi] = useState<CarouselApi>();
```

`<React.Fragment>` becomes `<Fragment>` (named import) or `<>` when it has no `key`.

### 7. Third-party modules use named imports

Namespace imports of helper libraries become named imports of what the file uses.

**Incorrect:**

```tsx
import * as RechartsPrimitive from "recharts"
import * as ResizablePrimitive from "react-resizable-panels"
```

**Correct:**

```tsx
import { Legend, type LegendProps, ResponsiveContainer, Tooltip } from "recharts";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
```

Primitive-library imports stay as shadcn writes them: `import { Dialog as DialogPrimitive } from "radix-ui"`, `import { Dialog as DialogPrimitive } from "@base-ui/react/dialog"`, named imports from `react-aria-components`.

### 8. Radix imports come from `radix-ui`

When a Radix-base file imports any `@radix-ui/react-*` package, run the CLI migration instead of editing imports by hand, then continue the rewrite on the result:

```bash
npx shadcn@latest migrate radix
```

It rewrites `import * as AlertDialogPrimitive from "@radix-ui/react-alert-dialog"` to `import { AlertDialog as AlertDialogPrimitive } from "radix-ui"` across the `ui` directory and installs `radix-ui`. It only touches files present when it runs: run it again after every `add` that brings `@radix-ui/react-*` imports back.

### 9. Global CSS carries the dream base layer

The `@layer base` block in `tailwindCssFile` includes these rules, merged into whatever shadcn generated (shadcn's own rules stay):

```css
@layer base {
  html {
    scroll-behavior: smooth;

    scrollbar-color: var(--color-border) transparent;
    scrollbar-width: thin;

    &.light {
      color-scheme: light;
    }

    &.dark {
      color-scheme: dark;
    }
  }

  body {
    font-synthesis-weight: none;
    text-rendering: optimizeLegibility;

    @apply antialiased;
  }
}
```

`init`, `apply`, and preset switches regenerate `tailwindCssFile`: re-check this block after each.

---

## Per base

The `base` field from `npx shadcn@latest info` decides the primitive library. These are the shapes the props interface takes.

| `base`  | Library                 | Primitive props                                                                     | Custom element                            |
| ------- | ----------------------- | ----------------------------------------------------------------------------------- | ----------------------------------------- |
| `base`  | `@base-ui/react`        | `extends ButtonPrimitive.Props` / `extends useRender.ComponentProps<"span">`        | `render` prop                             |
| `radix` | `radix-ui`              | `extends React.ComponentProps<typeof DialogPrimitive.Content>`                      | `asChild` + `Slot.Root`                   |
| `aria`  | `react-aria-components` | `extends Omit<ButtonPrimitiveProps, "className">, React.RefAttributes<HTMLButtonElement>` plus `className?: string` in the body | render-prop children / `composeRenderProps` |

React Aria components often accept `className` as a function of render state. Keep whatever `composeRenderProps` / `className` handling shadcn wrote; rule 3 applies only where the file calls a `cva` variants function with a string `className`.

---

## Done

A rewrite is done when all of these hold:

1. `node <skill-dir>/scripts/dream-audit.mjs <path>...` over every component file prints no violations and exits `0`. For other project files, add `--rules 1,2,3,8`. The script checks rules 1–8 mechanically; it cannot see `null` variant props (rule 2) or the CSS block (rule 9), so check those by reading.
2. The project's typecheck passes.
3. The project's lint/format script passes (a dream project runs Biome with sorted classes for `cva`, `cx`, `cn`).
