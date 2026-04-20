/**
 * DashboardErrorBanner.tsx
 *
 * Inline error banner used across the admin dashboards. When a query hook
 * fails, surface this instead of (or above) the content so the page never
 * silently goes blank. Mirrors the banner pattern originally added to the
 * V1 Remarketing dashboard in bde9313.
 */
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface DashboardErrorBannerProps {
  title: string;
  error: Error | null | undefined;
  onRetry?: () => void;
}

export function DashboardErrorBanner({ title, error, onRetry }: DashboardErrorBannerProps) {
  return (
    <div className="rounded-xl border border-red-200 bg-red-50 p-4 flex items-start gap-3">
      <AlertTriangle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-red-800">{title}</p>
        <p className="text-xs text-red-700 mt-1 break-words">
          {error?.message || 'The data query failed. Check RLS policies, migrations, and network.'}
        </p>
      </div>
      {onRetry && (
        <Button
          variant="outline"
          size="sm"
          onClick={onRetry}
          className="shrink-0 border-red-300 text-red-700 hover:bg-red-100"
        >
          <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
          Retry
        </Button>
      )}
    </div>
  );
}
