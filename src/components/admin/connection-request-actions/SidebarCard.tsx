/**
 * SidebarCard.tsx
 *
 * Reusable sidebar card wrapper with a title header.
 */

export function SidebarCard({ title, children }: { title: string; children: React.ReactNode }) {
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
