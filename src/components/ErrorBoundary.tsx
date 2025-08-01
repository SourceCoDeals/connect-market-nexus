import React, { Component, ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
  showDetails?: boolean;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
  retryCount: number;
}

export class ErrorBoundary extends Component<Props, State> {
  private retryTimeouts: NodeJS.Timeout[] = [];

  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: 0,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('🚨 Error Boundary caught an error:', error, errorInfo);
    
    this.setState({
      error,
      errorInfo,
    });

    // Call optional error handler
    this.props.onError?.(error, errorInfo);

    // Log to external service if needed
    this.logErrorToService(error, errorInfo);
  }

  componentWillUnmount() {
    // Clean up any pending timeouts
    this.retryTimeouts.forEach(timeout => clearTimeout(timeout));
  }

  private logErrorToService = (error: Error, errorInfo: React.ErrorInfo) => {
    try {
      // In a real app, you'd send this to an error tracking service
      const errorData = {
        message: error.message,
        stack: error.stack,
        componentStack: errorInfo.componentStack,
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent,
        url: window.location.href,
      };
      
      console.error('📊 Error logged:', errorData);
    } catch (loggingError) {
      console.error('❌ Failed to log error:', loggingError);
    }
  };

  private handleRetry = () => {
    const { retryCount } = this.state;
    const maxRetries = 3;
    const backoffDelay = Math.min(1000 * Math.pow(2, retryCount), 10000); // Exponential backoff, max 10s

    if (retryCount >= maxRetries) {
      console.warn('⚠️ Max retries reached, redirecting to home');
      window.location.href = '/';
      return;
    }

    // Development only: Retry error recovery attempt logging

    const timeout = setTimeout(() => {
      this.setState({
        hasError: false,
        error: null,
        errorInfo: null,
        retryCount: retryCount + 1,
      });
    }, backoffDelay);

    this.retryTimeouts.push(timeout);
  };

  private handleGoHome = () => {
    window.location.href = '/';
  };

  private handleRefresh = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default error UI
      return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-red-50 to-red-100 dark:from-red-950 dark:to-red-900">
          <Card className="w-full max-w-lg shadow-lg">
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 p-3 bg-red-100 dark:bg-red-900 rounded-full w-fit">
                <AlertTriangle className="h-8 w-8 text-red-600 dark:text-red-400" />
              </div>
              <CardTitle className="text-xl font-bold text-red-900 dark:text-red-100">
                Oops! Something went wrong
              </CardTitle>
            </CardHeader>
            
            <CardContent className="space-y-4">
              <Alert className="border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950">
                <AlertDescription className="text-red-800 dark:text-red-200">
                  We've encountered an unexpected error. Don't worry - your data is safe and we're working to fix this.
                </AlertDescription>
              </Alert>

              {this.props.showDetails && this.state.error && (
                <details className="text-sm">
                  <summary className="cursor-pointer font-medium text-muted-foreground hover:text-foreground">
                    Technical Details
                  </summary>
                  <div className="mt-2 p-3 bg-muted rounded-lg">
                    <p className="font-mono text-xs break-all">
                      {this.state.error.message}
                    </p>
                  </div>
                </details>
              )}

              <div className="flex flex-col sm:flex-row gap-2">
                <Button 
                  onClick={this.handleRetry}
                  className="flex-1 flex items-center gap-2"
                  disabled={this.state.retryCount >= 3}
                >
                  <RefreshCw className="h-4 w-4" />
                  {this.state.retryCount >= 3 ? 'Max Retries Reached' : 'Try Again'}
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

              <Button 
                variant="ghost" 
                onClick={this.handleRefresh}
                className="w-full text-sm"
              >
                Refresh Page
              </Button>
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}