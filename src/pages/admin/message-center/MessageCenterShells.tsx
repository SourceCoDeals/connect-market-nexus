import { Skeleton } from "@/components/ui/skeleton";
import { Inbox } from "lucide-react";

// ─── Skeleton Loading State ───

export function MessageCenterSkeleton() {
  return (
    <div className="rounded-xl overflow-hidden h-full" style={{ border: '2px solid #CBCBCB', backgroundColor: '#FCF9F0' }}>
      <div className="p-6 space-y-4">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex items-start gap-4">
            <Skeleton className="h-8 w-8 rounded-full" style={{ backgroundColor: '#E5DDD0' }} />
            <div className="space-y-2 flex-1">
              <Skeleton className="h-4 w-[200px]" style={{ backgroundColor: '#E5DDD0' }} />
              <Skeleton className="h-3 w-[300px]" style={{ backgroundColor: '#F0EDE4' }} />
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
    <div className="rounded-xl overflow-hidden h-full flex items-center justify-center" style={{ border: '2px solid #CBCBCB', backgroundColor: '#FCF9F0' }}>
      <div className="text-center py-16">
        <Inbox className="h-16 w-16 mx-auto mb-4" style={{ color: '#CBCBCB' }} />
        <h3 className="text-lg font-medium mb-1" style={{ color: '#0E101A' }}>No conversations yet</h3>
        <p className="text-sm max-w-xs mx-auto" style={{ color: '#5A5A5A' }}>
          Messages will appear here when buyers start conversations through connection requests.
        </p>
      </div>
    </div>
  );
}
