/**
 * SidebarCard.tsx
 *
 * A simple card wrapper used in the right sidebar of ConnectionRequestActions.
 * Provides a titled card with a header strip and content area.
 *
 * Extracted from ConnectionRequestActions.tsx
 */
import React from 'react';

interface SidebarCardProps {
  title: string;
  children: React.ReactNode;
}

export function SidebarCard({ title, children }: SidebarCardProps) {
  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
      <div className="px-5 py-3.5 border-b border-border bg-muted/30">
        <h3 className="text-xs font-bold uppercase tracking-[1.2px] text-muted-foreground">
          {title}
        </h3>
      </div>
      <div className="px-5 py-4">{children}</div>
    </div>
  );
}
