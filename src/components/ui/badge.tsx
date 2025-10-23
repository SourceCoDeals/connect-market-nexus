import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground hover:bg-primary/80",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive:
          "border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80",
        outline: "text-foreground border-border/60 bg-muted/30",
        success:
          "border-transparent bg-green-100 text-green-800 hover:bg-green-200 dark:bg-green-900 dark:text-green-200",
        signed: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
        sent: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30",
        notSent: "bg-slate-500/15 text-slate-600 dark:text-slate-400 border-slate-500/30",
        subtle: "border-border/40 bg-muted/20 text-muted-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

const Badge = React.forwardRef<HTMLDivElement, BadgeProps>(
  ({ className, variant, ...props }, ref) => {
    return (
      <div ref={ref} className={cn(badgeVariants({ variant }), className)} {...props} />
    )
  }
)
Badge.displayName = "Badge"

export { Badge, badgeVariants }
