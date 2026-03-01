/**
 * Re-usable React Error Boundary component.
 *
 * Catches render-phase errors, displays a friendly fallback UI with a
 * "Try Again" button, and reports the error via the structured error
 * reporting utility.
 */

import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import { AppError, createErrorReport, formatErrorMessage } from '@/lib/error-boundary';
import { logger } from '@/lib/logger';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ResilientErrorBoundaryProps {
  children: ReactNode;
  /** Custom fallback UI — receives the error and a reset callback. */
  fallback?: (props: { error: Error; reset: () => void }) => ReactNode;
  /** Called when an error is caught (after internal reporting). */
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  /** Label for logging/reporting purposes. */
  componentName?: string;
  /** Show the raw error message in a collapsible details section. */
  showDetails?: boolean;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  retryCount: number;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export class ResilientErrorBoundary extends Component<ResilientErrorBoundaryProps, State> {
  static readonly MAX_RETRIES = 3;

  constructor(props: ResilientErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: 0,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    this.setState({ errorInfo });

    // Structured reporting
    const appError = AppError.from(error, {
      component: this.props.componentName ?? 'Unknown',
      operation: 'render',
      metadata: {
        componentStack: errorInfo.componentStack,
        retryCount: this.state.retryCount,
      },
    });

    const report = createErrorReport(appError);
    logger.error(
      `ErrorBoundary caught: ${report.message}`,
      this.props.componentName ?? 'ResilientErrorBoundary',
      { report },
    );

    // Notify parent
    this.props.onError?.(error, errorInfo);
  }

  /** Reset the boundary so children can re-render. */
  private handleReset = (): void => {
    const nextRetry = this.state.retryCount + 1;

    if (nextRetry > ResilientErrorBoundary.MAX_RETRIES) {
      // Too many resets — redirect home
      window.location.href = '/';
      return;
    }

    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: nextRetry,
    });
  };

  private handleGoHome = (): void => {
    window.location.href = '/';
  };

  private handleRefresh = (): void => {
    window.location.reload();
  };

  render(): ReactNode {
    if (!this.state.hasError) {
      return this.props.children;
    }

    // If a custom fallback was provided, use it
    if (this.props.fallback && this.state.error) {
      return this.props.fallback({
        error: this.state.error,
        reset: this.handleReset,
      });
    }

    const userMessage = this.state.error
      ? formatErrorMessage(this.state.error)
      : 'An unexpected error occurred.';

    const canRetry = this.state.retryCount < ResilientErrorBoundary.MAX_RETRIES;

    return (
      <div className="min-h-[300px] flex items-center justify-center p-6">
        <Card className="w-full max-w-lg shadow-lg">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 p-3 bg-red-100 dark:bg-red-900 rounded-full w-fit">
              <AlertTriangle className="h-8 w-8 text-red-600 dark:text-red-400" />
            </div>
            <CardTitle className="text-xl font-bold text-red-900 dark:text-red-100">
              Something went wrong
            </CardTitle>
          </CardHeader>

          <CardContent className="space-y-4">
            <Alert className="border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950">
              <AlertDescription className="text-red-800 dark:text-red-200">
                {userMessage}
              </AlertDescription>
            </Alert>

            {this.props.showDetails && this.state.error && (
              <details className="text-sm">
                <summary className="cursor-pointer font-medium text-muted-foreground hover:text-foreground">
                  Technical Details
                </summary>
                <div className="mt-2 p-3 bg-muted rounded-lg overflow-auto max-h-40">
                  <p className="font-mono text-xs break-all">{this.state.error.message}</p>
                </div>
              </details>
            )}

            <div className="flex flex-col sm:flex-row gap-2">
              <Button
                onClick={this.handleReset}
                className="flex-1 flex items-center gap-2"
                disabled={!canRetry}
              >
                <RefreshCw className="h-4 w-4" />
                {canRetry ? 'Try Again' : 'Max Retries Reached'}
              </Button>

              <Button
                variant="outline"
                onClick={this.handleGoHome}
                className="flex-1 flex items-center gap-2"
              >
                <Home className="h-4 w-4" />
                Go Home
              </Button>
            </div>

            <Button variant="ghost" onClick={this.handleRefresh} className="w-full text-sm">
              Refresh Page
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }
}

export default ResilientErrorBoundary;
