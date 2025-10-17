import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground hover:bg-primary/80",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive:
          "border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80",
        outline: "text-foreground",
        success:
          "border-transparent bg-green-100 text-green-800 hover:bg-green-200 dark:bg-green-900 dark:text-green-200",
        // New colorful badge variants for pipeline
        signed: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/25",
        sent: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30 hover:bg-amber-500/25",
        notSent: "bg-slate-500/15 text-slate-600 dark:text-slate-400 border-slate-500/30 hover:bg-slate-500/25",
        pe: "bg-violet-500/15 text-violet-700 dark:text-violet-400 border-violet-500/30 hover:bg-violet-500/25",
        familyOffice: "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30 hover:bg-blue-500/25",
        corporate: "bg-indigo-500/15 text-indigo-700 dark:text-indigo-400 border-indigo-500/30 hover:bg-indigo-500/25",
        searchFund: "bg-cyan-500/15 text-cyan-700 dark:text-cyan-400 border-cyan-500/30 hover:bg-cyan-500/25",
        individual: "bg-slate-500/15 text-slate-600 dark:text-slate-400 border-slate-500/30 hover:bg-slate-500/25",
        marketplace: "bg-cyan-500/15 text-cyan-700 dark:text-cyan-400 border-cyan-500/30 hover:bg-cyan-500/25",
        webflow: "bg-pink-500/15 text-pink-700 dark:text-pink-400 border-pink-500/30 hover:bg-pink-500/25",
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
