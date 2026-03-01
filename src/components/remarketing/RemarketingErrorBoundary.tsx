import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertCircle } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallbackMessage?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class RemarketingErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Errors are intentionally not logged to the console here.
    // In production, this would be sent to an error reporting service.
    void errorInfo;
    void error;
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-6">
          <Card>
            <CardContent className="py-12 text-center space-y-4">
              <AlertCircle className="mx-auto h-12 w-12 text-destructive" />
              <h3 className="font-semibold text-lg">
                {this.props.fallbackMessage || 'Something went wrong'}
              </h3>
              <p className="text-muted-foreground text-sm max-w-md mx-auto">
                An unexpected error occurred while rendering this page. Please try again or contact
                support if the problem persists.
              </p>
              <div className="flex justify-center gap-3">
                <Button variant="outline" onClick={this.handleReset}>
                  Try Again
                </Button>
                <Button variant="default" onClick={() => window.location.reload()}>
                  Reload Page
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}

export default RemarketingErrorBoundary;
