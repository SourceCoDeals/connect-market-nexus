import React from 'react';
import { ProductionErrorBoundary } from '@/components/ProductionErrorBoundary';
import { useProductionErrorHandler } from '@/hooks/use-production-error-handler';

interface AdminRequestsWrapperProps {
  children: React.ReactNode;
}

export const AdminRequestsWrapper: React.FC<AdminRequestsWrapperProps> = ({ children }) => {
  const { handleError } = useProductionErrorHandler('AdminRequestsWrapper');

  const fallback = (
    <div className="flex flex-col items-center justify-center p-8 text-center">
      <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-6 max-w-md">
        <h3 className="text-lg font-semibold text-destructive mb-2">
          Admin Dashboard Error
        </h3>
        <p className="text-sm text-muted-foreground mb-4">
          Something went wrong loading the admin requests. Please refresh the page or contact support if the issue persists.
        </p>
        <button 
          onClick={() => window.location.reload()} 
          className="bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm hover:bg-primary/90 transition-colors"
        >
          Refresh Page
        </button>
      </div>
    </div>
  );

  return (
    <ProductionErrorBoundary
      component="AdminRequests"
      errorType="admin"
      severity="high"
      fallback={fallback}
      onError={(error, errorInfo) => {
        handleError(error, 'admin dashboard rendering', 'high', {
          componentStack: errorInfo.componentStack
        });
      }}
    >
      {children}
    </ProductionErrorBoundary>
  );
};