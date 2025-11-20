/**
 * Design System Constants for Investment-Grade Editor
 * Apple/Stripe level sophistication - consistent spacing, typography, and styling
 */

export const EDITOR_DESIGN = {
  // Spacing
  sectionSpacing: 'space-y-6',
  fieldSpacing: 'gap-3',
  compactFieldSpacing: 'gap-2',
  
  // Typography
  sectionHeader: 'text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/80',
  fieldLabel: 'text-sm font-medium text-foreground',
  helperText: 'text-[11px] text-muted-foreground/70',
  compactLabel: 'text-xs font-medium text-muted-foreground/80',
  
  // Input sizes
  standardHeight: 'h-10',
  compactHeight: 'h-9',
  miniHeight: 'h-8',
  
  // Borders
  sectionBorder: 'pb-4 mb-6 border-b border-border/50',
  divider: 'border-t border-border/50',
  subtleBorder: 'border-border/60',
  
  // Transitions
  transition: 'transition-all duration-200 ease-in-out',
  hoverTransition: 'transition-colors duration-150',
  
  // Backgrounds
  mutedBg: 'bg-muted/30',
  subtleBg: 'bg-slate-50/30 dark:bg-slate-900/30',
  
  // Focus states
  focusRing: 'focus:border-primary focus:ring-1 focus:ring-primary/10',
} as const;
