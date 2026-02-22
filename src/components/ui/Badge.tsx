import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center justify-center rounded-full border px-3 py-1 text-xs font-semibold w-fit whitespace-nowrap shrink-0 [&>svg]:size-3 gap-1.5 [&>svg]:pointer-events-none transition-all duration-200 overflow-hidden",
  {
    variants: {
      variant: {
        default: "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800",
        secondary: "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700",
        destructive: "bg-red-100 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800",
        outline: "border-2 border-slate-300 text-slate-700 dark:border-slate-600 dark:text-slate-300",
        ghost: "border-transparent text-slate-700 dark:text-slate-300",
        link: "text-blue-600 underline-offset-4 dark:text-blue-400",

        // Add status variants with modern gradients
        success: "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800",
        warning: "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800",
        danger: "bg-red-100 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800",
        info: "bg-sky-100 text-sky-700 border-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-800",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

// Dot color mapping based on variant
const dotColors = {
  default: "bg-primary-foreground",
  secondary: "bg-secondary-foreground",
  destructive: "bg-white",
  outline: "bg-foreground",
  ghost: "bg-foreground",
  link: "bg-primary",
  success: "bg-emerald-700 dark:bg-emerald-400",
  warning: "bg-amber-700 dark:bg-amber-400",
  danger: "bg-red-700 dark:bg-red-400",
  info: "bg-sky-700 dark:bg-sky-400",
}

interface BadgeProps extends React.ComponentProps<"span">, VariantProps<typeof badgeVariants> {
  asChild?: boolean
  dot?: boolean
  dotClassName?: string
}

function Badge({
  className,
  variant = "default",
  asChild = false,
  dot = false,
  dotClassName,
  children,
  ...props
}: BadgeProps) {
  const Comp = asChild ? Slot.Root : "span"

  return (
    <Comp
      data-slot="badge"
      data-variant={variant}
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    >
      {dot && (
        <span 
          className={cn(
            "inline-block w-1.5 h-1.5 rounded-full",
            dotColors[variant as keyof typeof dotColors] || "bg-current",
            dotClassName
          )} 
          aria-hidden="true"
        />
      )}
      {children}
    </Comp>
  )
}

export { Badge, badgeVariants }