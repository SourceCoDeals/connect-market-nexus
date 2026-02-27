import { Skeleton } from '@/components/ui/skeleton';
import { Activity, Shield, FileSignature, Bell, CheckCircle2, Clock, Info } from 'lucide-react';
import { useConnectionMessages } from '@/hooks/use-connection-messages';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';

interface DealActivityLogProps {
  requestId: string;
  requestStatus: 'pending' | 'approved' | 'rejected' | 'on_hold';
}

function getActivityIcon(body: string) {
  const lower = body.toLowerCase();
  if (lower.includes('nda') || lower.includes('non-disclosure')) return Shield;
  if (lower.includes('fee agreement') || lower.includes('signed')) return FileSignature;
  if (lower.includes('approved') || lower.includes('selected') || lower.includes('accepted')) return CheckCircle2;
  if (lower.includes('pending') || lower.includes('review')) return Clock;
  return Bell;
}

function getActivityColor(body: string) {
  const lower = body.toLowerCase();
  if (lower.includes('approved') || lower.includes('selected') || lower.includes('signed') || lower.includes('accepted')) return 'text-emerald-600 bg-emerald-50';
  if (lower.includes('rejected') || lower.includes('declined') || lower.includes('not selected')) return 'text-slate-500 bg-slate-50';
  if (lower.includes('nda') || lower.includes('fee agreement')) return 'text-amber-600 bg-amber-50';
  return 'text-blue-600 bg-blue-50';
}

export function DealActivityLog({ requestId, requestStatus }: DealActivityLogProps) {
  const { data: allMessages = [], isLoading } = useConnectionMessages(requestId);

  // Filter to only system/decision messages
  const systemMessages = allMessages.filter(
    (msg) => msg.message_type === 'system' || msg.message_type === 'decision'
  );

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      <div className="px-5 py-3.5 border-b border-slate-100 flex items-center gap-2">
        <Activity className="h-4 w-4 text-slate-500" />
        <h3 className="text-sm font-semibold text-slate-900">Activity Log</h3>
        {systemMessages.length > 0 && (
          <span className="text-xs text-slate-400">{systemMessages.length}</span>
        )}
      </div>

      <div className="min-h-[200px] max-h-[500px] overflow-y-auto">
        {isLoading ? (
          <div className="p-5 space-y-3">
            <Skeleton className="h-12 w-full rounded-lg" />
            <Skeleton className="h-12 w-full rounded-lg" />
            <Skeleton className="h-12 w-3/4 rounded-lg" />
          </div>
        ) : systemMessages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-6">
            <div className="rounded-full bg-slate-100 p-3 mb-3">
              <Info className="h-5 w-5 text-slate-400" />
            </div>
            <p className="text-sm font-medium text-slate-700 mb-1">No activity yet</p>
            <p className="text-xs text-slate-500 text-center max-w-xs">
              System notifications like agreement requests, status changes, and deal updates will appear here.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {systemMessages.map((msg) => {
              const Icon = getActivityIcon(msg.body);
              const colorClass = getActivityColor(msg.body);
              return (
                <div key={msg.id} className="flex items-start gap-3 px-5 py-3">
                  <div className={cn('flex h-7 w-7 shrink-0 items-center justify-center rounded-full', colorClass)}>
                    <Icon className="h-3.5 w-3.5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-700 leading-relaxed">{msg.body}</p>
                    <span className="text-[10px] text-slate-400 mt-0.5 block">
                      {formatDistanceToNow(new Date(msg.created_at), { addSuffix: true })}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
