import { Suspense, type ReactNode } from "react";
import { Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { AuthProvider } from "@/context/AuthContext";
import { AnalyticsProvider } from "@/context/AnalyticsContext";
import { TabVisibilityProvider } from "@/context/TabVisibilityContext";
import { NavigationStateProvider } from "@/context/NavigationStateContext";
import SessionTrackingProvider from "@/components/SessionTrackingProvider";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";
import { SimpleToastProvider } from "@/components/ui/simple-toast";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { errorHandler } from "@/lib/error-handler";

import { publicRoutes } from "@/routes/public";
import { buyerRoutes } from "@/routes/buyer";
import { adminRoutes } from "@/routes/admin";
import { maIntelligenceRoutes } from "@/routes/ma-intelligence";

function AppProviders({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <TabVisibilityProvider>
        <NavigationStateProvider>
          <AuthProvider>
            <SessionTrackingProvider>
              <AnalyticsProvider>
                <SimpleToastProvider>
                  {children}
                </SimpleToastProvider>
              </AnalyticsProvider>
            </SessionTrackingProvider>
          </AuthProvider>
        </NavigationStateProvider>
      </TabVisibilityProvider>
    </QueryClientProvider>
  );
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: true,
      staleTime: 15 * 60 * 1000,
      gcTime: 30 * 60 * 1000,
      retry: 3,
      refetchOnReconnect: true,
    },
    mutations: { retry: 1 },
  }
});

function App() {
  return (
    <ErrorBoundary
      onError={(error, errorInfo) => {
        errorHandler(error, {
          component: 'App',
          operation: 'application root',
          metadata: { componentStack: errorInfo.componentStack }
        }, 'critical');
      }}
    >
      <AppProviders>
        <Toaster />
        <SonnerToaster />
        <Suspense fallback={<div className="flex items-center justify-center h-screen"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>}>
          <Routes>
            {publicRoutes()}
            {buyerRoutes()}
            {adminRoutes()}
            {maIntelligenceRoutes()}

            {/* Catch-all */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </AppProviders>
    </ErrorBoundary>
  );
}

function NotFound() {
  return (
    <div className="flex items-center justify-center h-screen bg-background">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-foreground">404 Not Found</h1>
        <p className="text-muted-foreground mt-2">The page you are looking for does not exist.</p>
        <a href="/" className="text-primary mt-4 inline-block">Go back to homepage</a>
      </div>
    </div>
  );
}

export default App;
