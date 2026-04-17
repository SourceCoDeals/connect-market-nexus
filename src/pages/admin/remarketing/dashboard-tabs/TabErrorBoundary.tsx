/**
 * TabErrorBoundary.tsx
 *
 * Wraps an individual dashboard tab so one failing hook (RPC error, RLS denial,
 * missing table, etc.) degrades gracefully to an error card instead of
 * crashing the whole dashboard.
 */
import React, { Component, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface TabErrorBoundaryProps {
  children: ReactNode;
  tabLabel: string;
}

interface TabErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class TabErrorBoundary extends Component<TabErrorBoundaryProps, TabErrorBoundaryState> {
  state: TabErrorBoundaryState = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): TabErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error(`[RemarketingDashboard/${this.props.tabLabel}] Tab error:`, error, info);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      const message =
        this.state.error?.message ?? 'An unknown error occurred while loading this tab.';
      return (
        <div className="bg-white rounded-xl border border-red-200 p-8">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-full bg-red-50 text-red-600 flex items-center justify-center shrink-0">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-semibold text-gray-900">
                {this.props.tabLabel} tab failed to load
              </h3>
              <p className="text-xs text-gray-600 mt-1 font-mono break-all">{message}</p>
              <div className="mt-3 flex gap-2">
                <Button size="sm" variant="outline" onClick={this.handleReset} className="gap-2">
                  <RefreshCw className="h-3 w-3" />
                  Retry
                </Button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
