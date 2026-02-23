import { Skeleton } from "@/components/ui/skeleton";
import { Inbox } from "lucide-react";

// ─── Skeleton Loading State ───

export function MessageCenterSkeleton() {
  return (
    <div className="border border-border rounded-xl overflow-hidden bg-card h-full">
      <div className="p-6 space-y-4">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex items-start gap-4">
            <Skeleton className="h-8 w-8 rounded-full" />
            <div className="space-y-2 flex-1">
              <Skeleton className="h-4 w-[200px]" />
              <Skeleton className="h-3 w-[300px]" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Empty State ───

export function MessageCenterEmpty() {
  return (
    <div className="border border-border rounded-xl overflow-hidden bg-card h-full flex items-center justify-center">
      <div className="text-center py-16">
        <Inbox className="h-16 w-16 text-muted-foreground/20 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-foreground mb-1">No conversations yet</h3>
        <p className="text-sm text-muted-foreground max-w-xs mx-auto">
          Messages will appear here when buyers start conversations through connection requests.
        </p>
      </div>
    </div>
  );
}
