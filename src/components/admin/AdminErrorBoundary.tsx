import { AdminErrorBoundary as ProductionAdminErrorBoundary } from "@/components/ProductionErrorBoundary";

interface AdminErrorBoundaryProps {
  children: React.ReactNode;
  component: string;
  fallback?: React.ReactNode;
}

/**
 * Specialized error boundary for admin components
 * Automatically handles admin-specific error classification and reporting
 */
export function AdminErrorBoundary({ children, component, fallback }: AdminErrorBoundaryProps) {
  const defaultFallback = (
    <div className="p-8 text-center">
      <h3 className="text-lg font-semibold text-destructive mb-2">Admin Component Error</h3>
      <p className="text-muted-foreground mb-4">
        There was an error in the {component} component. Please refresh the page or contact support if the issue persists.
      </p>
      <button 
        onClick={() => window.location.reload()} 
        className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
      >
        Refresh Page
      </button>
    </div>
  );

  return (
    <ProductionAdminErrorBoundary
      component={component}
      fallback={fallback || defaultFallback}
      severity="high"
    >
      {children}
    </ProductionAdminErrorBoundary>
  );
}