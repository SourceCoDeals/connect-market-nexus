import { PipelineShell } from '@/components/admin/pipeline/PipelineShell';
import { ErrorBoundary } from '@/components/ErrorBoundary';

export default function AdminPipeline() {
  return (
    <ErrorBoundary
      fallback={
        <div className="p-8 text-center">
          <h3 className="text-lg font-semibold text-destructive mb-2">Admin Component Error</h3>
          <p className="text-muted-foreground mb-4">
            There was an error in the AdminPipeline component. Please refresh the page or contact
            support if the issue persists.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
          >
            Refresh Page
          </button>
        </div>
      }
    >
      <PipelineShell />
    </ErrorBoundary>
  );
}
