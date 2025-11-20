/**
 * Design System for Investment-Grade Listing Editor
 * Inspired by Linear, Stripe Dashboard, Apple Settings
 */

export const EDITOR_DESIGN = {
  // Layout & Spacing
  maxWidth: 'max-w-[1600px]',
  contentPadding: 'px-10 py-8',
  cardSpacing: 'gap-6',
  cardPadding: 'p-6',
  sectionSpacing: 'space-y-4',
  fieldSpacing: 'space-y-3',
  compactFieldSpacing: 'space-y-1.5',
  microFieldSpacing: 'space-y-1',
  
  // Typography
  microHeader: 'text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70',
  microLabel: 'text-[10px] text-muted-foreground/70 uppercase tracking-wide',
  fieldLabel: 'text-sm font-medium text-foreground',
  compactLabel: 'text-xs font-medium text-muted-foreground',
  helperText: 'text-xs text-muted-foreground/60',
  inputText: 'text-sm',
  compactInputText: 'text-xs',
  
  // Input Sizes
  largeHeight: 'h-11',
  standardHeight: 'h-10',
  compactHeight: 'h-9',
  miniHeight: 'h-8',
  microHeight: 'h-7',
  
  // Borders & Backgrounds
  cardBg: 'bg-slate-50/40',
  cardBorder: 'border border-border/40',
  inputBg: 'bg-white/50',
  inputBorder: 'border border-border/40',
  dashedBorder: 'border-0 border-b border-dashed border-border/50',
  subtleDivider: 'border-t border-border/30',
  topBarBorder: 'border-b border-border/40',
  
  // Interactive States
  transition: 'transition-all duration-150 ease-in-out',
  hoverTransition: 'transition-colors duration-100',
  focusRing: 'focus:ring-2 focus:ring-primary/20 focus:border-primary',
  hoverBorder: 'hover:border-primary/40',
  
  // Component Variants
  toggleButton: 'px-2 py-0.5 rounded text-[11px] transition-all',
  toggleButtonActive: 'bg-foreground/10 font-medium text-foreground',
  toggleButtonInactive: 'text-muted-foreground/60 hover:text-foreground hover:bg-foreground/5',
  
  chipCheckbox: 'inline-flex items-center gap-1.5 px-2 py-1 rounded border border-border/40 bg-white/50 text-xs cursor-pointer hover:border-primary/40 transition-colors',
  
  // Aspect Ratios
  wideImageAspect: 'aspect-[21/9]',
  standardImageAspect: 'aspect-video',
} as const;
